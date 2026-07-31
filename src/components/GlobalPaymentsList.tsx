import { useState } from 'react';
import { Calendar, Trash2, Coins, CornerDownRight } from 'lucide-react';
import { groupPaymentsIntoEvents } from '../utils/calculations';
import type { Payment, Debt } from '../utils/calculations';

interface GlobalPaymentsListProps {
  debts: Debt[];
  payments: Payment[];
  onDeletePayment: (id: string) => Promise<void>;
}

export function GlobalPaymentsList({ debts, payments, onDeletePayment }: GlobalPaymentsListProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Um abatimento repartido entre várias dívidas vira um único card.
  const eventos = groupPaymentsIntoEvents(payments, debts);

  const removerLinhas = async (chave: string, ids: string[]) => {
    setLoadingKey(chave);
    try {
      for (const id of ids) {
        await onDeletePayment(id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDeleteEvent = async (chave: string, ids: string[]) => {
    const pergunta =
      ids.length > 1
        ? `Este abatimento foi repartido entre ${ids.length} dívidas. Deseja excluí-lo por inteiro?`
        : 'Deseja excluir este abatimento permanentemente?';
    if (window.confirm(pergunta)) {
      await removerLinhas(chave, ids);
    }
  };

  const handleDeleteAllocation = async (id: string, descricao: string) => {
    if (window.confirm(`Deseja excluir apenas a parcela dirigida a "${descricao}"?`)) {
      await removerLinhas(id, [id]);
    }
  };

  return (
    <div className="w-full px-4 space-y-4 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-zinc-400">Histórico de Abatimentos</h4>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-650 bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-900 font-mono">
          Total: {eventos.length}
        </span>
      </div>

      {eventos.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {eventos.map((ev) => {
            const ids = ev.alocacoes.map((a) => a.id);
            const repartido = ev.alocacoes.length > 1;
            const ocupado = loadingKey === ev.key || ids.some((id) => loadingKey === id);

            return (
              <div
                key={ev.key}
                className="p-3.5 bg-zinc-900/5 border border-zinc-900 rounded-lg text-xs hover:bg-zinc-900/10 transition duration-150 animate-fadeIn"
              >
                {/* Cabeçalho do abatimento: data, total e exclusão do evento inteiro */}
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h5 className="font-semibold text-zinc-200 leading-snug flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      Abatimento
                      {repartido && (
                        <span className="text-[9px] font-medium text-zinc-500 bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded">
                          {ev.alocacoes.length} dívidas
                        </span>
                      )}
                    </h5>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-550">
                      <Calendar className="w-3 h-3 text-zinc-650" />
                      <span>{formatDate(ev.data_pagamento)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-semibold font-mono tabular-nums text-zinc-300">
                      -{formatCurrency(ev.valorTotal)}
                    </span>

                    <button
                      onClick={() => handleDeleteEvent(ev.key, ids)}
                      disabled={ocupado}
                      className="p-1 text-zinc-650 hover:text-zinc-350 disabled:opacity-30 transition-colors cursor-pointer"
                      title={repartido ? 'Remover o abatimento inteiro' : 'Remover Abatimento'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dívidas abatidas por este pagamento */}
                <div className="mt-2.5 pt-2.5 border-t border-zinc-900/80 space-y-1.5">
                  {ev.alocacoes.map((aloc) => (
                    <div key={aloc.id} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="flex items-center gap-1.5 min-w-0 text-zinc-450">
                        <CornerDownRight className="w-3 h-3 text-zinc-700 flex-shrink-0" />
                        <span className="truncate">{aloc.descricao}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono tabular-nums text-zinc-400">
                          -{formatCurrency(aloc.valor)}
                        </span>
                        {repartido && (
                          <button
                            onClick={() => handleDeleteAllocation(aloc.id, aloc.descricao)}
                            disabled={ocupado}
                            className="p-0.5 text-zinc-750 hover:text-zinc-450 disabled:opacity-30 transition-colors cursor-pointer"
                            title="Remover apenas esta parcela"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-zinc-900/5 rounded-lg border border-dashed border-zinc-900 text-[11px] text-zinc-650 italic leading-relaxed">
          Nenhum abatimento foi registrado ainda.
        </div>
      )}
    </div>
  );
}
