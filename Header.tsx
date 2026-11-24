import { Moon, Sun, FlaskConical } from 'lucide-react';

interface Props {
  dark: boolean;
  onToggle: () => void;
}

export default function Header({ dark, onToggle }: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-lab-line bg-lab-panel px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500">
          <FlaskConical size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight tracking-tight">TensileLab ASTM</h1>
          <p className="text-xs text-lab-muted">Simulador de Ensayo de Tracción — Norma ASTM E8/E8M</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-lab-line text-lab-muted transition-colors hover:bg-lab-raised hover:text-lab-text"
        aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  );
}
