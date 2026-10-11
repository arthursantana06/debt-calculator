/**
 * Motor da Rentabilidade Real.
 *
 * Todo fluxo é calculado sob a ótica do CREDOR — a dívida contraída é uma saída
 * de caixa (capital emprestado), cada abatimento é uma entrada. A visão do
 * DEVEDOR é o espelho exato: os mesmos fluxos com o sinal trocado. Por isso a
 * TIR é a mesma nas duas visões (trocar o sinal de todos os fluxos não muda a
 * raiz) — o que muda é a leitura: rentabilidade para um, custo efetivo para o
 * outro. Já o ganho real troca de sinal: o que o credor ganha acima da
 * inflação é exatamente o que o devedor perde.
 *
 * "Real" é sempre medido contra o IPCA (BCB/SGS série 433). O saldo em aberto
 * entra como valor terminal na data de hoje — é o que a dívida vale pelo
 * próprio contrato, não um valor de mercado.
 */

import { buildDebtMutations, calculateDebtDetails, calculateTotalSummary, parseLocalDate, startOfDay, toDateKey } from './calculations';
import type { Debt, Payment } from './calculations';

export type Visao = 'credor' | 'devedor';

const MS_DIA = 1000 * 60 * 60 * 24;

/** Prazo mínimo para anualizar uma taxa: abaixo disso a TIR anual explode e não informa nada. */
export const PRAZO_MINIMO_DIAS = 30;

/* ------------------------------------------------------------------ */
/* IPCA                                                                */
/* ------------------------------------------------------------------ */

export interface IpcaMes {
  /** YYYY-MM */
  mes: string;
  /** Variação mensal como fração (0,0082 = 0,82%). */
  taxa: number;
}

export interface IndiceIpca {
  /** Número-índice na data (base arbitrária — só razões entre datas têm sentido). */
  fator: (date: Date) => number;
  /** Último mês com IPCA publicado; depois dele o índice é projetado. */
  ultimoMes: string;
  /** Taxa mensal usada na projeção (média geométrica dos últimos 12 meses). */
  taxaProjecao: number;
}

const mesKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Índice diário a partir da série mensal: dentro de um mês a inflação é
 * distribuída pro rata die, em regime composto. Meses além do último
 * publicado usam a média geométrica dos 12 últimos — e são sinalizados.
 */
export function criarIndiceIpca(serie: IpcaMes[]): IndiceIpca | null {
  if (serie.length === 0) return null;
  const ordenada = [...serie].sort((a, b) => a.mes.localeCompare(b.mes));
  const taxas = new Map(ordenada.map((m) => [m.mes, m.taxa]));

  const ultimos = ordenada.slice(-12);
  const taxaProjecao =
    Math.pow(ultimos.reduce((p, m) => p * (1 + m.taxa), 1), 1 / ultimos.length) - 1;

  const primeiro = ordenada[0].mes;
  const ultimoMes = ordenada[ordenada.length - 1].mes;
  const taxaDo = (mes: string) => taxas.get(mes) ?? (mes < primeiro ? ordenada[0].taxa : taxaProjecao);

  // Índice no 1º dia de cada mês, memorizado a partir do primeiro mês da série.
  const inicioMes = new Map<string, number>();
  const [anoBase, mesBase] = primeiro.split('-').map(Number);
  const indiceNoInicio = (ano: number, mes0: number): number => {
    const key = `${ano}-${String(mes0 + 1).padStart(2, '0')}`;
    const memo = inicioMes.get(key);
    if (memo !== undefined) return memo;

    const passos = (ano - anoBase) * 12 + (mes0 - (mesBase - 1));
    let valor = 1;
    if (passos > 0) {
      const anterior = new Date(ano, mes0 - 1, 1, 12);
      valor = indiceNoInicio(anterior.getFullYear(), anterior.getMonth()) * (1 + taxaDo(mesKey(anterior)));
    } else if (passos < 0) {
      // Antes da série: recua com a primeira taxa conhecida.
      const seguinte = new Date(ano, mes0 + 1, 1, 12);
      valor = indiceNoInicio(seguinte.getFullYear(), seguinte.getMonth()) / (1 + taxaDo(key));
    }
    inicioMes.set(key, valor);
    return valor;
  };

  const fator = (date: Date) => {
    const d = startOfDay(date);
    const diasNoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const fracao = (d.getDate() - 1) / diasNoMes;
    return indiceNoInicio(d.getFullYear(), d.getMonth()) * Math.pow(1 + taxaDo(mesKey(d)), fracao);
  };

  return { fator, ultimoMes, taxaProjecao };
}

const IPCA_CACHE_KEY = 'debt_calculator_ipca';
const IPCA_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Busca a série mensal do IPCA desde `desde` na API pública do Banco Central. */
export async function fetchIpca(desde: Date): Promise<IpcaMes[]> {
  const inicio = new Date(desde.getFullYear(), desde.getMonth() - 1, 1, 12);
  const inicioKey = mesKey(inicio);

  try {
    const cache = JSON.parse(localStorage.getItem(IPCA_CACHE_KEY) || 'null');
    if (cache && Date.now() - cache.em < IPCA_CACHE_TTL_MS && cache.inicio <= inicioKey) {
      return cache.serie as IpcaMes[];
    }
  } catch {
    // Cache ilegível ou armazenamento bloqueado: segue para a API.
  }

  const url =
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json' +
    `&dataInicial=${ddmmyyyy(inicio)}&dataFinal=${ddmmyyyy(new Date())}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`BCB respondeu ${resp.status}`);
  const dados: { data: string; valor: string }[] = await resp.json();

  const serie = dados.map((p) => {
    const [, mes, ano] = p.data.split('/');
    return { mes: `${ano}-${mes}`, taxa: parseFloat(p.valor) / 100 };
  });

  try {
    localStorage.setItem(IPCA_CACHE_KEY, JSON.stringify({ em: Date.now(), inicio: inicioKey, serie }));
  } catch {
    // Sem armazenamento, apenas não há cache.
  }
  return serie;
}

/* ------------------------------------------------------------------ */
/* TIR (XIRR)                                                          */
/* ------------------------------------------------------------------ */

export interface FluxoCaixa {
  data: Date;
  valor: number;
}

/**
 * Taxa interna de retorno anual para fluxos em datas irregulares (Act/365),
 * por bisseção — lenta, mas não diverge como Newton quando a taxa é extrema.
 * null quando não há troca de sinal ou o prazo é curto demais para anualizar.
 */
export function xirr(fluxos: FluxoCaixa[]): number | null {
  const validos = fluxos.filter((f) => Math.abs(f.valor) > 0.005);
  if (!validos.some((f) => f.valor > 0) || !validos.some((f) => f.valor < 0)) return null;

  const t0 = Math.min(...validos.map((f) => f.data.getTime()));
  const t1 = Math.max(...validos.map((f) => f.data.getTime()));
  if ((t1 - t0) / MS_DIA < PRAZO_MINIMO_DIAS) return null;

  const termos = validos.map((f) => ({ v: f.valor, anos: (f.data.getTime() - t0) / (365 * MS_DIA) }));
  const vpl = (r: number) => termos.reduce((s, t) => s + t.v / Math.pow(1 + r, t.anos), 0);

  let lo = -0.9999;
  let hi = 1;
  while (Math.sign(vpl(lo)) === Math.sign(vpl(hi)) && hi < 1e6) hi *= 4;
  if (Math.sign(vpl(lo)) === Math.sign(vpl(hi))) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(vpl(mid)) === Math.sign(vpl(lo))) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ */
/* Fluxos sob a ótica do credor                                        */
/* ------------------------------------------------------------------ */

export interface Movimento {
  id: string;
  id_divida: string;
  tipo: 'divida' | 'abatimento';
  data: string;
  /** Ótica do credor: negativo = capital emprestado, positivo = recebido. */
  valor: number;
}

/**
 * Movimentos ocorridos até `ate`. Os abatimentos entram pelo valor
 * efetivamente APLICADO (o motor descarta o excedente sobre o saldo), para que
 * fluxos e saldo contem a mesma história.
 */
export function movimentosDoCredor(debts: Debt[], payments: Payment[], ate: Date): Movimento[] {
  const limite = toDateKey(startOfDay(ate));
  const movimentos: Movimento[] = [];

  debts.forEach((debt) => {
    if (debt.data_divida > limite) return;
    movimentos.push({
      id: debt.id,
      id_divida: debt.id,
      tipo: 'divida',
      data: debt.data_divida,
      valor: -debt.valor_inicial,
    });
    buildDebtMutations(debt, payments)
      .filter((m) => m.data <= limite && m.valor > 0)
      .forEach((m) =>
        movimentos.push({ id: m.id, id_divida: debt.id, tipo: 'abatimento', data: m.data, valor: m.valor })
      );
  });

  return movimentos.sort((a, b) => a.data.localeCompare(b.data));
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                         */
/* ------------------------------------------------------------------ */

export interface Indicadores {
  /** Capital que mudou de mãos na origem (soma dos valores iniciais). */
  inicial: number;
  abatido: number;
  juros: number;
  saldo: number;
  /** TIR nominal anual — rentabilidade (credor) ou custo efetivo (devedor). */
  tirNominal: number | null;
  /** TIR real anual, com os fluxos trazidos a valor de hoje pelo IPCA. */
  tirReal: number | null;
  /** Juros sobre o capital inicial, no período inteiro — o "ROE" do empréstimo. */
  retornoCapital: number | null;
  /** Ganho acima do IPCA, em reais de hoje, já na ótica da visão escolhida. */
  ganhoReal: number | null;
  /** IPCA acumulado entre o primeiro movimento e hoje. */
  ipcaPeriodo: number | null;
  /** Primeiro movimento considerado (YYYY-MM-DD). */
  desde: string | null;
}

export function calcularIndicadores(
  debts: Debt[],
  payments: Payment[],
  visao: Visao,
  ipca: IndiceIpca | null,
  hoje: Date = new Date()
): Indicadores {
  const ref = startOfDay(hoje);
  const resumo = calculateTotalSummary(debts, payments, ref);
  const movimentos = movimentosDoCredor(debts, payments, ref);
  const sinal = visao === 'credor' ? 1 : -1;

  const vazio: Indicadores = {
    inicial: resumo.totalOriginal,
    abatido: resumo.totalAmortizado,
    juros: resumo.totalJuros,
    saldo: resumo.saldoTotal,
    tirNominal: null,
    tirReal: null,
    retornoCapital: null,
    ganhoReal: null,
    ipcaPeriodo: null,
    desde: null,
  };
  if (movimentos.length === 0) return vazio;

  const fluxos = movimentos.map((m) => ({ data: parseLocalDate(m.data), valor: m.valor }));
  const terminal = { data: ref, valor: resumo.saldoTotal };

  const tirNominal = xirr([...fluxos, terminal]);
  const retornoCapital = resumo.totalOriginal > 0 ? resumo.totalJuros / resumo.totalOriginal : null;
  const desde = movimentos[0].data;

  if (!ipca) {
    return { ...vazio, tirNominal, retornoCapital, desde };
  }

  const fHoje = ipca.fator(ref);
  const reais = fluxos.map((f) => ({ data: f.data, valor: (f.valor * fHoje) / ipca.fator(f.data) }));
  const tirReal = xirr([...reais, terminal]);
  const ganhoCredor = reais.reduce((s, f) => s + f.valor, 0) + resumo.saldoTotal;

  return {
    ...vazio,
    tirNominal,
    tirReal,
    retornoCapital,
    ganhoReal: sinal * ganhoCredor,
    ipcaPeriodo: fHoje / ipca.fator(parseLocalDate(desde)) - 1,
    desde,
  };
}

/* ------------------------------------------------------------------ */
/* Séries dos gráficos                                                 */
/* ------------------------------------------------------------------ */

export interface PontoTrajetoria {
  data: string;
  /** Saldo devedor pelo contrato. */
  saldo: number;
  /** O mesmo capital, corrigido só pelo IPCA — a régua do "real". */
  corrigido: number | null;
}

/**
 * Saldo devedor ao longo do tempo contra o capital corrigido pelo IPCA. A
 * distância entre as duas linhas, hoje, é exatamente o ganho real.
 */
export function trajetoriaSaldo(
  debts: Debt[],
  payments: Payment[],
  ipca: IndiceIpca | null,
  hoje: Date = new Date(),
  pontos = 90
): PontoTrajetoria[] {
  const ref = startOfDay(hoje);
  const movimentos = movimentosDoCredor(debts, payments, ref);
  if (movimentos.length === 0) return [];

  const inicio = parseLocalDate(movimentos[0].data).getTime();
  const fim = ref.getTime();
  const passo = Math.max(MS_DIA, (fim - inicio) / pontos);

  // Datas amostradas + cada movimento e a véspera dele — assim o degrau do
  // abatimento cai na vertical, em vez de virar uma rampa entre amostras.
  const datas = new Set<string>();
  movimentos.forEach((m) => {
    datas.add(m.data);
    const vespera = parseLocalDate(m.data);
    vespera.setDate(vespera.getDate() - 1);
    if (vespera.getTime() >= inicio) datas.add(toDateKey(vespera));
  });
  for (let t = inicio; t < fim; t += passo) datas.add(toDateKey(new Date(t)));
  datas.add(toDateKey(ref));

  return [...datas].sort().map((data) => {
    const d = parseLocalDate(data);
    const saldo = calculateTotalSummary(debts, payments, d).saldoTotal;
    let corrigido: number | null = null;
    if (ipca) {
      const f = ipca.fator(d);
      corrigido = movimentos
        .filter((m) => m.data <= data)
        .reduce((s, m) => s - (m.valor * f) / ipca.fator(parseLocalDate(m.data)), 0);
    }
    return { data, saldo, corrigido };
  });
}

export interface FluxoMensal {
  /** YYYY-MM */
  mes: string;
  /** Valor emprestado/contraído no mês (positivo). */
  originado: number;
  /** Valor abatido no mês (positivo). */
  abatido: number;
}

export function fluxoMensal(debts: Debt[], payments: Payment[], hoje: Date = new Date()): FluxoMensal[] {
  const movimentos = movimentosDoCredor(debts, payments, hoje);
  if (movimentos.length === 0) return [];

  const porMes = new Map<string, FluxoMensal>();
  const primeiro = parseLocalDate(movimentos[0].data);
  const ultimo = startOfDay(hoje);
  for (let d = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1, 12); d <= ultimo; d.setMonth(d.getMonth() + 1)) {
    const mes = mesKey(d);
    porMes.set(mes, { mes, originado: 0, abatido: 0 });
  }

  movimentos.forEach((m) => {
    const linha = porMes.get(m.data.slice(0, 7));
    if (!linha) return;
    if (m.tipo === 'divida') linha.originado += -m.valor;
    else linha.abatido += m.valor;
  });

  return [...porMes.values()];
}

export interface ComposicaoDivida {
  id: string;
  descricao: string;
  inicial: number;
  juros: number;
  abatido: number;
  saldo: number;
  /** TIR real anual desta dívida; null se curta demais ou sem IPCA. */
  tirReal: number | null;
  tirNominal: number | null;
}

/** Uma linha por dívida vigente, da maior para a menor (inicial + juros). */
export function composicaoPorDivida(
  debts: Debt[],
  payments: Payment[],
  ipca: IndiceIpca | null,
  hoje: Date = new Date()
): ComposicaoDivida[] {
  const ref = startOfDay(hoje);
  return debts
    .map((debt) => {
      const det = calculateDebtDetails(debt, payments, ref);
      if (!det.vigente) return null;

      const movs = movimentosDoCredor([debt], payments, ref);
      const fluxos = movs.map((m) => ({ data: parseLocalDate(m.data), valor: m.valor }));
      const terminal = { data: ref, valor: det.saldoAtual };
      let tirReal: number | null = null;
      if (ipca) {
        const fHoje = ipca.fator(ref);
        tirReal = xirr([
          ...fluxos.map((f) => ({ data: f.data, valor: (f.valor * fHoje) / ipca.fator(f.data) })),
          terminal,
        ]);
      }

      return {
        id: debt.id,
        descricao: debt.descricao,
        inicial: det.valorOriginal,
        juros: det.jurosAcumulados,
        abatido: det.totalAmortizado,
        saldo: det.saldoAtual,
        tirReal,
        tirNominal: xirr([...fluxos, terminal]),
      };
    })
    .filter((c): c is ComposicaoDivida => c !== null)
    .sort((a, b) => b.inicial + b.juros - (a.inicial + a.juros));
}
