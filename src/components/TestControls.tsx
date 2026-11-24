import { Play, Pause, RotateCcw, Gauge, AlertTriangle, Wrench, FastForward } from 'lucide-react';
import { SPECIMEN_COLORS, PASCO_CELL_LIMIT_N } from '@/data/materials';
import type { Specimen } from '@/types';
import { SCREW_SPEED_MIN, SCREW_SPEED_MAX, strainRate } from '@/lib/engine';

interface Props {
  specimens: Specimen[];
  running: boolean;
  speed: number;
  time: number;
  progress: number;
  screwSpeed: number;
  complianceOn: boolean;
  maxForce: number;
  totalTime: number;
  currentEps: number;
  currentSig: number;
  currentF: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeed: (v: number) => void;
  onScrewSpeed: (v: number) => void;
  onCompliance: (v: boolean) => void;
  onScrub: (time: number) => void;
}

const SPEEDS = [1, 2, 3, 5, 20];

export default function TestControls({
  specimens, running, speed, time, progress, screwSpeed, complianceOn, maxForce,
  totalTime, currentEps, currentSig, currentF,
  onStart, onPause, onReset, onSpeed, onScrewSpeed, onCompliance, onScrub,
}: Props) {
  const cellExceeded = maxForce >= PASCO_CELL_LIMIT_N;
  const cellNear = maxForce >= PASCO_CELL_LIMIT_N * 0.9;
  const fmtForce = maxForce >= 1000 ? `${(maxForce / 1000).toFixed(2)} kN` : `${maxForce.toFixed(0)} N`;
  const fmtCurrentF = currentF >= 1000 ? `${(currentF / 1000).toFixed(2)} kN` : `${currentF.toFixed(0)} N`;
  const scrubMax = totalTime > 0 ? totalTime : 1;
  const scrubValue = Math.min(time, scrubMax);

  return (
    <div className="border-b border-lab-line bg-lab-panel px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Play size={14} /> Iniciar
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500"
          >
            <Pause size={14} /> Pausar
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-md border border-lab-line px-3 py-2 text-xs font-medium text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text"
        >
          <RotateCcw size={14} /> Reiniciar
        </button>

        <div className="flex items-center gap-1 rounded-md border border-lab-line p-0.5">
          <Gauge size={13} className="ml-1.5 mr-0.5 text-lab-muted" />
          {SPEEDS.map((v) => (
            <button
              key={v}
              onClick={() => onSpeed(v)}
              className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                speed === v ? 'bg-cyan-500/20 text-cyan-500' : 'text-lab-muted hover:text-lab-text'
              }`}
            >
              {v}x
            </button>
          ))}
        </div>

        {/* Velocidad de rosca (Arduino) */}
        <div className="flex items-center gap-2 rounded-md border border-lab-line px-3 py-1.5">
          <Wrench size={13} className="text-lab-muted" />
          <span className="text-[10px] font-medium text-lab-muted">Vel. rosca</span>
          <input
            type="range"
            min={SCREW_SPEED_MIN}
            max={SCREW_SPEED_MAX}
            step={0.1}
            value={screwSpeed}
            onChange={(e) => onScrewSpeed(parseFloat(e.target.value))}
            className="h-1 w-24 accent-cyan-500"
          />
          <span className="font-mono text-[10px] text-cyan-500">{screwSpeed.toFixed(1)} mm/min</span>
        </div>

        {/* Toggle cumplimiento del bastidor */}
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-lab-line px-3 py-1.5 text-[10px] text-lab-muted transition-colors hover:text-lab-text">
          <input
            type="checkbox"
            className="h-3 w-3 accent-cyan-500"
            checked={complianceOn}
            onChange={(e) => onCompliance(e.target.checked)}
          />
          Cumplimiento bastidor (E corregido)
        </label>

        {/* Alerta celda PASCO 7100 N */}
        {(cellExceeded || cellNear) && (
          <div className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-semibold ${
            cellExceeded ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
          }`}>
            <AlertTriangle size={13} />
            {cellExceeded
              ? `Celda sobrepasada: ${fmtForce} > ${PASCO_CELL_LIMIT_N / 1000} kN`
              : `Cerca del límite celda: ${fmtForce} / ${PASCO_CELL_LIMIT_N / 1000} kN`}
          </div>
        )}

        {/* Barra de progreso compacta + leyenda de colores */}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 lg:flex">
            {specimens.slice(0, 6).map((s, i) => (
              <span key={s.id} className="flex items-center gap-1 text-[10px] text-lab-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SPECIMEN_COLORS[i % 6] }} />
                {s.label.length > 12 ? s.label.slice(0, 12) + '…' : s.label}
              </span>
            ))}
          </div>
          <div className="w-28 sm:w-40">
            <div className="h-1.5 overflow-hidden rounded-full bg-lab-raised">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-100"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 flex justify-between font-mono text-[9px] text-lab-muted">
              <span>{progress >= 1 ? 'COMPLETADO' : `${Math.round(progress * 100)}%`}</span>
              <span>t = {time.toFixed(1)} s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deslizador interactivo de avance del ensayo */}
      <div className="mt-3 rounded-md border border-lab-line bg-lab-raised/40 px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <FastForward size={13} className="text-cyan-500" />
          <span className="text-[11px] font-semibold text-lab-text">Avance del ensayo</span>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-[10px] text-lab-muted">
            <span>t: <span className="text-lab-text">{time.toFixed(1)} s</span> / {scrubMax.toFixed(1)} s</span>
            <span>ε: <span className="text-lab-text">{(currentEps * 100).toFixed(2)} %</span></span>
            <span>σ: <span className="text-lab-text">{currentSig.toFixed(0)} MPa</span></span>
            <span>F: <span className="text-lab-text">{fmtCurrentF}</span></span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={scrubMax}
          step={0.05}
          value={scrubValue}
          onChange={(e) => onScrub(parseFloat(e.target.value))}
          className="h-2 w-full accent-cyan-500"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] text-lab-muted">
          <span>0 s</span>
          <span>{progress >= 1 ? 'Fractura' : `${Math.round(progress * 100)}%`}</span>
          <span>{scrubMax.toFixed(1)} s</span>
        </div>
      </div>
    </div>
  );
}
