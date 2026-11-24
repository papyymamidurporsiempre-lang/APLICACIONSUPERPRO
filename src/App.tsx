import { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import Header from '@/components/Header';
import SpecimenPanel, { makeDefaultSpecimens } from '@/components/SpecimenPanel';
import TestControls from '@/components/TestControls';
import SpecimenStage from '@/components/SpecimenStage';
import ResultsPanel from '@/components/ResultsPanel';
import ChartsPanel from '@/components/ChartsPanel';
import StandardTab from '@/components/StandardTab';
import FormulasTab from '@/components/FormulasTab';
import { useSpecimens, type ComputedItem } from '@/hooks/useSpecimens';
import { useSimulation } from '@/hooks/useSimulation';
import { validateSpecimen, DEFAULT_SCREW_SPEED, strainRate } from '@/lib/engine';
import { exportSummaryCSV } from '@/lib/csv';
import type { Specimen } from '@/types';

type Tab = 'lab' | 'standard' | 'formulas';

export default function App() {
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState<Tab>('lab');
  const [specimens, setSpecimens] = useState<Specimen[]>(makeDefaultSpecimens);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'stress-strain' | 'force-elong'>('stress-strain');
  const [stressKind, setStressKind] = useState<'engineering' | 'true'>('engineering');
  const [screwSpeed, setScrewSpeed] = useState<number>(DEFAULT_SCREW_SPEED);
  const [complianceOn, setComplianceOn] = useState<boolean>(true);
  const [zoomElastic, setZoomElastic] = useState<boolean>(false);
  const [singleMode, setSingleMode] = useState<boolean>(false);

  const items = useSpecimens(specimens);
  const validIds = useMemo(() => {
    const set = new Set<string>();
    specimens.forEach((s) => {
      if (validateSpecimen(s).every((x) => x.level !== 'error')) set.add(s.id);
    });
    return set;
  }, [specimens]);

  const validItems = items.filter(({ specimen }) => validIds.has(specimen.id));
  const sim = useSimulation(specimens, validIds.size, screwSpeed);

  // Progreso global: fracción de deformación de la probeta más dúctil
  const progress = useMemo(() => {
    let maxEpsF = 0;
    validItems.forEach(({ specimen, results }) => {
      if (results?.keys?.epsF) maxEpsF = Math.max(maxEpsF, results.keys.epsF);
    });
    if (maxEpsF <= 0 || validItems.length === 0) return 0;
    // usamos la primera probeta válida como referencia de tiempo
    const ref = validItems[0];
    if (!ref) return 0;
    const epsNow = strainRate(screwSpeed, ref.specimen.L0) * sim.time * sim.speed;
    return Math.min(1, epsNow / maxEpsF);
  }, [validItems, sim.time, sim.speed, screwSpeed]);

  // Fuerza máxima actual (para alerta de celda PASCO)
  const maxForce = useMemo(() => {
    let maxF = 0;
    validItems.forEach(({ specimen, results }) => {
      const epsNow = strainRate(screwSpeed, specimen.L0) * sim.time * sim.speed;
      const epsF = results?.keys?.epsF ?? 1;
      const frac = Math.min(1, epsNow / epsF);
      const sig = results?.stressAt(frac * epsF);
      if (sig !== null && sig !== undefined) {
        maxF = Math.max(maxF, sig * results.A0);
      }
    });
    return maxF;
  }, [validItems, sim.time, sim.speed, screwSpeed]);

  const toggleTheme = () => {
    setDark((d) => {
      document.documentElement.classList.toggle('light', d);
      return !d;
    });
  };

  // Tiempo total del ensayo basado en la probeta más dúctil
  const totalTime = useMemo(() => {
    let maxEpsF = 0;
    let refL0 = 0;
    validItems.forEach(({ specimen, results }) => {
      const epsF = results?.keys?.epsF ?? 0;
      if (epsF > maxEpsF) {
        maxEpsF = epsF;
        refL0 = specimen.L0;
      }
    });
    if (maxEpsF <= 0 || refL0 <= 0) return 0;
    const rate = strainRate(screwSpeed, refL0);
    return rate > 0 ? maxEpsF / rate : 0;
  }, [validItems, screwSpeed]);

  // Valores actuales para el deslizador: usar la probeta de referencia (más dúctil)
  const refSpecimen = useMemo(() => {
    let best: ComputedItem | null = null;
    let maxEpsF = 0;
    validItems.forEach((it) => {
      const epsF = it.results?.keys?.epsF ?? 0;
      if (epsF > maxEpsF) {
        maxEpsF = epsF;
        best = it;
      }
    });
    return best;
  }, [validItems]);

  const currentEps = useMemo(() => {
    const ref = refSpecimen as ComputedItem | null;
    if (!ref) return 0;
    return Math.min(
      strainRate(screwSpeed, ref.specimen.L0) * sim.time * sim.speed,
      ref.results?.keys?.epsF ?? 0
    );
  }, [refSpecimen, sim.time, sim.speed, screwSpeed]);

  const { currentSig, currentF } = useMemo(() => {
    const ref = refSpecimen as ComputedItem | null;
    if (!ref || !ref.results) return { currentSig: 0, currentF: 0 };
    const sig = ref.results.stressAt(currentEps);
    const s = sig ?? 0;
    return { currentSig: s, currentF: s * ref.results.A0 };
  }, [refSpecimen, currentEps]);

  const handleScrub = (t: number) => {
    if (sim.running) sim.stop();
    sim.setTime(t);
  };

  const singleId = singleMode ? selectedId : null;

  return (
    <div className="flex min-h-screen flex-col bg-lab-bg">
      <Header dark={dark} onToggle={toggleTheme} />

      <nav className="flex gap-1 border-b border-lab-line bg-lab-panel px-4 md:px-6">
        {([
          ['lab', 'Laboratorio'],
          ['standard', 'Norma ASTM E8/E8M'],
          ['formulas', 'Fórmulas y Propiedades'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              tab === t ? 'border-cyan-500 text-cyan-500' : 'border-transparent text-lab-muted hover:text-lab-text'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'standard' ? (
        <main className="flex-1">
          <StandardTab />
        </main>
      ) : tab === 'formulas' ? (
        <main className="flex-1">
          <FormulasTab />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <aside className="w-full border-b border-lab-line xl:h-[calc(100vh-113px)] xl:w-80 xl:border-b-0 xl:border-r">
            <SpecimenPanel specimens={specimens} onChange={setSpecimens} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <TestControls
              specimens={specimens}
              running={sim.running}
              speed={sim.speed}
              time={sim.time}
              progress={progress}
              screwSpeed={screwSpeed}
              complianceOn={complianceOn}
              maxForce={maxForce}
              totalTime={totalTime}
              currentEps={currentEps}
              currentSig={currentSig}
              currentF={currentF}
              onStart={sim.start}
              onPause={sim.stop}
              onReset={sim.reset}
              onSpeed={sim.setSpeed}
              onScrewSpeed={setScrewSpeed}
              onCompliance={setComplianceOn}
              onScrub={handleScrub}
            />

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              <SpecimenStage
                items={validItems}
                time={sim.time}
                speed={sim.speed}
                screwSpeed={screwSpeed}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />

              <div className="rounded-lg border border-lab-line bg-lab-panel" style={{ height: 460 }}>
                <ChartsPanel
                  items={validItems}
                  time={sim.time}
                  speed={sim.speed}
                  screwSpeed={screwSpeed}
                  chartType={chartType}
                  stressKind={stressKind}
                  complianceOn={complianceOn}
                  singleMode={singleMode}
                  singleId={singleId}
                  onChartType={setChartType}
                  onStressKind={setStressKind}
                  onZoom={setZoomElastic}
                  zoomElastic={zoomElastic}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-lab-muted">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-cyan-500"
                    checked={singleMode}
                    onChange={(e) => setSingleMode(e.target.checked)}
                  />
                  Modo individual (aislar probeta seleccionada en la gráfica)
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Resultados por probeta</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportSummaryCSV(validItems, ',')}
                      disabled={validItems.length === 0}
                      className="flex items-center gap-1.5 rounded-md border border-lab-line px-2.5 py-1.5 text-[11px] text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text disabled:opacity-40"
                    >
                      <FileDown size={13} /> Resumen CSV (,)
                    </button>
                    <button
                      onClick={() => exportSummaryCSV(validItems, ';')}
                      disabled={validItems.length === 0}
                      className="flex items-center gap-1.5 rounded-md border border-lab-line px-2.5 py-1.5 font-mono text-[11px] text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text disabled:opacity-40"
                    >
                      <FileDown size={13} /> {'(;'}
                    </button>
                  </div>
                </div>
                <ResultsPanel items={validItems} validIds={validIds} />
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
