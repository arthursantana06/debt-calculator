/**
 * Utilitários de Cálculo Financeiro para o Controle de Dívidas.
 *
 * Regime adotado: os juros incidem SEMPRE sobre o saldo devedor vigente.
 * A linha do tempo de cada dívida é percorrida cronologicamente — capitaliza-se
 * o saldo até a data de cada abatimento, o abatimento é descontado, e a
 * capitalização prossegue sobre o saldo já reduzido. Por isso a DATA do
 * abatimento importa: antecipar um pagamento reduz o saldo final.
 */

export interface Debt {
  id: string;
  created_at: string;
  data_divida: string; // Formato YYYY-MM-DD
  descricao: string;
  valor_inicial: number;
  taxa_juros: number; // Porcentagem ao período
  tipo_juros: 'Simples' | 'Compostos';
  periodo_juros?: 'Dia' | 'Mês' | 'Ano'; // Período dos juros
  status: 'Ativa' | 'Quitada';
}

export interface Payment {
  id: string;
  id_divida: string;
  created_at: string;
  data_pagamento: string; // Formato YYYY-MM-DD
  valor: number;
}

export interface CalculatedDebtDetails {
  valorOriginal: number;
  jurosAcumulados: number;
  totalAmortizado: number;
  saldoAtual: number;
  tempoMeses: number;
  statusCalculado: 'Ativa' | 'Quitada';
  /** false quando a data de avaliação é anterior à data da dívida (ela ainda não existe). */
  vigente: boolean;
}

/** Dias corridos equivalentes a um período de juros. */
const DIAS_POR_PERIODO: Record<'Dia' | 'Mês' | 'Ano', number> = {
  Dia: 1,
  // 30.417 é a média exata de dias em um mês no ano (365 / 12)
  'Mês': 30.417,
  Ano: 365,
};

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/**
 * Converte uma string de data local YYYY-MM-DD em um objeto Date local estável.
 * Isso evita flutuações de fuso horário que podem mudar o dia ao usar new Date(str).
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Mês é base 0 no JS
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0); // Meio-dia evita desvios de DST
}

/** Normaliza qualquer Date para o meio-dia local, isolando o cálculo de horas/DST. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

/** Serializa um Date no formato YYYY-MM-DD local usado em todo o app. */
export function toDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

/**
 * Calcula o tempo transcorrido em meses proporcionais entre duas datas.
 * Baseado na quantidade de dias corridos dividida pela média de dias no mês (30.417).
 */
export function calculateTimeInMonths(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  if (diffTime <= 0) return 0;

  const diffDays = diffTime / MS_POR_DIA;
  return diffDays / DIAS_POR_PERIODO['Mês'];
}

/**
 * Juros gerados por um saldo entre duas datas, no regime e período da dívida.
 * Trecho isolado da linha do tempo: nada de abatimentos aqui.
 */
function accrueInterest(saldo: number, debt: Debt, from: Date, to: Date): number {
  if (saldo <= 0) return 0;

  const diffDays = Math.max(0, (to.getTime() - from.getTime()) / MS_POR_DIA);
  if (diffDays === 0) return 0;

  const r = debt.taxa_juros / 100; // Taxa em decimal
  if (r === 0) return 0;

  const periodo = debt.periodo_juros || 'Mês';
  const t = diffDays / DIAS_POR_PERIODO[periodo];

  // Novos registros são sempre Compostos; Simples permanece como fallback de
  // compatibilidade e, no regime de saldo devedor, incide sobre o saldo do trecho.
  if (debt.tipo_juros === 'Simples') {
    return saldo * r * t;
  }
  return saldo * (Math.pow(1 + r, t) - 1);
}

/**
 * Calcula os detalhes financeiros de uma dívida percorrendo sua linha do tempo
 * de abatimentos até a data de avaliação.
 */
export function calculateDebtDetails(
  debt: Debt,
  payments: Payment[],
  currentDate: Date = new Date(),
  _allDebts: Debt[] = []
): CalculatedDebtDetails {
  const dInicio = startOfDay(parseLocalDate(debt.data_divida));
  const dFim = startOfDay(currentDate);

  // A dívida ainda não existe na data avaliada: não contribui com nada.
  if (dFim.getTime() < dInicio.getTime()) {
    return {
      valorOriginal: 0,
      jurosAcumulados: 0,
      totalAmortizado: 0,
      saldoAtual: 0,
      tempoMeses: 0,
      statusCalculado: 'Ativa',
      vigente: false,
    };
  }

  // Abatimentos desta dívida que já ocorreram até a data avaliada, em ordem cronológica.
  const eventos = payments
    .filter((pay) => pay.id_divida === debt.id)
    .map((pay) => {
      const d = startOfDay(parseLocalDate(pay.data_pagamento));
      // Pagamento anterior à própria dívida é tratado como ocorrido na origem.
      return { data: d.getTime() < dInicio.getTime() ? dInicio : d, valor: Number(pay.valor) || 0 };
    })
    .filter((ev) => ev.data.getTime() <= dFim.getTime())
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  let saldo = debt.valor_inicial;
  let jurosAcumulados = 0;
  let totalAmortizado = 0;
  let cursor = dInicio;

  for (const ev of eventos) {
    const juros = accrueInterest(saldo, debt, cursor, ev.data);
    saldo += juros;
    jurosAcumulados += juros;

    // Um abatimento nunca gera saldo negativo; o excedente é ignorado.
    const aplicado = Math.min(saldo, ev.valor);
    saldo -= aplicado;
    totalAmortizado += aplicado;

    cursor = ev.data;
  }

  // Capitaliza o trecho final, do último evento até a data de avaliação.
  const jurosFinais = accrueInterest(saldo, debt, cursor, dFim);
  saldo += jurosFinais;
  jurosAcumulados += jurosFinais;

  const saldoAtual = Math.max(0, Math.round(saldo * 100) / 100);
  const statusCalculado = saldoAtual <= 0.01 || debt.status === 'Quitada' ? 'Quitada' : 'Ativa';

  return {
    valorOriginal: debt.valor_inicial,
    jurosAcumulados: Math.round(jurosAcumulados * 100) / 100,
    totalAmortizado: Math.round(totalAmortizado * 100) / 100,
    saldoAtual,
    tempoMeses: calculateTimeInMonths(dInicio, dFim),
    statusCalculado,
    vigente: true,
  };
}

/**
 * Calcula o saldo atualizado total combinando todas as dívidas e pagamentos
 * em uma data de referência. Dívidas ainda não vigentes são ignoradas.
 */
export function calculateTotalSummary(debts: Debt[], payments: Payment[], currentDate: Date = new Date()) {
  let totalOriginal = 0;
  let totalJuros = 0;
  let totalAmortizado = 0;
  let saldoTotal = 0;
  let dividasAtivasCount = 0;
  let dividasQuitadasCount = 0;

  debts.forEach((debt) => {
    const details = calculateDebtDetails(debt, payments, currentDate, debts);
    if (!details.vigente) return;

    totalOriginal += details.valorOriginal;
    totalJuros += details.jurosAcumulados;
    totalAmortizado += details.totalAmortizado;
    saldoTotal += details.saldoAtual;

    if (details.saldoAtual <= 0.01) {
      dividasQuitadasCount++;
    } else {
      dividasAtivasCount++;
    }
  });

  return {
    totalOriginal: Math.round(totalOriginal * 100) / 100,
    totalJuros: Math.round(totalJuros * 100) / 100,
    totalAmortizado: Math.round(totalAmortizado * 100) / 100,
    saldoTotal: Math.round(saldoTotal * 100) / 100,
    dividasAtivasCount,
    dividasQuitadasCount,
  };
}
