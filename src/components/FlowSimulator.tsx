import { useMemo, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  CalendarDays,
  ListOrdered,
  RotateCcw,
  CheckSquare,
  Square,
  Coins,
  TrendingUp,
  TrendingDown,
  FlaskConical,
} from 'lucide-react';
import { calculateTotalSummary, parseLocalDate, toDateKey } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';
import {
  alocarAbatimento,
  buildFlowEntries,
  buildMonthCells,
  createSimId,
  dividasAbertasNaData,
} from '../utils/simulation';

interface FlowSimulatorProps {
  debts: Debt[];
  payments: Payment[];
  initialTab?: 'calendario' | 'fluxo';
  onClose: () => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

/** Versão curta do saldo, para caber na célula do calendário. */
const formatCompact = (val: number) => {
  if (val <= 0.01) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1).replace('.', ',')}k`;
  return String(Math.round(val));
};

const formatDate = (dateStr: string) => {
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

export function FlowSimulator({ debts, payments, initialTab = 'calendario', onClose }: FlowSimulatorProps) {
  const hoje = new Date();
  const hojeStr = toDateKey(hoje);

  const [tab, setTab] = useState<'calendario' | 'fluxo'>(initialTab);
  const [simDebts, setSimDebts] = useState<Debt[]>([]);
  const [simPayments, setSimPayments] = useState<Payment[]>([]);
  const [selectedDate, setSelectedDate] = useState(hojeStr);
  const [viewYear, setViewYear] = useState(hoje.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoje.getMonth());
  const [formAberto, setFormAberto] = useState<'divida' | 'abatimento' | null>(null);

  const allDebts = useMemo(() => [...debts, ...simDebts], [debts, simDebts]);
  const allPayments = useMemo(() => [...payments, ...simPayments], [payments, simPayments]);

  const dataAlvo = useMemo(() => parseLocalDate(selectedDate), [selectedDate]);

  const cells = useMemo(
    () => buildMonthCells(allDebts, allPayments, viewYear, viewMonth),
    [allDebts, allPayments, viewYear, viewMonth]
  );

  const resumo = useMemo(
    () => calculateTotalSummary(allDebts, allPayments, dataAlvo),
    [allDebts, allPayments, dataAlvo]
  );

  // Menor saldo do mês exibido — o "melhor dia", à moda das tabelas de passagens.
  const menorSaldoDoMes = useMemo(() => {
    const saldos = cells.filter((c) => c.inMonth).map((c) => c.saldo);
    return saldos.length ? Math.min(...saldos) : 0;
  }, [cells]);

  const mutacoesDoDia = useMemo(() => {
    const dividas = simDebts.filter((d) => d.data_divida === selectedDate);
    const abatimentos = simPayments.filter((p) => p.data_pagamento === selectedDate);
    return { dividas, abatimentos };
  }, [simDebts, simPayments, selectedDate]);

  const totalMutacoes = simDebts.length + simPayments.length;

  const navegarMes = (delta: number) => {
    const novo = new Date(viewYear, viewMonth + delta, 1, 12, 0, 0);
    setViewYear(novo.getFullYear());
    setViewMonth(novo.getMonth());
  };

  const selecionarDia = (key: string, dentroDoMes: boolean) => {
    setSelectedDate(key);
    setFormAberto(null);
    if (!dentroDoMes) {
      const d = parseLocalDate(key);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const adicionarDividaSimulada = (dados: {
    descricao: string;
    valor_inicial: number;
    taxa_juros: number;
    periodo_juros: 'Dia' | 'Mês' | 'Ano';
  }) => {
    setSimDebts((prev) => [
      ...prev,
      {
        id: createSimId('divida'),
        created_at: new Date().toISOString(),
        data_divida: selectedDate,
        tipo_juros: 'Compostos',
        status: 'Ativa',
        ...dados,
      },
    ]);
    setFormAberto(null);
  };

  const adicionarAbatimentoSimulado = (alocacoes: { id_divida: string; valor: number }[]) => {
    setSimPayments((prev) => [
      ...prev,
      ...alocacoes.map((a) => ({
        id: createSimId('abatimento'),
        id_divida: a.id_divida,
        created_at: new Date().toISOString(),
        data_pagamento: selectedDate,
        valor: a.valor,
      })),
    ]);
    setFormAberto(null);
  };

  const removerDividaSimulada = (id: string) => {
    setSimDebts((prev) => prev.filter((d) => d.id !== id));
    // Abatimentos órfãos seriam invisíveis no cálculo; removidos junto.
    setSimPayments((prev) => prev.filter((p) => p.id_divida !== id));
  };

  const limparSimulacao = () => {
    setSimDebts([]);
    setSimPayments([]);
    setFormAberto(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-zinc-950 border-t md:border border-zinc-900 md:rounded-xl rounded-t-xl overflow-hidden minimal-panel z-10 animate-slideUp max-h-[92vh] flex flex-col">
        {/* Barra superior de toque para Mobile */}
        <div className="flex justify-center py-2 md:hidden">
          <div className="w-10 h-1 bg-zinc-900 rounded-full" />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-900 flex-shrink-0">
          <div>
            <h3 className="font-bold text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-zinc-500" />
              Simulador de Fluxo
            </h3>
            <p className="text-[10px] text-zinc-550 mt-1 font-medium">
              Projeções hipotéticas — nada aqui é salvo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas */}
        <div className="grid grid-cols-2 gap-1 p-1 mx-5 mt-3 bg-zinc-900/30 border border-zinc-900 rounded-lg flex-shrink-0">
          {([
            { id: 'calendario' as const, label: 'Calendário', icon: CalendarDays },
            { id: 'fluxo' as const, label: 'Fluxo Simplificado', icon: ListOrdered },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                tab === id ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Saldo projetado — comum às duas abas */}
          <div className="p-4 bg-zinc-900/10 rounded-lg border border-zinc-900 text-center">
            <span className="text-[9px] text-zinc-550 uppercase tracking-wider block font-semibold mb-1">
              Saldo devedor em {formatDate(selectedDate)}
            </span>
            <span className="text-2xl font-light font-mono tabular-nums text-white">
              {formatCurrency(resumo.saldoTotal)}
            </span>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-900 text-[9px]">
              <div>
                <span className="text-zinc-550 uppercase tracking-wider block mb-0.5">Inicial</span>
                <span className="font-mono tabular-nums text-zinc-300">{formatCurrency(resumo.totalOriginal)}</span>
              </div>
              <div>
                <span className="text-zinc-550 uppercase tracking-wider block mb-0.5">Juros</span>
                <span className="font-mono tabular-nums text-zinc-300">+{formatCurrency(resumo.totalJuros)}</span>
              </div>
              <div>
                <span className="text-zinc-550 uppercase tracking-wider block mb-0.5">Abatido</span>
                <span className="font-mono tabular-nums text-zinc-300">-{formatCurrency(resumo.totalAmortizado)}</span>
              </div>
            </div>
          </div>

          {tab === 'calendario' ? (
            <>
              {/* Navegação de mês */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navegarMes(-1)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  {MESES[viewMonth]} {viewYear}
                </span>
                <button
                  onClick={() => navegarMes(1)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Grade do calendário */}
              <div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DIAS_SEMANA.map((d, i) => (
                    <span key={i} className="text-[8px] font-bold text-zinc-650 uppercase text-center py-1">
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell) => {
                    const selecionado = cell.key === selectedDate;
                    const melhorDia = cell.inMonth && cell.saldo <= menorSaldoDoMes + 0.01;

                    return (
                      <button
                        key={cell.key}
                        onClick={() => selecionarDia(cell.key, cell.inMonth)}
                        className={`relative flex flex-col items-center justify-center py-1.5 rounded-md border text-center transition-subtle cursor-pointer ${
                          selecionado
                            ? 'border-zinc-400 bg-zinc-900/60'
                            : cell.inMonth
                            ? 'border-zinc-900 bg-zinc-950 hover:border-zinc-800'
                            : 'border-transparent bg-transparent opacity-30'
                        }`}
                      >
                        <span
                          className={`text-[10px] leading-none font-semibold ${
                            cell.isToday ? 'text-white underline underline-offset-2' : 'text-zinc-400'
                          }`}
                        >
                          {cell.day}
                        </span>
                        <span
                          className={`text-[8px] leading-none mt-1 font-mono tabular-nums ${
                            melhorDia ? 'text-zinc-200 font-bold' : 'text-zinc-600'
                          }`}
                        >
                          {formatCompact(cell.saldo)}
                        </span>
                        {cell.mutacoes > 0 && (
                          <span
                            className={`absolute top-1 right-1 w-1 h-1 rounded-full ${
                              cell.temSimulacao ? 'bg-zinc-200' : 'bg-zinc-600'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[9px] text-zinc-650 mt-2 leading-relaxed">
                  Cada dia mostra o saldo devedor projetado (R$). O ponto marca dias com mutações —
                  claro para as simuladas, escuro para as reais.
                </p>
              </div>

              {/* Mutações do dia selecionado */}
              {(mutacoesDoDia.dividas.length > 0 || mutacoesDoDia.abatimentos.length > 0) && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Mutações simuladas em {formatDate(selectedDate)}
                  </span>
                  {mutacoesDoDia.dividas.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-2.5 bg-zinc-900/10 border border-zinc-900 rounded-lg text-[11px]"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-zinc-200 block truncate">{d.descricao}</span>
                        <span className="text-[9px] text-zinc-550 font-mono">
                          {d.taxa_juros}% ao {(d.periodo_juros || 'Mês').toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className="font-mono tabular-nums text-zinc-300">
                          +{formatCurrency(d.valor_inicial)}
                        </span>
                        <button
                          onClick={() => removerDividaSimulada(d.id)}
                          className="p-1 text-zinc-650 hover:text-zinc-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {mutacoesDoDia.abatimentos.map((p) => {
                    const alvo = allDebts.find((d) => d.id === p.id_divida);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 bg-zinc-900/10 border border-zinc-900 rounded-lg text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-200 block truncate">Abatimento</span>
                          <span className="text-[9px] text-zinc-550 block truncate">
                            {alvo ? alvo.descricao : 'dívida removida'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <span className="font-mono tabular-nums text-zinc-300">
                            -{formatCurrency(Number(p.valor))}
                          </span>
                          <button
                            onClick={() => setSimPayments((prev) => prev.filter((x) => x.id !== p.id))}
                            className="p-1 text-zinc-650 hover:text-zinc-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Criação de mutações */}
              {formAberto === 'divida' ? (
                <SimDebtForm
                  data={selectedDate}
                  onCancel={() => setFormAberto(null)}
                  onSubmit={adicionarDividaSimulada}
                />
              ) : formAberto === 'abatimento' ? (
                <SimPaymentForm
                  data={selectedDate}
                  debts={allDebts}
                  payments={allPayments}
                  onCancel={() => setFormAberto(null)}
                  onSubmit={adicionarAbatimentoSimulado}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormAberto('divida')}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Dívida
                  </button>
                  <button
                    onClick={() => setFormAberto('abatimento')}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-350 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Abatimento
                  </button>
                </div>
              )}
            </>
          ) : (
            <FlowList debts={allDebts} payments={allPayments} ate={dataAlvo} />
          )}
        </div>

        {/* Rodapé */}
        {totalMutacoes > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-900 flex-shrink-0">
            <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-semibold">
              {totalMutacoes === 1 ? '1 mutação simulada' : `${totalMutacoes} mutações simuladas`}
            </span>
            <button
              onClick={limparSimulacao}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Limpar simulação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fluxo simplificado: entradas e saídas em lista                      */
/* ------------------------------------------------------------------ */

function FlowList({ debts, payments, ate }: { debts: Debt[]; payments: Payment[]; ate: Date }) {
  const entries = useMemo(() => buildFlowEntries(debts, payments, ate), [debts, payments, ate]);

  const totalEntradas = entries.filter((e) => e.valor > 0).reduce((s, e) => s + e.valor, 0);
  const totalSaidas = entries.filter((e) => e.valor < 0).reduce((s, e) => s - e.valor, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-zinc-900/10 border border-zinc-900 rounded-lg">
          <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3" /> Dívidas contraídas
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-200">+{formatCurrency(totalEntradas)}</span>
        </div>
        <div className="p-3 bg-zinc-900/10 border border-zinc-900 rounded-lg">
          <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
            <TrendingDown className="w-3 h-3" /> Abatimentos pagos
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-200">-{formatCurrency(totalSaidas)}</span>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-3 bg-zinc-900/5 border border-zinc-900 rounded-lg text-[11px]"
            >
              <div className="min-w-0 space-y-0.5">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  {e.tipo === 'divida' ? (
                    <TrendingUp className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                  ) : (
                    <Coins className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{e.descricao}</span>
                  {e.simulado && (
                    <span className="text-[8px] uppercase tracking-wider font-bold text-zinc-950 bg-zinc-400 px-1 py-0.5 rounded flex-shrink-0">
                      sim
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-zinc-550 block">
                  {formatDate(e.data)} · saldo após:{' '}
                  <span className="font-mono">{formatCurrency(e.saldoApos)}</span>
                </span>
              </div>
              <span className="font-semibold font-mono tabular-nums text-zinc-300 flex-shrink-0 ml-2">
                {e.valor > 0 ? '+' : '-'}
                {formatCurrency(Math.abs(e.valor))}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-zinc-900/5 rounded-lg border border-dashed border-zinc-900 text-[11px] text-zinc-650 italic">
          Nenhuma movimentação até esta data.
        </div>
      )}

      <p className="text-[9px] text-zinc-650 leading-relaxed">
        A lista cobre tudo até a data selecionada no calendário. Os juros não aparecem como linha —
        eles correm entre os eventos e estão embutidos no saldo após cada um.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário: nova dívida simulada                                    */
/* ------------------------------------------------------------------ */

function SimDebtForm({
  data,
  onCancel,
  onSubmit,
}: {
  data: string;
  onCancel: () => void;
  onSubmit: (d: {
    descricao: string;
    valor_inicial: number;
    taxa_juros: number;
    periodo_juros: 'Dia' | 'Mês' | 'Ano';
  }) => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [taxa, setTaxa] = useState('0');
  const [periodo, setPeriodo] = useState<'Dia' | 'Mês' | 'Ano'>('Mês');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || Number(valor) <= 0) return;
    onSubmit({
      descricao: descricao.trim(),
      valor_inicial: parseFloat(valor),
      taxa_juros: parseFloat(taxa) || 0,
      periodo_juros: periodo,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="minimal-card rounded-xl p-4 border border-zinc-855 bg-zinc-900/10 space-y-3 animate-fadeIn"
    >
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
        <h4 className="font-bold text-zinc-200 text-[10px] uppercase tracking-wider">
          Dívida simulada em {formatDate(data)}
        </h4>
        <button type="button" onClick={onCancel} className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <input
        type="text"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Motivo / Descrição"
        required
        className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <span className="absolute left-3 top-2 text-zinc-600 text-xs font-mono">R$</span>
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            step="0.01"
            min="0.01"
            required
            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
          />
        </div>
        <div className="relative">
          <input
            type="number"
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            placeholder="0"
            step="0.01"
            min="0"
            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
          />
          <span className="absolute right-3.5 top-2 text-zinc-600 text-xs font-mono">%</span>
        </div>
      </div>

      <div className="relative">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as 'Dia' | 'Mês' | 'Ano')}
          className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 focus-minimal appearance-none cursor-pointer"
        >
          <option value="Dia" className="bg-zinc-900">Juros por Dia</option>
          <option value="Mês" className="bg-zinc-900">Juros por Mês</option>
          <option value="Ano" className="bg-zinc-900">Juros por Ano</option>
        </select>
        <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
      </div>

      <button
        type="submit"
        className="w-full py-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
      >
        Adicionar à simulação
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário: novo abatimento simulado                                */
/* ------------------------------------------------------------------ */

function SimPaymentForm({
  data,
  debts,
  payments,
  onCancel,
  onSubmit,
}: {
  data: string;
  debts: Debt[];
  payments: Payment[];
  onCancel: () => void;
  onSubmit: (alocacoes: { id_divida: string; valor: number }[]) => void;
}) {
  const [valor, setValor] = useState('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const abertas = useMemo(
    () => dividasAbertasNaData(debts, payments, parseLocalDate(data)),
    [debts, payments, data]
  );

  const parsedValor = parseFloat(valor) || 0;
  const { alocacoes, restante } = useMemo(
    () => alocarAbatimento(parsedValor, selecionadas, abertas),
    [parsedValor, selecionadas, abertas]
  );

  const alocadoPorDivida = useMemo(() => {
    const map: Record<string, number> = {};
    alocacoes.forEach((a) => (map[a.id_divida] = a.valor));
    return map;
  }, [alocacoes]);

  const toggle = (id: string) => {
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alocacoes.length === 0) return;
    onSubmit(alocacoes);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="minimal-card rounded-xl p-4 border border-zinc-855 bg-zinc-900/10 space-y-3 animate-fadeIn"
    >
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
        <h4 className="font-bold text-zinc-200 text-[10px] uppercase tracking-wider">
          Abatimento simulado em {formatDate(data)}
        </h4>
        <button type="button" onClick={onCancel} className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-2.5 text-zinc-600 text-xs font-mono">R$</span>
        <input
          type="number"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            if (!e.target.value) setSelecionadas([]);
          }}
          placeholder="0,00"
          step="0.01"
          min="0.01"
          required
          className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-8 pr-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
        />
      </div>

      {parsedValor > 0 && (
        <div className="space-y-2 border-t border-zinc-900 pt-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
              Alocar nas dívidas abertas
            </span>
            {selecionadas.length > 0 && (
              <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 flex items-center gap-1">
                <Coins className="w-3 h-3 text-zinc-500" /> Restante: {formatCurrency(restante)}
              </span>
            )}
          </div>

          {abertas.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {abertas.map(({ debt, saldo }) => {
                const marcada = selecionadas.includes(debt.id);
                const desabilitada = !marcada && restante <= 0.01;
                const alocado = alocadoPorDivida[debt.id] || 0;

                return (
                  <div
                    key={debt.id}
                    onClick={() => !desabilitada && toggle(debt.id)}
                    className={`flex items-start justify-between p-2.5 rounded-lg border text-[11px] transition-subtle select-none cursor-pointer ${
                      marcada
                        ? 'border-zinc-700 bg-zinc-900/40 text-zinc-250'
                        : desabilitada
                        ? 'border-zinc-900/40 opacity-40 text-zinc-600 cursor-not-allowed'
                        : 'border-zinc-900 bg-zinc-950 text-zinc-400 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 max-w-[70%]">
                      <span className="mt-0.5 flex-shrink-0">
                        {marcada ? (
                          <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-700" />
                        )}
                      </span>
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-semibold block truncate leading-snug">{debt.descricao}</span>
                        <span className="text-[9px] text-zinc-550 block font-medium">
                          Aberto: <span className="font-mono">{formatCurrency(saldo)}</span>
                        </span>
                      </div>
                    </div>
                    {marcada && (
                      <span className="font-bold font-mono text-zinc-300 flex-shrink-0">
                        -{formatCurrency(alocado)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-3 bg-zinc-950/40 rounded-lg border border-zinc-900 text-[10px] text-zinc-650 italic">
              Nenhuma dívida em aberto nesta data.
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={alocacoes.length === 0}
        className="w-full py-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
      >
        Adicionar à simulação
      </button>
    </form>
  );
}
