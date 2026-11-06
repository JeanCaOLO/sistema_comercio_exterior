import type { EtapaRuta } from './types';
import { fechaHora, formatearMinutos } from './utils';

interface Props {
  ruta: EtapaRuta[];
  estadoActual: string;
  minutosCiclo: number | null;
  estadosRecorridos: number;
  totalCambiosEstado: number;
}

const colorBarra = (etapa: EtapaRuta): string => {
  if (etapa.esActual) return 'bg-amber-400';
  if (etapa.visitado) return 'bg-teal-500';
  return 'bg-gray-200';
};

export default function RutaEstados({
  ruta,
  estadoActual,
  minutosCiclo,
  estadosRecorridos,
  totalCambiosEstado,
}: Props) {
  const visitadas = ruta.filter((etapa) => etapa.visitado);
  const maximo = visitadas.reduce((acc, etapa) => Math.max(acc, etapa.minutos || 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-teal-50/70 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-teal-100 text-teal-700">
            <i className="ri-route-line text-sm"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Ruta completa de estados</p>
            <p className="text-[11px] text-gray-500">
              {estadosRecorridos} de {ruta.length} estados recorridos · {totalCambiosEstado} cambio
              {totalCambiosEstado === 1 ? '' : 's'} de estado registrados
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-teal-200 text-[11px] font-semibold text-teal-800 whitespace-nowrap">
            <i className="ri-timer-line"></i>
            Ciclo total: {formatearMinutos(minutosCiclo)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 whitespace-nowrap">
            <i className="ri-map-pin-line"></i>
            Estado actual: {estadoActual}
          </span>
        </div>
      </div>

      <div className="p-4">
        {visitadas.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <i className="ri-information-line text-gray-400"></i>
            Este tíquete no tiene estados registrados.
          </div>
        ) : (
          <div className="space-y-2">
            {ruta.map((etapa, index) => {
              const ancho =
                maximo > 0 && etapa.minutos ? Math.max(4, Math.round((etapa.minutos / maximo) * 100)) : 0;

              return (
                <div
                  key={`${etapa.estado}-${index}`}
                  className={`relative rounded-lg border px-3 py-2.5 pl-9 transition-colors ${
                    etapa.esActual
                      ? 'border-amber-300 bg-amber-50/60'
                      : etapa.visitado
                      ? 'border-gray-200 bg-white'
                      : 'border-dashed border-gray-200 bg-gray-50/60'
                  }`}
                >
                  <div
                    className={`absolute left-2.5 top-3 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      etapa.esActual
                        ? 'bg-amber-400 text-white'
                        : etapa.visitado
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {etapa.visitado ? (
                      etapa.esActual ? (
                        <i className="ri-map-pin-2-fill text-[11px]"></i>
                      ) : (
                        <i className="ri-check-line text-[11px]"></i>
                      )
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          etapa.visitado ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {etapa.estado}
                      </span>
                      {etapa.veces > 1 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                          {etapa.veces} veces
                        </span>
                      )}
                      {etapa.esActual && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-white whitespace-nowrap">
                          ESTADO ACTUAL
                        </span>
                      )}
                      {!etapa.visitado && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
                          No registrado
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        etapa.esActual ? 'text-amber-700' : etapa.visitado ? 'text-teal-700' : 'text-gray-400'
                      }`}
                    >
                      {etapa.visitado ? formatearMinutos(etapa.minutos) : '—'}
                    </span>
                  </div>

                  {etapa.visitado && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                      <span className="whitespace-nowrap">
                        <i className="ri-login-box-line mr-1"></i>
                        Entró: {etapa.fechaInicio ? fechaHora(etapa.fechaInicio) : '—'}
                      </span>
                      <span className="whitespace-nowrap">
                        <i className="ri-logout-box-line mr-1"></i>
                        Salió: {etapa.fechaFin ? fechaHora(etapa.fechaFin) : 'Sigue aquí'}
                      </span>
                    </div>
                  )}

                  {etapa.visitado && ancho > 0 && (
                    <div className="mt-1.5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colorBarra(etapa)}`}
                        style={{ width: `${ancho}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}