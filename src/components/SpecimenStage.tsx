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
      <div className="rounded-lg border border-lab-line bg-lab-panel p-3">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Probeta M12×1.75 en la PASCO</h2>
          <span className="text-[10px] text-lab-muted">Celda ME-8236 · 7.1 kN</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                className={`group flex flex-col rounded-lg border bg-lab-bg/40 p-2 text-center transition-all ${
                  active ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-lab-line hover:border-lab-muted'
                }`}
              >
                <SpecimenView specimen={s} results={results} curve={curve} epsNow={epsNow} color={color} />
                <div className="mt-1.5 space-y-0.5">
                  <div className="truncate text-[11px] font-semibold text-lab-text">{s.label}</div>
                  <div className="flex items-center justify-center gap-1.5 font-mono text-[9px] text-lab-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-lab-text">{F >= 1000 ? `${(F / 1000).toFixed(2)} kN` : `${F.toFixed(0)} N`}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 font-mono text-[9px] text-lab-muted">
                    <span>σ <span className="text-lab-text">{sig.toFixed(0)} MPa</span></span>
                    <span>ε <span className="text-lab-text">{(eps * 100).toFixed(1)}%</span></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
  const epsF = results.keys.epsF || 1;
  const frac = Math.min(1, Math.max(0, epsNow / epsF));
  const idx = curve.length > 0 ? Math.min(curve.length - 1, Math.floor(frac * (curve.length - 1))) : 0;
  const eps = curve[idx]?.eps ?? 0;
  const broken = epsNow >= epsF && epsF > 0;
  const ductile = results.strainPct > 5;
  const stretch = 1 + eps;

  const W = 120;
  const H = 180;
  const cx = W / 2;
  const topY = 16;
  const botY = H - 16;
  const totalBar = botY - topY;
  const gripH = 26;
  const gripW = 28;
  const threadW = gripW - 4;
  const barHalfW = 7;
  const maxHalfLen = (totalBar - gripH - 6) / 2;
  const baseHalf = Math.min(maxHalfLen / stretch, maxHalfLen * 0.72);
  const halfLen = baseHalf * stretch;
  const ductileNeck = Math.max(0.5, 1 - 0.42 * Math.pow(frac, 3));

  const gripTopY = topY + 2;
  const gripBotY = botY - 2;
  const calTopY = gripTopY + gripH / 2 + 2;
  const calBotY = gripBotY - gripH / 2 - 2;
  const calCenterY = (calTopY + calBotY) / 2;
  const halfLenClamped = Math.min(halfLen, (calBotY - calTopY) / 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={`mg-${s.id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Bastidor vertical PASCO — columnas laterales */}
      <line x1={4} y1={topY} x2={4} y2={botY} stroke="rgb(var(--lab-line))" strokeWidth="3" />
      <line x1={W - 4} y1={topY} x2={W - 4} y2={botY} stroke="rgb(var(--lab-line))" strokeWidth="3" />
      {/* travesaños superior e inferior */}
      <line x1={4} y1={topY} x2={W - 4} y2={topY} stroke="rgb(var(--lab-line))" strokeWidth="2" />
      <line x1={4} y1={botY} x2={W - 4} y2={botY} stroke="rgb(var(--lab-line))" strokeWidth="2" />

      {/* Líneas guía horizontales de referencia en la zona calibrada */}
      {[0.25, 0.5, 0.75].map((f) => {
        const y = calTopY + f * (calBotY - calTopY);
        return (
          <line key={`guide-${f}`} x1={cx - 18} y1={y} x2={cx + 18} y2={y} stroke="rgb(var(--lab-muted))" strokeWidth="0.4" strokeDasharray="2 2" opacity={0.3} />
        );
      })}

      {/* Flechas de tracción */}
      <g stroke={color} strokeWidth="1.5" fill="none" opacity={broken ? 0.15 : 0.7}>
        <path d={`M ${cx} ${topY - 4} l 0 7 m -2 -3 l 2 3 l 2 -3`} />
        <path d={`M ${cx} ${botY + 4} l 0 -7 m -2 3 l 2 -3 l 2 3`} />
      </g>

      {/* Mordazas superior e inferior con rosca M12 */}
      <rect x={cx - gripW / 2} y={gripTopY - gripH / 2} width={gripW} height={gripH} rx="3" fill="rgb(var(--lab-raised))" stroke="rgb(var(--lab-line))" strokeWidth="1" />
      <rect x={cx - gripW / 2} y={gripBotY - gripH / 2} width={gripW} height={gripH} rx="3" fill="rgb(var(--lab-raised))" stroke="rgb(var(--lab-line))" strokeWidth="1" />
      {/* líneas de rosca M12x1.75 */}
      {Array.from({ length: 6 }).map((_, ti) => {
        const ty = gripTopY - gripH / 2 + 3 + ti * 3.5;
        return <line key={`tt-${ti}`} x1={cx - threadW / 2 + 1} y1={ty} x2={cx + threadW / 2 - 1} y2={ty} stroke="rgb(var(--lab-muted))" strokeWidth="0.5" opacity={0.4} />;
      })}
      {Array.from({ length: 6 }).map((_, ti) => {
        const ty = gripBotY - gripH / 2 + 3 + ti * 3.5;
        return <line key={`bt-${ti}`} x1={cx - threadW / 2 + 1} y1={ty} x2={cx + threadW / 2 - 1} y2={ty} stroke="rgb(var(--lab-muted))" strokeWidth="0.5" opacity={0.4} />;
      })}

      {/* Cuerpo de la probeta: zona calibrada central más estrecha */}
      {!broken ? (
        <g>
          {/* transición superior */}
          <path
            d={`M ${cx - barHalfW - 2} ${calTopY}
               L ${cx - barHalfW * 0.7} ${calCenterY - halfLenClamped}
               L ${cx + barHalfW * 0.7} ${calCenterY - halfLenClamped}
               L ${cx + barHalfW + 2} ${calTopY} Z`}
            fill={`url(#mg-${s.id})`}
            opacity="0.35"
          />
          {/* transición inferior */}
          <path
            d={`M ${cx - barHalfW - 2} ${calBotY}
               L ${cx - barHalfW * 0.7} ${calCenterY + halfLenClamped}
               L ${cx + barHalfW * 0.7} ${calCenterY + halfLenClamped}
               L ${cx + barHalfW + 2} ${calBotY} Z`}
            fill={`url(#mg-${s.id})`}
            opacity="0.35"
          />
          {/* zona calibrada */}
          {ductile ? (
            <path
              d={`M ${cx - barHalfW * 0.7} ${calCenterY - halfLenClamped}
                 Q ${cx - barHalfW * 0.7 * ductileNeck} ${calCenterY} ${cx - barHalfW * 0.7} ${calCenterY + halfLenClamped}
                 L ${cx + barHalfW * 0.7} ${calCenterY + halfLenClamped}
                 Q ${cx + barHalfW * 0.7 * ductileNeck} ${calCenterY} ${cx + barHalfW * 0.7} ${calCenterY - halfLenClamped} Z`}
              fill={`url(#mg-${s.id})`}
            />
          ) : (
            <rect
              x={cx - barHalfW * 0.7}
              y={calCenterY - halfLenClamped}
              width={barHalfW * 1.4}
              height={halfLenClamped * 2}
              fill={`url(#mg-${s.id})`}
            />
          )}
        </g>
      ) : (
        <g>
          {ductile ? (
            <>
              {/* mitad superior tras rotura */}
              <path
                d={`M ${cx - barHalfW - 2} ${calTopY}
                   L ${cx - barHalfW * 0.7} ${calCenterY - halfLenClamped * 0.6}
                   Q ${cx - barHalfW * 0.7 * ductileNeck} ${calCenterY - 2} ${cx} ${calCenterY - 4}
                   L ${cx} ${calCenterY - halfLenClamped * 0.6 + 2}
                   L ${cx + barHalfW * 0.7} ${calCenterY - halfLenClamped * 0.6}
                   L ${cx + barHalfW + 2} ${calTopY} Z`}
                fill={`url(#mg-${s.id})`}
                opacity="0.6"
              />
              {/* mitad inferior tras rotura */}
              <path
                d={`M ${cx - barHalfW - 2} ${calBotY}
                   L ${cx - barHalfW * 0.7} ${calCenterY + halfLenClamped * 0.6}
                   Q ${cx - barHalfW * 0.7 * ductileNeck} ${calCenterY + 2} ${cx} ${calCenterY + 4}
                   L ${cx} ${calCenterY + halfLenClamped * 0.6 - 2}
                   L ${cx + barHalfW * 0.7} ${calCenterY + halfLenClamped * 0.6}
                   L ${cx + barHalfW + 2} ${calBotY} Z`}
                fill={`url(#mg-${s.id})`}
                opacity="0.6"
              />
              {/* superficie de fractura irregular */}
              <path
                d={`M ${cx - barHalfW * 0.7 * ductileNeck} ${calCenterY - 2}
                   L ${cx - 1} ${calCenterY + 1}
                   L ${cx + 1.5} ${calCenterY - 1}
                   L ${cx + barHalfW * 0.7 * ductileNeck} ${calCenterY + 2} Z`}
                fill={color}
                opacity="0.4"
              />
            </>
          ) : (
            <>
              <rect x={cx - barHalfW - 2} y={calTopY} width={barHalfW * 2 + 4} height={halfLenClamped * 0.6} fill={`url(#mg-${s.id})`} opacity="0.55" />
              <rect x={cx - barHalfW - 2} y={calCenterY + 2} width={barHalfW * 2 + 4} height={halfLenClamped * 0.6} fill={`url(#mg-${s.id})`} opacity="0.55" />
              {/* línea de fractura recta para frágiles */}
              <line x1={cx - barHalfW - 2} y1={calCenterY} x2={cx + barHalfW + 2} y2={calCenterY} stroke={color} strokeWidth="1" strokeDasharray="2 1" opacity="0.6" />
            </>
          )}
        </g>
      )}

      {/* Estado */}
      <text x={cx} y={H - 3} textAnchor="middle" fontSize="7" fill={broken ? '#ef4444' : 'rgb(var(--lab-muted))'} fontFamily="JetBrains Mono" fontWeight={broken ? 700 : 400}>
        {broken ? 'ROTURA' : `ε=${(eps * 100).toFixed(1)}%`}
      </text>
    </svg>
  );
}
