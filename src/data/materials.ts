import type { Material } from '@/types';

export const MATERIALS: Material[] = [
  // 5 metales predeterminados al iniciar — elongaciones ajustadas a valores físicos coherentes
  { id: 'aisi-1020', name: 'Acero AISI 1020', shortName: 'Acero 1020', group: 'Acero al carbono', E: 203, sigmaY: 295, sigmaUTS: 395, elongation: 25, nu: 0.29, behavior: 'ductile', isDefault: true },
  { id: 'al-6061-t6', name: 'Aluminio 6061-T6 (ref. PASCO)', shortName: 'Aluminio', group: 'Aleación de aluminio', E: 68.9, sigmaY: 276, sigmaUTS: 310, elongation: 17, nu: 0.33, behavior: 'ductile', isDefault: true },
  { id: 'c83600', name: 'Bronce SAE 40 (C83600)', shortName: 'Bronce SAE 40', group: 'Aleación de cobre', E: 103, sigmaY: 138, sigmaUTS: 262, elongation: 35, nu: 0.33, behavior: 'ductile', isDefault: true },
  { id: 'c11000', name: 'Cobre C11000', shortName: 'Cobre', group: 'Aleación de cobre', E: 117, sigmaY: 69, sigmaUTS: 220, elongation: 45, nu: 0.34, behavior: 'ductile', isDefault: true },
  { id: 'c36000', name: 'Latón C36000', shortName: 'Latón', group: 'Aleación de cobre', E: 97, sigmaY: 310, sigmaUTS: 340, elongation: 18, nu: 0.34, behavior: 'ductile', isDefault: true },
  // Catálogo amplio adicional
  { id: 'aisi-1018', name: 'Acero AISI 1018', shortName: 'Acero 1018', group: 'Acero al carbono', E: 205, sigmaY: 370, sigmaUTS: 440, elongation: 15, nu: 0.29, behavior: 'ductile' },
  { id: 'aisi-1018-annealed', name: 'Acero AISI 1018 recocido', shortName: 'Acero 1018 recocido', group: 'Acero al carbono', E: 205, sigmaY: 220, sigmaUTS: 340, elongation: 30, nu: 0.29, behavior: 'ductile' },
  { id: 'astm-a36', name: 'Acero estructural ASTM A36', shortName: 'Acero A36', group: 'Acero al carbono', E: 200, sigmaY: 250, sigmaUTS: 400, elongation: 20, nu: 0.26, behavior: 'ductile' },
  { id: 'aisi-1045', name: 'Acero AISI 1045 templado/revenido', shortName: 'Acero 1045', group: 'Acero al carbono', E: 206, sigmaY: 530, sigmaUTS: 625, elongation: 12, nu: 0.29, behavior: 'ductile' },
  { id: 'ss-304', name: 'Acero Inoxidable 304', shortName: 'Inox 304', group: 'Acero inoxidable', E: 193, sigmaY: 215, sigmaUTS: 505, elongation: 40, nu: 0.29, behavior: 'ductile' },
  { id: 'ss-316l', name: 'Acero Inoxidable 316L', shortName: 'Inox 316L', group: 'Acero inoxidable', E: 193, sigmaY: 205, sigmaUTS: 485, elongation: 40, nu: 0.30, behavior: 'ductile' },
  { id: 'al-7075-t6', name: 'Aluminio 7075-T6', shortName: 'Aluminio 7075', group: 'Aleación de aluminio', E: 71.7, sigmaY: 503, sigmaUTS: 572, elongation: 11, nu: 0.33, behavior: 'ductile' },
  { id: 'c51000', name: 'Bronce fosforado C51000', shortName: 'Bronce fosforado', group: 'Aleación de cobre', E: 110, sigmaY: 330, sigmaUTS: 470, elongation: 20, nu: 0.34, behavior: 'ductile' },
  { id: 'cuni-7030', name: 'Cuproníquel Cu-Ni 70/30', shortName: 'Cuproníquel 70/30', group: 'Aleación de cobre', E: 152, sigmaY: 130, sigmaUTS: 380, elongation: 42, nu: 0.31, behavior: 'ductile' },
  { id: 'ti-6al-4v', name: 'Titanio Grado 5 Ti-6Al-4V', shortName: 'Titanio Ti-6Al-4V', group: 'Titanio', E: 113.8, sigmaY: 880, sigmaUTS: 950, elongation: 14, nu: 0.34, behavior: 'ductile' },
  { id: 'astm-a48-30', name: 'Fundición gris ASTM A48 Clase 30', shortName: 'Fundición gris A48', group: 'Fundición', E: 100, sigmaY: 207, sigmaUTS: 215, elongation: 1.5, nu: 0.26, behavior: 'brittle' },
];

export const DEFAULT_METAL_IDS = ['aisi-1020', 'al-6061-t6', 'c83600', 'c11000', 'c36000'];

export const SPECIMEN_COLORS = ['#22d3ee', '#f59e0b', '#34d399', '#fb7185', '#a78bfa', '#38bdf8'];

// Parámetros de equipo PASCO ME-8236
export const PASCO_CELL_LIMIT_N = 7100; // 7.1 kN
export const FRAME_COMPLIANCE = 1 / 2.5e6; // m/N (rigidez del bastidor aprox. 2.5 MN/m)

export function getMaterial(id: string): Material {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export function fileSafeName(materialId: string): string {
  const map: Record<string, string> = {
    'aisi-1020': 'Acero_AISI_1020',
    'al-6061-t6': 'Aluminio',
    'c83600': 'Bronce_SAE_40',
    'c11000': 'Cobre_C11000',
    'c36000': 'Laton_C36000',
  };
  return map[materialId] ?? getMaterial(materialId).shortName.replace(/[^a-zA-Z0-9]/g, '_');
}
