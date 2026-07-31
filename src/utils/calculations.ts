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

/** Uma parcela de um abatimento, dirigida a uma dívida específica. */
export interface PaymentAllocation {
  /** id da linha em `abatimentos` — é esta que se exclui. */
  id: string;
  id_divida: string;
  /** Descrição da dívida abatida, ou um rótulo neutro se ela já não existe. */
  descricao: string;
  valor: number;
}

/**
 * Um abatimento como o usuário o fez: um único pagamento, possivelmente
 * repartido entre várias dívidas.
 */
export interface PaymentEvent {
  /** Chave estável derivada da data e do lote de inserção. */
  key: string;
  data_pagamento: string;
  valorTotal: number;
  alocacoes: PaymentAllocation[];
}

/** Tolerância, em ms, para considerar duas linhas parte do mesmo lote. */
const JANELA_LOTE_MS = 5000;

/**
 * Reagrupa as linhas de `abatimentos` nos pagamentos que as originaram.
 *
 * Um abatimento repartido entre N dívidas vira N linhas na tabela, sem nenhuma
 * coluna que as ligue. O que as une é o lote de inserção: no Postgres todas
 * compartilham o `created_at` da transação, e no mock local caem a poucos
 * milissegundos umas das outras. Agrupa-se, então, por data de pagamento mais
 * proximidade de `created_at`.
 */
export function groupPaymentsIntoEvents(payments: Payment[], debts: Debt[]): PaymentEvent[] {
  const descricaoDe = (idDivida: string) =>
    debts.find((d) => d.id === idDivida)?.descricao ?? 'Dívida removida';

  const instanteDe = (pay: Payment) => {
    const t = pay.created_at ? new Date(pay.created_at).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
  };

  // Agrupa primeiro por data de pagamento; dentro dela, por lote de inserção.
  const porData = new Map<string, Payment[]>();
  payments.forEach((pay) => {
    const lista = porData.get(pay.data_pagamento) || [];
    lista.push(pay);
    porData.set(pay.data_pagamento, lista);
  });

  const eventos: PaymentEvent[] = [];

  porData.forEach((linhas, data) => {
    const ordenadas = [...linhas].sort((a, b) => instanteDe(a) - instanteDe(b));

    let lote: Payment[] = [];
    const fecharLote = () => {
      if (lote.length === 0) return;
      const alocacoes = lote.map((pay) => ({
        id: pay.id,
        id_divida: pay.id_divida,
        descricao: descricaoDe(pay.id_divida),
        valor: Number(pay.valor) || 0,
      }));
      eventos.push({
        key: `${data}-${lote[0].id}`,
        data_pagamento: data,
        valorTotal: Math.round(alocacoes.reduce((s, a) => s + a.valor, 0) * 100) / 100,
        alocacoes,
      });
      lote = [];
    };

    ordenadas.forEach((pay) => {
      const anterior = lote[lote.length - 1];
      const mesmoLote = anterior && Math.abs(instanteDe(pay) - instanteDe(anterior)) <= JANELA_LOTE_MS;
      // Uma dívida repetida no mesmo lote indica dois pagamentos distintos.
      const jaNoLote = lote.some((p) => p.id_divida === pay.id_divida);

      if (!mesmoLote || jaNoLote) fecharLote();
      lote.push(pay);
    });

    fecharLote();
  });

  return eventos.sort(
    (a, b) => parseLocalDate(b.data_pagamento).getTime() - parseLocalDate(a.data_pagamento).getTime()
  );
}

/** Um abatimento na linha do tempo de uma dívida. */
export interface DebtMutation {
  id: string;
  data: string;
  /** Valor efetivamente aplicado — nunca maior que o saldo daquela data. */
  valor: number;
  /** Saldo devedor logo após o abatimento. */
  saldoApos: number;
  /** true quando foi este abatimento que zerou a dívida. */
  quitou: boolean;
}

/**
 * Histórico de mutações de uma dívida: cada abatimento, em ordem cronológica,
 * com o saldo que restou depois dele. Reexecuta a mesma linha do tempo de
 * `calculateDebtDetails`, para que os valores exibidos batam com o saldo.
 */
export function buildDebtMutations(debt: Debt, payments: Payment[]): DebtMutation[] {
  const dInicio = startOfDay(parseLocalDate(debt.data_divida));

  const eventos = payments
    .filter((pay) => pay.id_divida === debt.id)
    .map((pay) => {
      const d = startOfDay(parseLocalDate(pay.data_pagamento));
      return {
        id: pay.id,
        data: pay.data_pagamento,
        quando: d.getTime() < dInicio.getTime() ? dInicio : d,
        valor: Number(pay.valor) || 0,
      };
    })
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());

  let saldo = debt.valor_inicial;
  let cursor = dInicio;
  const mutacoes: DebtMutation[] = [];

  for (const ev of eventos) {
    saldo += accrueInterest(saldo, debt, cursor, ev.quando);

    const aplicado = Math.min(saldo, ev.valor);
    saldo -= aplicado;
    cursor = ev.quando;

    const saldoApos = Math.max(0, Math.round(saldo * 100) / 100);
    mutacoes.push({
      id: ev.id,
      data: ev.data,
      valor: Math.round(aplicado * 100) / 100,
      saldoApos,
      quitou: saldoApos <= 0.01,
    });
  }

  return mutacoes;
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
