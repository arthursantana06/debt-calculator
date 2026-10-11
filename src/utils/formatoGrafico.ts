/**
 * Cores e formatação compartilhadas pelos gráficos da Rentabilidade Real.
 *
 * A cor segue a ENTIDADE: saldo é sempre azul, abatimento sempre verde-água,
 * capital originado sempre laranja, IPCA sempre cinza. As três cores de série
 * foram validadas (separação para daltonismo e contraste) contra a superfície
 * escura do app; good/critical são cores de estado e nunca andam sem ícone.
 */

export const COR = {
  saldo: '#3987e5',
  originado: '#d95926',
  abatido: '#199e70',
  ipca: '#8b8b94',
  grid: '#1f1f23',
  base: '#3f3f46',
  muted: '#71717a',
  sec: '#a1a1aa',
  ink: '#f4f4f5',
  surface: '#0c0c0e',
  good: '#0ca30c',
  critical: '#d03b3b',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const fmtBRL = (v: number) => brl.format(v);

/** Eixos: "R$ 850", "R$ 1,2 mil", "R$ 3,4 mi". */
export const fmtBRLCompacto = (v: number) =>
  Math.abs(v) < 1000 ? brl.format(Math.round(v)).replace(/,00$/, '') : brlCompacto.format(v);

export const fmtPct = (v: number | null, casas = 1) =>
  v === null
    ? '—'
    : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const fmtData = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-01" → "jan/26" (com ano) ou "jan". */
export const rotuloMes = (mes: string, comAno: boolean) => {
  const [a, m] = mes.split('-');
  return comAno ? `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}` : MESES_CURTOS[Number(m) - 1];
};
