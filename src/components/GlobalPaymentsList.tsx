import { useState } from 'react';
import { Calendar, Trash2, Coins } from 'lucide-react';
import type { Payment, Debt } from '../utils/calculations';

interface GlobalPaymentsListProps {
  debts: Debt[];
  payments: Payment[];
  onDeletePayment: (id: string) => Promise<void>;
}

export function GlobalPaymentsList({ debts, payments, onDeletePayment }: GlobalPaymentsListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja excluir este abatimento permanentemente?')) {
      setLoadingId(id);
      try {
        await onDeletePayment(id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingId(null);
      }
    }
  };

  // Ordena os abatimentos mais recentes primeiro
  const sortedPayments = [...payments].sort((a, b) => new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime());

  // Busca a descrição da dívida vinculada
  const getDebtDescription = (idDivida: string) => {
    const debt = debts.find((d) => d.id === idDivida);
    return debt ? debt.descricao : 'Abatimento Geral';
  };

  return (
    <div className="w-full px-4 space-y-4 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-zinc-400">Histórico de Abatimentos</h4>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-650 bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-900 font-mono">
          Total: {payments.length}
        </span>
      </div>

      {sortedPayments.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {sortedPayments.map((pay) => {
            const debtDesc = getDebtDescription(pay.id_divida);
            return (
              <div
                key={pay.id}
                className="flex items-center justify-between p-3.5 bg-zinc-900/5 border border-zinc-900 rounded-lg text-xs hover:bg-zinc-900/10 transition duration-150 animate-fadeIn"
              >
                <div className="space-y-1 max-w-[70%]">
                  <h5 className="font-semibold text-zinc-200 truncate leading-snug flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    {debtDesc}
                  </h5>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-550">
                    <Calendar className="w-3 h-3 text-zinc-650" />
                    <span>{formatDate(pay.data_pagamento)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="font-semibold font-mono tabular-nums text-zinc-300">
                    -{formatCurrency(Number(pay.valor))}
                  </span>
                  
                  <button
                    onClick={() => handleDelete(pay.id)}
                    disabled={loadingId === pay.id}
                    className="p-1 text-zinc-650 hover:text-zinc-350 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Remover Abatimento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
