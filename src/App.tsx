import { Suspense, lazy, useEffect, useState } from 'react';
import { db, generateUUID, isSupabaseConfigured } from './supabaseClient';
import type { Debt, Payment } from './utils/calculations';
import type { SavedFlow } from './utils/simulation';
import { Dashboard } from './components/Dashboard';
import { DebtForm } from './components/DebtForm';
import { DebtList } from './components/DebtList';
import { PaymentModal } from './components/PaymentModal';
import { SetupInstructions } from './components/SetupInstructions';
import { NotesSection } from './components/NotesSection';
import { PaymentForm } from './components/PaymentForm';
import { GlobalPaymentsList } from './components/GlobalPaymentsList';
import { FlowSimulator } from './components/FlowSimulator';
import { SavedFlowsList } from './components/SavedFlowsList';
import { Scale, Loader2, FlaskConical, ListOrdered, LineChart, Plus } from 'lucide-react';
import { runMathTests } from './utils/calculations.test';

// Os gráficos só são baixados quando o painel é aberto.
const RentabilidadePanel = lazy(() =>
  import('./components/RentabilidadePanel').then((m) => ({ default: m.RentabilidadePanel }))
);

function App() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [simulatorTab, setSimulatorTab] = useState<'calendario' | 'fluxo' | null>(null);
  const [rentabilidadeAberta, setRentabilidadeAberta] = useState(false);
  /** Formulário aberto pelo cabeçalho — um por vez; clicar de novo fecha. */
  const [formAberto, setFormAberto] = useState<'divida' | 'abatimento' | null>(null);
  const alternarForm = (qual: 'divida' | 'abatimento') => setFormAberto((atual) => (atual === qual ? null : qual));
  const [flows, setFlows] = useState<SavedFlow[]>([]);
  const [flowsIndisponiveis, setFlowsIndisponiveis] = useState(false);
  /** Fluxo salvo aberto no simulador; null = simulação nova. */
  const [simulatorFlow, setSimulatorFlow] = useState<SavedFlow | null>(null);

  // Executa testes matemáticos de comprovação no console para verificação
  useEffect(() => {
    runMathTests();
  }, []);

  // 1. Carrega dados iniciais do Supabase ou Mock Local
  const fetchData = async () => {
    setLoading(true);
    try {
      const [debtsRes, paymentsRes] = await Promise.all([
        db.from('dividas').select('*'),
        db.from('abatimentos').select('*'),
      ]);

      if (debtsRes.error) throw debtsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      setDebts(debtsRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carregado à parte: se a tabela `fluxos_salvos` ainda não existir no
   * Supabase, as dívidas e abatimentos continuam funcionando normalmente.
   */
  const fetchFlows = async () => {
    try {
      const { data, error } = await db.from('fluxos_salvos').select('*');
      if (error) throw error;
      const lista = (data || []) as SavedFlow[];
      lista.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setFlows(lista);
      setFlowsIndisponiveis(false);
    } catch (err) {
      console.error('Erro ao carregar fluxos salvos:', err);
      setFlowsIndisponiveis(true);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFlows();
  }, []);

  // 2. Configura Sincronização em Tempo Real (Realtime)
  useEffect(() => {
    // Subscreve a atualizações nas duas tabelas
    const debtsChannel = db
      .channel('realtime_debts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dividas' },
        (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          setDebts((prevDebts) => {
            if (eventType === 'INSERT') {
              // Adiciona se não existir
              if (prevDebts.some((d) => d.id === newRecord.id)) return prevDebts;
              return [newRecord as Debt, ...prevDebts];
            }
            if (eventType === 'UPDATE') {
              return prevDebts.map((d) => (d.id === newRecord.id ? (newRecord as Debt) : d));
            }
            if (eventType === 'DELETE') {
              return prevDebts.filter((d) => d.id !== oldRecord.id);
            }
            return prevDebts;
          });
        }
      )
      .subscribe();

    const paymentsChannel = db
      .channel('realtime_payments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'abatimentos' },
        (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          setPayments((prevPayments) => {
            if (eventType === 'INSERT') {
              if (prevPayments.some((p) => p.id === newRecord.id)) return prevPayments;
              return [newRecord as Payment, ...prevPayments];
            }
            if (eventType === 'DELETE') {
              return prevPayments.filter((p) => p.id !== oldRecord.id);
            }
            return prevPayments;
          });
        }
      )
      .subscribe();

    return () => {
      debtsChannel.unsubscribe();
      paymentsChannel.unsubscribe();
    };
  }, []);

  // 3. Ações: Adicionar Dívida
  const handleAddDebt = async (newDebt: Omit<Debt, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await db.from('dividas').insert(newDebt);
      if (error) throw error;
      
      // Se estiver rodando offline/mock, o trigger manual atualiza a UI local
      if (data && !isSupabaseConfigured) {
        setDebts((prev) => [data[0], ...prev]);
      }
      return true;
    } catch (err) {
      console.error('Erro ao adicionar dívida:', err);
      if (isSupabaseConfigured) {
        alert('Falha ao registrar dívida. Se você conectou o Supabase recentemente, certifique-se de executar o novo código SQL fornecido na aba de configurações (Modo Offline / Nuvem) no console do seu Supabase para criar as tabelas e a coluna "periodo_juros"!');
      } else {
        alert('Falha ao registrar dívida. Verifique o console de desenvolvimento do navegador.');
      }
      return false;
    }
  };

  // 4. Ações: Adicionar Abatimento com Alocações Específicas
  const handleAddAllocatedPayments = async (
    allocations: { id_divida: string; valor: number }[],
    data: string
  ) => {
    try {
      const newPayments = allocations.map((alloc) => ({
        valor: alloc.valor,
        data_pagamento: data,
        id_divida: alloc.id_divida,
      }));

      const { data: payData, error } = await db.from('abatimentos').insert(newPayments);
      if (error) throw error;

      if (payData && !isSupabaseConfigured) {
        const addedPayments = Array.isArray(payData) ? payData : [payData];
        setPayments((prev) => [...prev, ...addedPayments]);
      }
      return true;
    } catch (err) {
      console.error('Erro ao adicionar abatimento:', err);
      alert('Erro ao registrar abatimento.');
      return false;
    }
  };

  // 5. Ações: Remover Abatimento
  const handleDeletePayment = async (idPayment: string) => {
    try {
      const { error } = await db.from('abatimentos').delete().eq('id', idPayment);
      if (error) throw error;

      if (!isSupabaseConfigured) {
        setPayments((prev) => prev.filter((p) => p.id !== idPayment));
      }
    } catch (err) {
      console.error('Erro ao remover pagamento:', err);
    }
  };

  // 6. Ações: Excluir Dívida
  const handleDeleteDebt = async (idDivida: string) => {
    try {
      const { error } = await db.from('dividas').delete().eq('id', idDivida);
      if (error) throw error;

      if (!isSupabaseConfigured) {
        setDebts((prev) => prev.filter((d) => d.id !== idDivida));
        setPayments((prev) => prev.filter((p) => p.id_divida !== idDivida));
      }
    } catch (err) {
      console.error('Erro ao excluir dívida:', err);
    }
  };

  // 7. Ações: Salvar Fluxo Simulado (com id, sobrescreve o existente)
  const handleSaveFlow = async (dados: {
    id?: string;
    nome: string;
    dividas: Debt[];
    abatimentos: Payment[];
  }): Promise<SavedFlow | null> => {
    const agora = new Date().toISOString();
    try {
      if (dados.id) {
        const changes = {
          nome: dados.nome,
          dividas: dados.dividas,
          abatimentos: dados.abatimentos,
          updated_at: agora,
        };
        const { error } = await db.from('fluxos_salvos').update(changes).eq('id', dados.id);
        if (error) throw error;

        const atual = flows.find((f) => f.id === dados.id);
        const salvo: SavedFlow = { ...(atual as SavedFlow), id: dados.id, ...changes };
        setFlows((prev) => prev.map((f) => (f.id === dados.id ? salvo : f)));
        return salvo;
      }

      // O id nasce no cliente para que o fluxo possa ser atualizado sem reler a tabela.
      const novo: SavedFlow = {
        id: generateUUID(),
        created_at: agora,
        updated_at: agora,
        nome: dados.nome,
        dividas: dados.dividas,
        abatimentos: dados.abatimentos,
      };
      const { error } = await db.from('fluxos_salvos').insert(novo);
      if (error) throw error;

      setFlows((prev) => [novo, ...prev]);
      setFlowsIndisponiveis(false);
      return novo;
    } catch (err) {
      console.error('Erro ao salvar fluxo:', err);
      alert(
        isSupabaseConfigured
          ? 'Falha ao salvar o fluxo. Confirme que a tabela "fluxos_salvos" foi criada no SQL Editor do Supabase.'
          : 'Falha ao salvar o fluxo. Verifique o console de desenvolvimento do navegador.'
      );
      return null;
    }
  };

  // 8. Ações: Excluir Fluxo Simulado
  const handleDeleteFlow = async (id: string) => {
    try {
      const { error } = await db.from('fluxos_salvos').delete().eq('id', id);
      if (error) throw error;
      setFlows((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Erro ao excluir fluxo:', err);
      alert('Erro ao excluir o fluxo.');
    }
  };

  const abrirSimulador = (tab: 'calendario' | 'fluxo', flow: SavedFlow | null = null) => {
    setSimulatorFlow(flow);
    setSimulatorTab(tab);
  };



  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center overflow-x-hidden">
      {/* Header Container */}
      <header className="w-full max-w-[28rem] px-4 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* No celular o ícone e o subtítulo saem, para os botões caberem ao lado do título */}
          <div className="hidden sm:block p-2 border border-zinc-900 bg-zinc-900/15 rounded-lg">
            <Scale className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold uppercase tracking-wider text-zinc-200 leading-none whitespace-nowrap">
              Acerto de Contas
            </h1>
            <p className="hidden sm:block text-[10px] text-zinc-500 mt-1 font-medium leading-none">
              Controle financeiro em tempo real
            </p>
          </div>
        </div>

        {/* Ações principais: registrar dívida e abatimento */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => alternarForm('divida')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              formAberto === 'divida'
                ? 'bg-zinc-300 text-zinc-950'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-950'
            }`}
            aria-expanded={formAberto === 'divida'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Dívida
          </button>
          <button
            onClick={() => alternarForm('abatimento')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              formAberto === 'abatimento'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            aria-expanded={formAberto === 'abatimento'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Abatimento
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-[28rem] flex-1 flex flex-col py-2">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-550 space-y-3">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            <p className="text-[11px] font-medium tracking-wide text-zinc-600">Sincronizando saldos...</p>
          </div>
        ) : (
          <>
            {/* Formulários abertos pelos botões do cabeçalho, logo abaixo dele */}
            {formAberto && (
              <div className="px-4 mb-4">
                <DebtForm isOpen={formAberto === 'divida'} onClose={() => setFormAberto(null)} onAddDebt={handleAddDebt} />
                <PaymentForm
                  isOpen={formAberto === 'abatimento'}
                  onClose={() => setFormAberto(null)}
                  debts={debts}
                  payments={payments}
                  onAddPayment={handleAddAllocatedPayments}
                />
              </div>
            )}

            {/* Dashboard no topo */}
            <Dashboard debts={debts} payments={payments} />

            {/* Banner de setup caso não esteja configurado */}
            {!isSupabaseConfigured && <SetupInstructions />}

            {/* Seção de Anotações */}
            <NotesSection />

            <div className="grid grid-cols-1 gap-4 px-4 mb-4">
              {/* Projeções: calendário de simulação e fluxo em lista */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => abrirSimulador('calendario')}
                  className="flex items-center justify-center gap-1.5 py-3 bg-zinc-900/20 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 font-bold rounded-xl transition duration-150 cursor-pointer text-[10px] uppercase tracking-wider"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Simular Fluxo
                </button>
                <button
                  onClick={() => abrirSimulador('fluxo')}
                  className="flex items-center justify-center gap-1.5 py-3 bg-zinc-900/20 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 font-bold rounded-xl transition duration-150 cursor-pointer text-[10px] uppercase tracking-wider"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  Fluxo Simplificado
                </button>
                <button
                  onClick={() => setRentabilidadeAberta(true)}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-3 bg-zinc-900/20 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 font-bold rounded-xl transition duration-150 cursor-pointer text-[10px] uppercase tracking-wider"
                >
                  <LineChart className="w-3.5 h-3.5" />
                  Rentabilidade Real
                </button>
              </div>
            </div>

            {/* Listas cronológicas */}
            <div className="flex-1 space-y-4">
              <SavedFlowsList
                flows={flows}
                debts={debts}
                payments={payments}
                indisponivel={flowsIndisponiveis}
                onOpenFlow={(flow) => abrirSimulador('calendario', flow)}
                onDeleteFlow={handleDeleteFlow}
              />
              <DebtList
                debts={debts}
                payments={payments}
                onSelectDebt={(d) => setSelectedDebt(d)}
              />
              <GlobalPaymentsList
                debts={debts}
                payments={payments}
                onDeletePayment={handleDeletePayment}
              />
            </div>
          </>
        )}
      </main>

      {/* Simulador de Fluxo (calendário + fluxo simplificado) */}
      {simulatorTab && (
        <FlowSimulator
          key={simulatorFlow?.id ?? 'nova'}
          debts={debts}
          payments={payments}
          initialTab={simulatorTab}
          initialFlow={simulatorFlow}
          onSaveFlow={handleSaveFlow}
          onClose={() => {
            setSimulatorTab(null);
            setSimulatorFlow(null);
          }}
        />
      )}

      {/* Rentabilidade Real: indicadores e gráficos contra o IPCA */}
      {rentabilidadeAberta && (
        <Suspense fallback={null}>
          <RentabilidadePanel debts={debts} payments={payments} onClose={() => setRentabilidadeAberta(false)} />
        </Suspense>
      )}

      {/* Modal de Abatimentos / Drawer */}
      {selectedDebt && (
        <PaymentModal
          debt={selectedDebt}
          payments={payments}
          onClose={() => setSelectedDebt(null)}
          onDeleteDebt={handleDeleteDebt}
        />
      )}
    </div>
  );
}

export default App;
