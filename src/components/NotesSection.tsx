import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Calendar, Copy, Check, KeyRound, X, CloudOff, Loader2 } from 'lucide-react';
import { db, generateUUID } from '../supabaseClient';

interface Note {
  id: string;
  texto: string;
  created_at: string; // Formato ISO
  /** Texto pronto para copiar com um toque (ex.: chave PIX). */
  copiavel?: string | null;
}

/** Onde as notas viviam antes de irem para a tabela `notas`. */
const LEGADO_KEY = 'debt_calculator_notes';

const lerLegado = (): Note[] => {
  try {
    return JSON.parse(localStorage.getItem(LEGADO_KEY) || '[]');
  } catch {
    return [];
  }
};

const gravarLegado = (notas: Note[]) => {
  try {
    localStorage.setItem(LEGADO_KEY, JSON.stringify(notas));
  } catch {
    // Sem armazenamento local, não há onde guardar.
  }
};

const maisRecentesPrimeiro = (notas: Note[]) => [...notas].sort((a, b) => b.created_at.localeCompare(a.created_at));

/** 'ok' = banco respondeu; 'local' = tabela indisponível, notas só neste navegador. */
type Origem = 'carregando' | 'ok' | 'local';

/**
 * Lê as notas do banco e, uma única vez, sobe as que só existiam neste
 * navegador. A cópia local só é apagada depois que o banco confirma a gravação.
 */
async function carregarNotas(): Promise<{ notas: Note[]; origem: Origem }> {
  const legado = lerLegado();
  try {
    const { data, error } = await db.from('notas').select('*');
    if (error) throw error;
    const doBanco = (data || []) as Note[];

    const pendentes = legado.filter((n) => !doBanco.some((b) => b.id === n.id));
    if (pendentes.length > 0) {
      const linhas = pendentes.map((n) => ({
        id: n.id,
        created_at: n.created_at,
        texto: n.texto ?? '',
        copiavel: n.copiavel || null,
      }));
      const { error: erroMigracao } = await db.from('notas').insert(linhas);
      if (erroMigracao) throw erroMigracao;
      doBanco.push(...linhas);
    }
    if (legado.length > 0) localStorage.removeItem(LEGADO_KEY);

    return { notas: maisRecentesPrimeiro(doBanco), origem: 'ok' };
  } catch (err) {
    console.error('Notas: banco indisponível, usando as notas deste navegador.', err);
    return { notas: maisRecentesPrimeiro(legado), origem: 'local' };
  }
}

// Em modo estrito o React monta o efeito duas vezes; as duas montagens
// compartilham a mesma carga, para a migração não subir as notas em dobro.
let cargaEmCurso: ReturnType<typeof carregarNotas> | null = null;

/**
 * Copia para a área de transferência. A API moderna exige contexto seguro
 * (HTTPS ou localhost); fora dele, cai no método antigo do textarea.
 */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Permissão negada: tenta o método antigo abaixo.
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  return ok;
}

function CaixaCopiavel({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  const handleCopiar = async () => {
    if (await copiarTexto(texto)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    }
  };

  return (
    <div className="flex items-stretch gap-0 mt-1.5 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <span
        className="flex-1 min-w-0 px-2.5 py-2 font-mono text-[11px] text-zinc-200 break-all select-all"
        title="Toque para selecionar"
      >
        {texto}
      </span>
      <button
        type="button"
        onClick={handleCopiar}
        className={`flex items-center gap-1 px-3 border-l border-zinc-800 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0 ${
          copiado ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
        }`}
        title="Copiar"
      >
        {copiado ? <Check className="w-3 h-3 stroke-[3]" /> : <Copy className="w-3 h-3" />}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

export function NotesSection() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [origem, setOrigem] = useState<Origem>('carregando');
  const [salvando, setSalvando] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  /** null = caixa de cópia fechada no formulário. */
  const [newCopiavel, setNewCopiavel] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    cargaEmCurso ??= carregarNotas();
    cargaEmCurso
      .then((r) => {
        if (!vivo) return;
        setNotes(r.notas);
        setOrigem(r.origem);
      })
      .finally(() => {
        cargaEmCurso = null;
      });
    return () => {
      vivo = false;
    };
  }, []);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const copiavel = newCopiavel?.trim() || '';
    // Uma nota pode ser só a caixa de cópia (ex.: apenas a chave PIX).
    if (!newNoteText.trim() && !copiavel) return;

    const newNote: Note = {
      id: generateUUID(),
      texto: newNoteText.trim(),
      created_at: new Date().toISOString(),
      copiavel: copiavel || null,
    };

    if (origem === 'ok') {
      setSalvando(true);
      try {
        const { error } = await db.from('notas').insert(newNote);
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao salvar anotação:', err);
        alert('Falha ao salvar a anotação no banco. Confirme que a tabela "notas" existe no Supabase.');
        return;
      } finally {
        setSalvando(false);
      }
      setNotes((prev) => [newNote, ...prev]);
    } else {
      const atualizadas = [newNote, ...notes];
      setNotes(atualizadas);
      gravarLegado(atualizadas);
    }

    setNewNoteText('');
    setNewCopiavel(null);
  };

  const handleDeleteNote = async (id: string) => {
    if (origem === 'ok') {
      const { error } = await db.from('notas').delete().eq('id', id);
      if (error) {
        console.error('Erro ao excluir anotação:', error);
        alert('Falha ao excluir a anotação.');
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } else {
      const atualizadas = notes.filter((n) => n.id !== id);
      setNotes(atualizadas);
      gravarLegado(atualizadas);
    }
  };

  const formatNoteDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      // Retorna formato: DD/MM às HH:MM
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(', ', ' às ');
    } catch {
      return '';
    }
  };

  const caixaAberta = newCopiavel !== null;

  return (
    <div className="w-full px-4 mb-5">
      <div className="minimal-card rounded-xl p-4 border border-zinc-900 bg-zinc-900/10">

        {/* Cabeçalho da Seção */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-900">
          <div className="p-1 rounded bg-zinc-900 border border-zinc-850">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <h3 className="font-bold text-[10px] uppercase tracking-wider text-zinc-300">
            Notas & Anotações
          </h3>
          {origem === 'local' && (
            <span
              className="ml-auto flex items-center gap-1 text-[9px] font-semibold text-zinc-500"
              title='A tabela "notas" não respondeu: as notas estão salvas só neste navegador.'
            >
              <CloudOff className="w-3 h-3" /> Só neste aparelho
            </span>
          )}
        </div>

        {/* Input Formulário */}
        <form onSubmit={handleAddNote} className="mb-3.5 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder={caixaAberta ? 'Descrição (ex.: PIX do Pedro)' : 'Anotar algo rápido...'}
              required={!caixaAberta}
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-normal"
            />
            <button
              type="button"
              onClick={() => setNewCopiavel(caixaAberta ? null : '')}
              className={`p-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                caixaAberta
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  : 'border-zinc-900 text-zinc-500 hover:text-zinc-200 hover:border-zinc-800'
              }`}
              title={caixaAberta ? 'Remover caixa de cópia' : 'Adicionar caixa para copiar (ex.: chave PIX)'}
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              disabled={salvando || origem === 'carregando'}
              className="p-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
              title="Adicionar Anotação"
            >
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>
          </div>

          {caixaAberta && (
            <div className="relative animate-fadeIn">
              <Copy className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-600" />
              <input
                type="text"
                value={newCopiavel}
                onChange={(e) => setNewCopiavel(e.target.value)}
                placeholder="Texto para copiar (chave PIX, conta...)"
                autoFocus
                required={!newNoteText.trim()}
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
              />
              <button
                type="button"
                onClick={() => setNewCopiavel(null)}
                className="absolute right-2 top-1.5 p-0.5 text-zinc-600 hover:text-zinc-300 cursor-pointer"
                title="Remover caixa de cópia"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>

        {/* Lista de Notas */}
        {notes.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group flex items-start justify-between gap-3 p-2.5 bg-zinc-950/40 hover:bg-zinc-900/20 border border-zinc-900/80 rounded-lg text-xs transition duration-150 animate-fadeIn"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  {note.texto && (
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-normal whitespace-pre-line break-words">
                      {note.texto}
                    </p>
                  )}
                  {note.copiavel && <CaixaCopiavel texto={note.copiavel} />}
                  <span className="text-[9px] text-zinc-650 font-medium font-mono flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-zinc-700" />
                    {formatNoteDate(note.created_at)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-zinc-700 hover:text-zinc-400 p-0.5 transition-colors cursor-pointer flex-shrink-0"
                  title="Excluir Anotação"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 font-medium text-center py-2.5 italic">
            {origem === 'carregando' ? 'Carregando anotações…' : 'Nenhuma anotação registrada.'}
          </p>
        )}

      </div>
    </div>
  );
}
