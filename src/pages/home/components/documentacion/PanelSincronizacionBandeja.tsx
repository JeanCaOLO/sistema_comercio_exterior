// Franja de estado de la sincronización automática de Etapa y ATD con Raga.

interface Props {
  sincronizando: boolean;
  progreso: { procesados: number; pendientes: number } | null;
  ultimaSincronizacion: Date | null;
  proximaSincronizacion: Date | null;
  error: string | null;
  mensaje?: string | null;
  onSincronizar: () => void;
  // El botón de sincronización manual está reservado a los administradores.
  puedeSincronizar?: boolean;
}

const hora = (fecha: Date | null): string =>
  fecha
    ? fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '—';

export default function PanelSincronizacionBandeja({
  sincronizando,
  progreso,
  ultimaSincronizacion,
  proximaSincronizacion,
  error,
  mensaje,
  onSincronizar,
  puedeSincronizar = false,
}: Props) {
  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-100 flex-shrink-0">
            {sincronizando ? (
              <span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin"></span>
            ) : (
              <i className="ri-refresh-line text-indigo-700 text-base"></i>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-900">
              Etapa y ATD se sincronizan con Raga cada 2 horas
            </p>
            <p className="text-xs text-indigo-700 mt-0.5">
              {sincronizando
                ? progreso
                  ? `Consultando Raga… ${progreso.procesados} fila(s) revisadas, ${progreso.pendientes} pendiente(s).`
                  : 'Consultando Raga…'
                : `Última actualización: ${hora(ultimaSincronizacion)} · Próxima: ${hora(proximaSincronizacion)}`}
            </p>
            {error && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
            )}
            {!error && !sincronizando && mensaje && (
              <p className="text-xs text-indigo-700 mt-1 flex items-center gap-1">
                <i className="ri-information-line"></i>
                {mensaje}
              </p>
            )}
            {!puedeSincronizar && (
              <p className="text-[11px] text-indigo-600/90 mt-1 flex items-center gap-1">
                <i className="ri-lock-line"></i>
                La actualización manual la ejecuta un administrador.
              </p>
            )}
          </div>
        </div>
        {puedeSincronizar && (
          <button
            type="button"
            onClick={onSincronizar}
            disabled={sincronizando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={sincronizando ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}></i>
            {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        )}
      </div>
    </div>
  );
}