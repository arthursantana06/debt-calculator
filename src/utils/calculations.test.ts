import { calculateDebtDetails, calculateTotalSummary, parseLocalDate } from './calculations';
import type { Debt, Payment } from './calculations';

/**
 * Testes de comprovação do motor de juros sobre saldo devedor.
 *
 * Os valores esperados NÃO são constantes chumbadas: são recalculados aqui a
 * partir da fórmula, de forma independente da implementação, para que qualquer
 * desvio no motor apareça imediatamente no console.
 */

const DIAS_MES = 30.417;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Dias corridos entre duas datas YYYY-MM-DD. */
function dias(de: string, ate: string): number {
  return (parseLocalDate(ate).getTime() - parseLocalDate(de).getTime()) / MS_POR_DIA;
}

/** Fator de capitalização composta mensal para um intervalo em dias. */
function fator(taxaPercent: number, diasCorridos: number): number {
  return Math.pow(1 + taxaPercent / 100, diasCorridos / DIAS_MES);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

let falhas = 0;

function check(label: string, atual: number | string | boolean, esperado: number | string | boolean, tol = 0.01) {
  const ok =
    typeof atual === 'number' && typeof esperado === 'number'
      ? Math.abs(atual - esperado) <= tol
      : atual === esperado;
  if (!ok) falhas++;
  const fmt = (v: number | string | boolean) => (typeof v === 'number' ? v.toFixed(2) : String(v));
  console.log(`${ok ? '✓' : '✗'} ${label}: ${fmt(atual)} (esperado: ${fmt(esperado)})`);
}

const INICIO = '2026-05-28';
const AVALIACAO = '2026-09-28';

const debtCompostos: Debt = {
  id: 'divida-1',
  created_at: `${INICIO}T00:00:00Z`,
  data_divida: INICIO,
  descricao: 'Empréstimo Juros Compostos',
  valor_inicial: 1000,
  taxa_juros: 10, // 10% ao mês
  tipo_juros: 'Compostos',
  periodo_juros: 'Mês',
  status: 'Ativa',
};

const debtSimples: Debt = {
  ...debtCompostos,
  id: 'divida-2',
  descricao: 'Empréstimo Juros Simples',
  tipo_juros: 'Simples',
};

function pagamento(id: string, idDivida: string, data: string, valor: number): Payment {
  return { id, id_divida: idDivida, created_at: `${data}T00:00:00Z`, data_pagamento: data, valor };
}

export function runMathTests() {
  falhas = 0;
  console.log('=== TESTES: JUROS SOBRE SALDO DEVEDOR ===');

  const dataAvaliacao = parseLocalDate(AVALIACAO);
  const diasTotais = dias(INICIO, AVALIACAO);

  // 1. Compostos sem abatimento: capitalização contínua do principal.
  const semPagamento = round2(1000 * fator(10, diasTotais));
  const d1 = calculateDebtDetails(debtCompostos, [], dataAvaliacao);
  console.log(`\n[1] Compostos, ${diasTotais.toFixed(0)} dias, sem abatimento`);
  check('Saldo devedor', d1.saldoAtual, semPagamento);
  check('Juros acumulados', d1.jurosAcumulados, round2(semPagamento - 1000));
  check('Tempo (meses)', d1.tempoMeses, diasTotais / DIAS_MES);

  // 2. Abatimento no meio do caminho: juros passam a incidir sobre o saldo reduzido.
  const DATA_CEDO = '2026-07-28';
  const pagCedo = [pagamento('p-1', debtCompostos.id, DATA_CEDO, 500)];
  const saldoNoPagamento = 1000 * fator(10, dias(INICIO, DATA_CEDO));
  const esperadoCedo = round2((saldoNoPagamento - 500) * fator(10, dias(DATA_CEDO, AVALIACAO)));
  const d2 = calculateDebtDetails(debtCompostos, pagCedo, dataAvaliacao);
  console.log(`\n[2] Abatimento de R$ 500 em ${DATA_CEDO}`);
  check('Saldo devedor', d2.saldoAtual, esperadoCedo);
  check('Total amortizado', d2.totalAmortizado, 500);
  check('Status', d2.statusCalculado, 'Ativa');

  // 3. Mesmo abatimento, mais tarde: o saldo final PRECISA ser maior.
  //    É este o teste que garante que a data do pagamento não é decorativa.
  const DATA_TARDE = '2026-09-01';
  const pagTarde = [pagamento('p-2', debtCompostos.id, DATA_TARDE, 500)];
  const d3 = calculateDebtDetails(debtCompostos, pagTarde, dataAvaliacao);
  console.log(`\n[3] Mesmo R$ 500, porém em ${DATA_TARDE} (antecipar deve compensar)`);
  check('Saldo maior que o do pagamento antecipado', d3.saldoAtual > d2.saldoAtual, true);
  check(
    'Ganho por antecipar',
    round2(d3.saldoAtual - d2.saldoAtual),
    round2(500 * (fator(10, dias(DATA_CEDO, AVALIACAO)) - fator(10, dias(DATA_TARDE, AVALIACAO))))
  );

  // 4. Liquidação: o excedente do pagamento não vira saldo negativo nem amortização fantasma.
  const DATA_QUITA = '2026-08-28';
  const saldoNaQuitacao = round2(1000 * fator(10, dias(INICIO, DATA_QUITA)));
  const d4 = calculateDebtDetails(
    debtCompostos,
    [pagamento('p-3', debtCompostos.id, DATA_QUITA, 5000)],
    dataAvaliacao
  );
  console.log(`\n[4] Liquidação com R$ 5.000 em ${DATA_QUITA}`);
  check('Saldo devedor', d4.saldoAtual, 0);
  check('Status', d4.statusCalculado, 'Quitada');
  check('Amortização limitada ao saldo da data', d4.totalAmortizado, saldoNaQuitacao);

  // 5. Juros simples (legado): incidem sobre o saldo de cada trecho.
  const t1 = dias(INICIO, DATA_CEDO) / DIAS_MES;
  const t2 = dias(DATA_CEDO, AVALIACAO) / DIAS_MES;
  const saldoSimplesNoPag = 1000 * (1 + 0.1 * t1);
  const esperadoSimples = round2((saldoSimplesNoPag - 500) * (1 + 0.1 * t2));
  const d5 = calculateDebtDetails(
    debtSimples,
    [pagamento('p-4', debtSimples.id, DATA_CEDO, 500)],
    dataAvaliacao
  );
  console.log('\n[5] Juros simples com abatimento no meio');
  check('Saldo devedor', d5.saldoAtual, esperadoSimples);

  // 6. Dívida futura: não existe na data avaliada.
  const d6 = calculateDebtDetails(
    { ...debtCompostos, id: 'divida-3', data_divida: '2027-01-10' },
    [],
    dataAvaliacao
  );
  console.log('\n[6] Dívida com data futura');
  check('Vigente', d6.vigente, false);
  check('Saldo devedor', d6.saldoAtual, 0);

  // 7. Identidade do painel: saldo = inicial + juros − amortizado.
  const resumo = calculateTotalSummary([debtCompostos, debtSimples], [...pagCedo], dataAvaliacao);
  console.log('\n[7] Consistência do resumo consolidado');
  check(
    'Inicial + Juros − Pagos = Saldo',
    round2(resumo.totalOriginal + resumo.totalJuros - resumo.totalAmortizado),
    resumo.saldoTotal,
    0.02
  );

  console.log(
    `\n=== ${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} TESTE(S) FALHARAM`} ===\n`
  );
}
