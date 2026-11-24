import { useEffect, useRef, useState } from 'react';
import type { Specimen } from '@/types';
import { strainRate } from '@/lib/engine';

// Simulación basada en velocidad de rosca (mm/min). El tiempo avanza en segundos
// y la deformación se calcula como eps = strainRate * t * speedMultiplier.
export function useSimulation(specimens: Specimen[], validCount: number, screwSpeed: number) {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  // Detener si no hay probetas válidas
  useEffect(() => {
    if (running && validCount === 0) setRunning(false);
  }, [running, validCount]);

  // Auto-detener al llegar al final: lo maneja App vía progress; aquí sólo pausamos si time excede un límite grande.
  useEffect(() => {
    if (running && time > 3600) setRunning(false);
  }, [running, time]);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - lastRef.current) / 1000, 0.1);
      lastRef.current = now;
      setTime((t) => t + dt * speed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, speed]);

  // La deformación para una probeta con L0 se calcula fuera: eps = strainRate(screwSpeed, L0) * time * speed
  // Exponemos una helper para obtener eps actual de una probeta.
  const epsFor = (L0: number): number => strainRate(screwSpeed, L0) * time * speed;

  return {
    time,
    running,
    speed,
    start: () => setRunning(true),
    stop: () => setRunning(false),
    toggle: () => setRunning((r) => !r),
    reset: () => {
      setRunning(false);
      setTime(0);
    },
    setSpeed,
    epsFor,
  };
}
