/**
 * Motor da Simulação de Fluxo.
 *
 * Nada aqui é persistido: a simulação vive apenas em memória, combinando as
 * dívidas e abatimentos reais com mutações hipotéticas para projetar o saldo
 * devedor em qualquer data futura.
 */

import { calculateDebtDetails, calculateTotalSummary, parseLocalDate, startOfDay, toDateKey } from './calculations';
import type { Debt, Payment } from './calculations';

/** Marca que distingue uma mutação simulada de um registro real. */
export const SIM_PREFIX = 'sim-';

export function isSimulated(id: string): boolean {
  return id.startsWith(SIM_PREFIX);
}

let simCounter = 0;
export function createSimId(kind: 'divida' | 'abatimento'): string {
  simCounter += 1;
  return `${SIM_PREFIX}${kind}-${simCounter}`;
}

export interface DayCell {
  /** Data no formato YYYY-MM-DD. */
  key: string;
  date: Date;
  /** Número do dia no mês. */
  day: number;
  /** false para os dias de preenchimento do mês anterior/seguinte. */
  inMonth: boolean;
  isToday: boolean;
  /** Saldo devedor total projetado no fim deste dia. */
  saldo: number;
  /** Quantidade de mutações (reais ou simuladas) que ocorrem neste dia. */
  mutacoes: number;
  /** true se ao menos uma das mutações do dia for simulada. */
  temSimulacao: boolean;
}

export interface FlowEntry {
  id: string;
  tipo: 'divida' | 'abatimento';
  data: string;
  descricao: string;
  /** Positivo para dívida contraída (entrada), negativo para abatimento (saída). */
  valor: number;
  simulado: boolean;
  /** Saldo devedor total logo após o evento. */
  saldoApos: number;
}

/** Saldo devedor consolidado numa data qualquer. */
export function saldoNaData(debts: Debt[], payments: Payment[], date: Date): number {
  return calculateTotalSummary(debts, payments, date).saldoTotal;
}

/**
 * Saldo devedor de uma única dívida numa data, já considerando os abatimentos
 * anteriores. Usado para alocar um abatimento simulado entre as dívidas abertas.
 */
export function saldoDaDividaNaData(debt: Debt, payments: Payment[], date: Date): number {
  return calculateDebtDetails(debt, payments, date).saldoAtual;
}

/** Dívidas com saldo em aberto numa data, da mais antiga para a mais recente. */
export function dividasAbertasNaData(debts: Debt[], payments: Payment[], date: Date) {
  return debts
    .map((debt) => ({ debt, saldo: saldoDaDividaNaData(debt, payments, date) }))
    .filter((item) => item.saldo > 0.01)
    .sort((a, b) => parseLocalDate(a.debt.data_divida).getTime() - parseLocalDate(b.debt.data_divida).getTime());
}

/**
 * Aloca um valor entre as dívidas escolhidas, na ordem de seleção, sem que
 * nenhuma parcela ultrapasse o saldo daquela dívida na data. Mesma regra do
 * formulário padrão de abatimento.
 */
export function alocarAbatimento(
  valorTotal: number,
  idsSelecionados: string[],
  abertas: { debt: Debt; saldo: number }[]
): { alocacoes: { id_divida: string; valor: number }[]; restante: number } {
  let restante = valorTotal;
  const alocacoes: { id_divida: string; valor: number }[] = [];

  for (const id of idsSelecionados) {
    if (restante <= 0) break;
    const alvo = abertas.find((item) => item.debt.id === id);
    if (!alvo) continue;

    const alocado = Math.round(Math.min(alvo.saldo, restante) * 100) / 100;
    if (alocado > 0) {
      alocacoes.push({ id_divida: id, valor: alocado });
      restante -= alocado;
    }
  }

  return { alocacoes, restante: Math.max(0, Math.round(restante * 100) / 100) };
}

/**
 * Monta a grade de 6 semanas do mês pedido, com o saldo devedor projetado dia a dia.
 * A semana começa no domingo, como nos calendários brasileiros.
 */
export function buildMonthCells(
  debts: Debt[],
  payments: Payment[],
  year: number,
  month: number
): DayCell[] {
  const primeiroDia = new Date(year, month, 1, 12, 0, 0);
  const inicioGrade = new Date(year, month, 1 - primeiroDia.getDay(), 12, 0, 0);
  const hojeKey = toDateKey(startOfDay(new Date()));

  const mutacoesPorDia = new Map<string, { total: number; simulada: boolean }>();
  const registrar = (dateStr: string, simulada: boolean) => {
    const atual = mutacoesPorDia.get(dateStr) || { total: 0, simulada: false };
    mutacoesPorDia.set(dateStr, { total: atual.total + 1, simulada: atual.simulada || simulada });
  };
  debts.forEach((d) => registrar(d.data_divida, isSimulated(d.id)));
  payments.forEach((p) => registrar(p.data_pagamento, isSimulated(p.id)));

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i, 12, 0, 0);
    const key = toDateKey(date);
    const marcador = mutacoesPorDia.get(key);

    cells.push({
      key,
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: key === hojeKey,
      saldo: saldoNaData(debts, payments, date),
      mutacoes: marcador?.total ?? 0,
      temSimulacao: marcador?.simulada ?? false,
    });
  }

  return cells;
}

/**
 * Lista cronológica de entradas (dívidas contraídas) e saídas (abatimentos)
 * até a data limite, com o saldo devedor resultante após cada evento.
 */
export function buildFlowEntries(debts: Debt[], payments: Payment[], ate: Date): FlowEntry[] {
  const limite = startOfDay(ate).getTime();

  const eventos: Omit<FlowEntry, 'saldoApos'>[] = [];

  debts.forEach((debt) => {
    if (startOfDay(parseLocalDate(debt.data_divida)).getTime() > limite) return;
    eventos.push({
      id: debt.id,
      tipo: 'divida',
      data: debt.data_divida,
      descricao: debt.descricao,
      valor: debt.valor_inicial,
      simulado: isSimulated(debt.id),
    });
  });

  payments.forEach((pay) => {
    if (startOfDay(parseLocalDate(pay.data_pagamento)).getTime() > limite) return;
    const alvo = debts.find((d) => d.id === pay.id_divida);
    eventos.push({
      id: pay.id,
      tipo: 'abatimento',
      data: pay.data_pagamento,
      descricao: alvo ? `Abatimento — ${alvo.descricao}` : 'Abatimento',
      valor: -Number(pay.valor),
      simulado: isSimulated(pay.id),
    });
  });

  eventos.sort((a, b) => {
    const diff = parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime();
    if (diff !== 0) return diff;
    // No mesmo dia, a dívida nasce antes de ser abatida.
    return a.tipo === b.tipo ? 0 : a.tipo === 'divida' ? -1 : 1;
  });

  return eventos.map((ev) => ({
    ...ev,
    saldoApos: saldoNaData(debts, payments, parseLocalDate(ev.data)),
  }));
}
