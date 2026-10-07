import { useState } from 'react';
import {
  META_ZF_ETA_DIAS,
  META_ZF_TRANSITO_DIAS,
  type FilaZfEta,
  type FilaZfTransito,
} from '@/lib/kpisZf';
import ModalDetalleZf, { type FilaDetalleZf } from './ModalDetalleZf';

interface SeccionKpisZfProps {
  kpis: {
    eta: FilaZfEta[];
    transito: FilaZfTransito[];
    sinEtaReal?: number;
  };
}

interface Resumen {
  total: number;
  cumplen: number;
  noCumplen: number;
  porcentaje: number;
  promedio: number;
}

const resumir = (filas: { dias: number; cumpleMeta: boolean }[]): Resumen => {
  const total = filas.length;
  const cumplen = filas.filter((f) => f.cumpleMeta).length;
  const noCumplen = total - cumplen;
  const porcentaje = total > 0 ? Math.round((cumplen / total) * 100) : 0;
  const promedio = total > 0 ? Math.round((filas.reduce((s, f) => s + f.dias, 0) / total) * 10) / 10 : 0;
  return { total, cumplen, noCumplen, porcentaje, promedio };
};

interface TarjetaKpiZfProps {
  icono: string;
  titulo: string;
  subtitulo: string;
  metaTexto: string;
  resumen: Resumen;
  aviso?: string;
  onVerDetalle: () => void;
}

function TarjetaKpiZf({ icono, titulo, subtitulo, metaTexto, resumen, aviso, onVerDetalle }: TarjetaKpiZfProps) {
  const sinDatos = resumen.total === 0;
  const colorValor = resumen.porcentaje >= 80 ? 'text-emerald-600' : resumen.porcentaje >= 50 ? 'text-amber-600' : 'text-red-600';
  const colorBarra = resumen.porcentaje >= 80 ? 'bg-emerald-500' : resumen.porcentaje >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const colorIcono = sinDatos ? 'bg-gray-100 text-gray-400' : 'bg-emerald-100 text-emerald-600';

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${colorIcono}`}>
            <i className={`${icono} text-2xl`}></i>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">{titulo}</h4>
            <p className="text-xs text-gray-500 mt-1">{subtitulo}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
          sinDatos ? 'bg-gray-100 text-gray-500' : resumen.porcentaje >= 80 ? 'bg-emerald-100 text-emerald-700' : resumen.porcentaje >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>
          Meta: {metaTexto}
        </div>
      </div>

      {/* Porcentaje de cumplimiento */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-5xl font-bold ${sinDatos ? 'text-gray-300' : colorValor}`}>
          {sinDatos ? '—' : resumen.porcentaje}
        </span>
        {!sinDatos && <span className={`text-2xl font-semibold ${colorValor}`}>%</span>}
        <span className="text-sm text-gray-500 ml-1">de cumplimiento</span>
      </div>

      <div className="bg-gray-200 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${sinDatos ? 'bg-gray-300' : colorBarra}`}
          style={{ width: `${sinDatos ? 0 : resumen.porcentaje}%` }}
        ></div>
      </div>

      {/* Cantidad de expedientes que cumplen */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-center">
          <p className="text-2xl font-bold text-emerald-600">{resumen.cumplen}</p>
          <p className="text-[11px] font-medium text-emerald-700">Cumplen</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
          <p className={`text-2xl font-bold ${resumen.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}`}>{resumen.noCumplen}</p>
          <p className="text-[11px] font-medium text-red-700">No cumplen</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
          <p className="text-2xl font-bold text-gray-700">{resumen.total}</p>
          <p className="text-[11px] font-medium text-gray-600">Evaluados</p>
        </div>
      </div>

      {aviso && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <i className="ri-error-warning-line text-amber-500 text-base mt-0.5 flex-shrink-0"></i>
          <p className="text-[11px] leading-snug text-amber-800">{aviso}</p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-gray-200 flex items-center justify-between text-xs mb-4">
        <span className="text-gray-600">Promedio</span>
        <span className={`font-semibold ${sinDatos ? 'text-gray-400' : 'text-gray-800'}`}>
          {sinDatos ? 'Esperando datos' : `${resumen.promedio} días`}
        </span>
      </div>

      <button
        onClick={onVerDetalle}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-file-chart-line"></i>
        Ver detalle de POs
      </button>
    </div>
  );
}

export default function SeccionKpisZf({ kpis }: SeccionKpisZfProps) {
  const [detalleActivo, setDetalleActivo] = useState<'eta' | 'transito' | null>(null);

  const resumenEta = resumir(kpis.eta);
  const resumenTransito = resumir(kpis.transito);
  const sinEtaReal = kpis.sinEtaReal ?? 0;

  const filasEta: FilaDetalleZf[] = kpis.eta.map((f) => ({
    id: f.id,
    po_tiquetera: f.po_tiquetera,
    exp_id: f.exp_id,
    solicitante: f.solicitante,
    fechaAsignacion: f.fechaAsignacion,
    fechaReferencia: f.fechaEta,
    dias: f.dias,
    cumpleMeta: f.cumpleMeta,
  }));

  const filasTransito: FilaDetalleZf[] = kpis.transito.map((f) => ({
    id: f.id,
    po_tiquetera: f.po_tiquetera,
    exp_id: f.exp_id,
    solicitante: f.solicitante,
    fechaAsignacion: f.fechaAsignacion,
    fechaReferencia: f.fechaFin,
    dias: f.dias,
    cumpleMeta: f.cumpleMeta,
  }));

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-emerald-600 rounded-xl">
            <i className="ri-dashboard-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">KPIs de Expedientes ZF</h3>
            <p className="text-sm text-gray-600">Cumplimiento por ETA estimada y tránsito corto (Zona Franca)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TarjetaKpiZf
            icono="ri-calendar-check-line"
            titulo="ETA estimada"
            subtitulo="Días entre la asignación y la ETA Real"
            metaTexto={`< ${META_ZF_ETA_DIAS} días`}
            resumen={resumenEta}
            aviso={
              sinEtaReal > 0
                ? `${sinEtaReal} expediente${sinEtaReal !== 1 ? 's' : ''} ZF sin ETA Real cargada: no se evalúa${sinEtaReal !== 1 ? 'n' : ''} en este indicador.`
                : undefined
            }
            onVerDetalle={() => setDetalleActivo('eta')}
          />
          <TarjetaKpiZf
            icono="ri-speed-line"
            titulo="Tránsito corto"
            subtitulo="Solo POs marcadas como Tránsito Corto · días entre la asignación y el cierre"
            metaTexto={`< ${META_ZF_TRANSITO_DIAS} días`}
            resumen={resumenTransito}
            onVerDetalle={() => setDetalleActivo('transito')}
          />
        </div>
      </div>

      {detalleActivo === 'eta' && (
        <ModalDetalleZf
          titulo="Detalle ETA estimada (ZF)"
          subtitulo="Días hábiles entre la asignación del expediente y su ETA Real"
          etiquetaFecha="ETA Real"
          metaTexto={`< ${META_ZF_ETA_DIAS} días`}
          nombreArchivo="reporte-zf-eta-estimada"
          filas={filasEta}
          onClose={() => setDetalleActivo(null)}
        />
      )}

      {detalleActivo === 'transito' && (
        <ModalDetalleZf
          titulo="Detalle Tránsito corto (ZF)"
          subtitulo="Días hábiles entre la asignación del expediente y su completado/liberación (solo POs marcadas como Tránsito Corto)"
          etiquetaFecha="Completado"
          metaTexto={`< ${META_ZF_TRANSITO_DIAS} días`}
          nombreArchivo="reporte-zf-transito-corto"
          filas={filasTransito}
          onClose={() => setDetalleActivo(null)}
        />
      )}
    </>
  );
}