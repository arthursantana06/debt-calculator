import { Calendar, ChevronRight, CornerDownRight } from 'lucide-react';
import { buildDebtMutations, calculateDebtDetails } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';

/** Quantas mutações aparecem no card antes de o restante virar um resumo. */
const MUTACOES_VISIVEIS = 3;

interface DebtItemProps {
  debt: Debt;
  payments: Payment[];
  onClick: (debt: Debt) => void;
}

export function DebtItem({ debt, payments, onClick }: DebtItemProps) {
  const details = calculateDebtDetails(debt, payments);

  // Histórico de mutação: as mais recentes primeiro, como no resto do app.
  const mutacoes = buildDebtMutations(debt, payments).reverse();
  const visiveis = mutacoes.slice(0, MUTACOES_VISIVEIS);
  const ocultas = mutacoes.length - visiveis.length;

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
            {!details.vigente && (
              <span className="text-[9px] font-medium text-zinc-500 bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded">
                Ainda não iniciada
              </span>
            )}
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

      {/* Histórico de mutação: quando esta dívida foi abatida */}
      {mutacoes.length > 0 && (
        <div className="space-y-1 pb-2 mb-1 border-b border-zinc-900/80">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-650 block">
            Abatimentos
          </span>
          {visiveis.map((mut) => (
            <div key={mut.id} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1.5 text-zinc-500">
                <CornerDownRight className="w-3 h-3 text-zinc-700 flex-shrink-0" />
                <span className="font-mono tabular-nums">{formatDate(mut.data)}</span>
                <span className="text-zinc-650">{mut.quitou ? 'quitação' : 'parcial'}</span>
              </span>
              <span className="font-mono tabular-nums text-zinc-450 flex-shrink-0">
                -{formatCurrency(mut.valor)}
              </span>
            </div>
          ))}
          {ocultas > 0 && (
            <span className="text-[9px] text-zinc-650 block pl-4.5">
              + {ocultas} {ocultas === 1 ? 'abatimento anterior' : 'abatimentos anteriores'}
            </span>
          )}
        </div>
      )}

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
