/**
 * Utilitários de Cálculo Financeiro para o Controle de Dívidas.
 * Calcula juros simples e compostos proporcionalmente ao tempo transcorrido em dias.
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
}

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

/**
 * Calcula o tempo transcorrido em meses proporcionais entre duas datas.
 * Baseado na quantidade de dias corridos dividida pela média de dias no mês (30.417).
 */
export function calculateTimeInMonths(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  if (diffTime <= 0) return 0;
  
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  // 30.417 é a média exata de dias em um mês no ano (365 / 12)
  return diffDays / 30.417;
}

/**
 * Calcula os detalhes financeiros de uma dívida com base nos abatimentos e na data atual.
 * Se allDebts for fornecido, distribui a amortização global via fila FIFO (mais antiga primeiro).
 */
export function calculateDebtDetails(
  debt: Debt,
  payments: Payment[],
  currentDate: Date = new Date(),
  allDebts: Debt[] = []
): CalculatedDebtDetails {
  const p = debt.valor_inicial;
  const r = debt.taxa_juros / 100; // Taxa em decimal
  const dataDivida = parseLocalDate(debt.data_divida);
  
  // Zera as horas das datas para calcular estritamente os dias de diferença
  const dInicio = new Date(dataDivida.getFullYear(), dataDivida.getMonth(), dataDivida.getDate(), 12, 0, 0);
  const dFim = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0);
  
  const diffTime = dFim.getTime() - dInicio.getTime();
  const diffDays = Math.max(0, diffTime / (1000 * 60 * 60 * 24));
  
  // Ajusta o tempo com base no período de juros
  const periodo = debt.periodo_juros || 'Mês';
  let t = 0;
  
  if (periodo === 'Dia') {
    t = diffDays;
  } else if (periodo === 'Ano') {
    t = diffDays / 365;
  } else {
    // Mês (padrão)
    t = diffDays / 30.417;
  }
  
  let jurosAcumulados = 0;
  let montanteSemAbatimento = p;

  // Embora novos registros sejam sempre Compostos, mantemos Simples como fallback de compatibilidade
  if (debt.tipo_juros === 'Simples') {
    jurosAcumulados = p * r * t;
    montanteSemAbatimento = p + jurosAcumulados;
  } else {
    // Compostos
    montanteSemAbatimento = p * Math.pow(1 + r, t);
    jurosAcumulados = montanteSemAbatimento - p;
  }

  // Amortização direta vinculada ao id_divida da dívida específica
  const totalAmortizado = payments
    .filter((pay) => pay.id_divida === debt.id)
    .reduce((sum, pay) => sum + Number(pay.valor), 0);

  // Saldo Atualizado = (Valor Inicial + Juros Calculados) - Abatimentos
  const saldoAtualBruto = montanteSemAbatimento - totalAmortizado;
  const saldoAtual = Math.max(0, Math.round(saldoAtualBruto * 100) / 100);

  const statusCalculado = (saldoAtual <= 0.01 || debt.status === 'Quitada') ? 'Quitada' : 'Ativa';

  return {
    valorOriginal: p,
    jurosAcumulados: Math.round(jurosAcumulados * 100) / 100,
    totalAmortizado: Math.round(totalAmortizado * 100) / 100,
    saldoAtual,
    tempoMeses: periodo === 'Mês' ? t : t * (periodo === 'Dia' ? (1 / 30.417) : 12), // Representação em meses
    statusCalculado,
  };
}

/**
 * Calcula o saldo atualizado total combinando todas as dívidas e pagamentos.
 */
export function calculateTotalSummary(debts: Debt[], payments: Payment[], currentDate: Date = new Date()) {
  let totalOriginal = 0;
  let totalJuros = 0;
  let totalAmortizado = payments.reduce((sum, pay) => sum + Number(pay.valor), 0); // Amortização global
  let saldoTotal = 0;
  let dividasAtivasCount = 0;
  let dividasQuitadasCount = 0;

  debts.forEach((debt) => {
    const details = calculateDebtDetails(debt, payments, currentDate, debts);
    
    totalOriginal += details.valorOriginal;
    totalJuros += details.jurosAcumulados;
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
