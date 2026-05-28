import { useState, useMemo } from 'react';
import { Plus, X, Calendar, DollarSign, CheckSquare, Square, Coins } from 'lucide-react';
import { calculateDebtDetails } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';

interface PaymentFormProps {
  debts: Debt[];
  payments: Payment[];
  onAddPayment: (allocations: { id_divida: string; valor: number }[], date: string) => Promise<boolean>;
}

export function PaymentForm({ debts, payments, onAddPayment }: PaymentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados do formulário
  const [valor, setValor] = useState('');
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const [dataPagamento, setDataPagamento] = useState(todayStr);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);

  // 1. Calcula e memoiza as dívidas ativas
  const activeDebts = useMemo(() => {
    return debts
      .map((debt) => {
        const details = calculateDebtDetails(debt, payments);
        return { debt, details };
      })
      .filter((item) => item.details.saldoAtual > 0.01)
      .sort((a, b) => new Date(a.debt.data_divida).getTime() - new Date(b.debt.data_divida).getTime());
  }, [debts, payments]);

  // 2. Calcula dinamicamente as alocações com base no valor inserido
  const parsedValor = parseFloat(valor) || 0;

  const { allocations, allocationsMap, remainingPayment } = useMemo(() => {
    let remaining = parsedValor;
    const allocationsList: { id_divida: string; valor: number }[] = [];
    const allocMap: Record<string, number> = {};

    // Aloca na ordem em que o usuário clicou (selectedDebtIds)
    for (const debtId of selectedDebtIds) {
      if (remaining <= 0) break;
      const activeItem = activeDebts.find((item) => item.debt.id === debtId);
      if (!activeItem) continue;

      const balance = activeItem.details.saldoAtual;
      const allocated = Math.min(balance, remaining);

      const roundedAlloc = Math.round(allocated * 100) / 100;
      if (roundedAlloc > 0) {
        allocationsList.push({ id_divida: debtId, valor: roundedAlloc });
        allocMap[debtId] = roundedAlloc;
      }
      remaining -= allocated;
    }

    return {
      allocations: allocationsList,
      allocationsMap: allocMap,
      remainingPayment: Math.max(0, Math.round(remaining * 100) / 100),
    };
  }, [parsedValor, selectedDebtIds, activeDebts]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const handleToggleDebt = (debtId: string) => {
    setSelectedDebtIds((prev) => {
      if (prev.includes(debtId)) {
        return prev.filter((id) => id !== debtId);
      } else {
        return [...prev, debtId];
      }
    });
  };

  const isCheckboxDisabled = (debtId: string) => {
    // Desabilita se NÃO estiver marcado E o valor restante para alocar já se esgotou
    return !selectedDebtIds.includes(debtId) && remainingPayment <= 0.01;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedValor <= 0) return;

    if (allocations.length === 0) {
      alert('Por favor, selecione pelo menos uma dívida em aberto para aplicar este abatimento.');
      return;
    }

    setLoading(true);
    try {
      const success = await onAddPayment(allocations, dataPagamento);
      if (success) {
        setValor('');
        setDataPagamento(todayStr);
        setSelectedDebtIds([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Botão de abrir/fechar */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-350 font-bold rounded-xl transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Novo Abatimento
        </button>
      ) : (
        <div className="minimal-card rounded-xl p-5 border border-zinc-855 bg-zinc-900/10 relative animate-slideDown">
          {/* Cabeçalho do Form */}
          <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
            <h3 className="font-bold text-zinc-200 text-xs uppercase tracking-wider">Registrar Abatimento</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo: Valor */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1 uppercase tracking-wider">
                <DollarSign className="w-3 h-3 text-zinc-650" /> Valor Total
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-600 text-xs font-mono">R$</span>
                <input
                  type="number"
                  value={valor}
                  onChange={(e) => {
                    setValor(e.target.value);
                    // Reseta seleções caso limpe o valor
                    if (!e.target.value) setSelectedDebtIds([]);
                  }}
                  placeholder="0,00"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-8 pr-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
                />
              </div>
            </div>

            {/* Campo: Data */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1 uppercase tracking-wider">
                <Calendar className="w-3 h-3 text-zinc-650" /> Data do Pagamento
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2.5 text-xs text-zinc-200 focus-minimal [color-scheme:dark]"
              />
            </div>

            {/* Listagem de Dívidas em Aberto para Alocação */}
            {parsedValor > 0 && (
              <div className="space-y-2 border-t border-zinc-900 pt-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Alocar nas Dívidas Ativas
                  </span>
                  {selectedDebtIds.length > 0 && (
                    <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-zinc-500" />
                      Restante: {formatCurrency(remainingPayment)}
                    </span>
                  )}
                </div>

                {activeDebts.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeDebts.map(({ debt, details }) => {
                      const isChecked = selectedDebtIds.includes(debt.id);
                      const isDisabled = isCheckboxDisabled(debt.id);
                      const allocatedAmount = allocationsMap[debt.id] || 0;

                      return (
                        <div
                          key={debt.id}
                          onClick={() => !isDisabled && handleToggleDebt(debt.id)}
                          className={`flex items-start justify-between p-2.5 rounded-lg border text-[11px] transition-subtle select-none cursor-pointer ${
                            isChecked
                              ? 'border-zinc-700 bg-zinc-900/40 text-zinc-250'
                              : isDisabled
                              ? 'border-zinc-900/40 opacity-40 text-zinc-600 cursor-not-allowed'
                              : 'border-zinc-900 bg-zinc-950 text-zinc-400 hover:border-zinc-800'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 max-w-[70%]">
                            <span className="mt-0.5 text-zinc-500 flex-shrink-0">
                              {isChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-zinc-700" />
                              )}
                            </span>
                            <div className="space-y-0.5">
                              <span className="font-semibold block truncate leading-snug">{debt.descricao}</span>
                              <span className="text-[9px] text-zinc-550 block font-medium">
                                Aberto: <span className="font-mono">{formatCurrency(details.saldoAtual)}</span>
                              </span>
                            </div>
                          </div>

                          {/* Exibição de Alocação Reativa */}
                          {isChecked && (
                            <div className="text-right">
                              <span className="font-bold font-mono text-zinc-300">
                                -{formatCurrency(allocatedAmount)}
                              </span>
                              <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">
                                {allocatedAmount >= details.saldoAtual ? 'Quita' : 'Amortiza'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-zinc-950/40 rounded-lg border border-zinc-900 text-[10px] text-zinc-650 italic">
                    Nenhuma dívida ativa disponível para amortizar.
                  </div>
                )}
              </div>
            )}

            {/* Botão de Enviar */}
            <button
              type="submit"
              disabled={loading || parsedValor <= 0 || (parsedValor > 0 && allocations.length === 0)}
              className="w-full py-2.5 mt-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg active:scale-[0.98] transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirmar Abatimento'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
