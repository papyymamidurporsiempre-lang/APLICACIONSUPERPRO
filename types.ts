export type GeometryType = 'cylindrical' | 'flat';

export type Behavior = 'ductile' | 'brittle';

export interface Material {
  id: string;
  name: string;
  shortName: string;
  group: string;
  E: number; // GPa
  sigmaY: number; // MPa
  sigmaUTS: number; // MPa
  elongation: number; // %
  nu: number;
  behavior: Behavior;
  isDefault?: boolean;
}

export interface Specimen {
  id: string;
  label: string;
  replicas: number;
  materialId: string;
  geometry: GeometryType;
  // Cilíndrica
  d0: number; // mm
  Dmajor: number; // mm
  L0: number; // mm
  Ltotal: number; // mm
  // Plana
  w0: number; // mm
  t0: number; // mm
  Wmajor: number; // mm
  // Propiedades personalizadas temporales
  useCustom: boolean;
  cE: number; // GPa
  cSigmaY: number; // MPa
  cSigmaUTS: number; // MPa
  cElongation: number; // %
  cNu: number;
  cBehavior: Behavior;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

export interface CurveKeyPoints {
  epsY: number;
  epsU: number;
  epsF: number;
  sigmaF: number;
}

export interface SpecimenResults {
  valid: boolean;
  A0: number;
  ratioL0d0: number | null;
  E_MPa: number;
  E_apparent_MPa: number; // sin corregir (cumplimiento del bastidor)
  compliancePct: number; // % subestimación de E
  sigmaY: number;
  sigmaUTS: number;
  elongFrac: number;
  keys: CurveKeyPoints;
  Fy: number;
  Fmax: number;
  Fpeak: number; // = Fmax (alias para tabla)
  cellUsagePct: number; // % de uso de la celda 7100 N
  sigmaF: number;
  dLFinal: number;
  strainPct: number;
  resilience: number;
  toughness: number;
  RA_pct: number; // reducción de área estimada
  stressAt: (eps: number) => number | null;
}

export interface ReplicaResult {
  id: string;
  metalId: string;
  metalName: string;
  replicaIndex: number;
  d0: number;
  A0: number;
  Ra: number; // rugosidad superficial
  surfaceFactor: number;
  UTS: number;
  sigmaY: number;
  E: number;
  EL_pct: number;
  Ur: number;
  Ut: number;
  RA_pct: number;
  Fpeak: number;
  cellUsagePct: number;
}

export interface SimulationState {
  time: number;
  running: boolean;
  speed: number;
}
