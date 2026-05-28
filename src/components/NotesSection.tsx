import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Calendar } from 'lucide-react';
import { generateUUID } from '../supabaseClient';

interface Note {
  id: string;
  texto: string;
  created_at: string; // Formato ISO ou data formatada
}

export function NotesSection() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState('');

  // Carrega notas do localStorage ao iniciar
  useEffect(() => {
    const savedNotes = localStorage.getItem('debt_calculator_notes');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Erro ao ler anotações:', e);
      }
    }
  }, []);

  // Salva notas no localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    localStorage.setItem('debt_calculator_notes', JSON.stringify(updatedNotes));
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote: Note = {
      id: generateUUID(),
      texto: newNoteText.trim(),
      created_at: new Date().toISOString(),
    };

    saveNotes([newNote, ...notes]);
    setNewNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    const updatedNotes = notes.filter((n) => n.id !== id);
    saveNotes(updatedNotes);
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
        </div>

        {/* Input Formulário */}
        <form onSubmit={handleAddNote} className="flex gap-2 mb-3.5">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Anotar algo rápido..."
            required
            className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-normal"
          />
          <button
            type="submit"
            className="p-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            title="Adicionar Anotação"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </form>

        {/* Lista de Notas */}
        {notes.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group flex items-start justify-between gap-3 p-2.5 bg-zinc-950/40 hover:bg-zinc-900/20 border border-zinc-900/80 rounded-lg text-xs transition duration-150 animate-fadeIn"
              >
                <div className="space-y-1 flex-1">
                  <p className="text-[11px] text-zinc-300 leading-relaxed font-normal whitespace-pre-line break-words">
                    {note.texto}
                  </p>
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
            Nenhuma anotação registrada.
          </p>
        )}

      </div>
    </div>
  );
}
