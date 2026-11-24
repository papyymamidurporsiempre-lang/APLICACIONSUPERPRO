import type { Specimen } from '@/types';
import type { CurvePoint } from '@/lib/engine';

function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SEP_COMMA = ',';
const SEP_SEMI = ';';

export function exportSummaryCSV(
  rows: { specimen: Specimen; results: any }[],
  delimiter: ',' | ';'
): void {
  const d = delimiter;
  const num = (v: number, dec = 2) => v.toFixed(dec).replace('.', delimiter === ';' ? ',' : '.');
  const header = [
    'muestra', 'material', 'replicas', 'geometria', 'A0_mm2', 'L0_mm', 'L0_d0',
    'E_GPa', 'sigma_fluencia_MPa', 'sigma_ultimo_MPa', 'elongacion_pct',
    'F_fluencia_N', 'F_max_N', 'sigma_fractura_MPa', 'dL_final_mm', 'deformacion_pct',
    'resiliencia_MJ_m3', 'tenacidad_MJ_m3',
  ].join(d);
  const lines = rows.map(({ specimen: s, results: r }) => {
    const cols = [
      s.label,
      s.useCustom ? 'Personalizado' : s.materialId,
      String(s.replicas),
      s.geometry === 'cylindrical' ? 'Cilindrica' : 'Plana',
      num(r.A0), num(s.L0), r.ratioL0d0 !== null ? num(r.ratioL0d0) : '—',
      num(s.useCustom ? s.cE : 0, 1), num(r.sigmaY), num(r.sigmaUTS), num(r.strainPct, 1),
      num(r.Fy, 1), num(r.Fmax, 1), num(r.sigmaF),
      num(r.dLFinal, 3), num(r.strainPct, 1),
      num(r.resilience, 3), num(r.toughness, 1),
    ];
    return cols.join(d);
  });
  download('tensilelab_resumen.csv', [header, ...lines].join('\n'));
}

export function exportDatasetCSV(
  specimen: Specimen,
  curve: CurvePoint[],
  delimiter: ',' | ';'
): void {
  const d = delimiter;
  const header = [
    'muestra', 'tiempo_s', 'deformacion_unitaria_mm_mm', 'deformacion_pct',
    'esfuerzo_ingenieria_MPa', 'esfuerzo_real_MPa', 'fuerza_N', 'elongacion_mm',
  ].join(d);
  const num = (v: number, dec = 4) => v.toFixed(dec).replace('.', delimiter === ';' ? ',' : '.');
  const safe = specimen.label.replace(/[",;\n]/g, ' ').trim();
  const lines = curve.map((p) =>
    [safe, num(p.t, 2), num(p.eps, 6), num(p.eps * 100, 3), num(p.sig, 2), num(p.sigTrue, 2), num(p.F, 1), num(p.dL, 4)].join(d)
  );
  const fname = `tensilelab_${safe.toLowerCase().replace(/\s+/g, '_') || 'probeta'}.csv`;
  download(fname, [header, ...lines].join('\n'));
}
