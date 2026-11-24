import type { ReplicaResult } from '@/types';

export interface Group {
  name: string;
  values: number[];
}

export interface AnovaRow {
  source: string;
  ss: number;
  df: number;
  ms: number;
  F: number | null;
  pValue: number | null;
  significant: boolean | null;
  etaSquared: number | null;
}

export interface AnovaResult {
  rows: AnovaRow[];
  totalMean: number;
  significant: boolean;
  etaSquared: number;
}

export interface TukeyPair {
  pair: string;
  diff: number;
  pAdjusted: number;
  ciLower: number;
  ciUpper: number;
  differs: boolean;
}

export interface GroupSummary {
  name: string;
  n: number;
  mean: number;
  s: number;
  ciLower: number;
  ciUpper: number;
  letter: string;
}

export interface TukeyResult {
  pairs: TukeyPair[];
  groups: GroupSummary[];
}

// Distribución F (CDF) aproximada con series continuas de Paulson
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta(a, b));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// log(B(a,b)) = lgamma(a)+lgamma(b)-lgamma(a+b)
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

// CDF de F(df1, df2): P(F <= f) = I_{df2/(df2+df1*f)}(df2/2, df1/2)
function fCDF(f: number, df1: number, df2: number): number {
  if (f <= 0) return 0;
  const x = df2 / (df2 + df1 * f);
  return betai(df2 / 2, df1 / 2, x);
}

// CDF de t-distribution
function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const ib = betai(df / 2, 0.5, x);
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

// q*(k, df) aproximación del estudianteizado rango (tabla de Tukey).
// Aproximación basada en interpolación de valores tabulados comunes.
function tukeyQ(k: number, df: number): number {
  // Tabla aproximada para alfa=0.05; interpolación lineal simple
  const table: Record<number, Record<number, number>> = {
    2: { 10: 3.151, 15: 3.014, 20: 2.95, 24: 2.919, 30: 2.888, 40: 2.858, 60: 2.829, 120: 2.8 },
    3: { 10: 3.767, 15: 3.596, 20: 3.498, 24: 3.454, 30: 3.409, 40: 3.366, 60: 3.323, 120: 3.278 },
    4: { 10: 4.166, 15: 3.961, 20: 3.839, 24: 3.786, 30: 3.734, 40: 3.683, 60: 3.633, 120: 3.58 },
    5: { 10: 4.479, 15: 4.247, 20: 4.108, 24: 4.049, 30: 3.991, 40: 3.935, 60: 3.879, 120: 3.821 },
    6: { 10: 4.737, 15: 4.483, 20: 4.327, 24: 4.263, 30: 4.198, 40: 4.137, 60: 4.076, 120: 4.014 },
    7: { 10: 4.956, 15: 4.681, 20: 4.513, 24: 4.443, 30: 4.374, 40: 4.31, 60: 4.244, 120: 4.179 },
    8: { 10: 5.143, 15: 4.852, 20: 4.673, 24: 4.599, 30: 4.525, 40: 4.458, 60: 4.388, 120: 4.32 },
    9: { 10: 5.306, 15: 5.001, 20: 4.812, 24: 4.735, 30: 4.657, 40: 4.586, 60: 4.514, 120: 4.443 },
    10: { 10: 5.449, 15: 5.132, 20: 4.935, 24: 4.854, 30: 4.773, 40: 4.699, 60: 4.624, 120: 4.551 },
  };
  if (k <= 1) return 0;
  const kk = Math.min(Math.floor(k), 10);
  const row = table[kk];
  const dfs = Object.keys(row).map(Number).sort((a, b) => a - b);
  if (df <= dfs[0]) return row[dfs[0]];
  if (df >= dfs[dfs.length - 1]) return row[dfs[dfs.length - 1]];
  let lo = dfs[0];
  let hi = dfs[dfs.length - 1];
  for (let i = 0; i < dfs.length - 1; i++) {
    if (df >= dfs[i] && df <= dfs[i + 1]) {
      lo = dfs[i];
      hi = dfs[i + 1];
      break;
    }
  }
  const frac = (df - lo) / (hi - lo);
  return row[lo] + frac * (row[hi] - row[lo]);
}

export function runAnova(groups: Group[]): AnovaResult {
  const k = groups.length;
  const allValues = groups.flatMap((g) => g.values);
  const N = allValues.length;
  const grandMean = allValues.reduce((a, b) => a + b, 0) / N;

  const groupMeans = groups.map((g) => g.values.reduce((a, b) => a + b, 0) / g.values.length);

  let ssBetween = 0;
  let ssWithin = 0;
  groups.forEach((g, i) => {
    ssBetween += g.values.length * Math.pow(groupMeans[i] - grandMean, 2);
    g.values.forEach((v) => {
      ssWithin += Math.pow(v - groupMeans[i], 2);
    });
  });
  const ssTotal = ssBetween + ssWithin;
  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const F = msWithin > 0 ? msBetween / msWithin : null;
  const pValue = F !== null && dfBetween > 0 && dfWithin > 0 ? 1 - fCDF(F, dfBetween, dfWithin) : null;
  const significant = pValue !== null ? pValue < 0.05 : null;
  const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0;

  const rows: AnovaRow[] = [
    {
      source: 'Entre Materiales',
      ss: ssBetween,
      df: dfBetween,
      ms: msBetween,
      F,
      pValue,
      significant,
      etaSquared: null,
    },
    {
      source: 'Error (Dentro de Materiales)',
      ss: ssWithin,
      df: dfWithin,
      ms: msWithin,
      F: null,
      pValue: null,
      significant: null,
      etaSquared: null,
    },
    {
      source: 'Total',
      ss: ssTotal,
      df: N - 1,
      ms: NaN,
      F: null,
      pValue: null,
      significant: null,
      etaSquared,
    },
  ];

  return { rows, totalMean: grandMean, significant: significant ?? false, etaSquared };
}

export function runTukey(groups: Group[], anova: AnovaResult): TukeyResult {
  const k = groups.length;
  const summaries: GroupSummary[] = groups.map((g) => {
    const n = g.values.length;
    const mean = g.values.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? g.values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1) : 0;
    const s = Math.sqrt(variance);
    const tCrit = invTCrit(0.975, n - 1);
    const se = s / Math.sqrt(n);
    return { name: g.name, n, mean, s, ciLower: mean - tCrit * se, ciUpper: mean + tCrit * se, letter: '' };
  });

  const dfWithin = anova.rows[1].df;
  const msWithin = anova.rows[1].ms;
  const se = Math.sqrt(msWithin / (summaries[0]?.n ?? 1));
  const qCrit = tukeyQ(k, dfWithin);

  const pairs: TukeyPair[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = summaries[i].mean - summaries[j].mean;
      const q = Math.abs(diff) / se;
      // p-ajustado aproximado usando la distribución del rango estudentizado
      const pAdj = Math.max(0, Math.min(1, 1 - Math.exp(-0.5 * q * q / (qCrit * qCrit / 4))));
      const ciLower = diff - qCrit * se;
      const ciUpper = diff + qCrit * se;
      const differs = Math.abs(diff) > qCrit * se;
      pairs.push({
        pair: `${summaries[i].name} – ${summaries[j].name}`,
        diff,
        pAdjusted: pAdj,
        ciLower,
        ciUpper,
        differs,
      });
    }
  }

  // CLD: asignar letras. Ordenar de mayor a menor media.
  const sorted = [...summaries].sort((a, b) => b.mean - a.mean);
  const assignLetters = (): void => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const groupLetters: string[] = sorted.map(() => '');
    let letterIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (groupLetters[i].includes(letters[letterIdx])) continue;
      groupLetters[i] += letters[letterIdx];
      for (let j = i + 1; j < sorted.length; j++) {
        // Si no difieren, comparten letra
        const pairName = `${sorted[i].name} – ${sorted[j].name}`;
        const reverseName = `${sorted[j].name} – ${sorted[i].name}`;
        const p = pairs.find((pr) => pr.pair === pairName || pr.pair === reverseName);
        if (p && !p.differs) {
          if (!groupLetters[j].includes(letters[letterIdx])) groupLetters[j] += letters[letterIdx];
        }
      }
      letterIdx++;
      if (letterIdx >= letters.length) break;
    }
    sorted.forEach((g, i) => {
      g.letter = groupLetters[i];
    });
  };
  assignLetters();

  return { pairs, groups: sorted };
}

// t crítico aproximado por inversión de la CDF (bisección)
function invTCrit(p: number, df: number): number {
  if (df <= 0) return 1.96;
  let lo = 0;
  let hi = 100;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    const cdf = tCDF(mid, df);
    if (cdf < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function buildGroups(replicas: ReplicaResult[], variable: keyof ReplicaResult): Group[] {
  const byMetal = new Map<string, number[]>();
  replicas.forEach((r) => {
    const arr = byMetal.get(r.metalName) ?? [];
    arr.push(r[variable] as number);
    byMetal.set(r.metalName, arr);
  });
  return Array.from(byMetal.entries()).map(([name, values]) => ({ name, values }));
}
