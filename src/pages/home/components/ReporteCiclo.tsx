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
  modulo: string;
  fechaAsignado: string;
  fechaNotificado: string;
  fechaRef: string;
  dias: number;
}

export default function ReporteCiclo() {
  const [filas, setFilas] = useState<FilaCiclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<'todos' | 'dropship' | 'zf'>('todos');
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

      const activos = (expedientes || []).filter(exp => {
        const modulo = (exp.tipo_modulo || '').toLowerCase();
        const estado = (exp.estado_expediente || '').trim();
        if (modulo === 'dropship') {
          return estado === 'Notificado' || estado === 'Visto Listo';
        }
        if (modulo === 'zf') {
          return estado === 'Completado' || estado === 'Liberación';
        }
        return false;
      });

      if (activos.length === 0) {
        setFilas([]);
        setLoading(false);
        return;
      }

      const ids = activos.map(e => e.id);

      const [resAsig, resTerm, resHist] = await Promise.all([
        supabase.from('expedientes_tiempos_estados').select('expediente_id, fecha_inicio').in('expediente_id', ids).eq('estado_nuevo', 'Asignado'),
        supabase.from('expedientes_tiempos_estados').select('expediente_id, estado_nuevo, fecha_inicio').in('expediente_id', ids).in('estado_nuevo', ['Notificado', 'Completado', 'Liberación']),
        supabase.from('expedientes_historial').select('expediente_id, fecha_cambio, valor_nuevo').in('expediente_id', ids).eq('campo_modificado', 'Estado').in('valor_nuevo', ['Notificado', 'Completado', 'Liberación'])
      ]);

      const fechaAsignado: Record<string, string> = {};
      (resAsig.data || []).forEach((t: any) => {
        if (!fechaAsignado[t.expediente_id] || t.fecha_inicio < fechaAsignado[t.expediente_id]) {
          fechaAsignado[t.expediente_id] = t.fecha_inicio;
        }
      });

      const fechaTerm: Record<string, string> = {};
      (resTerm.data || []).forEach((t: any) => {
        if (!fechaTerm[t.expediente_id] || t.fecha_inicio < fechaTerm[t.expediente_id]) {
          fechaTerm[t.expediente_id] = t.fecha_inicio;
        }
      });
      (resHist.data || []).forEach((h: any) => {
        if (!fechaTerm[h.expediente_id] || h.fecha_cambio < fechaTerm[h.expediente_id]) {
          fechaTerm[h.expediente_id] = h.fecha_cambio;
        }
      });

      const resultado: FilaCiclo[] = [];
      activos.forEach(exp => {
        const fAsig = fechaAsignado[exp.id] || exp.created_at;
        const fTerm = fechaTerm[exp.id];
        if (!fTerm) return;
        const dias = Math.round(((new Date(fTerm).getTime() - new Date(fAsig).getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10;
        resultado.push({
          id: exp.id,
          po: exp.po_tiquetera,
          expId: exp.exp_id || '',
          solicitante: exp.solicitante,
          responsable: exp.responsable_creacion,
          estado: exp.estado_expediente,
          modulo: (exp.tipo_modulo || '').toLowerCase(),
          fechaAsignado: fAsig,
          fechaNotificado: fTerm,
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
    if (filtroModulo !== 'todos' && f.modulo !== filtroModulo) return false;
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      f.po.toLowerCase().includes(term) ||
      f.expId.toLowerCase().includes(term) ||
      f.solicitante.toLowerCase().includes(term) ||
      f.responsable.toLowerCase().includes(term)
    );
  });

  const total = filasFiltradas.length;
  const suma = filasFiltradas.reduce((s, f) => s + f.dias, 0);
  const promedio = total > 0 ? Math.round((suma / total) * 10) / 10 : 0;
  const maxDias = total > 0 ? Math.max(...filasFiltradas.map(f => f.dias)) : 0;
  const minDias = total > 0 ? Math.min(...filasFiltradas.map(f => f.dias)) : 0;

  const exportarCSV = () => {
    const headers = ['PO', 'EXP ID', 'Módulo', 'Solicitante', 'Responsable', 'Estado', 'Fecha Asignado', 'Fecha Terminal', 'Días (Asignado → Terminal)'];
    const rows = filasFiltradas.map(f => [
      f.po, f.expId, f.modulo === 'dropship' ? 'Dropship' : 'ZF',
      f.solicitante, f.responsable, f.estado,
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
          <h1 className="text-2xl font-bold text-gray-900">Ciclo Asignado → Terminal</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Promedio de días entre la asignación y el estado terminal de los expedientes (Notificado / Completado / Liberación)
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

      {/* Buscador y filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['todos', 'dropship', 'zf'] as const).map((mod) => (
              <button
                key={mod}
                onClick={() => setFiltroModulo(mod)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filtroModulo === mod ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {mod === 'todos' ? 'Todos' : mod === 'dropship' ? 'Dropship' : 'ZF'}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por PO, EXP, solicitante o responsable..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <FiltroFechas inicio={fechaInicio} fin={fechaFin} onChange={(i, f) => { setFechaInicio(i); setFechaFin(f); }} />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Expedientes evaluados</h2>
          <span className="text-sm text-gray-500">{filasFiltradas.length} de {filas.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / EXP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Asignado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Terminal</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-gray-400">
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
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        f.modulo === 'dropship' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                      }`}>
                        {f.modulo === 'dropship' ? 'Dropship' : 'ZF'}
                      </span>
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