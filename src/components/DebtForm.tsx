import { useState } from 'react';
import { Plus, X, Calendar, DollarSign, Tag, ChevronDown } from 'lucide-react';

interface DebtFormProps {
  onAddDebt: (debt: {
    data_divida: string;
    descricao: string;
    valor_inicial: number;
    taxa_juros: number;
    tipo_juros: 'Simples' | 'Compostos';
    periodo_juros?: 'Dia' | 'Mês' | 'Ano';
    status: 'Ativa' | 'Quitada';
  }) => Promise<boolean>;
}

export function DebtForm({ onAddDebt }: DebtFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados do formulário
  const [descricao, setDescricao] = useState('');
  const [valorInicial, setValorInicial] = useState('');
  const [taxaJuros, setTaxaJuros] = useState('0');
  const [periodoJuros, setPeriodoJuros] = useState<'Dia' | 'Mês' | 'Ano'>('Mês');
  
  // Data inicial padrão: hoje formatada em YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString('en-CA'); // en-CA gera YYYY-MM-DD local
  const [dataDivida, setDataDivida] = useState(todayStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !valorInicial || Number(valorInicial) <= 0) return;

    setLoading(true);
    try {
      const success = await onAddDebt({
        descricao: descricao.trim(),
        valor_inicial: parseFloat(valorInicial),
        taxa_juros: parseFloat(taxaJuros) || 0,
        tipo_juros: 'Compostos', // Sempre Composto
        periodo_juros: periodoJuros,
        data_divida: dataDivida,
        status: 'Ativa',
      });

      if (success) {
        // Limpar campos
        setDescricao('');
        setValorInicial('');
        setTaxaJuros('0');
        setPeriodoJuros('Mês');
        setDataDivida(todayStr);
        setIsOpen(false); // Fecha o form
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 mb-4">
      {/* Botão de abrir/fechar */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.99] text-zinc-950 font-bold rounded-xl transition duration-150 cursor-pointer text-xs"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Nova Dívida
        </button>
      ) : (
        <div className="minimal-card rounded-xl p-5 border border-zinc-855 bg-zinc-900/10 relative animate-slideDown">
          {/* Cabeçalho do Form */}
          <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
            <h3 className="font-bold text-zinc-200 text-xs uppercase tracking-wider">Registrar Nova Dívida</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo: Descrição */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1 uppercase tracking-wider">
                <Tag className="w-3 h-3 text-zinc-650" /> Motivo / Descrição
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Viagem de fim de ano, Aluguel, Uber"
                required
                className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal"
              />
            </div>

            {/* Grid Lado-a-Lado: Valor e Data */}
            <div className="grid grid-cols-2 gap-3">
              {/* Campo: Valor Inicial */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1 uppercase tracking-wider">
                  <DollarSign className="w-3 h-3 text-zinc-650" /> Valor Inicial
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-zinc-600 text-xs font-mono">R$</span>
                  <input
                    type="number"
                    value={valorInicial}
                    onChange={(e) => setValorInicial(e.target.value)}
                    placeholder="0,00"
                    step="0.01"
                    min="0.01"
                    required
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
                  />
                </div>
              </div>

              {/* Campo: Data */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1 uppercase tracking-wider">
                  <Calendar className="w-3 h-3 text-zinc-650" /> Data da Dívida
                </label>
                <input
                  type="date"
                  value={dataDivida}
                  onChange={(e) => setDataDivida(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 focus-minimal [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Grid Lado-a-Lado: Taxa de Juros e Período */}
            <div className="grid grid-cols-2 gap-3">
              {/* Campo: Taxa */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Taxa de Juros (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={taxaJuros}
                    onChange={(e) => setTaxaJuros(e.target.value)}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-mono"
                  />
                  <span className="absolute right-3.5 top-2 text-zinc-600 text-xs font-mono">%</span>
                </div>
              </div>

              {/* Campo: Período */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Período dos Juros
                </label>
                <div className="relative">
                  <select
                    value={periodoJuros}
                    onChange={(e) => setPeriodoJuros(e.target.value as 'Dia' | 'Mês' | 'Ano')}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs text-zinc-200 focus-minimal appearance-none cursor-pointer"
                  >
                    <option value="Dia" className="bg-zinc-900">Por Dia</option>
                    <option value="Mês" className="bg-zinc-900">Por Mês</option>
                    <option value="Ano" className="bg-zinc-900">Por Ano</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Botão de Enviar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg active:scale-[0.98] transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 text-xs"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Registrar Dívida'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
