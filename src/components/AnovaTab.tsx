import { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { AlertCircle, BarChart3, RotateCcw } from 'lucide-react';
import { PASCO_CELL_LIMIT_N } from '@/data/materials';
import { computeResults, generateReplicas, strainRate } from '@/lib/engine';
import { runAnova, type Group } from '@/lib/stats';
import type { ReplicaResult, Specimen } from '@/types';

interface Props { specimens: Specimen[]; time: number; speed: number; screwSpeed: number }
type PropertyKey = 'UTS' | 'sigmaY' | 'E' | 'EL_pct' | 'Ur' | 'Ut';
const properties: { key: PropertyKey; label: string; unit: string; tex: string }[] = [
  { key: 'UTS', label: 'Resistencia última (UTS)', unit: 'MPa', tex: '\\sigma_{UTS}' },
  { key: 'sigmaY', label: 'Esfuerzo de fluencia', unit: 'MPa', tex: '\\sigma_y' },
  { key: 'E', label: 'Módulo de Young', unit: 'GPa', tex: 'E' },
  { key: 'EL_pct', label: 'Elongación al fallo', unit: '%', tex: '\\%EL' },
  { key: 'Ur', label: 'Resiliencia', unit: 'MJ/m^3', tex: 'U_r' },
  { key: 'Ut', label: 'Tenacidad', unit: 'MJ/m^3', tex: 'U_t' },
];
const defaultH0 = 'Las medias de los materiales son iguales para la propiedad seleccionada.';
const defaultH1 = 'Al menos una media de material es diferente para la propiedad seleccionada.';

function Tex({ value, block = false }: { value: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(value, { throwOnError: false, displayMode: block }), [value, block]);
  return block ? <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toLocaleString('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

function groupsFrom(replicas: ReplicaResult[], property: PropertyKey): Group[] {
  const grouped = new Map<string, number[]>();
  replicas.forEach((replica) => {
    const values = grouped.get(replica.metalName) ?? [];
    values.push(replica[property]);
    grouped.set(replica.metalName, values);
  });
  return [...grouped.entries()].map(([name, values]) => ({ name, values }));
}

export default function AnovaTab({ specimens, time, speed, screwSpeed }: Props) {
  const [property, setProperty] = useState<PropertyKey>('UTS');
  const [alpha, setAlpha] = useState(0.05);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [h0, setH0] = useState(defaultH0);
  const [h1, setH1] = useState(defaultH1);
  const selected = properties.find((item) => item.key === property) ?? properties[0];

  const replicas = useMemo(() => specimens.flatMap((specimen) => generateReplicas(specimen, 5)), [specimens]);
  const failedIds = useMemo(() => {
    const failed = new Set<string>();
    specimens.forEach((specimen) => {
      const results = computeResults(specimen);
      const epsNow = Math.max(0, strainRate(screwSpeed, specimen.L0) * time * speed);
      if (epsNow >= results.keys.epsF) failed.add(specimen.id);
    });
    return failed;
  }, [specimens, time, speed, screwSpeed]);
  const usableReplicas = useMemo(() => {
    if (!onlyFailed) return replicas;
    return replicas.filter((replica) => {
      const specimen = specimens.find((item) => item.materialId === replica.metalId || item.id === replica.metalId);
      return specimen ? failedIds.has(specimen.id) : false;
    });
  }, [replicas, specimens, failedIds, onlyFailed]);
  const groups = useMemo(() => groupsFrom(usableReplicas, property).filter((group) => group.values.length >= 2), [usableReplicas, property]);
  const result = useMemo(() => groups.length >= 2 ? runAnova(groups) : null, [groups]);
  const pValue = result?.rows[0]?.pValue ?? null;
  const significant = pValue !== null && pValue < alpha;
  const allFailed = failedIds.size;
  const cellExceeded = usableReplicas.filter((replica) => replica.Fpeak >= PASCO_CELL_LIMIT_N).length;
  const groupMeans = groups.map((group) => group.values.reduce((sum, value) => sum + value, 0) / group.values.length);
  const grandMean = result?.totalMean ?? 0;
  const between = result?.rows[0];
  const within = result?.rows[1];
  const total = result?.rows[2];

  return (
    <div className="mx-auto max-w-5xl space-y-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center gap-2"><BarChart3 size={18} className="text-cyan-500" /><h2 className="text-base font-bold">ANOVA — análisis de varianza</h2></div>
      <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-[11px] text-lab-muted">Propiedad
            <select value={property} onChange={(event) => setProperty(event.target.value as PropertyKey)} className="mt-1 w-full rounded-md border border-lab-line bg-lab-raised px-2 py-1.5 text-xs text-lab-text">
              {properties.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <div className="text-[11px] text-lab-muted">Nivel α
            <div className="mt-1 flex rounded-md border border-lab-line p-0.5">{[0.01, 0.05, 0.1].map((value) => <button key={value} onClick={() => setAlpha(value)} className={`flex-1 rounded px-2 py-1.5 ${alpha === value ? 'bg-cyan-500/20 text-cyan-500' : 'text-lab-muted'}`}>{value.toFixed(2)}</button>)}</div>
          </div>
          <label className="flex items-end gap-2 pb-1 text-[11px] text-lab-muted"><input type="checkbox" checked={onlyFailed} onChange={(event) => setOnlyFailed(event.target.checked)} className="accent-cyan-500" /> Solo probetas falladas ({allFailed})</label>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="text-[11px] text-cyan-500">H₀<textarea value={h0} onChange={(event) => setH0(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-lab-line bg-lab-raised p-2 text-xs text-lab-text" /></label>
          <label className="text-[11px] text-amber-500">H₁<textarea value={h1} onChange={(event) => setH1(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-lab-line bg-lab-raised p-2 text-xs text-lab-text" /></label>
        </div>
        <button onClick={() => { setH0(defaultH0); setH1(defaultH1); }} className="mt-2 flex items-center gap-1 rounded-md border border-lab-line px-2 py-1 text-[10px] text-lab-muted"><RotateCcw size={11} /> Restablecer hipótesis</button>
      </section>

      {groups.length < 2 && <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300"><AlertCircle size={15} />Se necesitan al menos dos materiales con dos réplicas disponibles.</div>}
      {cellExceeded > 0 && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{cellExceeded} réplica(s) alcanzan o superan el límite PASCO de {(PASCO_CELL_LIMIT_N / 1000).toFixed(1)} kN; interpreta esas mediciones con precaución.</div>}

      {result && between && within && total && (
        <>
          <section className="rounded-lg border border-lab-line bg-lab-panel p-4"><h3 className="mb-3 text-sm font-bold text-cyan-500">Cálculo paso a paso</h3><div className="space-y-2 rounded-md border border-lab-line bg-lab-bg/50 p-3 text-xs">
            <Tex block value={String.raw`\bar{x}_i = ${groupMeans.map((mean, index) => `${groups[index].name}: ${format(mean)}\,${selected.unit}`).join('\\,;\\quad ')}`} />
            <Tex block value={String.raw`\bar{x}_{global} = ${format(grandMean)}\,${selected.unit}`} />
            <Tex block value={String.raw`SS_{entre} = ${format(between.ss)},\quad SS_{error} = ${format(within.ss)},\quad SS_{total} = ${format(total.ss)}`} />
            <Tex block value={String.raw`df_{entre} = ${between.df},\quad df_{error} = ${within.df},\quad MS_{entre} = ${format(between.ms)},\quad MS_{error} = ${format(within.ms)}`} />
            <Tex block value={String.raw`F = \frac{MS_{entre}}{MS_{error}} = ${format(between.F ?? NaN, 3)},\quad p = ${format(pValue ?? NaN, 4)}`} />
            <Tex block value={String.raw`\eta^2 = \frac{SS_{entre}}{SS_{total}} = ${format(result.etaSquared, 4)}`} />
          </div></section>
          <section className="rounded-lg border border-lab-line bg-lab-panel p-4"><h3 className="mb-3 text-sm font-bold text-cyan-500">Tabla ANOVA</h3><div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr className="border-b border-lab-line text-lab-muted">{['Fuente','SS','df','MS','F','p','η²'].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}</tr></thead><tbody>{result.rows.map((row) => <tr key={row.source} className="border-b border-lab-line/60"><td className="px-2 py-1.5 text-lab-text">{row.source}</td><td className="px-2 py-1.5 font-mono">{format(row.ss)}</td><td className="px-2 py-1.5 font-mono">{row.df}</td><td className="px-2 py-1.5 font-mono">{format(row.ms)}</td><td className="px-2 py-1.5 font-mono">{format(row.F ?? NaN, 3)}</td><td className="px-2 py-1.5 font-mono">{format(row.pValue ?? NaN, 4)}</td><td className="px-2 py-1.5 font-mono">{format(row.etaSquared ?? NaN, 4)}</td></tr>)}</tbody></table></div></section>
          <section className={`rounded-lg border p-4 ${significant ? 'border-red-500/40 bg-red-500/10' : 'border-emerald-500/40 bg-emerald-500/10'}`}><h3 className="text-sm font-bold text-cyan-500">Veredicto dinámico</h3><p className="mt-2 text-xs text-lab-text">{significant ? `Se rechaza H₀: p = ${format(pValue ?? NaN, 4)} < α = ${alpha.toFixed(2)}.` : `No se rechaza H₀: p = ${format(pValue ?? NaN, 4)} ≥ α = ${alpha.toFixed(2)}.`}</p><p className="mt-2 text-[11px] text-lab-muted">H₀: {h0}</p><p className="text-[11px] text-lab-muted">H₁: {h1}</p></section>
        </>
      )}
      <section className="rounded-lg border border-lab-line bg-lab-panel p-4 text-xs text-lab-muted">Las cinco réplicas R1–R5 se generan con variación reproducible de dimensiones, UTS, fluencia, módulo y elongación al fallo. El filtro usa el avance actual del ensayo y conserva únicamente grupos con datos suficientes.</section>
    </div>
  );
}
