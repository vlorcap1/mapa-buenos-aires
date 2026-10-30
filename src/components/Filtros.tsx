import { CATEGORIAS } from '../data/categorias';
import type { CategoriaId } from '../types';

interface Props {
  activas: Set<CategoriaId>;
  conteo: Record<string, number>;
  onToggle: (id: CategoriaId) => void;
  onTodas: () => void;
}

export default function Filtros({ activas, conteo, onToggle, onTodas }: Props) {
  const todas = activas.size === 0;
  return (
    <div className="filtros" role="group" aria-label="Filtrar por categoría">
      <button type="button" className={`chip ${todas ? 'chip--activo' : ''}`} onClick={onTodas} aria-pressed={todas}>
        Todo
      </button>
      {CATEGORIAS.map(({ id, label, color, Icon }) => {
        const on = activas.has(id);
        return (
          <button
            key={id}
            type="button"
            className={`chip ${on ? 'chip--activo' : ''}`}
            style={{ ['--chip' as string]: color }}
            onClick={() => onToggle(id)}
            aria-pressed={on}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            <span className="chip__n">{conteo[id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
