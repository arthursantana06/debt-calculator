import { calculateTotalSummary } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';

interface DashboardProps {
  debts: Debt[];
  payments: Payment[];
}

export function Dashboard({ debts, payments }: DashboardProps) {
  const summary = calculateTotalSummary(debts, payments);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="w-full px-4 mb-6">
      {/* Bloco de Saldo Principal */}
      <div className="minimal-panel rounded-xl p-6 text-center bg-zinc-900/15 border border-zinc-850 relative overflow-hidden">
        <span className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest block mb-2">
          Saldo Devedor Total
        </span>
        <h2 className="text-3xl font-light font-mono tracking-tight text-white select-all mb-0 tabular-nums">
          {formatCurrency(summary.saldoTotal)}
        </h2>
      </div>

      {/* Grid de Detalhamento Técnico */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {/* Total Inicial */}
        <div className="minimal-card rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Inicial</span>
          <div>
            <p className="text-xs font-semibold text-zinc-300 font-mono tabular-nums truncate">
              {formatCurrency(summary.totalOriginal)}
            </p>
          </div>
        </div>

        {/* Juros Acumulados */}
        <div className="minimal-card rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Juros</span>
          <div>
            <p className="text-xs font-semibold text-zinc-300 font-mono tabular-nums truncate">
              {summary.totalJuros > 0 ? '+' : ''}{formatCurrency(summary.totalJuros)}
            </p>
          </div>
        </div>

        {/* Total Amortizado */}
        <div className="minimal-card rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Pagos</span>
          <div>
            <p className="text-xs font-semibold text-zinc-400 font-mono tabular-nums truncate">
              -{formatCurrency(summary.totalAmortizado)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
