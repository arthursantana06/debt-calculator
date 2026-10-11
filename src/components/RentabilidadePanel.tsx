import { useEffect, useMemo, useState } from 'react';
import { X, LineChart, TrendingUp, TrendingDown, ChevronDown, Info, Loader2 } from 'lucide-react';
import type { Debt, Payment } from '../utils/calculations';
import {
  calcularIndicadores,
  composicaoPorDivida,
  criarIndiceIpca,
  fetchIpca,
  fluxoMensal,
  trajetoriaSaldo,
  PRAZO_MINIMO_DIAS,
} from '../utils/rentabilidade';
import type { ComposicaoDivida, IndiceIpca, Visao } from '../utils/rentabilidade';
import { ChartCard, ComposicaoChart, FluxoMensalChart, TirPorDividaChart, TrajetoriaChart } from './RentabilidadeCharts';
import { COR, fmtBRL, fmtData, fmtPct } from '../utils/formatoGrafico';

interface RentabilidadePanelProps {
  debts: Debt[];
  payments: Payment[];
  onClose: () => void;
}

const VISAO_KEY = 'debt_calculator_visao';

const lerVisao = (): Visao => {
  try {
    return localStorage.getItem(VISAO_KEY) === 'devedor' ? 'devedor' : 'credor';
  } catch {
    return 'credor';
  }
};

type EstadoIpca = { status: 'carregando' | 'ok' | 'erro'; indice: IndiceIpca | null };

export function RentabilidadePanel({ debts, payments, onClose }: RentabilidadePanelProps) {
  const [visao, setVisao] = useState<Visao>(lerVisao);
  const [filtro, setFiltro] = useState<string>('todas');
  const [ipca, setIpca] = useState<EstadoIpca>({ status: 'carregando', indice: null });
  const [metodoAberto, setMetodoAberto] = useState(false);

  const credor = visao === 'credor';

  // O IPCA só precisa cobrir a partir da dívida mais antiga.
  const desde = useMemo(
    () => debts.reduce((min, d) => (d.data_divida < min ? d.data_divida : min), '9999-12-31'),
    [debts]
  );

  useEffect(() => {
    let vivo = true;
    const inicio = desde === '9999-12-31' ? new Date() : new Date(`${desde}T12:00:00`);
    fetchIpca(inicio)
      .then((serie) => vivo && setIpca({ status: 'ok', indice: criarIndiceIpca(serie) }))
      .catch((err) => {
        console.error('Erro ao buscar o IPCA:', err);
        if (vivo) setIpca({ status: 'erro', indice: null });
      });
    return () => {
      vivo = false;
    };
  }, [desde]);

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(VISAO_KEY, v);
    } catch {
      // Preferência apenas não persiste.
    }
  };

  const escopo = useMemo(
    () => (filtro === 'todas' ? debts : debts.filter((d) => d.id === filtro)),
    [debts, filtro]
  );

  const indice = ipca.indice;
  const ind = useMemo(() => calcularIndicadores(escopo, payments, visao, indice), [escopo, payments, visao, indice]);
  const trajetoria = useMemo(() => trajetoriaSaldo(escopo, payments, indice), [escopo, payments, indice]);
  const mensal = useMemo(() => fluxoMensal(escopo, payments), [escopo, payments]);
  const composicao = useMemo(() => composicaoPorDivida(escopo, payments, indice), [escopo, payments, indice]);

  const totalComposicao: ComposicaoDivida | undefined = useMemo(() => {
    if (composicao.length < 2) return undefined;
    return composicao.reduce(
      (t, c) => ({
        ...t,
        inicial: t.inicial + c.inicial,
        juros: t.juros + c.juros,
        abatido: t.abatido + c.abatido,
        saldo: t.saldo + c.saldo,
      }),
      { id: 'total', descricao: 'Total', inicial: 0, juros: 0, abatido: 0, saldo: 0, tirReal: null, tirNominal: null }
    );
  }, [composicao]);

  const carregandoReal = ipca.status === 'carregando';
  const semReal = ipca.status === 'erro';
  const ganho = ind.ganhoReal;
  const positivo = (ganho ?? 0) >= 0;

  const rotulos = credor
    ? {
        tirNominal: 'TIR nominal',
        tirNominalSub: 'rentabilidade efetiva',
        tirReal: 'TIR real',
        tirRealSub: 'acima do IPCA',
        retorno: 'Retorno s/ capital',
        retornoSub: 'juros ÷ emprestado — o ROE do empréstimo',
        originado: 'Emprestado',
        abatido: 'Recebido',
      }
    : {
        tirNominal: 'Custo efetivo',
        tirNominalSub: 'TIR da dívida (CET)',
        tirReal: 'Custo real',
        tirRealSub: 'acima do IPCA',
        retorno: 'Custo s/ capital',
        retornoSub: 'juros ÷ valor recebido',
        originado: 'Recebido',
        abatido: 'Pago',
      };

  const tiles = [
    { r: rotulos.tirNominal, v: ind.tirNominal === null ? '—' : `${fmtPct(ind.tirNominal)} a.a.`, s: rotulos.tirNominalSub },
    {
      r: rotulos.tirReal,
      v: carregandoReal ? '…' : ind.tirReal === null ? '—' : `${fmtPct(ind.tirReal)} a.a.`,
      s: rotulos.tirRealSub,
    },
    { r: rotulos.retorno, v: fmtPct(ind.retornoCapital), s: rotulos.retornoSub },
    {
      r: 'IPCA no período',
      v: carregandoReal ? '…' : fmtPct(ind.ipcaPeriodo, 2),
      s: ind.desde ? `desde ${fmtData(ind.desde)}` : '',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-zinc-950 border-t md:border border-zinc-900 md:rounded-xl rounded-t-xl overflow-hidden minimal-panel z-10 animate-slideUp max-h-[94vh] flex flex-col">
        <div className="flex justify-center py-2 md:hidden">
          <div className="w-10 h-1 bg-zinc-900 rounded-full" />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-900 flex-shrink-0">
          <div>
            <h3 className="font-bold text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <LineChart className="w-3.5 h-3.5 text-zinc-500" />
              Rentabilidade Real
            </h3>
            <p className="text-[10px] text-zinc-550 mt-1 font-medium">
              {credor ? 'Quanto as dívidas renderam acima da inflação' : 'Quanto as dívidas custaram acima da inflação'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filtros — uma linha, valem para tudo abaixo */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-zinc-900 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900/30 border border-zinc-900 rounded-lg">
            {(['credor', 'devedor'] as const).map((v) => (
              <button
                key={v}
                onClick={() => trocarVisao(v)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  visao === v ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'credor' ? 'Credor' : 'Devedor'}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[10rem]">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-3 pr-8 py-1.5 text-[11px] text-zinc-300 focus-minimal appearance-none cursor-pointer"
            >
              <option value="todas" className="bg-zinc-900">Todas as dívidas</option>
              {debts.map((d) => (
                <option key={d.id} value={d.id} className="bg-zinc-900">
                  {d.descricao}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>

          <span className="text-[9px] text-zinc-600 flex items-center gap-1 w-full sm:w-auto">
            {carregandoReal ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> buscando IPCA no Banco Central…
              </>
            ) : semReal ? (
              'IPCA indisponível — só valores nominais'
            ) : (
              `IPCA · BCB até ${indice!.ultimoMes.split('-').reverse().join('/')}`
            )}
          </span>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {escopo.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-dashed border-zinc-900 text-[11px] text-zinc-600 italic">
              Nenhuma dívida registrada para analisar.
            </div>
          ) : (
            <>
              {/* Número de destaque */}
              <div className="rounded-xl border border-zinc-900 bg-gradient-to-b from-zinc-900/30 to-zinc-950 px-5 py-6 text-center">
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ganho real</span>
                <div className="mt-2 text-5xl font-light tracking-tight text-white">
                  {carregandoReal ? (
                    <span className="text-zinc-700">…</span>
                  ) : ganho === null ? (
                    <span className="text-zinc-700">—</span>
                  ) : (
                    `${positivo ? '+' : '−'}${fmtBRL(Math.abs(ganho))}`
                  )}
                </div>
                {ganho !== null && !carregandoReal && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] text-zinc-300">
                    {positivo ? (
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: COR.good }} />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" style={{ color: COR.critical }} />
                    )}
                    {credor
                      ? positivo
                        ? 'acima da inflação'
                        : 'abaixo da inflação'
                      : positivo
                      ? 'a inflação corroeu a dívida a seu favor'
                      : 'custou acima da inflação'}
                  </div>
                )}
                <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed max-w-sm mx-auto">
                  Em reais de hoje: tudo o que {credor ? 'entrou e saiu' : 'você recebeu e pagou'}, corrigido pelo IPCA até
                  hoje, mais o saldo em aberto.
                </p>
              </div>

              {/* Indicadores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tiles.map((t) => (
                  <div key={t.r} className="rounded-lg border border-zinc-900 bg-zinc-900/10 p-3">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{t.r}</span>
                    <span className="block mt-1.5 text-lg font-light text-zinc-100 leading-none">{t.v}</span>
                    <span className="block mt-1.5 text-[9px] text-zinc-600 leading-snug">{t.s}</span>
                  </div>
                ))}
              </div>

              {/* 1. Saldo × IPCA */}
              <ChartCard
                titulo="Saldo × inflação"
                subtitulo={
                  credor
                    ? 'Azul acima do cinza: o crédito cresceu mais que a inflação. A distância entre as linhas, hoje, é o ganho real.'
                    : 'Azul acima do cinza: a dívida cresceu mais que a inflação — esse é o seu custo real.'
                }
                legenda={[
                  { cor: COR.saldo, rotulo: 'Saldo devedor', forma: 'linha' },
                  ...(indice ? [{ cor: COR.ipca, rotulo: 'Capital corrigido pelo IPCA', forma: 'linha' as const }] : []),
                ]}
                tabela={{
                  colunas: ['Data', 'Saldo', 'Corrigido IPCA', 'Ganho real'],
                  linhas: trajetoria.map((p) => [
                    fmtData(p.data),
                    fmtBRL(p.saldo),
                    p.corrigido === null ? '—' : fmtBRL(p.corrigido),
                    p.corrigido === null ? '—' : fmtBRL((credor ? 1 : -1) * (p.saldo - p.corrigido)),
                  ]),
                }}
              >
                <TrajetoriaChart pontos={trajetoria} visao={visao} />
              </ChartCard>

              {/* 2. Fluxo de caixa */}
              <ChartCard
                titulo="Fluxo de caixa mensal"
                subtitulo={
                  credor
                    ? 'Para cima, o que voltou para o seu bolso; para baixo, o que você emprestou.'
                    : 'Para cima, o que você recebeu emprestado; para baixo, o que você pagou.'
                }
                legenda={[
                  { cor: COR.originado, rotulo: rotulos.originado, forma: 'bloco' },
                  { cor: COR.abatido, rotulo: rotulos.abatido, forma: 'bloco' },
                ]}
                tabela={{
                  colunas: ['Mês', rotulos.originado, rotulos.abatido],
                  linhas: mensal.map((mm) => [mm.mes.split('-').reverse().join('/'), fmtBRL(mm.originado), fmtBRL(mm.abatido)]),
                }}
              >
                <FluxoMensalChart meses={mensal} visao={visao} />
              </ChartCard>

              {/* 3. Inicial × abatido */}
              <ChartCard
                titulo="Inicial × abatido"
                subtitulo="Cada barra é o valor inicial mais os juros. O traço branco marca o valor inicial — o que passa dele é juro."
                legenda={[
                  { cor: COR.abatido, rotulo: rotulos.abatido, forma: 'bloco' },
                  { cor: COR.saldo, rotulo: 'Em aberto', forma: 'bloco' },
                  { cor: COR.ink, rotulo: 'Valor inicial', forma: 'marco' },
                ]}
                tabela={{
                  colunas: ['Dívida', 'Inicial', 'Juros', rotulos.abatido, 'Em aberto'],
                  linhas: [...(totalComposicao ? [totalComposicao] : []), ...composicao].map((c) => [
                    c.descricao,
                    fmtBRL(c.inicial),
                    fmtBRL(c.juros),
                    fmtBRL(c.abatido),
                    fmtBRL(c.saldo),
                  ]),
                }}
              >
                <ComposicaoChart linhas={composicao} total={totalComposicao} visao={visao} />
              </ChartCard>

              {/* 4. TIR real por dívida */}
              {filtro === 'todas' && composicao.length > 1 && indice && (
                <ChartCard
                  titulo={credor ? 'Rentabilidade real por dívida' : 'Custo real por dívida'}
                  subtitulo={
                    credor
                      ? 'TIR anual descontado o IPCA. À direita do traço, o empréstimo venceu a inflação.'
                      : 'TIR anual descontado o IPCA. À direita do traço, a dívida custou mais que a inflação.'
                  }
                  tabela={{
                    colunas: ['Dívida', 'TIR nominal a.a.', 'TIR real a.a.'],
                    linhas: composicao.map((c) => [c.descricao, fmtPct(c.tirNominal), fmtPct(c.tirReal)]),
                  }}
                  rodape={
                    composicao.some((c) => c.tirReal === null)
                      ? `n/d: menos de ${PRAZO_MINIMO_DIAS} dias entre o primeiro e o último fluxo — curto demais para anualizar.`
                      : undefined
                  }
                >
                  <TirPorDividaChart linhas={composicao} />
                </ChartCard>
              )}

              {/* Metodologia */}
              <div className="rounded-xl border border-zinc-900">
                <button
                  onClick={() => setMetodoAberto((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Como os números são calculados
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${metodoAberto ? 'rotate-180' : ''}`} />
                </button>
                {metodoAberto && (
                  <ul className="px-4 pb-4 space-y-2 text-[10px] text-zinc-500 leading-relaxed list-disc pl-8 animate-fadeIn">
                    <li>
                      <strong className="text-zinc-300">TIR</strong>: taxa anual que zera o valor presente de todos os fluxos
                      nas datas reais (XIRR, base 365). O saldo em aberto entra como se fosse recebido hoje, pelo valor do
                      contrato. A TIR é a mesma nas duas visões — muda a leitura: rentabilidade para o credor, custo para o
                      devedor.
                    </li>
                    <li>
                      <strong className="text-zinc-300">Real</strong>: cada fluxo é trazido a reais de hoje pelo IPCA
                      (BCB/SGS 433), distribuído dia a dia dentro do mês. Meses ainda não divulgados usam a média dos 12
                      últimos
                      {indice ? ` (${fmtPct(indice.taxaProjecao, 2)} a.m.)` : ''}.
                    </li>
                    <li>
                      <strong className="text-zinc-300">Retorno s/ capital</strong>: juros acumulados ÷ valor inicial. Não
                      é um ROE contábil — não há patrimônio líquido aqui —, é o equivalente para um empréstimo: quanto o
                      capital rendeu no período inteiro, sem anualizar.
                    </li>
                    <li>
                      <strong className="text-zinc-300">Ganho real</strong>: o que o credor ganhou acima da inflação, em
                      reais de hoje. Para o devedor é o mesmo número com o sinal trocado.
                    </li>
                    <li>Abatimentos acima do saldo entram pelo valor efetivamente aplicado, como no restante do app.</li>
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
