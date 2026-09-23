import { ReactNode } from 'react';

export type TonoIndicador = 'teal' | 'amber' | 'red' | 'indigo' | 'gray';

const FONDO_PANEL: Record<TonoIndicador, string> = {
  teal: 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300',
  amber: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300',
  red: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300',
  indigo: 'bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200',
  gray: 'bg-gray-50 border-gray-200'
};

const FONDO_ICONO: Record<TonoIndicador, string> = {
  teal: 'bg-teal-600',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  gray: 'bg-gray-400'
};

const COLOR_ICONO_ACCION: Record<TonoIndicador, string> = {
  teal: 'text-teal-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  indigo: 'text-indigo-600',
  gray: 'text-gray-500'
};

export interface BadgeIndicador {
  texto: string;
  subtexto?: string;
  tono: 'alerta' | 'ok';
}

interface AccionIndicador {
  texto: string;
  icono: string;
  onClick: () => void;
  disabled?: boolean;
}

interface PanelIndicadorProps {
  icono: string;
  tono: TonoIndicador;
  titulo: string;
  meta: ReactNode;
  badge?: BadgeIndicador | null;
  children: ReactNode;
  accion?: AccionIndicador | null;
}

export default function PanelIndicador({
  icono,
  tono,
  titulo,
  meta,
  badge,
  children,
  accion
}: PanelIndicadorProps) {
  return (
    <div className={`rounded-xl p-6 mb-8 border-2 ${FONDO_PANEL[tono]}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0 ${FONDO_ICONO[tono]}`}>
            <i className={`${icono} text-white text-2xl`}></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{titulo}</h3>
            <p className="text-sm text-gray-600">{meta}</p>
          </div>
        </div>

        {badge && (
          badge.tono === 'alerta' ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-xl flex-shrink-0 animate-pulse">
              <i className="ri-alarm-warning-fill text-red-600 text-xl"></i>
              <div className="text-sm">
                <p className="font-bold text-red-700">{badge.texto}</p>
                {badge.subtexto && <p className="text-red-600 text-xs">{badge.subtexto}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 border border-teal-300 rounded-xl flex-shrink-0">
              <i className="ri-shield-check-fill text-teal-600 text-xl"></i>
              <div className="text-sm">
                <p className="font-bold text-teal-700">{badge.texto}</p>
                {badge.subtexto && <p className="text-teal-600 text-xs">{badge.subtexto}</p>}
              </div>
            </div>
          )
        )}
      </div>

      {children}

      {accion && (
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={accion.onClick}
            disabled={accion.disabled}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`${accion.icono} ${COLOR_ICONO_ACCION[tono]}`}></i>
            {accion.texto}
          </button>
        </div>
      )}
    </div>
  );
}