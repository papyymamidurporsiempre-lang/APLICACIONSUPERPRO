import { Download } from 'lucide-react';
import { SPECIMEN_COLORS } from '@/data/materials';
import { exportDatasetCSV } from '@/lib/csv';
import { computeCurve } from '@/lib/engine';
import type { Specimen, SpecimenResults } from '@/types';

interface Props {
  items: { specimen: Specimen; results: SpecimenResults }[];
  validIds: Set<string>;
}

function fmt(v: number, dec = 1): string {
  return v.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fn(v: number): string {
  return v >= 10000 ? `${fmt(v / 1000, 2)} kN` : `${fmt(v, 0)} N`;
}

export default function ResultsPanel({ items, validIds }: Props) {
  return (
    <div className="space-y-3">
      {items.map(({ specimen: s, results: r }, i) => {
        const ok = validIds.has(s.id);
        const color = SPECIMEN_COLORS[i % 6];
        if (!ok) {
          return (
            <div key={s.id} className="rounded-lg border border-red-500/50 bg-lab-panel p-3 text-[11px] text-red-400">
              {s.label}: corrige las medidas para calcular resultados.
            </div>
          );
        }
        return (
          <div key={s.id} className="rounded-lg border border-lab-line bg-lab-panel">
            <div className="flex items-center gap-2 border-b border-lab-line px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{s.label}</span>
              <button
                onClick={() => exportDatasetCSV(s, computeCurve(s, r), ',')}
                className="rounded p-1.5 text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text"
                title="Descargar CSV punto a punto (coma)"
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => exportDatasetCSV(s, computeCurve(s, r), ';')}
                className="rounded border border-lab-line px-1.5 py-0.5 font-mono text-[10px] text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text"
                title="Descargar CSV punto a punto (punto y coma)"
              >
                {';'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2.5 sm:grid-cols-3">
              <Metric label="A₀ inicial" value={`${fmt(r.A0)} mm²`} />
              <Metric label="L₀ / d₀" value={r.ratioL0d0 !== null ? fmt(r.ratioL0d0, 2) : '—'} />
              <Metric label="F fluencia (Fy)" value={fn(r.Fy)} />
              <Metric label="F máxima (Fmax)" value={fn(r.Fmax)} />
              <Metric label="σ fluencia" value={`${fmt(r.sigmaY, 0)} MPa`} />
              <Metric label="UTS" value={`${fmt(r.sigmaUTS, 0)} MPa`} />
              <Metric label="σ fractura" value={`${fmt(r.sigmaF, 0)} MPa`} />
              <Metric label="ΔL final" value={`${fmt(r.dLFinal, 2)} mm`} />
              <Metric label="Deformación total" value={`${fmt(r.strainPct)} %`} />
              <Metric label="Resiliencia" value={`${fmt(r.resilience, 3)} MJ/m³`} />
              <Metric label="Tenacidad" value={`${fmt(r.toughness, 0)} MJ/m³`} />
              <Metric label="Módulo E" value={`${fmt(r.E_MPa / 1000, 1)} GPa`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-lab-muted">{label}</div>
      <div className="font-mono text-xs font-semibold text-lab-text">{value}</div>
    </div>
  );
}
