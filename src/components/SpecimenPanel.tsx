import { useState } from 'react';
import { Plus, Copy, Trash2, AlertTriangle, AlertOctagon, Settings2, RotateCcw } from 'lucide-react';
import type { Specimen, GeometryType, Behavior } from '@/types';
import { MATERIALS, SPECIMEN_COLORS, getMaterial, DEFAULT_METAL_IDS } from '@/data/materials';
import { validateSpecimen } from '@/lib/engine';

interface Props {
  specimens: Specimen[];
  onChange: (s: Specimen[]) => void;
}

// Nomenclatura por defecto: extremos roscados M12x1.75, d0=3.33, L0=32, Ltotal=89
export function makeSpecimen(materialId: string, index: number): Specimen {
  const m = getMaterial(materialId);
  return {
    id: `spec-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    label: `${m.shortName}`,
    replicas: 5,
    materialId,
    geometry: 'cylindrical',
    d0: 3.33, Dmajor: 12, L0: 32, Ltotal: 89,
    w0: 12.5, t0: 6, Wmajor: 20,
    useCustom: false,
    cE: m.E, cSigmaY: m.sigmaY, cSigmaUTS: m.sigmaUTS, cElongation: m.elongation, cNu: m.nu, cBehavior: m.behavior,
  };
}

export function makeDefaultSpecimens(): Specimen[] {
  return DEFAULT_METAL_IDS.map((mid, i) => makeSpecimen(mid, i));
}

function NumField({ label, value, onChange, unit, step = 0.1, disabled }: {
  label: string; value: number; onChange: (v: number) => void; unit: string; step?: number; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-lab-muted">{label}</span>
      <div className="flex items-center rounded-md border border-lab-line bg-lab-raised focus-within:border-cyan-500">
        <input
          type="number"
          className="w-full bg-transparent px-2.5 py-1.5 font-mono text-xs text-lab-text outline-none"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <span className="px-2 font-mono text-[10px] text-lab-muted">{unit}</span>
      </div>
    </label>
  );
}

export default function SpecimenPanel({ specimens, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(specimens[0]?.id ?? null);

  const update = (id: string, patch: Partial<Specimen>) => {
    onChange(specimens.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSpecimen = () => {
    if (specimens.length >= 8) return;
    const s = makeSpecimen(MATERIALS[0].id, specimens.length);
    onChange([...specimens, s]);
    setOpenId(s.id);
  };

  const duplicate = (s: Specimen) => {
    if (specimens.length >= 8) return;
    const copy = { ...s, id: `spec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: `${s.label} (copia)` };
    onChange([...specimens, copy]);
    setOpenId(copy.id);
  };

  const remove = (id: string) => {
    onChange(specimens.filter((s) => s.id !== id));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 size={16} className="text-cyan-500" />
          Probetas (n={specimens.reduce((a, s) => a + s.replicas, 0)})
        </h2>
        <button
          onClick={addSpecimen}
          disabled={specimens.length >= 8}
          className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} /> Añadir
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {specimens.map((s, i) => {
          const mat = s.useCustom
            ? { name: 'Personalizado', group: '' }
            : getMaterial(s.materialId);
          const issues = validateSpecimen(s);
          const hasError = issues.some((x) => x.level === 'error');
          const hasWarn = issues.some((x) => x.level === 'warning');
          const open = openId === s.id;
          const color = SPECIMEN_COLORS[i % SPECIMEN_COLORS.length];
          return (
            <div
              key={s.id}
              className={`overflow-hidden rounded-lg border bg-lab-raised transition-colors ${
                hasError ? 'border-red-500/60' : hasWarn ? 'border-amber-500/50' : 'border-lab-line'
              }`}
            >
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-lab-text">{s.label}</span>
                  <span className="block truncate text-[10px] text-lab-muted">
                    {mat.name} · M12x1.75 · d₀{s.d0} · {s.replicas} réplicas
                  </span>
                </span>
                {hasError ? <AlertOctagon size={15} className="shrink-0 text-red-500" /> : hasWarn ? <AlertTriangle size={15} className="shrink-0 text-amber-500" /> : null}
                <span className={`text-lab-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {open && (
                <div className="space-y-3 border-t border-lab-line px-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="col-span-2 block">
                      <span className="mb-1 block text-[11px] font-medium text-lab-muted">Etiqueta</span>
                      <input
                        type="text"
                        className="w-full rounded-md border border-lab-line bg-lab-panel px-2.5 py-1.5 text-xs text-lab-text outline-none focus:border-cyan-500"
                        value={s.label}
                        onChange={(e) => update(s.id, { label: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-lab-muted">Material del catálogo</span>
                      <select
                        className="w-full rounded-md border border-lab-line bg-lab-panel px-2 py-1.5 text-xs text-lab-text outline-none focus:border-cyan-500"
                        value={s.materialId}
                        onChange={(e) => {
                          const nm = getMaterial(e.target.value);
                          update(s.id, {
                            materialId: e.target.value,
                            useCustom: false,
                            label: nm.shortName,
                            cE: nm.E, cSigmaY: nm.sigmaY, cSigmaUTS: nm.sigmaUTS, cElongation: nm.elongation, cNu: nm.nu, cBehavior: nm.behavior,
                          });
                        }}
                      >
                        {MATERIALS.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </label>
                    <NumField label="Réplicas (1–5)" unit="u" step={1} value={s.replicas}
                      onChange={(v) => update(s.id, { replicas: Math.min(5, Math.max(1, Math.round(v || 1))) })} />
                  </div>

                  <div className="flex gap-1.5">
                    {(['cylindrical', 'flat'] as GeometryType[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => update(s.id, { geometry: g })}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          s.geometry === g
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-500'
                            : 'border-lab-line text-lab-muted hover:text-lab-text'
                        }`}
                      >
                        {g === 'cylindrical' ? 'Cilíndrica (M12)' : 'Plana / Rectangular'}
                      </button>
                    ))}
                  </div>

                  {s.geometry === 'cylindrical' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Diámetro calibrado d₀" unit="mm" step={0.01} value={s.d0} onChange={(v) => update(s.id, { d0: v })} />
                      <NumField label="Rosca sujeción M12 (D)" unit="mm" step={0.1} value={s.Dmajor} onChange={(v) => update(s.id, { Dmajor: v })} />
                      <NumField label="Longitud calibrada L₀" unit="mm" step={0.1} value={s.L0} onChange={(v) => update(s.id, { L0: v })} />
                      <NumField label="Longitud total" unit="mm" step={0.1} value={s.Ltotal} onChange={(v) => update(s.id, { Ltotal: v })} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Ancho calibrado w₀" unit="mm" value={s.w0} onChange={(v) => update(s.id, { w0: v })} />
                      <NumField label="Espesor t₀" unit="mm" value={s.t0} onChange={(v) => update(s.id, { t0: v })} />
                      <NumField label="Ancho sujeción W" unit="mm" value={s.Wmajor} onChange={(v) => update(s.id, { Wmajor: v })} />
                      <NumField label="Longitud calibrada L₀" unit="mm" value={s.L0} onChange={(v) => update(s.id, { L0: v })} />
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-[11px] text-lab-muted">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-cyan-500"
                      checked={s.useCustom}
                      onChange={(e) => update(s.id, { useCustom: e.target.checked })}
                    />
                    Ajustar propiedades (tratamiento térmico / aleación propia)
                  </label>

                  {s.useCustom && (
                    <div className="grid grid-cols-2 gap-2 rounded-md border border-lab-line bg-lab-panel p-2">
                      <NumField label="Módulo E" unit="GPa" step={1} value={s.cE} onChange={(v) => update(s.id, { cE: v })} />
                      <NumField label="Elongación" unit="%" step={0.5} value={s.cElongation} onChange={(v) => update(s.id, { cElongation: v })} />
                      <NumField label="σ fluencia σy" unit="MPa" step={1} value={s.cSigmaY} onChange={(v) => update(s.id, { cSigmaY: v })} />
                      <NumField label="σ último σu" unit="MPa" step={1} value={s.cSigmaUTS} onChange={(v) => update(s.id, { cSigmaUTS: v })} />
                      <NumField label="Poisson ν" unit="" step={0.01} value={s.cNu} onChange={(v) => update(s.id, { cNu: v })} />
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-medium text-lab-muted">Comportamiento</span>
                        <select
                          className="w-full rounded-md border border-lab-line bg-lab-raised px-2 py-1.5 text-xs text-lab-text outline-none focus:border-cyan-500"
                          value={s.cBehavior}
                          onChange={(e) => update(s.id, { cBehavior: e.target.value as Behavior })}
                        >
                          <option value="ductile">Dúctil</option>
                          <option value="brittle">Frágil</option>
                        </select>
                      </label>
                    </div>
                  )}

                  {issues.length > 0 && (
                    <ul className="space-y-1">
                      {issues.map((x, k) => (
                        <li key={k} className={`flex items-start gap-1.5 text-[10px] leading-snug ${x.level === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                          {x.level === 'error' ? <AlertOctagon size={11} className="mt-0.5 shrink-0" /> : <AlertTriangle size={11} className="mt-0.5 shrink-0" />}
                          {x.message}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => duplicate(s)}
                      disabled={specimens.length >= 8}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-lab-line py-1.5 text-[11px] text-lab-muted transition-colors hover:bg-lab-panel hover:text-lab-text disabled:opacity-40"
                    >
                      <Copy size={12} /> Duplicar
                    </button>
                    <button
                      onClick={() => {
                        const nm = getMaterial(s.materialId);
                        update(s.id, { useCustom: false, cE: nm.E, cSigmaY: nm.sigmaY, cSigmaUTS: nm.sigmaUTS, cElongation: nm.elongation, cNu: nm.nu, cBehavior: nm.behavior });
                      }}
                      className="flex items-center justify-center gap-1 rounded-md border border-lab-line px-2.5 py-1.5 text-[11px] text-lab-muted transition-colors hover:bg-lab-panel hover:text-lab-text"
                      title="Restablecer propiedades del catálogo"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="flex items-center justify-center gap-1 rounded-md border border-red-500/40 px-2.5 py-1.5 text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
