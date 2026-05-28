import { calculateDebtDetails } from './calculations';
import type { Debt, Payment } from './calculations';

// Mock de dívidas para testes
const debtSimples: Debt = {
  id: 'divida-1',
  created_at: '2026-05-28T00:00:00Z',
  data_divida: '2026-05-28', // Hoje no teste
  descricao: 'Empréstimo Juros Simples',
  valor_inicial: 1000,
  taxa_juros: 10, // 10% ao mês
  tipo_juros: 'Simples',
  status: 'Ativa',
};

const debtCompostos: Debt = {
  id: 'divida-2',
  created_at: '2026-05-28T00:00:00Z',
  data_divida: '2026-05-28',
  descricao: 'Empréstimo Juros Compostos',
  valor_inicial: 1000,
  taxa_juros: 10, // 10% ao mês
  tipo_juros: 'Compostos',
  status: 'Ativa',
};

// Rodar simulações
export function runMathTests() {
  console.log('=== INICIANDO TESTES MATEMÁTICOS DE JUROS ===');
  
  // Data atual = 3 meses no futuro (91.25 dias aproximadamente)
  // 3 meses exatos seriam data_divida + 3 meses
  const futureDate = new Date(2026, 8, 28, 12, 0, 0); // 2026-09-28 (exatos 4 meses após 2026-05-28)
  // Esperado: t = 4 meses
  
  // 1. Teste de Juros Simples sem pagamentos
  // Juros = 1000 * 0.10 * 4 = 400
  // Saldo = 1400
  const detailsSimples = calculateDebtDetails(debtSimples, [], futureDate);
  console.log('Juros Simples (4 meses):');
  console.log(`- Tempo Calculado (meses): ${detailsSimples.tempoMeses.toFixed(2)} (Esperado: 4.00)`);
  console.log(`- Juros Acumulados: R$ ${detailsSimples.jurosAcumulados} (Esperado: R$ 400)`);
  console.log(`- Saldo Devedor: R$ ${detailsSimples.saldoAtual} (Esperado: R$ 1400)`);

  // 2. Teste de Juros Compostos sem pagamentos
  // Montante = 1000 * (1.10)^4 = 1000 * 1.4641 = 1464.10
  // Juros = 464.10
  const detailsCompostos = calculateDebtDetails(debtCompostos, [], futureDate);
  console.log('\nJuros Compostos (4 meses):');
  console.log(`- Juros Acumulados: R$ ${detailsCompostos.jurosAcumulados} (Esperado: R$ 464.10)`);
  console.log(`- Saldo Devedor: R$ ${detailsCompostos.saldoAtual} (Esperado: R$ 1464.10)`);

  // 3. Teste de Abatimento Parcial
  // Pagamento de R$ 500
  const payments: Payment[] = [
    {
      id: 'p-1',
      id_divida: 'divida-1',
      created_at: '2026-07-28T00:00:00Z',
      data_pagamento: '2026-07-28',
      valor: 500,
    }
  ];
  const detailsSimplesWithPay = calculateDebtDetails(debtSimples, payments, futureDate);
  console.log('\nJuros Simples com Abatimento Parcial de R$ 500:');
  console.log(`- Total Amortizado: R$ ${detailsSimplesWithPay.totalAmortizado} (Esperado: R$ 500)`);
  console.log(`- Saldo Devedor Atual: R$ ${detailsSimplesWithPay.saldoAtual} (Esperado: R$ 900)`);
  console.log(`- Status: ${detailsSimplesWithPay.statusCalculado} (Esperado: Ativa)`);

  // 4. Teste de Liquidação
  // Pagamento de R$ 1500 (supera o saldo devido de R$ 1400)
  const fullPayments: Payment[] = [
    {
      id: 'p-2',
      id_divida: 'divida-1',
      created_at: '2026-08-28T00:00:00Z',
      data_pagamento: '2026-08-28',
      valor: 1500,
    }
  ];
  const detailsSimplesLiquidated = calculateDebtDetails(debtSimples, fullPayments, futureDate);
  console.log('\nJuros Simples com Abatimento Total (Liquidação):');
  console.log(`- Saldo Devedor Atual: R$ ${detailsSimplesLiquidated.saldoAtual} (Esperado: R$ 0)`);
  console.log(`- Status: ${detailsSimplesLiquidated.statusCalculado} (Esperado: Quitada)`);
  console.log('=== TESTES MATEMÁTICOS CONCLUÍDOS ===\n');
}
