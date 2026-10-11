import { useMemo, useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Coins,
  FlaskConical,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import type { Debt, Payment } from '../utils/calculations';
import { buildPlannedEntries } from '../utils/simulation';
import type { PlannedEntry, SavedFlow } from '../utils/simulation';

interface SavedFlowsListProps {
  flows: SavedFlow[];
  debts: Debt[];
  payments: Payment[];
  /** true quando a tabela `fluxos_salvos` não respondeu (ainda não foi criada). */
  indisponivel: boolean;
  onOpenFlow: (flow: SavedFlow) => void;
  onDeleteFlow: (id: string) => Promise<void>;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDate = (dateStr: string) => {
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

export function SavedFlowsList({
  flows,
  debts,
  payments,
  indisponivel,
  onOpenFlow,
  onDeleteFlow,
}: SavedFlowsListProps) {
  if (!indisponivel && flows.length === 0) return null;

  return (
    <div className="w-full px-4 space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-zinc-400">Fluxos Planejados</h4>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-650 bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-900 font-mono">
          Total: {flows.length}
        </span>
      </div>

      {indisponivel ? (
        <div className="p-3 bg-zinc-900/5 border border-dashed border-zinc-900 rounded-lg text-[10px] text-zinc-550 leading-relaxed">
          Não foi possível carregar os fluxos salvos. Se o Supabase está conectado, crie a tabela{' '}
          <span className="font-mono text-zinc-400">fluxos_salvos</span> no SQL Editor.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              debts={debts}
              payments={payments}
              onOpen={() => onOpenFlow(flow)}
              onDelete={() => onDeleteFlow(flow.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({
  flow,
  debts,
  payments,
  onOpen,
  onDelete,
}: {
  flow: SavedFlow;
  debts: Debt[];
  payments: Payment[];
  onOpen: () => void;
  onDelete: () => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const entries = useMemo(() => buildPlannedEntries(flow, debts, payments), [flow, debts, payments]);
  const proximas = entries.filter((e) => !e.atrasada);
  const atrasadas = entries.filter((e) => e.atrasada);

  const totalEntradas = proximas.filter((e) => e.valor > 0).reduce((s, e) => s + e.valor, 0);
  const totalSaidas = proximas.filter((e) => e.valor < 0).reduce((s, e) => s - e.valor, 0);

  const handleDelete = async () => {
    if (!window.confirm(`Deseja excluir o fluxo "${flow.nome}"? As dívidas e abatimentos reais não são afetados.`)) {
      return;
    }
    setExcluindo(true);
    try {
      await onDelete();
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="bg-zinc-900/5 border border-zinc-900 rounded-lg text-xs animate-fadeIn">
      {/* Cabeçalho: nome, próxima transação e expansão */}
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-3.5 text-left cursor-pointer hover:bg-zinc-900/10 transition duration-150 rounded-lg"
      >
        <div className="space-y-1 min-w-0">
          <h5 className="font-semibold text-zinc-200 leading-snug flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="truncate">{flow.nome}</span>
          </h5>
          <span className="text-[10px] text-zinc-550 block">
            {proximas.length > 0
              ? `Próxima em ${formatDate(proximas[0].data)} · ${proximas.length} ${
                  proximas.length === 1 ? 'planejada' : 'planejadas'
                }`
              : 'Nenhuma transação futura'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {atrasadas.length > 0 && (
            <span
              className="text-[9px] font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1"
              title="Transações planejadas cuja data já passou"
            >
              <AlertTriangle className="w-3 h-3 text-zinc-400" />
              {atrasadas.length}
            </span>
          )}
          {aberto ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {aberto && (
        <div className="px-3.5 pb-3.5 space-y-3 animate-fadeIn">
          {/* Totais do que ainda está por vir */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-zinc-950/40 border border-zinc-900 rounded-lg">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3" /> Entradas
              </span>
              <span className="text-[11px] font-mono tabular-nums text-zinc-200">+{formatCurrency(totalEntradas)}</span>
            </div>
            <div className="p-2.5 bg-zinc-950/40 border border-zinc-900 rounded-lg">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                <TrendingDown className="w-3 h-3" /> Saídas
              </span>
              <span className="text-[11px] font-mono tabular-nums text-zinc-200">-{formatCurrency(totalSaidas)}</span>
            </div>
          </div>

          {atrasadas.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Passaram da data sem registro
              </span>
              {atrasadas.map((e) => (
                <PlannedRow key={e.id} entry={e} />
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            {atrasadas.length > 0 && (
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Próximas</span>
            )}
            {proximas.length > 0 ? (
              proximas.map((e) => <PlannedRow key={e.id} entry={e} />)
            ) : (
              <div className="text-center py-3 bg-zinc-950/40 rounded-lg border border-zinc-900 text-[10px] text-zinc-650 italic">
                Todas as transações deste fluxo já passaram da data.
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
            <button
              onClick={onOpen}
              className="flex items-center justify-center gap-1.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5" /> Abrir no simulador
            </button>
            <button
              onClick={handleDelete}
              disabled={excluindo}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
              title="Excluir fluxo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlannedRow({ entry }: { entry: PlannedEntry }) {
  return (
    <div
      className={`flex items-center justify-between p-2.5 border rounded-lg text-[11px] ${
        entry.atrasada ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-900 bg-zinc-950/40'
      }`}
    >
      <div className="min-w-0 space-y-0.5">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          {entry.tipo === 'divida' ? (
            <TrendingUp className="w-3 h-3 text-zinc-500 flex-shrink-0" />
          ) : (
            <Coins className="w-3 h-3 text-zinc-500 flex-shrink-0" />
          )}
          <span className="truncate">{entry.descricao}</span>
          {entry.alocacoes && (
            <span
              className="text-[9px] font-medium text-zinc-500 bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded flex-shrink-0"
              title={entry.alocacoes.map((a) => a.descricao).join(', ')}
            >
              {entry.alocacoes.length} dívidas
            </span>
          )}
        </span>
        <span className="text-[9px] text-zinc-550 block">
          {formatDate(entry.data)} · saldo após: <span className="font-mono">{formatCurrency(entry.saldoApos)}</span>
        </span>
      </div>
      <span className="font-semibold font-mono tabular-nums text-zinc-300 flex-shrink-0 ml-2">
        {entry.valor > 0 ? '+' : '-'}
        {formatCurrency(Math.abs(entry.valor))}
      </span>
    </div>
  );
}
