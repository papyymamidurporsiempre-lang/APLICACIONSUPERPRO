import type { Specimen, SpecimenResults, CurveKeyPoints, ValidationIssue, Material, ReplicaResult, Behavior } from '@/types';
import { getMaterial, PASCO_CELL_LIMIT_N, FRAME_COMPLIANCE } from '@/data/materials';

// Velocidad de rosca por defecto (mm/min). Se convierte a mm/s internamente.
export const DEFAULT_SCREW_SPEED = 10; // mm/min
export const SCREW_SPEED_MIN = 0.2;
export const SCREW_SPEED_MAX = 10.0;

// Tasa de deformación efectiva (1/s) = v_mm_per_s / L0
export function strainRate(screwSpeedMmPerMin: number, L0mm: number): number {
  return screwSpeedMmPerMin / 60 / L0mm;
}

// Desplazamiento de la rosca en mm para un tiempo t (s) y velocidad v (mm/min)
export function screwDisplacement(screwSpeedMmPerMin: number, t: number): number {
  return (screwSpeedMmPerMin / 60) * t;
}

export function validateSpecimen(s: Specimen): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (s.geometry === 'cylindrical') {
    if (!(s.d0 > 0)) issues.push({ level: 'error', message: 'El diámetro calibrado d0 debe ser mayor que 0 mm.' });
    if (!(s.L0 > 0)) issues.push({ level: 'error', message: 'La longitud calibrada L0 debe ser mayor que 0 mm.' });
    if (!(s.Ltotal > 0)) issues.push({ level: 'error', message: 'La longitud total debe ser mayor que 0 mm.' });
    if (s.d0 > 0 && s.Dmajor > 0 && s.d0 >= s.Dmajor)
      issues.push({ level: 'error', message: 'El diámetro calibrado d0 debe ser menor que el diámetro de sujeción D.' });
    if (s.Ltotal > 0 && s.L0 > 0 && s.Ltotal <= s.L0)
      issues.push({ level: 'error', message: 'La longitud total debe ser mayor que la longitud calibrada L0.' });
  } else {
    if (!(s.w0 > 0)) issues.push({ level: 'error', message: 'El ancho calibrado w0 debe ser mayor que 0 mm.' });
    if (!(s.t0 > 0)) issues.push({ level: 'error', message: 'El espesor t0 debe ser mayor que 0 mm.' });
    if (!(s.L0 > 0)) issues.push({ level: 'error', message: 'La longitud calibrada L0 debe ser mayor que 0 mm.' });
    if (s.w0 > 0 && s.Wmajor > 0 && s.w0 >= s.Wmajor)
      issues.push({ level: 'error', message: 'El ancho calibrado w0 debe ser menor que el ancho de sujeción W.' });
  }
  if (s.useCustom) {
    if (!(s.cE > 0)) issues.push({ level: 'error', message: 'El módulo elástico E debe ser mayor que 0 GPa.' });
    if (!(s.cSigmaY > 0)) issues.push({ level: 'error', message: 'El esfuerzo de fluencia σy debe ser mayor que 0 MPa.' });
    if (s.cSigmaY >= s.cSigmaUTS)
      issues.push({ level: 'error', message: 'El esfuerzo de fluencia σy debe ser menor que el esfuerzo último σu.' });
    if (!(s.cElongation >= 0.1)) issues.push({ level: 'error', message: 'La elongación debe ser mayor que 0%.' });
  }
  return issues;
}

function resolveMaterial(s: Specimen): Material {
  if (s.useCustom) {
    const base = getMaterial(s.materialId);
    return {
      ...base,
      name: 'Personalizado',
      shortName: 'Personalizado',
      group: 'Material personalizado',
      E: s.cE,
      sigmaY: s.cSigmaY,
      sigmaUTS: s.cSigmaUTS,
      elongation: s.cElongation,
      nu: s.cNu,
      behavior: s.cBehavior,
    };
  }
  return getMaterial(s.materialId);
}

// Smoothstep: transición cúbica suave entre 0 y 1
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function computeResults(s: Specimen): SpecimenResults {
  const m = resolveMaterial(s);
  const A0 = s.geometry === 'cylindrical' ? (Math.PI / 4) * s.d0 * s.d0 : s.w0 * s.t0;
  const E_MPa = m.E * 1000;
  const elongFrac = m.elongation / 100;
  const behavior: Behavior = m.behavior;
  const ductile = behavior === 'ductile' && m.elongation > 5;

  const epsY = m.sigmaY / E_MPa;
  // epsU: deformación en UTS — proporcional a la ductilidad real
  const epsU = ductile
    ? Math.max(epsY * 1.1, elongFrac * 0.6)
    : Math.max(epsY * 1.02, elongFrac * 0.85);
  const epsF = Math.max(elongFrac, epsU * 1.02);
  const sigmaF = ductile ? m.sigmaUTS * 0.82 : m.sigmaUTS * 0.97;

  const keys: CurveKeyPoints = { epsY, epsU, epsF, sigmaF };

  // Curva suave tipo Ramberg-Osgood:
  // - Zona elástica lineal (0 → epsY)
  // - Transición redondeada en fluencia usando smoothstep (epsY → epsU)
  // - Caída suave por estricción con curvatura exponencial (epsU → epsF)
  // Exponente de endurecimiento plástico adaptado a la ductilidad del material
  const nHardening = ductile
    ? Math.max(0.08, Math.min(0.35, 0.1 + elongFrac * 1.2))
    : 0.04;

  const stressAt = (eps: number): number | null => {
    if (eps < 0 || eps > epsF * 1.0001) return null;
    if (eps <= epsY) {
      // Zona elástica lineal pura
      return E_MPa * eps;
    }
    if (eps <= epsU) {
      // Transición elástica-plástica suave (Ramberg-Osgood)
      // Mezcla la pendiente elástica con endurecimiento plástico progresivo
      const t = (eps - epsY) / Math.max(epsU - epsY, 1e-9);
      const smoothT = smoothstep(t);
      const plasticStress = m.sigmaY + (m.sigmaUTS - m.sigmaY) * Math.pow(smoothT, nHardening / 0.2);
      // Combina pendiente elástica con respuesta plástica para transición C1-continua
      const elasticContrib = E_MPa * eps;
      return elasticContrib * (1 - smoothT) + plasticStress * smoothT;
    }
    // Caída post-UTS por estricción: exponencial suave hacia sigmaF
    const t = (eps - epsU) / Math.max(epsF - epsU, 1e-9);
    if (!ductile) {
      // Frágil: caída muy corta y casi lineal
      return m.sigmaUTS * (1 - (1 - sigmaF / m.sigmaUTS) * smoothstep(t));
    }
    // Dúctil: caída suave con curvatura exponencial
    const drop = 1 - Math.pow(t, 1.6);
    return sigmaF + (m.sigmaUTS - sigmaF) * drop;
  };

  const Fy = m.sigmaY * A0;
  const Fmax = m.sigmaUTS * A0;

  // Cumplimiento del bastidor: la deformación aparente incluye la flexión del marco.
  // E_aparente = E * (1 / (1 + E*A0*k_frame)), con k_frame en mm/N.
  // FRAME_COMPLIANCE está en m/N; convertir a mm/N: *1000.
  const kFrame_mm_per_N = FRAME_COMPLIANCE * 1000; // mm/N
  const complianceFactor = 1 + E_MPa * A0 * kFrame_mm_per_N;
  const E_apparent_MPa = E_MPa / complianceFactor;
  const compliancePct = (1 - E_apparent_MPa / E_MPa) * 100;

  // Reducción de área estimada (%RA): mayor en dúctiles
  const RA_pct = ductile
    ? Math.min(85, 12 + m.elongation * 1.6 + (m.sigmaUTS - m.sigmaY) * 0.03)
    : Math.max(0, m.elongation * 0.5);

  const cellUsagePct = (Fmax / PASCO_CELL_LIMIT_N) * 100;

  const resilience = (m.sigmaY * m.sigmaY) / (2 * E_MPa);
  const Nsteps = 4000;
  const h = epsF / Nsteps;
  let sum = 0;
  for (let i = 0; i <= Nsteps; i++) {
    const w = i === 0 || i === Nsteps ? 1 : i % 2 === 1 ? 4 : 2;
    sum += w * (stressAt(i * h) ?? 0);
  }
  const toughness = (h / 3) * sum;

  return {
    valid: true,
    A0,
    ratioL0d0: s.geometry === 'cylindrical' && s.d0 > 0 ? s.L0 / s.d0 : null,
    E_MPa,
    E_apparent_MPa,
    compliancePct,
    sigmaY: m.sigmaY,
    sigmaUTS: m.sigmaUTS,
    elongFrac,
    keys,
    Fy,
    Fmax,
    Fpeak: Fmax,
    cellUsagePct,
    sigmaF,
    dLFinal: epsF * s.L0,
    strainPct: m.elongation,
    resilience,
    toughness,
    RA_pct,
    stressAt,
  };
}

export interface CurvePoint {
  eps: number;
  sig: number;
  sigTrue: number;
  epsTrue: number;
  F: number;
  dL: number;
  dLscrew: number; // desplazamiento de rosca (mm)
  dLcorrected: number; // desplazamiento corregido por cumplimiento
  t: number;
}

// Genera curva con tiempo basado en velocidad de rosca (mm/min)
export function computeCurve(s: Specimen, res: SpecimenResults, screwSpeedMmPerMin = DEFAULT_SCREW_SPEED): CurvePoint[] {
  const pts: CurvePoint[] = [];
  const { keys } = res;
  const N = 480;
  const v_mm_per_s = screwSpeedMmPerMin / 60;
  const epsRate = v_mm_per_s / s.L0;
  const kFrame_mm_per_N = FRAME_COMPLIANCE * 1000;
  for (let i = 0; i <= N; i++) {
    const eps = (i / N) * keys.epsF;
    const sig = res.stressAt(eps);
    if (sig === null) continue;
    const F = sig * res.A0;
    const dL = eps * s.L0;
    const dLscrew = dL + F * kFrame_mm_per_N; // la rosca avanza más por la flexión del bastidor
    const oneP = 1 + eps;
    pts.push({
      eps,
      sig,
      sigTrue: sig * oneP,
      epsTrue: eps > 0 ? Math.log(oneP) : 0,
      F,
      dL,
      dLscrew,
      dLcorrected: dL,
      t: epsRate > 0 ? eps / epsRate : 0,
    });
  }
  return pts;
}

// ---------- Réplicas con variación dimensional/superficial realista ----------

// PRNG determinista simple (mulberry32) para réplicas reproducibles
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number, mean: number, std: number): number {
  const u = 1 - rand();
  const v = rand();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function generateReplicas(specimen: Specimen, n: number, seed = 42): ReplicaResult[] {
  const rand = mulberry32(seed + specimen.materialId.charCodeAt(0) * 1000);
  const m = resolveMaterial(specimen);
  const base = computeResults(specimen);
  const out: ReplicaResult[] = [];
  for (let i = 0; i < n; i++) {
    // Variación dimensional: d0 ± 0.5% (tolerancia de mecanizado)
    const d0Var = gauss(rand, specimen.d0, specimen.d0 * 0.003);
    const A0Var = (Math.PI / 4) * d0Var * d0Var;
    // Rugosidad superficial Ra (µm) — varía por material y acabado
    const Ra = Math.max(0.2, gauss(rand, 0.8 + (m.sigmaUTS / 1000) * 0.4, 0.15));
    // Factor superficial (reduce resistencia ligeramente con mayor Ra)
    const surfaceFactor = Math.max(0.85, 1 - (Ra - 0.4) * 0.02);
    // Variación de propiedades: UTS ±2%, σy ±3%, E ±1.5%, EL ±5%
    const UTS = Math.max(1, gauss(rand, m.sigmaUTS * surfaceFactor, m.sigmaUTS * 0.02));
    const sigmaY = Math.max(1, gauss(rand, m.sigmaY * surfaceFactor, m.sigmaY * 0.03));
    const E = Math.max(1, gauss(rand, m.E, m.E * 0.015));
    const EL = Math.max(0.5, gauss(rand, m.elongation, m.elongation * 0.05));
    const Ur = (sigmaY * sigmaY) / (2 * E * 1000);
    const Ut = Math.max(Ur, gauss(rand, base.toughness, base.toughness * 0.06));
    const RA_pct = Math.max(0, gauss(rand, base.RA_pct, base.RA_pct * 0.1));
    const Fpeak = UTS * A0Var;
    const cellUsagePct = (Fpeak / PASCO_CELL_LIMIT_N) * 100;
    out.push({
      id: `${specimen.id}-R${i + 1}`,
      metalId: specimen.materialId,
      metalName: m.name,
      replicaIndex: i + 1,
      d0: d0Var,
      A0: A0Var,
      Ra,
      surfaceFactor,
      UTS,
      sigmaY,
      E,
      EL_pct: EL,
      Ur,
      Ut,
      RA_pct,
      Fpeak,
      cellUsagePct,
    });
  }
  return out;
}
