import { useState } from 'react';
import { Database, Key, Check, Copy, ChevronDown, ChevronUp, Link2, LogOut, CheckCircle2 } from 'lucide-react';
import { isSupabaseConfigured, supabaseSource, saveSupabaseCredentials, clearSupabaseCredentials } from '../supabaseClient';

export function SetupInstructions() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSqlOpen, setIsSqlOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Estados do Form dinâmico
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const sqlCode = `-- 1. Criar Tabela de Dívidas
create table dividas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data_divida date not null,
  descricao text not null,
  valor_inicial numeric(12, 2) not null,
  taxa_juros numeric(5, 2) not null, -- % ao período
  tipo_juros text not null default 'Compostos' check (tipo_juros in ('Simples', 'Compostos')),
  periodo_juros text not null default 'Mês' check (periodo_juros in ('Dia', 'Mês', 'Ano')),
  status text not null default 'Ativa' check (status in ('Ativa', 'Quitada'))
);

-- 2. Criar Tabela de Abatimentos (Pagamentos)
create table abatimentos (
  id uuid default gen_random_uuid() primary key,
  id_divida uuid references dividas(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data_pagamento date not null,
  valor numeric(12, 2) not null
);

-- 3. Desativar RLS para permitir acesso público sem autenticação
alter table dividas disable row level security;
alter table abatimentos disable row level security;

-- 4. Ativar Realtime para ambas tabelas
alter publication supabase_realtime add table dividas;
alter publication supabase_realtime add table abatimentos;`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      setError('Por favor, preencha a URL e a Chave Anon.');
      return;
    }

    if (!url.trim().startsWith('https://')) {
      setError('A URL do Supabase deve começar com https://');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      saveSupabaseCredentials(url.trim(), key.trim());
      // Recarrega a página após salvar para re-inicializar o cliente Supabase real
      window.location.reload();
    } catch (err) {
      setError('Falha ao salvar as credenciais.');
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Deseja desconectar da nuvem e voltar ao modo offline local?')) {
      clearSupabaseCredentials();
      window.location.reload();
    }
  };

  return (
    <div className="w-full px-4 mb-6">
      <div className="minimal-card rounded-xl overflow-hidden transition-all duration-300">
        
        {/* Cabeçalho do Bloco */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left text-zinc-300 focus:outline-none hover:bg-zinc-900/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${isSupabaseConfigured ? 'border-zinc-800 bg-zinc-950/40' : 'border-zinc-800/80 bg-zinc-950/20'}`}>
              <Database className={`w-4 h-4 ${isSupabaseConfigured ? 'text-zinc-300' : 'text-zinc-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-200 uppercase tracking-wider">
                {isSupabaseConfigured ? 'Nuvem Conectada' : 'Modo Offline Ativo'}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">
                {isSupabaseConfigured 
                  ? `Sincronização em nuvem via ${supabaseSource === 'env' ? 'arquivo .env' : 'credenciais locais'}` 
                  : 'Dados salvos localmente. Clique para conectar ao Supabase.'}
              </p>
            </div>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>

        {isOpen && (
          <div className="px-5 pb-5 pt-1 border-t border-zinc-900 text-xs space-y-4 text-zinc-400 animate-fadeIn">
            
            {isSupabaseConfigured ? (
              // Modo Conectado
              <div className="space-y-3.5">
                <div className="flex items-start gap-2.5 p-3 bg-zinc-900/20 border border-zinc-800/50 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-zinc-300 leading-normal">Tudo pronto!</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                      Seu aplicativo está sincronizado com a nuvem em tempo real. Qualquer alteração de dívida ou amortização será refletida imediatamente em todos os dispositivos conectados.
                    </p>
                  </div>
                </div>

                {supabaseSource === 'local' && (
                  <button
                    onClick={handleDisconnect}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-800 text-zinc-400 font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Desconectar Banco de Dados
                  </button>
                )}
              </div>
            ) : (
              // Modo Desconectado - Formulário de Conexão
              <div className="space-y-4">
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Para sincronizar dívidas entre duas pessoas em tempo real, configure um banco de dados **Supabase** gratuito. Insira as chaves abaixo para conectar instantaneamente:
                </p>

                <form onSubmit={handleConnect} className="space-y-3">
                  {/* URL */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-zinc-600" /> Supabase URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://sua-url-aqui.supabase.co"
                      required
                      className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal"
                    />
                  </div>

                  {/* Chave Anon */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1">
                      <Key className="w-3 h-3 text-zinc-600" /> Supabase Anon Key
                    </label>
                    <input
                      type="password"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="Chave anônima (anon public key)"
                      required
                      className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal"
                    />
                  </div>

                  {error && <p className="text-[10px] text-zinc-400 font-medium">{error}</p>}

                  <button
                    type="submit"
                    disabled={connecting}
                    className="w-full py-2.5 bg-white text-zinc-950 font-bold rounded-lg transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? 'Conectando...' : 'Salvar & Sincronizar'}
                  </button>
                </form>
              </div>
            )}

            {/* Acordeão do SQL de Tabelas */}
            <div className="border-t border-zinc-900 pt-3.5 space-y-2">
              <button
                onClick={() => setIsSqlOpen(!isSqlOpen)}
                className="w-full flex items-center justify-between text-left text-zinc-500 hover:text-zinc-300 font-semibold uppercase tracking-wider text-[10px]"
              >
                <span>Estrutura SQL do Banco</span>
                {isSqlOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {isSqlOpen && (
                <div className="space-y-2.5 animate-fadeIn pt-1.5">
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    Crie estas tabelas no console do seu Supabase em **SQL Editor** &gt; **New query** e clique em **Run**:
                  </p>
                  <div className="relative">
                    <pre className="text-[9px] leading-relaxed font-mono bg-zinc-950/70 p-3 rounded-lg overflow-x-auto max-h-36 border border-zinc-900 text-zinc-500 select-all">
                      {sqlCode}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(sqlCode, 'sql')}
                      className="absolute top-2 right-2 p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Copiar Código SQL"
                    >
                      {copied === 'sql' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
