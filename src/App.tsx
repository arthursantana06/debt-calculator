import { useEffect, useState } from 'react';
import { db, isSupabaseConfigured } from './supabaseClient';
import { calculateDebtDetails } from './utils/calculations';
import type { Debt, Payment } from './utils/calculations';
import { Dashboard } from './components/Dashboard';
import { DebtForm } from './components/DebtForm';
import { DebtList } from './components/DebtList';
import { PaymentModal } from './components/PaymentModal';
import { SetupInstructions } from './components/SetupInstructions';
import { NotesSection } from './components/NotesSection';
import { PaymentForm } from './components/PaymentForm';
import { GlobalPaymentsList } from './components/GlobalPaymentsList';
import { Scale, ShieldCheck, Loader2 } from 'lucide-react';
import { runMathTests } from './utils/calculations.test';

function App() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

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

  useEffect(() => {
    fetchData();
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



  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center">
      {/* Header Container */}
      <header className="w-full max-w-md md:w-full md:max-w-2xl px-4 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 border border-zinc-900 bg-zinc-900/15 rounded-lg">
            <Scale className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-wider text-zinc-200 leading-none flex items-center gap-1.5">
              Acerto de Contas
            </h1>
            <p className="text-[10px] text-zinc-500 mt-1 font-medium leading-none">Controle financeiro em tempo real</p>
          </div>
        </div>

        {/* Supabase status indicator */}
        <div className="flex items-center">
          {isSupabaseConfigured ? (
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400 border border-zinc-900 bg-zinc-900/15 px-2 py-1 rounded flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-450" /> Cloud
            </span>
          ) : (
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 border border-zinc-900/50 bg-zinc-950/20 px-2 py-1 rounded">
              Offline
            </span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md md:w-full md:max-w-2xl flex-1 flex flex-col py-2">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-550 space-y-3">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            <p className="text-[11px] font-medium tracking-wide text-zinc-600">Sincronizando saldos...</p>
          </div>
        ) : (
          <>
            {/* Dashboard no topo */}
            <Dashboard debts={debts} payments={payments} />

            {/* Banner de setup caso não esteja configurado */}
            {!isSupabaseConfigured && <SetupInstructions />}

            {/* Seção de Anotações */}
            <NotesSection />

            {/* Formulários de Dívida e Abatimento lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 mb-4">
              <DebtForm onAddDebt={handleAddDebt} />
              <PaymentForm debts={debts} payments={payments} onAddPayment={handleAddAllocatedPayments} />
            </div>

            {/* Listas cronológicas */}
            <div className="flex-1 space-y-4">
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
