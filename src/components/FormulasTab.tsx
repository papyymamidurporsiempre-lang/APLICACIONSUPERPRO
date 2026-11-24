import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { BookMarked } from 'lucide-react';
import { MATERIALS, PASCO_CELL_LIMIT_N, FRAME_COMPLIANCE } from '@/data/materials';

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

function FormulaCard({
  title,
  tex,
  description,
  variables,
}: {
  title: string;
  tex: string;
  description: string;
  variables: { sym: string; desc: string }[];
}) {
  return (
    <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
      <h3 className="mb-2 text-sm font-bold text-cyan-500">{title}</h3>
      <div className="rounded-md border border-lab-line bg-lab-bg/50 px-4 py-3">
        <Tex tex={tex} block />
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-lab-text/90">{description}</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {variables.map((v) => (
          <div key={v.sym} className="flex items-baseline gap-2 text-[11px]">
            <span className="shrink-0 text-cyan-500">
              <Tex tex={v.sym} />
            </span>
            <span className="text-lab-muted">{v.desc}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function FormulasTab() {
  const d0 = '3.33\\,\\text{mm}';
  const L0 = '32\\,\\text{mm}';
  const Fmax = `${(PASCO_CELL_LIMIT_N / 1000).toLocaleString('es-MX')}\\,\\text{kN}`;
  const defaultMaterials = MATERIALS.filter((m) => m.isDefault);

  return (
    <div className="mx-auto max-w-4xl space-y-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BookMarked size={18} className="text-cyan-500" />
        <h2 className="text-base font-bold">Fórmulas y Propiedades Mecánicas</h2>
      </div>

      <p className="rounded-lg border border-lab-line bg-lab-panel p-3 text-xs leading-relaxed text-lab-muted">
        Esta pestaña presenta todas las fórmulas utilizadas en los cálculos del simulador, con sus
        variables y descripciones. Las ecuaciones se renderizan en LaTeX. Los valores de referencia
        corresponden a la configuración estándar de las probetas M12×1.75 con la celda PASCO ME-8236.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormulaCard
          title="Área transversal inicial"
          tex="A_0 = \frac{\pi\, d_0^{\,2}}{4}"
          description="Sección inicial de la zona calibrada para probeta cilíndrica de diámetro d₀. Para probeta plana se usa A₀ = w₀·t₀."
          variables={[
            { sym: 'A_0', desc: 'área inicial (mm²)' },
            { sym: 'd_0', desc: `diámetro calibrado (ej. ${d0})` },
          ]}
        />

        <FormulaCard
          title="Esfuerzo de ingeniería"
          tex={String.raw`\sigma_{\text{ing}} = \frac{F}{A_0}`}
          description="Fuerza axial F dividida por el área inicial A₀. La celda de carga PASCO ME-8236 limita F a 7,100 N."
          variables={[
            { sym: 'F', desc: `fuerza axial (máx. ${Fmax})` },
            { sym: 'A_0', desc: 'área inicial (mm²)' },
          ]}
        />

        <FormulaCard
          title="Deformación unitaria y porcentual"
          tex={String.raw`\varepsilon_{\text{ing}} = \frac{\Delta L}{L_0}, \qquad \varepsilon\% = \varepsilon_{\text{ing}} \times 100`}
          description="Cambio relativo de longitud respecto a la longitud calibrada inicial L₀. La elongación porcentual expresa la ductilidad del material."
          variables={[
            { sym: '\\Delta L', desc: 'alargamiento (mm)' },
            { sym: 'L_0', desc: `longitud calibrada inicial (ej. ${L0})` },
          ]}
        />

        <FormulaCard
          title="Esfuerzo y deformación reales"
          tex={String.raw`\sigma_{\text{real}} = \sigma_{\text{ing}}\,(1 + \varepsilon_{\text{ing}}), \qquad \varepsilon_{\text{real}} = \ln(1 + \varepsilon_{\text{ing}})`}
          description="Esfuerzo y deformación referidos al área y longitud instantáneas bajo conservación de volumen plástico. La curva real no presenta caída tras el UTS."
          variables={[
            { sym: '\\sigma_{\\text{ing}}', desc: 'esfuerzo de ingeniería (MPa)' },
            { sym: '\\varepsilon_{\\text{ing}}', desc: 'deformación de ingeniería' },
          ]}
        />

        <FormulaCard
          title="Módulo de Young (elasticidad)"
          tex={String.raw`E = \frac{\Delta \sigma_{\text{ing}}}{\Delta \varepsilon_{\text{ing}}}`}
          description="Pendiente de la región elástica lineal (Ley de Hooke). El cumplimiento del bastidor produce un E aparente menor; se corrige según la rigidez del marco."
          variables={[
            { sym: 'E', desc: 'módulo elástico (GPa)' },
            { sym: 'k_{\text{frame}}', desc: `cumplimiento del bastidor ≈ ${FRAME_COMPLIANCE.toExponential(1)} m/N` },
          ]}
        />

        <FormulaCard
          title="Límite elástico / Esfuerzo de fluencia"
          tex={String.raw`\sigma_y \;\; (\text{método offset } 0.2\%)`}
          description="Esfuerzo a partir del cual el material presenta deformación plástica permanente apreciable. Para materiales sin punto de fluencia definido se traza una paralela a E desplazada 0.002 mm/mm."
          variables={[
            { sym: '\\sigma_y', desc: 'esfuerzo de fluencia (MPa)' },
            { sym: '0.2\\%', desc: 'offset plástico de referencia' },
          ]}
        />

        <FormulaCard
          title="Resistencia última a la tracción (UTS)"
          tex={String.raw`\sigma_{\text{UTS}} = \frac{F_{\max}}{A_0}`}
          description="Esfuerzo máximo soportado por la probeta antes de la estricción/rotura. En materiales dúctiles ocurre al inicio del cuello de formación."
          variables={[
            { sym: 'F_{\\max}', desc: 'fuerza máxima registrada (N)' },
            { sym: 'A_0', desc: 'área inicial (mm²)' },
          ]}
        />

        <FormulaCard
          title="Elongación a la fractura y reducción de área"
          tex={String.raw`\%EL = \frac{\Delta L_f}{L_0}\times 100, \qquad \%RA = \frac{A_0 - A_f}{A_0}\times 100`}
          description="Medidas de ductilidad tras la rotura. La elongación porcentual y la reducción de área indican cuánto se deforma el material antes de fallar."
          variables={[
            { sym: '\\Delta L_f', desc: 'alargamiento a la fractura (mm)' },
            { sym: 'A_f', desc: 'área final en la fractura (mm²)' },
          ]}
        />

        <FormulaCard
          title="Resiliencia"
          tex={String.raw`U_r \approx \frac{\sigma_y^{\,2}}{2\,E}`}
          description="Energía elástica recuperable por unidad de volumen. Corresponde al área bajo la curva σ–ε en la zona elástica, hasta la fluencia."
          variables={[
            { sym: 'U_r', desc: 'resiliencia (MJ/m³)' },
            { sym: '\\sigma_y,\\, E', desc: 'fluencia y módulo (MPa)' },
          ]}
        />

        <FormulaCard
          title="Tenacidad"
          tex={String.raw`U_t = \int_{0}^{\varepsilon_f} \sigma_{\text{ing}}\; d\varepsilon_{\text{ing}}`}
          description="Energía total absorbida por unidad de volumen hasta la fractura. Se integra numéricamente (regla de Simpson) sobre toda la curva σ–ε."
          variables={[
            { sym: 'U_t', desc: 'tenacidad (MJ/m³)' },
            { sym: '\\varepsilon_f', desc: 'deformación a la fractura' },
          ]}
        />

        <FormulaCard
          title="Desplazamiento por velocidad de rosca y tasa de deformación"
          tex={String.raw`\Delta L_{\text{rosca}} = v \cdot t, \qquad \dot{\varepsilon} = \frac{v}{L_0}`}
          description="Relación cinemática del accionamiento a velocidad controlada. La velocidad de rosca v se expresa en mm/min y se convierte a mm/s internamente."
          variables={[
            { sym: 'v', desc: 'velocidad de rosca (mm/min)' },
            { sym: 't', desc: 'tiempo (s)' },
          ]}
        />
      </div>

      <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
        <h3 className="mb-3 text-sm font-bold text-cyan-500">Propiedades de los materiales predeterminados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-lab-line text-lab-muted">
                <th className="py-2 pr-3 font-semibold">Material</th>
                <th className="py-2 px-2 font-semibold">E (GPa)</th>
                <th className="py-2 px-2 font-semibold">σy (MPa)</th>
                <th className="py-2 px-2 font-semibold">σUTS (MPa)</th>
                <th className="py-2 px-2 font-semibold">Elong. (%)</th>
                <th className="py-2 px-2 font-semibold">ν</th>
                <th className="py-2 pl-2 font-semibold">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {defaultMaterials.map((m) => (
                <tr key={m.id} className="border-b border-lab-line/60">
                  <td className="py-1.5 pr-3 font-medium text-lab-text">{m.name}</td>
                  <td className="py-1.5 px-2 font-mono text-lab-text/90">{m.E.toFixed(0)}</td>
                  <td className="py-1.5 px-2 font-mono text-lab-text/90">{m.sigmaY.toFixed(0)}</td>
                  <td className="py-1.5 px-2 font-mono text-lab-text/90">{m.sigmaUTS.toFixed(0)}</td>
                  <td className="py-1.5 px-2 font-mono text-lab-text/90">{m.elongation.toFixed(0)}</td>
                  <td className="py-1.5 px-2 font-mono text-lab-text/90">{m.nu.toFixed(2)}</td>
                  <td className="py-1.5 pl-2 text-lab-muted">{m.behavior === 'ductile' ? 'Dúctil' : 'Frágil'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
