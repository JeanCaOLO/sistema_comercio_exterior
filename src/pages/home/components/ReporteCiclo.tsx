import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { parseFechaSegura, formatearFechaCorta } from '@/lib/fechas';
import FiltroFechas from './FiltroFechas';

interface FilaCiclo {
  id: string;
  po: string;
  expId: string;
  solicitante: string;
  responsable: string;
  estado: string;
  fechaAsignado: string;
  fechaNotificado: string;
  fechaRef: string;
  dias: number;
}

export default function ReporteCiclo() {
  const [filas, setFilas] = useState<FilaCiclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: expedientes, error: errExp } = await supabase
        .from('expedientes')
        .select('id, po_tiquetera, exp_id, tipo_modulo, estado_expediente, solicitante, responsable_creacion, created_at, fecha_solicitud')
        .neq('estado_expediente', 'Documentación');

      if (errExp) throw errExp;

      const dropship = (expedientes || []).filter(exp =>
        (exp.tipo_modulo || '').toLowerCase() === 'dropship' &&
        (exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo')
      );

      if (dropship.length === 0) {
        setFilas([]);
        setLoading(false);
        return;
      }

      const ids = dropship.map(e => e.id);

      const [resAsig, resNotif, resHist] = await Promise.all([
        supabase.from('expedientes_tiempos_estados').select('expediente_id, fecha_inicio').in('expediente_id', ids).eq('estado_nuevo', 'Asignado'),
        supabase.from('expedientes_tiempos_estados').select('expediente_id, fecha_inicio').in('expediente_id', ids).eq('estado_nuevo', 'Notificado'),
        supabase.from('expedientes_historial').select('expediente_id, fecha_cambio').in('expediente_id', ids).eq('campo_modificado', 'Estado').eq('valor_nuevo', 'Notificado')
      ]);

      const fechaAsignado: Record<string, string> = {};
      (resAsig.data || []).forEach((t: any) => {
        if (!fechaAsignado[t.expediente_id] || t.fecha_inicio < fechaAsignado[t.expediente_id]) {
          fechaAsignado[t.expediente_id] = t.fecha_inicio;
        }
      });

      const fechaNotif: Record<string, string> = {};
      (resNotif.data || []).forEach((t: any) => {
        if (!fechaNotif[t.expediente_id] || t.fecha_inicio < fechaNotif[t.expediente_id]) {
          fechaNotif[t.expediente_id] = t.fecha_inicio;
        }
      });
      (resHist.data || []).forEach((h: any) => {
        if (!fechaNotif[h.expediente_id] || h.fecha_cambio < fechaNotif[h.expediente_id]) {
          fechaNotif[h.expediente_id] = h.fecha_cambio;
        }
      });

      const resultado: FilaCiclo[] = [];
      dropship.forEach(exp => {
        const fAsig = fechaAsignado[exp.id] || exp.created_at;
        const fNotif = fechaNotif[exp.id];
        if (!fNotif) return;
        const dias = Math.round(((new Date(fNotif).getTime() - new Date(fAsig).getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10;
        resultado.push({
          id: exp.id,
          po: exp.po_tiquetera,
          expId: exp.exp_id || '',
          solicitante: exp.solicitante,
          responsable: exp.responsable_creacion,
          estado: exp.estado_expediente,
          fechaAsignado: fAsig,
          fechaNotificado: fNotif,
          fechaRef: exp.fecha_solicitud || exp.created_at,
          dias
        });
      });

      resultado.sort((a, b) => b.dias - a.dias);
      setFilas(resultado);
    } catch (err: any) {
      console.error('Error al cargar reporte de ciclo:', err);
      setError(err?.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const dentroRango = (fechaStr: string): boolean => {
    if (!fechaInicio && !fechaFin) return true;
    const f = parseFechaSegura(fechaStr);
    if (Number.isNaN(f.getTime())) return false;
    if (fechaInicio && f < new Date(fechaInicio + 'T00:00:00')) return false;
    if (fechaFin && f > new Date(fechaFin + 'T23:59:59')) return false;
    return true;
  };

  const filasFiltradas = filas.filter(f => {
    if (!dentroRango(f.fechaRef)) return false;
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      f.po.toLowerCase().includes(term) ||
      f.expId.toLowerCase().includes(term) ||
      f.solicitante.toLowerCase().includes(term) ||
      f.responsable.toLowerCase().includes(term)
    );
  });

  const total = filas.length;
  const suma = filas.reduce((s, f) => s + f.dias, 0);
  const promedio = total > 0 ? Math.round((suma / total) * 10) / 10 : 0;
  const maxDias = total > 0 ? Math.max(...filas.map(f => f.dias)) : 0;
  const minDias = total > 0 ? Math.min(...filas.map(f => f.dias)) : 0;

  const exportarCSV = () => {
    const headers = ['PO', 'EXP ID', 'Solicitante', 'Responsable', 'Estado', 'Fecha Asignado', 'Fecha Notificado', 'Días (Asignado → Notificado)'];
    const rows = filasFiltradas.map(f => [
      f.po, f.expId, f.solicitante, f.responsable, f.estado,
      formatearFechaCorta(f.fechaAsignado), formatearFechaCorta(f.fechaNotificado), f.dias
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-ciclo-asignado-notificado.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600">Calculando ciclo Asignado → Notificado...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ciclo Asignado → Notificado</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Promedio de días entre la asignación y la notificación de los expedientes Dropship
          </p>
        </div>
        <button
          onClick={exportarCSV}
          disabled={filasFiltradas.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="ri-download-line"></i>
          Exportar CSV
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl"></i>
          <div>
            <p className="text-red-800 font-semibold text-sm">No se pudieron cargar los datos</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={cargarDatos}
            className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 cursor-pointer whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Duración promedio</p>
            <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center">
              <i className="ri-time-line text-sky-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-sky-600 mt-2">{promedio}</p>
          <p className="text-xs text-gray-500 mt-1">días en promedio</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Expedientes</p>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <i className="ri-file-list-3-line text-gray-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{total}</p>
          <p className="text-xs text-gray-500 mt-1">notificados evaluados</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Ciclo máximo</p>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <i className="ri-arrow-up-line text-red-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-red-600 mt-2">{maxDias}</p>
          <p className="text-xs text-gray-500 mt-1">días más largo</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Ciclo mínimo</p>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <i className="ri-arrow-down-line text-emerald-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{minDias}</p>
          <p className="text-xs text-gray-500 mt-1">días más corto</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por PO, EXP, solicitante o responsable..."
            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-circle-line text-sm"></i>
            </button>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <FiltroFechas inicio={fechaInicio} fin={fechaFin} onChange={(i, f) => { setFechaInicio(i); setFechaFin(f); }} />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Expedientes Dropship notificados</h2>
          <span className="text-sm text-gray-500">{filasFiltradas.length} de {total}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / EXP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Asignado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Notificado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay expedientes en esta categoría</p>
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{f.po}</div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">{f.expId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.solicitante}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.responsable}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 whitespace-nowrap">
                        {f.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(f.fechaAsignado)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(f.fechaNotificado)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-base font-bold text-sky-700">{f.dias}</span>
                      <span className="text-xs text-gray-400 ml-1">días</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}