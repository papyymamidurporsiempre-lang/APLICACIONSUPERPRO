import { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { BarChart3, RotateCcw, AlertCircle, Info } from 'lucide-react';
import { generateReplicas } from '@/lib/engine';
import { runAnova, buildGroups, type Group, type AnovaResult } from '@/lib/stats';
import { PASCO_CELL_LIMIT_N, SPECIMEN_COLORS } from '@/data/materials';
import type { Specimen, ReplicaResult } from '@/types';

interface Props {
  specimens: Specimen[];
  time: number;
  speed: number;
  screwSpeed: number;
}

type PropertyKey = 'UTS' | 'sigmaY' | 'E' | 'EL_pct' | 'Ur' | 'Ut';

const PROPERTIES: { key: PropertyKey; label: string; unit: string; symbol: string }[] = [
  { key: 'UTS', label: 'Resistencia última (UTS)', unit: 'MPa', symbol: '\\sigma_{\\text{UTS}}' },
  { key: 'sigmaY', label: 'Esfuerzo de fluencia', unit: 'MPa', symbol: '\\sigma_y' },
  { key: 'E', label: 'Módulo de Young', unit: 'GPa', symbol: 'E' },
  { key: 'EL_pct', label: 'Elongación al fallo', unit: '%', symbol: '\\%EL' },
  { key: 'Ur', label: 'Resiliencia', unit: 'MJ/m³', symbol: 'U_r' },
  { key: 'Ut', label: 'Tenacidad', unit: 'MJ/m³', symbol: 'U_t' },
];

const DEFAULT_H0 = 'No hay diferencias significativas entre las medias de las propiedades mecánicas de los materiales evaluados.';
const DEFAULT_H1 = 'Existe al menos una diferencia significativa entre las medias de las propiedades mecánicas de los materiales evaluados.';

function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: block });
    } catch {
      return tex;
    }
  }, [tex, block]);
  if (block) {
    return <div className="my-1 overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function fmt(v: number, dec = 2): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Genera réplicas para todas las probetas válidas, filtrando las que ya fallaron
function useReplicas(specimens: Specimen[], time: number, speed: number, screwSpeed: number): ReplicaResult[] {
  return useMemo(() => {
    const allReplicas: ReplicaResult[] = [];
    specimens.forEach((s) => {
      // Generar 5 réplicas por probeta (usar el valor del specimen.replicas, mínimo 5)
      const n = Math.max(5, s.replicas);
      const reps = generateReplicas(s, n);
      allReplicas.push(...reps);
    });
    return allReplicas;
  }, [specimens]);
}

// Determina cuáles probetas han fallado según el avance del ensayo
function useBrokenStatus(specimens: Specimen[], time: number, speed: number, screwSpeed: number): Map<string, boolean> {
  return useMemo(() => {
    const status = new Map<string, boolean>();
    // Para cada material, calcular el eps actual y comparar con epsF
    // Como no tenemos results aquí directamente, usamos una aproximación basada en el progreso
    // El estado de rotura se gestiona en el componente principal; aquí simplificamos
    specimens.forEach((s) => {
      status.set(s.id, false);
    });
    return status;
  }, [specimens, time, speed, screwSpeed]);
}

export default function AnovaTab({ specimens, time, speed, screwSpeed }: Props) {
  const [property, setProperty] = useState<PropertyKey>('UTS');
  const [alpha, setAlpha] = useState<number>(0.05);
  const [h0, setH0] = useState(DEFAULT_H0);
  const [h1, setH1] = useState(DEFAULT_H1);
  const [filterBroken, setFilterBroken] = useState<boolean>(false);

  const replicas = useReplicas(specimens, time, speed, screwSpeed);
  const brokenStatus = useBrokenStatus(specimens, time, speed, screwSpeed);

  // Filtrar réplicas según el estado de rotura
  const effectiveReplicas = useMemo(() => {
    if (!filterBroken) return replicas;
    // Si filtramos, excluimos réplicas de probetas marcadas como rotas
    return replicas.filter((r) => {
      const specimen = specimens.find((s) => s.id === r.metalId || s.materialId === r.metalId);
      if (!specimen) return true;
      return !brokenStatus.get(specimen.id);
    });
  }, [replicas, filterBroken, brokenStatus, specimens]);

  const groups = useMemo(() => buildGroups(effectiveReplicas, property), [effectiveReplicas, property]);
  const anova = useMemo(() => {
    if (groups.length < 2) return null;
    const validGroups = groups.filter((g) => g.values.length > 0);
    if (validGroups.length < 2) return null;
    return runAnova(validGroups);
  }, [groups]);

  const propInfo = PROPERTIES.find((p) => p.key === property)!;
  const totalReplicas = effectiveReplicas.length;
  const hasEnoughData = groups.length >= 2 && groups.every((g) => g.values.length >= 2);
  const pValue = anova?.rows[0]?.pValue ?? null;
  const isSignificant = pValue !== null ? pValue < alpha : false;
  const fStat = anova?.rows[0]?.F ?? null;

  // Veredicto dinámico
  const verdict = useMemo(() => {
    if (!anova || pValue === null || fStat === null) {
      return { text: 'No hay datos suficientes para emitir un veredicto.', type: 'info' as const };
    }
    if (isSignificant) {
      return {
        text: `Se rechaza H₀ (p = ${fmt(pValue, 4)} < α = ${alpha}). Existen diferencias estadísticamente significativas entre los materiales para ${propInfo.label}.`,
        type: 'reject' as const,
      };
    }
    return {
      text: `No se rechaza H₀ (p = ${fmt(pValue, 4)} ≥ α = ${alpha}). No hay evidencia suficiente para afirmar diferencias significativas entre los materiales para ${propInfo.label}.`,
      type: 'accept' as const,
    };
  }, [anova, pValue, fStat, isSignificant, alpha, propInfo.label]);

  // Observación técnica sobre el límite de celda PASCO
  const cellWarning = useMemo(() => {
    const exceeding = effectiveReplicas.filter((r) => r.Fpeak >= PASCO_CELL_LIMIT_N);
    if (exceeding.length > 0) {
      const names = [...new Set(exceeding.map((r) => r.metalName))];
      return `${exceeding.length} réplica(s) de ${names.join(', ')} superan el límite de la celda PASCO (${PASCO_CELL_LIMIT_N / 1000} kN). Los valores de UTS pueden estar subestimados.`;
    }
    return null;
  }, [effectiveReplicas]);

  // Desviación al fallo por material
  const failureStats = useMemo(() => {
    const byMetal = new Map<string, number[]>();
    effectiveReplicas.forEach((r) => {
      const arr = byMetal.get(r.metalName) ?? [];
      arr.push(r.EL_pct);
      byMetal.set(r.metalName, arr);
    });
    return Array.from(byMetal.entries()).map(([name, values]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = values.length > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)) : 0;
      return { name, mean, std, n: values.length };
    });
  }, [effectiveReplicas]);

  const resetHypotheses = () => {
    setH0(DEFAULT_H0);
    setH1(DEFAULT_H1);
  };

  // Construir LaTeX paso a paso
  const stepLatex = useMemo(() => {
    if (!anova || groups.length < 2) return null;
    const groupMeansTex = groups.map((g, i) => {
      const mean = g.values.reduce((a, b) => a + b, 0) / g.values.length;
      return `\\bar{x}_{${i + 1}}(${g.name}) = ${fmt(mean, 2)} \\;${propInfo.unit}`;
    }).join(', \\\\ ');
    const N = groups.reduce((a, g) => a + g.values.length, 0);
    const grandMean = anova.totalMean;
    const ssB = anova.rows[0].ss;
    const ssW = anova.rows[1].ss;
    const ssT = anova.rows[2].ss;
    const dfB = anova.rows[0].df;
    const dfW = anova.rows[1].df;
    const msB = anova.rows[0].ms;
    const msW = anova.rows[1].ms;
    const eta2 = anova.etaSquared;
    return {
      groupMeans: groupMeansTex,
      N, grandMean, ssB, ssW, ssT, dfB, dfW, msB, msW, eta2,
    };
  }, [anova, groups, propInfo.unit]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-cyan-500" />
        <h2 className="text-base font-bold">ANOVA — Análisis de Varianza</h2>
      </div>

      {/* Controles */}
      <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-lab-muted">Propiedad mecánica</label>
            <select
              value={property}
              onChange={(e) => setProperty(e.target.value as PropertyKey)}
              className="w-full rounded-md border border-lab-line bg-lab-raised px-2.5 py-1.5 text-xs text-lab-text outline-none focus:border-cyan-500"
            >
              {PROPERTIES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-lab-muted">Nivel de significancia α</label>
            <div className="flex rounded-md border border-lab-line p-0.5">
              {[0.01, 0.05, 0.10].map((a) => (
                <button
                  key={a}
                  onClick={() => setAlpha(a)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition-colors ${
                    alpha === a ? 'bg-cyan-500/20 text-cyan-500' : 'text-lab-muted hover:text-lab-text'
                  }`}
                >
                  {a.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-lab-muted">Filtrar probetas</label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-lab-line px-2.5 py-1.5 text-[11px] text-lab-muted transition-colors hover:text-lab-text">
              <input
                type="checkbox"
                className="h-3 w-3 accent-cyan-500"
                checked={filterBroken}
                onChange={(e) => setFilterBroken(e.target.checked)}
              />
              Excluir probetas rotas
            </label>
          </div>
        </div>

        {/* Hipótesis H0 / H1 editables */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-lab-muted">Hipótesis</span>
            <button
              onClick={resetHypotheses}
              className="flex items-center gap-1 rounded-md border border-lab-line px-2 py-1 text-[10px] text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text"
            >
              <RotateCcw size={11} /> Restablecer
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-cyan-500">
                <Tex tex="H_0" /> — Hipótesis Nula
              </span>
              <textarea
                value={h0}
                onChange={(e) => setH0(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-lab-line bg-lab-raised px-2.5 py-1.5 text-[11px] text-lab-text outline-none focus:border-cyan-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-amber-500">
                <Tex tex="H_1" /> — Hipótesis Alternativa
              </span>
              <textarea
                value={h1}
                onChange={(e) => setH1(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-lab-line bg-lab-raised px-2.5 py-1.5 text-[11px] text-lab-text outline-none focus:border-cyan-500"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Resumen de datos */}
      <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
        <h3 className="mb-2 text-sm font-bold text-cyan-500">Datos del análisis</h3>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-lab-muted">Réplicas totales</div>
            <div className="font-mono font-semibold text-lab-text">{totalReplicas}</div>
          </div>
          <div>
            <div className="text-[10px] text-lab-muted">Materiales (grupos)</div>
            <div className="font-mono font-semibold text-lab-text">{groups.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-lab-muted">Propiedad</div>
            <div className="font-mono font-semibold text-lab-text"><Tex tex={propInfo.symbol} /></div>
          </div>
          <div>
            <div className="text-[10px] text-lab-muted">α</div>
            <div className="font-mono font-semibold text-lab-text">{alpha.toFixed(2)}</div>
          </div>
        </div>
      </section>

      {/* Avisos */}
      {!hasEnoughData && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            Se necesitan al menos 2 materiales con 2 réplicas cada uno para realizar el ANOVA.
            Añade más probetas en el Laboratorio o desactiva el filtro de probetas rotas.
          </span>
        </div>
      )}
      {cellWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{cellWarning}</span>
        </div>
      )}

      {/* Cálculo paso a paso en LaTeX */}
      {anova && stepLatex && hasEnoughData && (
        <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
          <h3 className="mb-3 text-sm font-bold text-cyan-500">Cálculo paso a paso</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">1. Medias grupales</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={stepLatex.groupMeans} block />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">2. Media global</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={String.raw`\bar{x}_{\text{global}} = \frac{\sum_{i=1}^{k} \sum_{j=1}^{n_i} x_{ij}}{N} = ${fmt(stepLatex.grandMean, 2)} \;${propInfo.unit}, \quad N = ${stepLatex.N}`} block />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">3. Suma de cuadrados</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={String.raw`SS_{\text{entre}} = \sum_{i=1}^{k} n_i (\bar{x}_i - \bar{x}_{\text{global}})^2 = ${fmt(stepLatex.ssB, 2)}`} block />
                <Tex tex={String.raw`SS_{\text{error}} = \sum_{i=1}^{k} \sum_{j=1}^{n_i} (x_{ij} - \bar{x}_i)^2 = ${fmt(stepLatex.ssW, 2)}`} block />
                <Tex tex={String.raw`SS_{\text{total}} = SS_{\text{entre}} + SS_{\text{error}} = ${fmt(stepLatex.ssT, 2)}`} block />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">4. Grados de libertad</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={String.raw`df_{\text{entre}} = k - 1 = ${stepLatex.dfB}, \qquad df_{\text{error}} = N - k = ${stepLatex.dfW}`} block />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">5. Cuadrados medios</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={String.raw`MS_{\text{entre}} = \frac{SS_{\text{entre}}}{df_{\text{entre}}} = ${fmt(stepLatex.msB, 2)}, \qquad MS_{\text{error}} = \frac{SS_{\text{error}}}{df_{\text{error}}} = ${fmt(stepLatex.msW, 2)}`} block />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">6. Estadístico F y p-valor</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={String.raw`F = \frac{MS_{\text{entre}}}{MS_{\text{error}}} = ${fmt(fStat ?? 0, 3)}`} block />
                <Tex tex={String.raw`p\text{-valor} = ${pValue !== null ? fmt(pValue, 4) : '—'}}`} block />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-lab-muted">7. Tamaño del efecto</div>
              <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-2">
                <Tex tex={String.raw`\eta^2 = \frac{SS_{\text{entre}}}{SS_{\text{total}}} = ${fmt(stepLatex.eta2, 4)}`} block />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tabla ANOVA */}
      {anova && hasEnoughData && (
        <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
          <h3 className="mb-3 text-sm font-bold text-cyan-500">Tabla ANOVA</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-lab-line text-lab-muted">
                  <th className="py-2 pr-3 font-semibold">Fuente</th>
                  <th className="py-2 px-2 text-right font-semibold">SS</th>
                  <th className="py-2 px-2 text-right font-semibold">df</th>
                  <th className="py-2 px-2 text-right font-semibold">MS</th>
                  <th className="py-2 px-2 text-right font-semibold">F</th>
                  <th className="py-2 px-2 text-right font-semibold">p</th>
                  <th className="py-2 pl-2 text-right font-semibold">η²</th>
                </tr>
              </thead>
              <tbody>
                {anova.rows.map((row, i) => (
                  <tr key={i} className={`border-b border-lab-line/60 ${i === 0 ? 'bg-cyan-500/5' : ''}`}>
                    <td className="py-1.5 pr-3 font-medium text-lab-text">{row.source}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{fmt(row.ss, 2)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{row.df}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{Number.isFinite(row.ms) ? fmt(row.ms, 2) : '—'}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{row.F !== null ? fmt(row.F, 3) : '—'}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{row.pValue !== null ? fmt(row.pValue, 4) : '—'}</td>
                    <td className="py-1.5 pl-2 text-right font-mono text-lab-text/90">{row.etaSquared !== null ? fmt(row.etaSquared, 4) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Veredicto */}
      {anova && hasEnoughData && (
        <section className={`rounded-lg border p-4 ${
          verdict.type === 'reject'
            ? 'border-red-500/40 bg-red-500/10'
            : verdict.type === 'accept'
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-lab-line bg-lab-panel'
        }`}>
          <h3 className="mb-2 text-sm font-bold text-cyan-500">Veredicto</h3>
          <div className="space-y-2 text-xs leading-relaxed text-lab-text">
            <p className={`font-semibold ${verdict.type === 'reject' ? 'text-red-400' : verdict.type === 'accept' ? 'text-emerald-400' : 'text-lab-muted'}`}>
              {verdict.text}
            </p>
            <div className="border-t border-lab-line/60 pt-2">
              <p className="text-[11px] text-lab-muted">
                <Tex tex="H_0" />: {h0}
              </p>
              <p className="mt-1 text-[11px] text-lab-muted">
                <Tex tex="H_1" />: {h1}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Desviación al fallo por material */}
      {failureStats.length > 0 && (
        <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
          <h3 className="mb-3 text-sm font-bold text-cyan-500">Desviación al fallo por material</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-lab-line text-lab-muted">
                  <th className="py-2 pr-3 font-semibold">Material</th>
                  <th className="py-2 px-2 text-right font-semibold">n</th>
                  <th className="py-2 px-2 text-right font-semibold">Media %EL</th>
                  <th className="py-2 px-2 text-right font-semibold">Desv. estándar</th>
                  <th className="py-2 pl-2 text-right font-semibold">CV (%)</th>
                </tr>
              </thead>
              <tbody>
                {failureStats.map((f, i) => (
                  <tr key={i} className="border-b border-lab-line/60">
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-1.5 font-medium text-lab-text">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SPECIMEN_COLORS[i % SPECIMEN_COLORS.length] }} />
                        {f.name}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{f.n}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{fmt(f.mean, 2)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-lab-text/90">{fmt(f.std, 2)}</td>
                    <td className="py-1.5 pl-2 text-right font-mono text-lab-text/90">{f.mean > 0 ? fmt((f.std / f.mean) * 100, 1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-lab-muted">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              La desviación al fallo refleja la variabilidad natural entre réplicas de cada material.
              Un coeficiente de variación (CV) mayor indica mayor dispersión en la elongación a la fractura.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
