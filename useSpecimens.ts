import { useMemo } from 'react';
import type { Specimen, Material } from '@/types';
import { getMaterial } from '@/data/materials';
import { computeResults } from '@/lib/engine';

export interface ComputedItem {
  specimen: Specimen;
  material: Material;
  results: ReturnType<typeof computeResults>;
}

export function useSpecimens(specimens: Specimen[]): ComputedItem[] {
  return useMemo(
    () =>
      specimens.map((s) => {
        const material = s.useCustom
          ? ({
              ...getMaterial(s.materialId),
              name: 'Personalizado',
              shortName: 'Personalizado',
              group: 'Material personalizado',
              E: s.cE,
              sigmaY: s.cSigmaY,
              sigmaUTS: s.cSigmaUTS,
              elongation: s.cElongation,
              nu: s.cNu,
              behavior: s.cBehavior,
            } as Material)
          : getMaterial(s.materialId);
        return { specimen: s, material, results: computeResults(s) };
      }),
    [specimens]
  );
}
