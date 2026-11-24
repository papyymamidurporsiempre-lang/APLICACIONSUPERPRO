import { useMemo } from 'react';
import { SPECIMEN_COLORS } from '@/data/materials';
import { computeCurve, DEFAULT_SCREW_SPEED, strainRate } from '@/lib/engine';
import type { Specimen, SpecimenResults } from '@/types';
import type { ComputedItem } from '@/hooks/useSpecimens';

interface Props {
  items: ComputedItem[];
  time: number;
  speed: number;
  screwSpeed: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function SpecimenStage({ items, time, speed, screwSpeed, selectedId, onSelect }: Props) {
  const frames = useMemo(
    () =>
      items.map(({ specimen, results }) => ({
        specimen,
        results,
        curve: computeCurve(specimen, results, screwSpeed),
      })),
    [items, screwSpeed]
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {frames.map(({ specimen: s, results, curve }, i) => {
          const active = selectedId === s.id;
          const color = SPECIMEN_COLORS[i % SPECIMEN_COLORS.length];
          const epsNow = Math.max(0, strainRate(screwSpeed, s.L0) * time * speed);
          const epsF = results?.keys?.epsF ?? 1;
          const frac = epsF > 0 ? Math.min(1, epsNow / epsF) : 0;
          const idx = curve.length > 0 ? Math.min(curve.length - 1, Math.floor(frac * (curve.length - 1))) : 0;
          const pt = curve[idx];
          const F = pt?.F ?? 0;
          const sig = pt?.sig ?? 0;
          const eps = pt?.eps ?? 0;
          const broken = epsNow >= epsF && epsF > 0;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`rounded-lg border bg-lab-panel p-2 text-left transition-colors ${
                active ? 'border-cyan-500 ring-1 ring-cyan-500/40' : 'border-lab-line hover:border-lab-muted'
              }`}
            >
              <SpecimenView specimen={s} results={results} curve={curve} epsNow={epsNow} color={color} />
              <div className="mt-1.5 space-y-0.5">
                <div className="truncate text-[11px] font-semibold text-lab-text">{s.label}</div>
                <div className="flex items-center justify-between font-mono text-[9px] text-lab-muted">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    F
                  </span>
                  <span className="text-lab-text">{F >= 1000 ? `${(F / 1000).toFixed(2)} kN` : `${F.toFixed(0)} N`}</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[9px] text-lab-muted">
                  <span>σ</span>
                  <span className="text-lab-text">{sig.toFixed(0)} MPa</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[9px] text-lab-muted">
                  <span>ε</span>
                  <span className="text-lab-text">{(eps * 100).toFixed(2)} %</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-lab-line py-10 text-center text-xs text-lab-muted">
          Añade probetas en el configurador para ver la animación del ensayo.
        </div>
      )}
    </div>
  );
}

function SpecimenView({
  specimen: s,
  results,
  curve,
  epsNow,
  color,
}: {
  specimen: Specimen;
  results: SpecimenResults;
  curve: ReturnType<typeof computeCurve>;
  epsNow: number;
  color: string;
}) {
  const L0 = s.L0;
  const epsF = results.keys.epsF || 1;
  const frac = Math.min(1, Math.max(0, epsNow / epsF));
  const idx = curve.length > 0 ? Math.min(curve.length - 1, Math.floor(frac * (curve.length - 1))) : 0;
  const eps = curve[idx]?.eps ?? 0;
  const broken = epsNow >= epsF && epsF > 0;
  const ductile = results.strainPct > 5;
  const stretch = 1 + eps;

  const W = 140;
  const H = 100;
  const cy = 52;
  const threadW = 16;
  const gripH = 26;
  const cx = W / 2;
  const maxHalf = 52;
  const baseHalf = Math.min(maxHalf / stretch, maxHalf * 0.65);
  const halfLen = baseHalf * stretch;
  const ductileNeck = Math.max(0.5, 1 - 0.42 * Math.pow(frac, 3));
  const barH = 8;

  const gripL = cx - halfLen - 3;
  const gripR = cx + halfLen + 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={`mg-${s.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="50%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Marcos tipo PASCO (columnas laterales) */}
      <line x1={6} y1={10} x2={6} y2={H - 10} stroke="rgb(var(--lab-line))" strokeWidth="3" />
      <line x1={W - 6} y1={10} x2={W - 6} y2={H - 10} stroke="rgb(var(--lab-line))" strokeWidth="3" />
      <line x1={6} y1={10} x2={W - 6} y2={10} stroke="rgb(var(--lab-line))" strokeWidth="1.5" opacity="0.5" />

      {/* Mordazas con rosca M12 */}
      <rect x={gripL - threadW} y={cy - gripH / 2} width={threadW} height={gripH} rx="2" fill="rgb(var(--lab-line))" />
      <rect x={gripR} y={cy - gripH / 2} width={threadW} height={gripH} rx="2" fill="rgb(var(--lab-line))" />
      {/* líneas de rosca */}
      {Array.from({ length: 5 }).map((_, ti) => (
        <line key={`tl-${ti}`} x1={gripL - threadW + 2} y1={cy - gripH / 2 + 3 + ti * 4} x2={gripL - 2} y2={cy - gripH / 2 + 3 + ti * 4} stroke="rgb(var(--lab-muted))" strokeWidth="0.5" opacity="0.4" />
      ))}
      {Array.from({ length: 5 }).map((_, ti) => (
        <line key={`tr-${ti}`} x1={gripR + 2} y1={cy - gripH / 2 + 3 + ti * 4} x2={gripR + threadW - 2} y2={cy - gripH / 2 + 3 + ti * 4} stroke="rgb(var(--lab-muted))" strokeWidth="0.5" opacity="0.4" />
      ))}

      {/* Flechas de tracción */}
      <g stroke={color} strokeWidth="1.5" fill="none" opacity={broken ? 0.15 : 0.85}>
        <path d={`M ${gripL - threadW - 1} ${cy} l -7 0 m 2 -3 l -2 3 l 2 3`} />
        <path d={`M ${gripR + threadW + 1} ${cy} l 7 0 m -2 -3 l 2 3 l -2 3`} />
      </g>

      {!broken ? (
        <g>
          {/* tramos de transición */}
          <path
            d={`M ${gripL} ${cy - barH / 2 - 2} L ${cx - halfLen * 0.55} ${cy - (barH / 2) * ductileNeck} L ${cx - halfLen * 0.55} ${cy + (barH / 2) * ductileNeck} L ${gripL} ${cy + barH / 2 + 2} Z`}
            fill={`url(#mg-${s.id})`}
            opacity="0.35"
          />
          <path
            d={`M ${gripR} ${cy - barH / 2 - 2} L ${cx + halfLen * 0.55} ${cy - (barH / 2) * ductileNeck} L ${cx + halfLen * 0.55} ${cy + (barH / 2) * ductileNeck} L ${gripR} ${cy + barH / 2 + 2} Z`}
            fill={`url(#mg-${s.id})`}
            opacity="0.35"
          />
          {ductile ? (
            <path
              d={`M ${cx - halfLen * 0.55} ${cy - barH / 2}
                 Q ${cx} ${cy - barH / 2} ${cx} ${cy - (barH / 2) * ductileNeck}
                 L ${cx} ${cy + (barH / 2) * ductileNeck}
                 Q ${cx} ${cy + barH / 2} ${cx + halfLen * 0.55} ${cy + barH / 2} Z`}
              fill={`url(#mg-${s.id})`}
            />
          ) : (
            <rect x={cx - halfLen * 0.55} y={cy - barH / 2} width={halfLen * 1.1} height={barH} fill={`url(#mg-${s.id})`} />
          )}
        </g>
      ) : (
        <g>
          {ductile ? (
            <>
              <path
                d={`M ${gripL} ${cy - barH / 2 - 2} L ${cx - halfLen * 0.45} ${cy - barH / 2} Q ${cx - halfLen * 0.52} ${cy} ${cx - halfLen * 0.45} ${cy + barH / 2} L ${gripL} ${cy + barH / 2 + 2} Z`}
                fill={`url(#mg-${s.id})`}
                opacity="0.55"
              />
              <path
                d={`M ${gripR} ${cy - barH / 2 - 2} L ${cx + halfLen * 0.45} ${cy - barH / 2} Q ${cx + halfLen * 0.52} ${cy} ${cx + halfLen * 0.45} ${cy + barH / 2} L ${gripR} ${cy + barH / 2 + 2} Z`}
                fill={`url(#mg-${s.id})`}
                opacity="0.55"
              />
            </>
          ) : (
            <>
              <rect x={gripL} y={cy - barH / 2} width={cx - halfLen * 0.5 - gripL} height={barH} fill={`url(#mg-${s.id})`} opacity="0.55" />
              <rect x={cx + halfLen * 0.5} y={cy - barH / 2} width={gripR - cx - halfLen * 0.5} height={barH} fill={`url(#mg-${s.id})`} opacity="0.55" />
            </>
          )}
        </g>
      )}

      <text x={cx} y={H - 4} textAnchor="middle" fontSize="7" fill="rgb(var(--lab-muted))" fontFamily="JetBrains Mono">
        {broken ? 'ROTURA' : `ε=${(eps * 100).toFixed(1)}%`}
      </text>
    </svg>
  );
}
