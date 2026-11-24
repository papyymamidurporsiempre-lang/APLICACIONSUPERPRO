import { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot, Label,
} from 'recharts';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { SPECIMEN_COLORS, PASCO_CELL_LIMIT_N } from '@/data/materials';
import { computeCurve, strainRate } from '@/lib/engine';
import type { CurvePoint } from '@/lib/engine';
import type { SpecimenResults } from '@/types';
import type { ComputedItem } from '@/hooks/useSpecimens';

interface Props {
  items: ComputedItem[];
  time: number;
  speed: number;
  screwSpeed: number;
  chartType: 'stress-strain' | 'force-elong';
  stressKind: 'engineering' | 'true';
  complianceOn: boolean;
  singleMode: boolean;
  singleId: string | null;
  onChartType: (v: 'stress-strain' | 'force-elong') => void;
  onStressKind: (v: 'engineering' | 'true') => void;
  onZoom: (v: boolean) => void;
  zoomElastic: boolean;
}

type XY = Record<string, number | null>;

interface CurveBundle {
  specimenId: string;
  label: string;
  colorIdx: number;
  full: CurvePoint[];
  results: SpecimenResults;
  epsNow: number;
  epsF: number;
  broken: boolean;
}

function buildBundles(
  items: ComputedItem[],
  screwSpeed: number,
  time: number,
  speed: number,
  singleMode: boolean,
  singleId: string | null
): CurveBundle[] {
  const shown = singleMode && singleId
    ? items.filter((it) => it.specimen.id === singleId)
    : items;
  return shown.map(({ specimen, results }, idx) => {
    const full = computeCurve(specimen, results, screwSpeed);
    const epsF = results?.keys?.epsF ?? 0;
    const epsNow = Math.max(0, strainRate(screwSpeed, specimen.L0) * time * speed);
    return {
      specimenId: specimen.id,
      label: specimen.label,
      colorIdx: singleMode && singleId ? 0 : idx,
      full,
      results,
      epsNow: Math.min(epsNow, epsF),
      epsF,
      broken: epsNow >= epsF && epsF > 0,
    };
  });
}

function valueAt(pt: CurvePoint | undefined, chartType: string, stressKind: string): number | null {
  if (!pt) return null;
  if (chartType === 'stress-strain') {
    return stressKind === 'true' ? pt.sigTrue : pt.sig;
  }
  return pt.F;
}

function xAt(pt: CurvePoint | undefined, chartType: string, complianceOn: boolean): number {
  if (!pt) return 0;
  if (chartType === 'stress-strain') return pt.eps * 100;
  return complianceOn ? pt.dLscrew : pt.dL;
}

// Devuelve el índice del último punto de la curva cuyo eps <= epsLimit.
function lastIndexForEps(full: CurvePoint[], epsLimit: number): number {
  if (full.length === 0) return -1;
  if (epsLimit <= 0) return 0;
  // Búsqueda binaria aproximada
  let lo = 0;
  let hi = full.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (full[mid].eps <= epsLimit) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export default function ChartsPanel({
  items, time, speed, screwSpeed, chartType, stressKind, complianceOn, singleMode, singleId,
  onChartType, onStressKind, onZoom, zoomElastic,
}: Props) {
  const bundles = useMemo(
    () => buildBundles(items, screwSpeed, time, speed, singleMode, singleId),
    [items, screwSpeed, time, speed, singleMode, singleId]
  );

  const { data, xMax, yMax, singleBundle } = useMemo(() => {
    if (bundles.length === 0) {
      return { data: [] as XY[], xMax: 1, yMax: 1, singleBundle: null as CurveBundle | null };
    }
    const isStrain = chartType === 'stress-strain';

    // xMax basado en la deformación máxima completa de todas las curvas mostradas
    const fullXMax = isStrain
      ? Math.max(...bundles.map((b) => (b.full[b.full.length - 1]?.eps ?? 0) * 100), 0.1)
      : Math.max(...bundles.map((b) => {
          const last = b.full[b.full.length - 1];
          return last ? (complianceOn ? last.dLscrew : last.dL) : 0;
        }), 0.1);

    const xEffective = zoomElastic ? fullXMax * 0.12 : fullXMax;

    // Construir filas combinadas: para cada valor x, cada probeta contribuye su valor
    // sólo si su deformación actual ha alcanzado ese x.
    const N = 300;
    const rows: XY[] = [];
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * xEffective;
      const row: XY = { x };
      let has = false;
      bundles.forEach((b) => {
        if (b.full.length === 0) return;
        if (isStrain) {
          const epsLimit = b.epsNow;
          const epsTarget = x / 100;
          if (epsTarget > epsLimit) {
            // esta probeta aún no alcanza este x -> null (trazo se detiene)
            row[b.specimenId] = null;
            return;
          }
          const val = sampleAt(b.full, epsTarget, chartType, stressKind);
          if (val !== null) { row[b.specimenId] = val; has = true; }
          else row[b.specimenId] = null;
        } else {
          // F vs desplazamiento: limitar por desplazamiento equivalente a epsNow
          const dLimit = computeDisplacementLimit(b, complianceOn);
          if (x > dLimit) {
            row[b.specimenId] = null;
            return;
          }
          const val = sampleForce(b.full, x, complianceOn);
          if (val !== null) { row[b.specimenId] = val; has = true; }
          else row[b.specimenId] = null;
        }
      });
      if (has) rows.push(row);
    }

    // yMax: máximo valor considerando sólo la parte ya trazada
    let mx = 0;
    bundles.forEach((b) => {
      if (b.full.length === 0) return;
      const cutoff = lastIndexForEps(b.full, b.epsNow);
      for (let i = 0; i <= cutoff && i < b.full.length; i++) {
        const v = isStrain ? (stressKind === 'true' ? b.full[i].sigTrue : b.full[i].sig) : b.full[i].F;
        if (v > mx) mx = v;
      }
    });
    if (mx <= 0) mx = 1;

    return { data: rows, xMax: xEffective, yMax: mx, singleBundle: bundles[0] ?? null };
  }, [bundles, chartType, stressKind, complianceOn, zoomElastic]);

  const xLabel = chartType === 'stress-strain' ? 'Deformación ε (%)' : (complianceOn ? 'Desplazamiento rosca (mm)' : 'Alargamiento ΔL (mm)');
  const yLabel = chartType === 'stress-strain' ? (stressKind === 'true' ? 'Esfuerzo real σ (MPa)' : 'Esfuerzo ing. σ (MPa)') : 'Fuerza F (N)';

  // Área de resiliencia y tenacidad para modo individual (stress-strain)
  const areaData = useMemo(() => {
    if (!singleBundle || chartType !== 'stress-strain') return null;
    const { full, results } = singleBundle;
    const epsY = results.keys.epsY;
    const epsF = results.keys.epsF;
    const resilienceArea = full.filter((p) => p.eps <= epsY).map((p) => ({ x: p.eps * 100, y: stressKind === 'true' ? p.sigTrue : p.sig }));
    const toughnessArea = full.filter((p) => p.eps <= epsF).map((p) => ({ x: p.eps * 100, y: stressKind === 'true' ? p.sigTrue : p.sig }));
    return { resilienceArea, toughnessArea };
  }, [singleBundle, chartType, stressKind]);

  // Marcadores de fractura: un punto destacado al final del trazo de cada probeta rota
  const fractureMarkers = useMemo(() => {
    const markers: { id: string; x: number; y: number; colorIdx: number }[] = [];
    bundles.forEach((b) => {
      if (!b.broken || b.full.length === 0) return;
      const idx = lastIndexForEps(b.full, b.epsF);
      const pt = b.full[idx];
      if (!pt) return;
      markers.push({
        id: b.specimenId,
        x: xAt(pt, chartType, complianceOn),
        y: valueAt(pt, chartType, stressKind) ?? 0,
        colorIdx: b.colorIdx,
      });
    });
    return markers;
  }, [bundles, chartType, stressKind, complianceOn]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <h2 className="mr-auto text-sm font-semibold">Gráficas comparativas</h2>
        <Seg options={[{ v: 'stress-strain', l: 'σ – ε' }, { v: 'force-elong', l: 'F – ΔL' }]} value={chartType} onChange={(v) => onChartType(v as any)} />
        {chartType === 'stress-strain' && (
          <Seg options={[{ v: 'engineering', l: 'Ingeniería' }, { v: 'true', l: 'Real' }]} value={stressKind} onChange={(v) => onStressKind(v as any)} />
        )}
        <button
          onClick={() => onZoom(!zoomElastic)}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors ${
            zoomElastic ? 'border-cyan-500 bg-cyan-500/10 text-cyan-500' : 'border-lab-line text-lab-muted hover:text-lab-text'
          }`}
        >
          {zoomElastic ? <ZoomOut size={11} /> : <ZoomIn size={11} />} Zona elástica
        </button>
      </div>

      <div className="min-h-[300px] flex-1 px-3 pb-3">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <ComposedChart data={data} margin={{ top: 12, right: 28, bottom: 28, left: 18 }}>
            <CartesianGrid stroke="rgb(var(--lab-line))" strokeDasharray="3 3" strokeOpacity={0.5} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, xMax]}
              tick={{ fill: 'rgb(var(--lab-muted))', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickMargin={8}
            >
              <Label value={xLabel} position="insideBottom" offset={-16} fill="rgb(var(--lab-muted))" fontSize={11} />
            </XAxis>
            <YAxis
              domain={[0, yMax * 1.08]}
              tick={{ fill: 'rgb(var(--lab-muted))', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickMargin={6}
            >
              <Label value={yLabel} angle={-90} position="insideLeft" offset={6} fill="rgb(var(--lab-muted))" fontSize={11} />
            </YAxis>
            <Tooltip
              contentStyle={{
                background: 'rgb(var(--lab-panel))',
                border: '1px solid rgb(var(--lab-line))',
                borderRadius: 8,
                fontSize: 11,
                fontFamily: 'JetBrains Mono',
                color: 'rgb(var(--lab-text))',
              }}
              labelFormatter={(v) => `${xLabel.split(' ')[0]}: ${Number(v).toFixed(3)}`}
              formatter={(value: any, name: any) => [Number(value).toFixed(1), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: 'rgb(var(--lab-muted))', paddingTop: 4 }} />

            {/* Áreas de resiliencia y tenacidad (modo individual) */}
            {areaData && (
              <>
                <Area dataKey="y" name="Uᵣ (resiliencia)" data={areaData.resilienceArea} fill="#34d399" fillOpacity={0.18} stroke="none" />
                <Area dataKey="y" name="Uₜ (tenacidad)" data={areaData.toughnessArea} fill="#f59e0b" fillOpacity={0.10} stroke="none" />
              </>
            )}

            {/* Línea de límite de celda PASCO (sólo F-ΔL) */}
            {chartType === 'force-elong' && (
              <ReferenceLine y={PASCO_CELL_LIMIT_N} stroke="#ef4444" strokeDasharray="6 4" strokeWidth={1.5}>
                <Label value={`Límite celda ${PASCO_CELL_LIMIT_N / 1000} kN`} position="insideTopRight" fill="#ef4444" fontSize={10} />
              </ReferenceLine>
            )}

            {bundles.map((b) => (
              <Line
                key={b.specimenId}
                type="monotone"
                dataKey={b.specimenId}
                name={b.label}
                stroke={SPECIMEN_COLORS[b.colorIdx % 6]}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}

            {/* Marcador de fractura por probeta rota */}
            {fractureMarkers.map((m) => (
              <ReferenceDot
                key={`frac-${m.id}`}
                x={m.x}
                y={m.y}
                r={5}
                fill={SPECIMEN_COLORS[m.colorIdx % 6]}
                stroke="#fff"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Dado un bundle, calcula el desplazamiento máximo ya alcanzado (dL o dLscrew) según epsNow
function computeDisplacementLimit(b: CurveBundle, complianceOn: boolean): number {
  if (b.full.length === 0) return 0;
  const idx = lastIndexForEps(b.full, b.epsNow);
  const pt = b.full[idx];
  if (!pt) return 0;
  return complianceOn ? pt.dLscrew : pt.dL;
}

function Seg({ options, value, onChange }: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-md border border-lab-line p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
            value === o.v ? 'bg-cyan-500/20 text-cyan-500' : 'text-lab-muted hover:text-lab-text'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function sampleAt(
  full: CurvePoint[],
  eps: number,
  chartType: string,
  stressKind: string
): number | null {
  if (full.length === 0) return null;
  const last = full[full.length - 1];
  if (eps < 0 || eps > last.eps) return null;
  const f = (eps / last.eps) * (full.length - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(full.length - 1, i0 + 1);
  const t = f - i0;
  const a = full[i0];
  const b = full[i1];
  if (!a || !b) return null;
  if (chartType === 'stress-strain') {
    return stressKind === 'true' ? a.sigTrue + (b.sigTrue - a.sigTrue) * t : a.sig + (b.sig - a.sig) * t;
  }
  return a.F + (b.F - a.F) * t;
}

function sampleForce(full: CurvePoint[], displacement: number, complianceOn: boolean): number | null {
  if (full.length === 0) return null;
  const key = complianceOn ? 'dLscrew' : 'dL';
  const last = full[full.length - 1];
  if (displacement < 0 || displacement > (last as any)[key]) return null;
  for (let i = 0; i < full.length - 1; i++) {
    const a = full[i];
    const b = full[i + 1];
    const av = (a as any)[key];
    const bv = (b as any)[key];
    if (displacement >= av && displacement <= bv) {
      const t = bv > av ? (displacement - av) / (bv - av) : 0;
      return a.F + (b.F - a.F) * t;
    }
  }
  return null;
}
