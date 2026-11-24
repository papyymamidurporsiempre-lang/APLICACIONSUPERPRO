import { BookOpen } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-lab-line bg-lab-panel p-4">
      <h3 className="mb-2 text-sm font-bold text-cyan-500">{title}</h3>
      <div className="space-y-2 text-xs leading-relaxed text-lab-text/90">{children}</div>
    </section>
  );
}

export default function StandardTab() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BookOpen size={18} className="text-cyan-500" />
        <h2 className="text-base font-bold">Norma ASTM E8 / E8M — Ensayo de Tracción de Materiales Metálicos</h2>
      </div>

      <Section title="Objeto y alcance">
        <p>
          La norma ASTM E8 (unidades pulgada-libra) y E8M (unidades SI: MPa, mm, N) describe el ensayo de tracción
          uniaxial de materiales metálicos a temperatura ambiente. Se mide la resistencia a la fluencia, la
          resistencia última a la tracción (UTS), el alargamiento y la reducción de área, aplicando carga axial
          controlada a una probeta sujeta por mordazas hasta su fractura.
        </p>
      </Section>

      <Section title="Geometría estándar de probetas">
        <p><strong>Probeta cilíndrica clásica (E8M):</strong></p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Diámetro calibrado d₀ = 12.5 mm.</li>
          <li>Longitud calibrada L₀ = 50 mm, con relación estándar <strong>L₀ = 4·d₀</strong> (4D).</li>
          <li>Diámetro mayor en los extremos de sujeción ≈ 2·d₀ (típicamente 18–20 mm), con transición suave por radios de tangencia.</li>
          <li>La longitud total suele ser al menos L₀ + 2·(diámetro de sujeción) para asegurar que la fractura ocurra dentro de la zona calibrada.</li>
        </ul>
        <p><strong>Probeta plana / rectangular:</strong></p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Ancho calibrado w₀ ≈ 6·t₀ (máximo 8·t₀ para evitar pandeo en compresión).</li>
          <li>Espesor t₀ según el producto; extremos más anchos (W ≈ 1.5·w₀) para la sujeción.</li>
          <li>La longitud calibrada L₀ debe cumplir las mismas condiciones de uniformidad que la cilíndrica.</li>
        </ul>
      </Section>

      <Section title="Control de velocidad de ensayo">
        <p>
          La norma permite control por velocidad de carga, velocidad de esfuerzo, tasa de deformación o velocidad
          del cabezal. Para E8M se recomienda una tasa de deformación tal que la zona elástica dure al menos 6 s;
          en este simulador se usa una tasa lineal de 0.02 s⁻¹ (2% de deformación por segundo simulado). Los
          resultados de fluencia son sensibles a la velocidad: a mayor velocidad, mayor σy aparente.
        </p>
      </Section>

      <Section title="Definición del límite elástico (método del offset 0.2%)">
        <p>
          Muchos metales no presentan punto de fluencia definido (caída de carga tipo acero dulce). Para ellos, el
          límite elástico se define como el esfuerzo que produce una <strong>deformación permanente del 0.2%</strong>
          (offset plástico): se traza una paralela a la recta elástica E desplazada 0.002 mm/mm y su intersección
          con la curva define σy. Alternativas de la norma: extensometría (E3138) o puntos de fluencia superior e
          inferior cuando existen.
        </p>
      </Section>

      <Section title="Esfuerzo último (UTS), fractura y ductilidad">
        <p>
          El UTS es el esfuerzo máximo de ingeniería alcanzado (Fmax / A₀). En materiales dúctiles, después del UTS
          la deformación deja de ser uniforme: se localiza en una zona que se adelgaza (estricción o cuello de
          formació n) y la carga de ingeniería cae hasta la fractura. La ductilidad se mide como elongación
          porcentual (ΔL_final/L₀ × 100) y reducción de área.
        </p>
      </Section>

      <Section title="Esfuerzo y deformación de ingeniería vs. real (true stress / true strain)">
        <p>
          <strong>Ingeniería:</strong> σ = F/A₀ y ε = ΔL/L₀ (referidas al área y longitud iniciales).{' '}
          <strong>Real:</strong> σ_real = F/A_inst = σ·(1+ε) (suponiendo volumen constante) y ε_real = ln(1+ε).
          Las curvas reales siguen subiendo después del UTS (no hay caída) porque el endurecimiento supera la
          pérdida de sección hasta la inestabilidad plástica; por eso la curva real es la base para leyes de
          endurecimiento tipo Hollomon: σ_real = K·ε_realⁿ.
        </p>
      </Section>

      <Section title="Propiedades derivadas calculadas en TensileLab">
        <ul className="ml-4 list-disc space-y-1">
          <li><strong>Resiliencia:</strong> energía elástica por unidad de volumen ≈ σy²/(2E), en MJ/m³.</li>
          <li><strong>Tenacidad:</strong> área total bajo la curva σ–ε hasta la fractura, integrada numéricamente (regla de Simpson), en MJ/m³.</li>
        </ul>
      </Section>
    </div>
  );
}
