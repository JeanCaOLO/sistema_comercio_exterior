import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { parseFechaSegura, formatearFechaCorta } from '@/lib/fechas';

interface Expediente {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  tipo_po: string;
  tipo_modulo: string;
  estado_expediente: string;
  responsable_creacion: string;
  solicitante: string;
  fecha_requerimiento: string;
  fecha_liberacion: string | null;
  dias_entrega_real: number | null;
  transito_corto: boolean;
  prioridad: string;
  prioridad_urgente: boolean;
  created_at: string;
}

interface MetricaRuta {
  ruta: string;
  modulo: string;
  total: number;
  enProceso: number;
  finalizados: number;
  retrasados: number;
  tasaRetraso: number;
  cicloPromedio: number | null;
  retrasoPromedio: number;
  transitoCorto: number;
  altaPrioridad: number;
  expedientes: Expediente[];
}

const diffDias = (a: Date, b: Date): number =>
  Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

// Un expediente se considera "finalizado" si ya tiene fecha de liberación,
// o si llegó a su estado terminal según el módulo.
const esFinalizado = (exp: Expediente): boolean => {
  if (exp.fecha_liberacion) return true;
  const estado = (exp.estado_expediente || '').trim();
  if ((exp.tipo_modulo || '').toLowerCase() === 'dropship') {
    return estado === 'Notificado' || estado === 'Visto Listo';
  }
  return estado === 'Completado' || estado === 'Liberación';
};

const calcularRetraso = (exp: Expediente, ahora: Date): number => {
  const req = parseFechaSegura(exp.fecha_requerimiento);
  if (Number.isNaN(req.getTime())) return 0;
  if (exp.fecha_liberacion) {
    return Math.max(0, diffDias(new Date(exp.fecha_liberacion), req));
  }
  return Math.max(0, diffDias(ahora, req));
};

const calcularCiclo = (exp: Expediente): number | null => {
  if (exp.dias_entrega_real != null) return exp.dias_entrega_real;
  if (exp.fecha_liberacion && exp.created_at) {
    return Math.max(0, diffDias(new Date(exp.fecha_liberacion), new Date(exp.created_at)));
  }
  return null;
};

const moduloLabel = (modulo: string): string =>
  (modulo || '').toLowerCase() === 'dropship' ? 'Dropship' : 'ZF';

export default function ReporteRuta() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<'todos' | 'dropship' | 'zf'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [rutaExpandida, setRutaExpandida] = useState<string | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error: err } = await supabase
        .from('expedientes')
        .select('*')
        .neq('estado_expediente', 'Documentación')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setExpedientes(data || []);
    } catch (err: any) {
      console.error('Error al cargar reporte por ruta:', err);
      setError(err?.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const ahora = useMemo(() => new Date(), []);

  const metricas: MetricaRuta[] = useMemo(() => {
    const agrupadas = new Map<string, Expediente[]>();

    expedientes.forEach((exp) => {
      const ruta = (exp.tipo_po || '').trim() || 'Sin ruta';
      if (!agrupadas.has(ruta)) agrupadas.set(ruta, []);
      agrupadas.get(ruta)!.push(exp);
    });

    const resultado: MetricaRuta[] = [];

    agrupadas.forEach((grupo, ruta) => {
      const total = grupo.length;
      const finalizados = grupo.filter(esFinalizado);
      const enProceso = total - finalizados.length;

      const ciclos = finalizados
        .map(calcularCiclo)
        .filter((c): c is number => c != null);
      const cicloPromedio = ciclos.length > 0
        ? Math.round((ciclos.reduce((s, c) => s + c, 0) / ciclos.length) * 10) / 10
        : null;

      const retrasos = grupo.map((exp) => calcularRetraso(exp, ahora));
      const retrasados = retrasos.filter((r) => r > 0);
      const retrasoPromedio = retrasados.length > 0
        ? Math.round((retrasados.reduce((s, r) => s + r, 0) / retrasados.length) * 10) / 10
        : 0;

      const transitoCorto = grupo.filter((exp) => exp.transito_corto).length;
      const altaPrioridad = grupo.filter((exp) => exp.prioridad === 'Alta' || exp.prioridad_urgente).length;

      // Módulo dominante de la ruta
      const dropshipCount = grupo.filter((exp) => (exp.tipo_modulo || '').toLowerCase() === 'dropship').length;
      const modulo = dropshipCount >= grupo.length / 2 ? 'dropship' : 'zf';

      resultado.push({
        ruta,
        modulo,
        total,
        enProceso,
        finalizados: finalizados.length,
        retrasados: retrasados.length,
        tasaRetraso: total > 0 ? Math.round((retrasados.length / total) * 100) : 0,
        cicloPromedio,
        retrasoPromedio,
        transitoCorto,
        altaPrioridad,
        expedientes: grupo
      });
    });

    return resultado.sort((a, b) => b.total - a.total);
  }, [expedientes, ahora]);

  const metricasFiltradas = metricas.filter((m) => {
    if (filtroModulo !== 'todos' && m.modulo !== filtroModulo) return false;
    if (busqueda) {
      const term = busqueda.toLowerCase();
      if (!m.ruta.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  // KPIs generales
  const totalRutas = metricas.length;
  const totalExpedientes = expedientes.length;
  const rutaMayorVolumen = metricas.length > 0 ? metricas[0] : null;
  const rutaMayorRetraso = metricas.length > 0
    ? [...metricas].sort((a, b) => b.tasaRetraso - a.tasaRetraso)[0]
    : null;

  const maxVolumen = metricasFiltradas.length > 0
    ? Math.max(...metricasFiltradas.map((m) => m.total))
    : 1;

  const rutaSeleccionada = rutaExpandida
    ? metricas.find((m) => m.ruta === rutaExpandida)
    : null;

  const exportarCSV = () => {
    const headers = ['Ruta', 'Módulo', 'Total', 'En proceso', 'Finalizados', 'Ciclo prom (días)', 'Tasa retraso (%)', 'Retraso prom (días)', 'Tránsito corto', 'Alta prioridad'];
    const rows = metricasFiltradas.map((m) => [
      m.ruta,
      moduloLabel(m.modulo),
      m.total,
      m.enProceso,
      m.finalizados,
      m.cicloPromedio ?? '',
      m.tasaRetraso,
      m.retrasoPromedio,
      m.transitoCorto,
      m.altaPrioridad
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-por-ruta.csv';
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
          <p className="mt-4 text-gray-600">Agrupando expedientes por ruta...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rendimiento por Ruta</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Volumen, tiempo de ciclo, retrasos y mix de tránsito corto agrupados por ruta logística
          </p>
        </div>
        <button
          onClick={exportarCSV}
          disabled={metricasFiltradas.length === 0}
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
            <p className="text-sm text-gray-500">Rutas activas</p>
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <i className="ri-route-line text-teal-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalRutas}</p>
          <p className="text-xs text-gray-500 mt-1">rutas con expedientes</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total expedientes</p>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <i className="ri-file-list-3-line text-gray-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalExpedientes}</p>
          <p className="text-xs text-gray-500 mt-1">entre todas las rutas</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Mayor volumen</p>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <i className="ri-bar-chart-fill text-amber-600 text-xl"></i>
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 truncate" title={rutaMayorVolumen?.ruta}>
            {rutaMayorVolumen ? rutaMayorVolumen.ruta : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {rutaMayorVolumen ? `${rutaMayorVolumen.total} expedientes` : 'sin datos'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Mayor retraso</p>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <i className="ri-alarm-warning-line text-red-600 text-xl"></i>
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2 truncate" title={rutaMayorRetraso?.ruta}>
            {rutaMayorRetraso ? rutaMayorRetraso.ruta : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {rutaMayorRetraso ? `${rutaMayorRetraso.tasaRetraso}% de retraso` : 'sin datos'}
          </p>
        </div>
      </div>

      {/* Filtros */}
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
              placeholder="Buscar por ruta..."
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
        </div>
      </div>

      {/* Tabla principal por ruta */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Rutas</h2>
          <span className="text-sm text-gray-500">{metricasFiltradas.length} rutas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Ruta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Volumen</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">En proceso</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Finalizados</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Ciclo prom.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Retraso</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Tránsito corto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metricasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-gray-400">
                    <i className="ri-route-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay rutas en esta categoría</p>
                  </td>
                </tr>
              ) : (
                metricasFiltradas.map((m) => {
                  const pctTransito = m.total > 0 ? Math.round((m.transitoCorto / m.total) * 100) : 0;
                  return (
                    <tr
                      key={m.ruta}
                      onClick={() => setRutaExpandida(rutaExpandida === m.ruta ? null : m.ruta)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{m.ruta}</div>
                        <div className="text-xs text-gray-500">{m.altaPrioridad} alta prioridad</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          m.modulo === 'dropship' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                        }`}>
                          {moduloLabel(m.modulo)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${Math.max(8, Math.round((m.total / maxVolumen) * 100))}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{m.total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{m.enProceso}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{m.finalizados}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {m.cicloPromedio != null ? `${m.cicloPromedio} d` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.tasaRetraso > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            m.tasaRetraso >= 50
                              ? 'bg-red-100 text-red-800'
                              : m.tasaRetraso >= 25
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {m.tasaRetraso}%
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">0%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">{m.transitoCorto}</span>
                        <span className="text-xs text-gray-400 ml-1">({pctTransito}%)</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle de ruta expandida */}
      {rutaSeleccionada && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Expedientes de <span className="text-teal-600">{rutaSeleccionada.ruta}</span>
            </h2>
            <button
              onClick={() => setRutaExpandida(null)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / EXP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Vencimiento</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Retraso</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">TC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rutaSeleccionada.expedientes
                  .slice()
                  .sort((a, b) => calcularRetraso(b, ahora) - calcularRetraso(a, ahora))
                  .map((exp) => {
                    const retraso = calcularRetraso(exp, ahora);
                    return (
                      <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">{exp.exp_id}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{exp.estado_expediente}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.responsable_creacion}</td>
                        <td className="px-4 py-3">
                          {exp.prioridad_urgente ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap">
                              URGENTE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                              {exp.prioridad}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(exp.fecha_requerimiento)}</td>
                        <td className="px-4 py-3 text-center">
                          {retraso > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              <i className="ri-alarm-warning-fill"></i> +{retraso}d
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">A tiempo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {exp.transito_corto ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">TC</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}