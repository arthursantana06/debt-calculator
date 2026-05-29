import { useState } from 'react';
import { X, Trash2, ShieldAlert } from 'lucide-react';
import { calculateDebtDetails } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';

interface PaymentModalProps {
  debt: Debt;
  payments: Payment[];
  onClose: () => void;
  onDeleteDebt: (idDivida: string) => Promise<void>;
}

export function PaymentModal({
  debt,
  payments,
  onClose,
  onDeleteDebt,
}: PaymentModalProps) {
  const details = calculateDebtDetails(debt, payments);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    if (periodo === 'Dia') return 'ao dia';
    if (periodo === 'Ano') return 'ao ano';
    return 'ao mês';
  };

  const handleDeleteDebtClick = async () => {
    setLoading(true);
    try {
      await onDeleteDebt(debt.id);
      onClose();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop de Fechamento al clicar fora */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Painel do Modal - Mobile Bottom Sheet ou Desktop Center */}
      <div className="relative w-full max-w-md bg-zinc-950 border-t md:border border-zinc-900 md:rounded-xl rounded-t-xl overflow-hidden minimal-panel z-10 animate-slideUp">
        {/* Barra superior de toque para Mobile */}
        <div className="flex justify-center py-2 md:hidden">
          <div className="w-10 h-1 bg-zinc-900 rounded-full" />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
          <div>
            <h3 className="font-bold text-zinc-100 text-sm uppercase tracking-wider">{debt.descricao}</h3>
            <p className="text-[10px] text-zinc-550 mt-1 font-medium">
              Registrada em {formatDate(debt.data_divida)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-5 space-y-6">
          {/* Caixa de Resumo de Saldos */}
          <div className="p-4 bg-zinc-900/10 rounded-lg border border-zinc-900 text-center">
            <span className="text-[9px] text-zinc-550 uppercase tracking-wider block font-semibold mb-1">
              Saldo Devedor Atualizado
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-white">
              {formatCurrency(details.saldoAtual)}
            </span>
          </div>

          {/* Ficha Técnica Detalhada */}
          <div className="space-y-2 text-xs border border-zinc-900 rounded-lg p-4 bg-zinc-900/5 text-zinc-400 font-normal">
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500">Valor Inicial:</span>
              <span className="font-semibold text-zinc-300 font-mono">{formatCurrency(details.valorOriginal)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500">Taxa de Juros:</span>
              <span className="font-semibold text-zinc-300 font-mono">
                {debt.taxa_juros}% {getPeriodLabel(debt.periodo_juros)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900/50">
              <span className="text-zinc-500">Juros Acumulados:</span>
              <span className="font-semibold text-zinc-300 font-mono">+{formatCurrency(details.jurosAcumulados)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500">Total Pago:</span>
              <span className="font-semibold text-zinc-300 font-mono">-{formatCurrency(details.totalAmortizado)}</span>
            </div>
          </div>

          {/* Seção Excluir Dívida */}
          <div className="pt-2">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 bg-zinc-950/20 hover:bg-zinc-900 border border-zinc-900 text-zinc-500 hover:text-zinc-400 font-medium rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Dívida Permanentemente
              </button>
            ) : (
              <div className="p-4 bg-zinc-900/5 border border-zinc-900 rounded-lg space-y-3 animate-fadeIn">
                <div className="flex items-start gap-2.5 text-zinc-400">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-550" />
                  <div className="space-y-1">
                    <h5 className="font-semibold text-[10px] uppercase tracking-wider text-zinc-350">Ação Irreversível</h5>
                    <p className="text-[10px] text-zinc-550 leading-relaxed">
                      Esta dívida e todos os seus abatimentos associados serão excluídos permanentemente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteDebtClick}
                    disabled={loading}
                    className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Sim, Excluir
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-semibold rounded-lg text-xs transition-colors cursor-pointer border border-zinc-850"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
