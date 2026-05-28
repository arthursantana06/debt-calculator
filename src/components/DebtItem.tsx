import { Calendar, ChevronRight } from 'lucide-react';
import { calculateDebtDetails } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';

interface DebtItemProps {
  debt: Debt;
  payments: Payment[];
  onClick: (debt: Debt) => void;
}

export function DebtItem({ debt, payments, onClick }: DebtItemProps) {
  const details = calculateDebtDetails(debt, payments);

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

  const getPeriodLabel = (periodo?: 'Dia' | 'Mês' | 'Ano') => {
    if (periodo === 'Dia') return 'a.d.';
    if (periodo === 'Ano') return 'a.a.';
    return 'a.m.';
  };

  return (
    <div
      onClick={() => onClick(debt)}
      className="group w-full text-left rounded-xl p-4.5 transition duration-150 border cursor-pointer select-none minimal-card border-zinc-900 bg-zinc-900/10 hover:border-zinc-850 hover:bg-zinc-900/25"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        {/* Descrição e Data */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-xs transition text-zinc-200 group-hover:text-white">
              {debt.descricao}
            </h4>
            {debt.taxa_juros > 0 && (
              <span className="text-[9px] font-medium font-mono text-zinc-400 bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded flex items-center gap-0.5">
                {debt.taxa_juros}% {getPeriodLabel(debt.periodo_juros)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-550">
            <Calendar className="w-3 h-3 text-zinc-650" />
            <span>{formatDate(debt.data_divida)}</span>
          </div>
        </div>

        {/* Chevron para Ação */}
        <div className="flex items-center pt-0.5">
          <ChevronRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-450 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Grid de Valores */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-900/80 my-2 text-[10px]">
        {/* Inicial */}
        <div>
          <span className="text-zinc-500 block mb-0.5">Inicial</span>
          <span className="font-semibold text-zinc-300 font-mono tabular-nums">{formatCurrency(details.valorOriginal)}</span>
        </div>
        {/* Juros */}
        <div>
          <span className="text-zinc-500 block mb-0.5">Juros</span>
          <span className="font-semibold font-mono tabular-nums text-zinc-300">
            +{formatCurrency(details.jurosAcumulados)}
          </span>
        </div>
        {/* Amortizado */}
        <div>
          <span className="text-zinc-500 block mb-0.5">Pago</span>
          <span className="font-semibold font-mono tabular-nums text-zinc-300">
            -{formatCurrency(details.totalAmortizado)}
          </span>
        </div>
      </div>

      {/* Saldo Devedor Atual */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Saldo Devedor</span>
        <span className="font-bold text-xs font-mono tabular-nums text-white">
          {formatCurrency(details.saldoAtual)}
        </span>
      </div>
    </div>
  );
}
