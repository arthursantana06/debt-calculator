import { createClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  const isPlaceholderUrl = !envUrl || 
    envUrl === 'SEU_SUPABASE_URL' || 
    envUrl === 'SEU_SUPABASE_URL_AQUI' || 
    envUrl.trim() === '';
    
  const isPlaceholderKey = !envKey || 
    envKey === 'COLE_SUA_ANON_KEY_AQUI' || 
    envKey === 'SEU_SUPABASE_ANON_KEY' || 
    envKey.trim() === '';
  
  if (!isPlaceholderUrl && !isPlaceholderKey) {
    return { url: envUrl, key: envKey, source: 'env' };
  }
  
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');
  
  if (localUrl && localKey && localUrl.trim() !== '' && localKey.trim() !== '') {
    return { url: localUrl, key: localKey, source: 'local' };
  }
  
  return null;
};

const config = getSupabaseConfig();

// Verifica se as credenciais estão disponíveis
export const isSupabaseConfigured = !!config;
export const supabaseSource = config ? config.source : null;

// Inicializa o client real se configurado
export const supabase = isSupabaseConfigured
  ? createClient(config!.url, config!.key)
  : (null as any);

// Helpers para salvar/limpar chaves
export const saveSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_anon_key', key.trim());
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
};

// Gerador de UUID compatível com HTTP e HTTPS
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * IMPLEMENTAÇÃO DE MOCK OFFLINE (LOCALSTORAGE) COM SUPORTE A EVENTOS EM TEMPO REAL.
 * Isso permite que o aplicativo funcione perfeitamente sem nenhuma configuração inicial do Supabase,
 * salvando dados localmente no navegador e notificando outras instâncias sobre alterações.
 */

// Chaves do LocalStorage
const STORAGE_DEBTS_KEY = 'debt_calculator_debts';
const STORAGE_PAYMENTS_KEY = 'debt_calculator_payments';

// Canais de callbacks locais para simular Realtime
type RealtimeCallback = (payload: any) => void;
const listeners = new Set<{
  table: string;
  event: string;
  callback: RealtimeCallback;
}>();

// Gatilho para disparar eventos localmente
export const triggerLocalRealtime = (table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', record: any) => {
  listeners.forEach((listener) => {
    if (listener.table === '*' || listener.table === table) {
      if (listener.event === '*' || listener.event === event) {
        listener.callback({
          eventType: event,
          new: event !== 'DELETE' ? record : {},
          old: event !== 'INSERT' ? { id: record.id } : {},
        });
      }
    }
  });
};

// Cliente Mock que simula a interface do Supabase Client
export const mockSupabase = {
  isMock: true,
  
  // Tabelas
  from(table: 'dividas' | 'abatimentos') {
    const key = table === 'dividas' ? STORAGE_DEBTS_KEY : STORAGE_PAYMENTS_KEY;
    
    // Obter dados atuais
    const getData = (): any[] => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    };

    // Salvar dados
    const saveData = (data: any[]) => {
      localStorage.setItem(key, JSON.stringify(data));
    };

    return {
      // SELECT
      async select(_columns: string = '*') {
        try {
          const data = getData();
          // Ordena decrescente por data_divida ou data_pagamento
          const sortKey = table === 'dividas' ? 'data_divida' : 'data_pagamento';
          data.sort((a, b) => new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime());
          
          return { data, error: null };
        } catch (e: any) {
          return { data: null, error: e };
        }
      },

      // INSERT
      async insert(records: any | any[]) {
        try {
          const data = getData();
          const items = Array.isArray(records) ? records : [records];
          const newItems = items.map((item) => ({
            id: item.id || generateUUID(),
            created_at: new Date().toISOString(),
            ...item,
          }));

          saveData([...data, ...newItems]);
          
          // Dispara realtime simulado para cada item
          newItems.forEach((item) => triggerLocalRealtime(table, 'INSERT', item));
          
          return { data: newItems, error: null };
        } catch (e: any) {
          return { data: null, error: e };
        }
      },

      // UPDATE
      update(changes: any) {
        return {
          eq: async (column: string, value: any) => {
            try {
              const data = getData();
              let updatedRecord: any = null;
              
              const updatedData = data.map((item) => {
                if (item[column] === value) {
                  updatedRecord = { ...item, ...changes };
                  return updatedRecord;
                }
                return item;
              });

              if (updatedRecord) {
                saveData(updatedData);
                triggerLocalRealtime(table, 'UPDATE', updatedRecord);
              }
              
              return { data: updatedRecord ? [updatedRecord] : [], error: null };
            } catch (e: any) {
              return { data: null, error: e };
            }
          },
        };
      },

      // DELETE
      delete() {
        return {
          eq: async (column: string, value: any) => {
            try {
              const data = getData();
              const deletedItems = data.filter((item) => item[column] === value);
              const remainingItems = data.filter((item) => item[column] !== value);

              saveData(remainingItems);
              
              deletedItems.forEach((item) => triggerLocalRealtime(table, 'DELETE', item));
              
              return { data: deletedItems, error: null };
            } catch (e: any) {
              return { data: null, error: e };
            }
          },
        };
      },
    };
  },

  // CANAL DE TEMPO REAL
  channel(_name: string) {
    return {
      on(
        _type: 'postgres_changes',
        filter: { event: string; schema: string; table: string },
        callback: RealtimeCallback
      ) {
        const listener = {
          table: filter.table,
          event: filter.event,
          callback,
        };
        listeners.add(listener);
        return this;
      },
      subscribe() {
        // Retorna função de unsubscribe
        return {
          unsubscribe() {
            listeners.clear(); // Limpa escutas ao desmontar
          },
        };
      },
    };
  },
};

// Exporta o cliente ativo (Supabase real ou mock local)
export const db = isSupabaseConfigured ? supabase : mockSupabase;
