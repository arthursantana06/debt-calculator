/**
 * Gráficos da Rentabilidade Real — SVG e HTML feitos à mão, sem biblioteca.
 *
 * Convenções (iguais em todos os gráficos):
 * - a cor segue a ENTIDADE, nunca a posição: saldo é sempre azul, abatimento
 *   sempre verde-água, capital originado sempre laranja, IPCA sempre cinza;
 * - linhas de 2px, colunas de no máximo 24px com ponta arredondada de 4px e
 *   base reta, 2px de superfície entre marcas que se tocam;
 * - texto nunca usa a cor da série — a identidade vem da marca ao lado;
 * - toda leitura do tooltip também existe na tabela do cartão.
 * Paleta validada (CVD e contraste) contra a superfície escura do app.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { parseLocalDate } from '../utils/calculations';
import type { ComposicaoDivida, FluxoMensal, PontoTrajetoria, Visao } from '../utils/rentabilidade';
import { COR, fmtBRL, fmtBRLCompacto, fmtData, fmtPct, rotuloMes } from '../utils/formatoGrafico';

/* ------------------------------------------------------------------ */
/* Infra                                                               */
/* ------------------------------------------------------------------ */

/** Largura real do contêiner — o SVG é desenhado em pixels de verdade, sem esticar texto. */
function useLargura<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setLargura(Math.floor(entry.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura];
}

/** Marcas de eixo em números redondos (1, 2, 2,5 ou 5 × 10^k). */
function ticksRedondos(min: number, max: number, alvo = 4): number[] {
  if (max === min) max = min + 1;
  const bruto = (max - min) / alvo;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= bruto) ?? 10 * mag;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Coluna com ponta arredondada (4px) do lado oposto à base, e base reta. */
function colunaPath(x: number, yBase: number, yPonta: number, w: number, r = 4): string {
  const altura = Math.abs(yPonta - yBase);
  const rr = Math.min(r, altura, w / 2);
  if (yPonta < yBase) {
    return `M${x},${yBase} V${yPonta + rr} Q${x},${yPonta} ${x + rr},${yPonta} H${x + w - rr} Q${x + w},${yPonta} ${x + w},${yPonta + rr} V${yBase} Z`;
  }
  return `M${x},${yBase} V${yPonta - rr} Q${x},${yPonta} ${x + rr},${yPonta} H${x + w - rr} Q${x + w},${yPonta} ${x + w},${yPonta - rr} V${yBase} Z`;
}

/* ------------------------------------------------------------------ */
/* Peças compartilhadas                                                */
/* ------------------------------------------------------------------ */

export interface ItemLegenda {
  cor: string;
  rotulo: string;
  forma: 'linha' | 'bloco' | 'marco';
}

export function Legenda({ itens }: { itens: ItemLegenda[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {itens.map((it) => (
        <span key={it.rotulo} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          {it.forma === 'linha' && <span className="w-3 h-[2px] rounded-full" style={{ background: it.cor }} />}
          {it.forma === 'bloco' && <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: it.cor }} />}
          {it.forma === 'marco' && <span className="w-[2px] h-3 rounded-full" style={{ background: it.cor }} />}
          {it.rotulo}
        </span>
      ))}
    </div>
  );
}

export interface Tabela {
  colunas: string[];
  linhas: (string | number)[][];
}

export function ChartCard({
  titulo,
  subtitulo,
  legenda,
  tabela,
  rodape,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  legenda?: ItemLegenda[];
  tabela: Tabela;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const [verTabela, setVerTabela] = useState(false);

  return (
    <section className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-200">{titulo}</h4>
          {subtitulo && <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{subtitulo}</p>}
        </div>
        <button
          onClick={() => setVerTabela((v) => !v)}
          className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-200 border border-zinc-900 hover:border-zinc-800 rounded-md px-2 py-1 transition-colors cursor-pointer flex-shrink-0"
          title={verTabela ? 'Ver gráfico' : 'Ver os números em tabela'}
        >
          {verTabela ? <BarChart3 className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
          {verTabela ? 'Gráfico' : 'Tabela'}
        </button>
      </header>

      {legenda && !verTabela && <Legenda itens={legenda} />}

      {verTabela ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-zinc-900">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-zinc-950">
              <tr>
                {tabela.colunas.map((c, i) => (
                  <th
                    key={c}
                    className={`px-2.5 py-2 font-semibold uppercase tracking-wider text-[9px] text-zinc-500 border-b border-zinc-900 ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha, i) => (
                <tr key={i} className="border-b border-zinc-900/60 last:border-0">
                  {linha.map((cel, j) => (
                    <td
                      key={j}
                      className={`px-2.5 py-1.5 ${
                        j === 0 ? 'text-left text-zinc-300' : 'text-right font-mono tabular-nums text-zinc-400'
                      }`}
                    >
                      {cel}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}

      {rodape && <div className="text-[9px] text-zinc-600 leading-relaxed">{rodape}</div>}
    </section>
  );
}

interface LinhaTooltip {
  cor?: string;
  forma?: 'linha' | 'bloco';
  valor: string;
  rotulo: string;
}

/** Valor primeiro, rótulo depois — o leitor já sabe a série, quer o número. */
function Tooltip({
  x,
  y,
  largura,
  titulo,
  linhas,
}: {
  x: number;
  y: number;
  largura: number;
  titulo: string;
  linhas: LinhaTooltip[];
}) {
  const aDireita = x < largura * 0.55;
  return (
    <div
      className="absolute z-10 pointer-events-none rounded-lg border border-zinc-800 bg-zinc-950/95 backdrop-blur-sm px-2.5 py-2 shadow-xl shadow-black/40 min-w-[9.5rem]"
      style={{
        left: x,
        top: y,
        transform: `translate(${aDireita ? '12px' : 'calc(-100% - 12px)'}, -50%)`,
      }}
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">{titulo}</div>
      <div className="space-y-1">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-center gap-2">
            {l.cor ? (
              l.forma === 'bloco' ? (
                <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: l.cor }} />
              ) : (
                <span className="w-2.5 h-[2px] rounded-full flex-shrink-0" style={{ background: l.cor }} />
              )
            ) : (
              <span className="w-2.5 flex-shrink-0" />
            )}
            <span className="text-[11px] font-semibold text-zinc-100 tabular-nums">{l.valor}</span>
            <span className="text-[10px] text-zinc-500 ml-auto pl-2">{l.rotulo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Trajetória do saldo × capital corrigido pelo IPCA                 */
/* ------------------------------------------------------------------ */

export function TrajetoriaChart({ pontos, visao }: { pontos: PontoTrajetoria[]; visao: Visao }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  const altura = 220;
  const m = { top: 14, right: 14, bottom: 26, left: 56 };
  const w = Math.max(0, largura - m.left - m.right);
  const h = altura - m.top - m.bottom;

  const temIpca = pontos.some((p) => p.corrigido !== null);
  const tempos = pontos.map((p) => parseLocalDate(p.data).getTime());
  const t0 = tempos[0] ?? 0;
  const t1 = tempos[tempos.length - 1] ?? 1;
  const maxY = Math.max(1, ...pontos.map((p) => Math.max(p.saldo, p.corrigido ?? 0)));
  const ticksY = ticksRedondos(0, maxY, 4);
  const topoY = ticksY[ticksY.length - 1];

  const x = (t: number) => (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const y = (v: number) => h - (v / topoY) * h;

  const caminho = (valores: (number | null)[]) =>
    valores
      .map((v, i) => (v === null ? null : `${x(tempos[i]).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`)
      .join(' ');

  const linhaSaldo = caminho(pontos.map((p) => p.saldo));
  const areaSaldo = pontos.length ? `${linhaSaldo} L${x(t1).toFixed(1)},${h} L${x(t0).toFixed(1)},${h} Z` : '';
  const linhaIpca = temIpca ? caminho(pontos.map((p) => p.corrigido)) : '';

  // Marcas de tempo: inícios de mês, rareados para caber.
  const ticksX: { t: number; rotulo: string }[] = [];
  if (pontos.length) {
    const ini = new Date(t0);
    const meses: Date[] = [];
    for (let d = new Date(ini.getFullYear(), ini.getMonth() + 1, 1, 12); d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) {
      meses.push(new Date(d));
    }
    const cabem = Math.max(1, Math.floor(w / 56));
    const salto = Math.max(1, Math.ceil(meses.length / cabem));
    meses.forEach((d, i) => {
      if (i % salto !== 0) return;
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ticksX.push({ t: d.getTime(), rotulo: rotuloMes(mes, d.getMonth() === 0 || i === 0) });
    });
  }

  const moverPara = useCallback(
    (clientX: number, rect: DOMRect) => {
      const px = clientX - rect.left - m.left;
      let melhor = 0;
      let dist = Infinity;
      tempos.forEach((t, i) => {
        const dd = Math.abs(x(t) - px);
        if (dd < dist) {
          dist = dd;
          melhor = i;
        }
      });
      setFoco(melhor);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tempos.length, t0, t1, w]
  );

  const p = foco !== null ? pontos[foco] : null;
  const diferenca = p && p.corrigido !== null ? (visao === 'credor' ? 1 : -1) * (p.saldo - p.corrigido) : null;

  // Rótulos de ponta só quando não colidem.
  const ultimo = pontos[pontos.length - 1];
  const yFimSaldo = ultimo ? y(ultimo.saldo) : 0;
  const yFimIpca = ultimo && ultimo.corrigido !== null ? y(ultimo.corrigido) : null;
  const separados = yFimIpca === null || Math.abs(yFimSaldo - yFimIpca) > 16;

  return (
    <div ref={ref} className="relative select-none" style={{ height: altura }}>
      {largura > 0 && pontos.length > 1 && (
        <svg width={largura} height={altura} className="absolute inset-0 block overflow-visible">
          <defs>
            <linearGradient id="grad-saldo" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COR.saldo} stopOpacity={0.16} />
              <stop offset="100%" stopColor={COR.saldo} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <g transform={`translate(${m.left},${m.top})`}>
            {ticksY.map((v) => (
              <g key={v}>
                <line x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={v === 0 ? COR.base : COR.grid} strokeWidth={1} />
                <text x={-10} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={COR.muted} className="tabular-nums">
                  {fmtBRLCompacto(v)}
                </text>
              </g>
            ))}
            {ticksX.map((tk) => (
              <text key={tk.t} x={x(tk.t)} y={h + 17} textAnchor="middle" fontSize={10} fill={COR.muted}>
                {tk.rotulo}
              </text>
            ))}

            <path d={areaSaldo} fill="url(#grad-saldo)" />
            {temIpca && (
              <path d={linhaIpca} fill="none" stroke={COR.ipca} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}
            <path d={linhaSaldo} fill="none" stroke={COR.saldo} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* Pontas com anel de superfície */}
            {ultimo && yFimIpca !== null && (
              <circle cx={x(t1)} cy={yFimIpca} r={4} fill={COR.ipca} stroke={COR.surface} strokeWidth={2} />
            )}
            {ultimo && <circle cx={x(t1)} cy={yFimSaldo} r={4} fill={COR.saldo} stroke={COR.surface} strokeWidth={2} />}

            {separados && ultimo && (
              <>
                <text x={x(t1) - 8} y={yFimSaldo - 9} textAnchor="end" fontSize={10} fontWeight={600} fill={COR.ink}>
                  {fmtBRLCompacto(ultimo.saldo)}
                </text>
                {yFimIpca !== null && ultimo.corrigido !== null && (
                  <text x={x(t1) - 8} y={yFimIpca + 15} textAnchor="end" fontSize={10} fill={COR.sec}>
                    {fmtBRLCompacto(ultimo.corrigido)}
                  </text>
                )}
              </>
            )}

            {/* Mira */}
            {p && (
              <g pointerEvents="none">
                <line x1={x(tempos[foco!])} x2={x(tempos[foco!])} y1={0} y2={h} stroke={COR.base} strokeWidth={1} />
                {p.corrigido !== null && (
                  <circle cx={x(tempos[foco!])} cy={y(p.corrigido)} r={4} fill={COR.ipca} stroke={COR.surface} strokeWidth={2} />
                )}
                <circle cx={x(tempos[foco!])} cy={y(p.saldo)} r={4} fill={COR.saldo} stroke={COR.surface} strokeWidth={2} />
              </g>
            )}

            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill="transparent"
              tabIndex={0}
              className="outline-none cursor-crosshair"
              onPointerMove={(e) => moverPara(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onPointerLeave={() => setFoco(null)}
              onFocus={() => setFoco(pontos.length - 1)}
              onBlur={() => setFoco(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setFoco((f) => Math.max(0, (f ?? pontos.length - 1) - 1));
                if (e.key === 'ArrowRight') setFoco((f) => Math.min(pontos.length - 1, (f ?? 0) + 1));
              }}
            />
          </g>
        </svg>
      )}

      {p && (
        <Tooltip
          x={m.left + x(tempos[foco!])}
          y={m.top + y(p.saldo)}
          largura={largura}
          titulo={fmtData(p.data)}
          linhas={[
            { cor: COR.saldo, valor: fmtBRL(p.saldo), rotulo: 'Saldo' },
            ...(p.corrigido !== null
              ? [
                  { cor: COR.ipca, valor: fmtBRL(p.corrigido), rotulo: 'Corrigido IPCA' },
                  { valor: `${diferenca! >= 0 ? '+' : ''}${fmtBRL(diferenca!)}`, rotulo: 'Ganho real' },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Fluxo de caixa mensal — entradas para cima, saídas para baixo     */
/* ------------------------------------------------------------------ */

export function FluxoMensalChart({ meses, visao }: { meses: FluxoMensal[]; visao: Visao }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  const altura = 210;
  const m = { top: 12, right: 8, bottom: 26, left: 66 };
  const w = Math.max(0, largura - m.left - m.right);
  const h = altura - m.top - m.bottom;

  // Credor: empresta (sai) e recebe abatimentos (entra). Devedor: o espelho.
  const sinalOriginado = visao === 'credor' ? -1 : 1;
  const sinalAbatido = -sinalOriginado;

  const maxCima = Math.max(0, ...meses.map((x) => (sinalOriginado > 0 ? x.originado : x.abatido)));
  const maxBaixo = Math.max(0, ...meses.map((x) => (sinalOriginado > 0 ? x.abatido : x.originado)));
  const ticks = ticksRedondos(-maxBaixo || -1, maxCima || 1, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => h - ((v - yMin) / (yMax - yMin)) * h;
  const y0 = y(0);

  const banda = meses.length ? w / meses.length : 0;
  const larguraCol = Math.max(2, Math.min(24, banda * 0.62));

  const cabem = Math.max(1, Math.floor(w / 40));
  const salto = Math.max(1, Math.ceil(meses.length / cabem));

  const f = foco !== null ? meses[foco] : null;
  const liquido = f ? sinalOriginado * f.originado + sinalAbatido * f.abatido : 0;

  return (
    <div ref={ref} className="relative select-none" style={{ height: altura }}>
      {largura > 0 && meses.length > 0 && (
        <svg width={largura} height={altura} className="absolute inset-0 block">
          <g transform={`translate(${m.left},${m.top})`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={v === 0 ? COR.base : COR.grid} strokeWidth={1} />
                <text x={-10} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={COR.muted} className="tabular-nums">
                  {v === 0 ? 'R$ 0' : `${v > 0 ? '+' : '−'}${fmtBRLCompacto(Math.abs(v))}`}
                </text>
              </g>
            ))}

            {meses.map((mes, i) => {
              const cx = i * banda + (banda - larguraCol) / 2;
              const ativo = foco === null || foco === i;
              const vOrig = sinalOriginado * mes.originado;
              const vAbat = sinalAbatido * mes.abatido;
              return (
                <g key={mes.mes} opacity={ativo ? 1 : 0.35} style={{ transition: 'opacity 120ms' }}>
                  {mes.originado > 0 && (
                    <path
                      d={colunaPath(cx, vOrig > 0 ? y0 - 1 : y0 + 1, y(vOrig), larguraCol)}
                      fill={COR.originado}
                    />
                  )}
                  {mes.abatido > 0 && (
                    <path d={colunaPath(cx, vAbat > 0 ? y0 - 1 : y0 + 1, y(vAbat), larguraCol)} fill={COR.abatido} />
                  )}
                  {i % salto === 0 && (
                    <text x={i * banda + banda / 2} y={h + 17} textAnchor="middle" fontSize={10} fill={COR.muted}>
                      {rotuloMes(mes.mes, mes.mes.endsWith('-01') || i === 0)}
                    </text>
                  )}
                  <rect
                    x={i * banda}
                    y={0}
                    width={banda}
                    height={h}
                    fill="transparent"
                    tabIndex={0}
                    className="outline-none"
                    onPointerEnter={() => setFoco(i)}
                    onPointerLeave={() => setFoco(null)}
                    onFocus={() => setFoco(i)}
                    onBlur={() => setFoco(null)}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {f && foco !== null && (
        <Tooltip
          x={m.left + foco * banda + banda / 2}
          y={m.top + y0}
          largura={largura}
          titulo={rotuloMes(f.mes, true)}
          linhas={[
            {
              cor: COR.originado,
              forma: 'bloco',
              valor: `${sinalOriginado > 0 ? '+' : '−'}${fmtBRL(f.originado)}`,
              rotulo: visao === 'credor' ? 'Emprestado' : 'Recebido',
            },
            {
              cor: COR.abatido,
              forma: 'bloco',
              valor: `${sinalAbatido > 0 ? '+' : '−'}${fmtBRL(f.abatido)}`,
              rotulo: visao === 'credor' ? 'Recebido' : 'Pago',
            },
            { valor: `${liquido >= 0 ? '+' : '−'}${fmtBRL(Math.abs(liquido))}`, rotulo: 'Líquido' },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Inicial × abatido × em aberto, por dívida                         */
/* ------------------------------------------------------------------ */

/**
 * `total` (opcional) vem no topo com escala própria: na escala das dívidas ele
 * seria várias vezes maior e achataria todas as outras barras.
 */
export function ComposicaoChart({
  linhas,
  total,
  visao,
}: {
  linhas: ComposicaoDivida[];
  total?: ComposicaoDivida;
  visao: Visao;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const escalaDe = (ls: ComposicaoDivida[]) => Math.max(1, ...ls.map((l) => Math.max(l.abatido + l.saldo, l.inicial)));
  const escala = escalaDe(linhas);

  const linha = (l: ComposicaoDivida, esc: number, destaque = false) => (
    <LinhaComposicao
      key={l.id}
      l={l}
      escala={esc}
      visao={visao}
      destaque={destaque}
      ativo={foco === null || foco === l.id}
      aberto={foco === l.id}
      onFoco={(on) => setFoco(on ? l.id : null)}
    />
  );

  return (
    <div className="space-y-2.5">
      {total && (
        <>
          {linha(total, escalaDe([total]), true)}
          <div className="h-px bg-zinc-900" />
        </>
      )}
      {linhas.map((l) => linha(l, escala))}
    </div>
  );
}

function LinhaComposicao({
  l,
  escala,
  visao,
  destaque,
  ativo,
  aberto,
  onFoco,
}: {
  l: ComposicaoDivida;
  escala: number;
  visao: Visao;
  destaque: boolean;
  ativo: boolean;
  aberto: boolean;
  onFoco: (on: boolean) => void;
}) {
  const total = l.abatido + l.saldo;
  const pAbat = (l.abatido / escala) * 100;
  const pSaldo = (l.saldo / escala) * 100;
  const pInicial = (l.inicial / escala) * 100;
  const temDois = l.abatido > 0.005 && l.saldo > 0.005;

  return (
    <div
      tabIndex={0}
      onPointerEnter={() => onFoco(true)}
      onPointerLeave={() => onFoco(false)}
      onFocus={() => onFoco(true)}
      onBlur={() => onFoco(false)}
      className="relative outline-none rounded-md -mx-1.5 px-1.5 py-1 transition-colors hover:bg-zinc-900/40 focus-visible:bg-zinc-900/40"
      style={{ opacity: ativo ? 1 : 0.4, transition: 'opacity 120ms' }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span
          className={`truncate ${
            destaque ? 'text-[10px] font-bold uppercase tracking-wider text-zinc-200' : 'text-[11px] text-zinc-300'
          }`}
        >
          {l.descricao}
        </span>
        <span className="text-[10px] font-semibold text-zinc-200 tabular-nums flex-shrink-0">{fmtBRL(total)}</span>
      </div>

      <div className={`relative ${destaque ? 'h-4' : 'h-3'}`}>
        <div className="absolute inset-y-0 left-0 flex" style={{ width: `${pAbat + pSaldo}%` }}>
          {l.abatido > 0.005 && (
            <div
              className="h-full"
              style={{
                width: `${(pAbat / (pAbat + pSaldo)) * 100}%`,
                background: COR.abatido,
                borderRadius: l.saldo > 0.005 ? 0 : '0 4px 4px 0',
                marginRight: temDois ? 2 : 0,
              }}
            />
          )}
          {l.saldo > 0.005 && (
            <div
              className="h-full flex-1"
              style={{ background: COR.saldo, borderRadius: '0 4px 4px 0' }}
            />
          )}
        </div>
        {/* Marco do valor inicial — o que passa dele é juro */}
        <div
          className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full"
          style={{ left: `calc(${pInicial}% - 1px)`, background: COR.ink, boxShadow: `0 0 0 2px ${COR.surface}` }}
        />
      </div>

      {aberto && (
        <div className="grid grid-cols-4 gap-2 mt-2 text-[9px] animate-fadeIn">
          {[
            { r: 'Inicial', v: l.inicial },
            { r: 'Juros', v: l.juros },
            { r: visao === 'credor' ? 'Recebido' : 'Pago', v: l.abatido },
            { r: 'Em aberto', v: l.saldo },
          ].map((c) => (
            <div key={c.r}>
              <span className="block text-zinc-500 uppercase tracking-wider">{c.r}</span>
              <span className="block text-zinc-200 font-semibold tabular-nums mt-0.5">{fmtBRL(c.v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. TIR real por dívida — barras divergentes a partir do IPCA          */
/* ------------------------------------------------------------------ */

export function TirPorDividaChart({ linhas }: { linhas: ComposicaoDivida[] }) {
  const [foco, setFoco] = useState<string | null>(null);
  const comTaxa = linhas.filter((l) => l.tirReal !== null);
  const min = Math.min(0, ...comTaxa.map((l) => l.tirReal!));
  const max = Math.max(0, ...comTaxa.map((l) => l.tirReal!));
  const amplitude = max - min || 1;
  const zero = (-min / amplitude) * 100;
  const ordenadas = [...linhas].sort((a, b) => (b.tirReal ?? -Infinity) - (a.tirReal ?? -Infinity));

  return (
    <div className="space-y-2">
      {ordenadas.map((l) => {
        const v = l.tirReal;
        const ativo = foco === null || foco === l.id;
        const larguraPct = v === null ? 0 : (Math.abs(v) / amplitude) * 100;
        const positivo = (v ?? 0) >= 0;

        return (
          <div
            key={l.id}
            tabIndex={0}
            onPointerEnter={() => setFoco(l.id)}
            onPointerLeave={() => setFoco(null)}
            onFocus={() => setFoco(l.id)}
            onBlur={() => setFoco(null)}
            className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.75rem] items-center gap-2.5 outline-none rounded-md -mx-1.5 px-1.5 py-1 hover:bg-zinc-900/40 focus-visible:bg-zinc-900/40"
            style={{ opacity: ativo ? 1 : 0.4, transition: 'opacity 120ms' }}
            title={v === null ? 'Prazo curto demais para anualizar' : `Nominal ${fmtPct(l.tirNominal)} a.a.`}
          >
            <span className="text-[10px] text-zinc-400 truncate">{l.descricao}</span>
            <div className="relative h-3">
              <div className="absolute inset-y-[-4px] w-px" style={{ left: `${zero}%`, background: COR.base }} />
              {v !== null && (
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: positivo ? `calc(${zero}% + 1px)` : `calc(${zero - larguraPct}% - 1px)`,
                    width: `${larguraPct}%`,
                    background: COR.saldo,
                    borderRadius: positivo ? '0 4px 4px 0' : '4px 0 0 4px',
                  }}
                />
              )}
            </div>
            <span className="text-[10px] text-right tabular-nums font-semibold text-zinc-200">
              {v === null ? <span className="text-zinc-600 font-normal">n/d</span> : fmtPct(v)}
            </span>
            {foco === l.id && v !== null && (
              <span className="col-span-3 text-[9px] text-zinc-500 -mt-0.5 animate-fadeIn">
                Nominal {fmtPct(l.tirNominal)} a.a. · real {fmtPct(v)} a.a.
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
