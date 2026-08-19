import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { parseFechaSegura, formatearFechaCorta } from '@/lib/fechas';

interface Expediente {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  prioridad: string;
  prioridad_urgente: boolean;
  exp_id: string;
  estado_expediente: string;
  responsable_creacion: string;
  fecha_requerimiento: string;
  fecha_liberacion: string | null;
  dias_entrega: number | null;
  dias_entrega_real: number | null;
  tipo_modulo: string;
  created_at: string;
  fecha_creacion_expediente: string;
}

type Nivel = 'verde' | 'ambar' | 'rojo';

// Umbrales del semáforo (fáciles de ajustar)
const UMBRAL_AGING_AMBAR = 3; // > 3 días → ámbar
const UMBRAL_AGING_ROJO = 7; // > 7 días → rojo
const UMBRAL_RETRASO_AMBAR = 0; // > 0 días → ámbar (ya vencido)
const UMBRAL_RETRASO_ROJO = 3; // > 3 días → rojo

const COLORES: Record<Nivel, { dot: string; text: string; chip: string; label: string }> = {
  verde: { dot: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800', label: 'En rango' },
  ambar: { dot: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-800', label: 'Atención' },
  rojo: { dot: 'bg-red-500', text: 'text-red-700', chip: 'bg-red-100 text-red-800', label: 'Crítico' }
};

const diffDias = (a: Date, b: Date): number => {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
};

const esTerminal = (exp: Expediente): boolean => {
  const modulo = (exp.tipo_modulo || '').toLowerCase();
  const estado = (exp.estado_expediente || '').trim();
  if (modulo === 'dropship') {
    return estado === 'Notificado' || estado === 'Visto Listo';
  }
  if (modulo === 'zf') {
    return estado === 'Completado';
  }
  return false;
};

const nivelAging = (dias: number): Nivel =>
  dias <= UMBRAL_AGING_AMBAR ? 'verde' : dias <= UMBRAL_AGING_ROJO ? 'ambar' : 'rojo';

const nivelRetraso = (dias: number): Nivel =>
  dias <= UMBRAL_RETRASO_AMBAR ? 'verde' : dias <= UMBRAL_RETRASO_ROJO ? 'ambar' : 'rojo';

interface FilaEstancado {
  id: string;
  po: string;
  ruta: string;
  expId: string;
  modulo: string;
  estado: string;
  responsable: string;
  solicitante: string;
  prioridad: string;
  urgente: boolean;
  fechaCreacion: string;
  fechaRequerimiento: string;
  aging: number;
  retraso: number;
  nivelAging: Nivel;
  nivelRetraso: Nivel;
}

interface FilaAtraso {
  id: string;
  po: string;
  expId: string;
  modulo: string;
  responsable: string;
  solicitante: string;
  fechaRequerimiento: string;
  fechaLiberacion: string | null;
  retraso: number;
}

export default function ReporteAtrasos() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [tiemposAbiertos, setTiemposAbiertos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<'todos' | 'dropship' | 'zf'>('todos');
  const [filtroNivel, setFiltroNivel] = useState<'todos' | Nivel>('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError('');

      const [resExp, resTiempos] = await Promise.all([
        supabase
          .from('expedientes')
          .select('*')
          .neq('estado_expediente', 'Documentación')
          .order('created_at', { ascending: false }),
        supabase
          .from('expedientes_tiempos_estados')
          .select('expediente_id, fecha_inicio')
          .is('fecha_fin', null)
      ]);

      if (resExp.error) throw resExp.error;

      // Mapa: expediente_id → fecha de entrada al estado actual (la más temprana abierta)
      const mapa: Record<string, string> = {};
      (resTiempos.data || []).forEach((t: any) => {
        if (!mapa[t.expediente_id] || t.fecha_inicio < mapa[t.expediente_id]) {
          mapa[t.expediente_id] = t.fecha_inicio;
        }
      });
      setTiemposAbiertos(mapa);

      setExpedientes(resExp.data || []);
    } catch (err: any) {
      console.error('Error al cargar reporte de atrasos:', err);
      setError(err?.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const ahora = useMemo(() => new Date(), []);

  // ── Expedientes estancados (no terminales) ──
  const estancados: FilaEstancado[] = useMemo(() => {
    return expedientes
      .filter((exp) => !esTerminal(exp))
      .map((exp) => {
        const fechaEstado = tiemposAbiertos[exp.id] || exp.created_at || exp.fecha_creacion_expediente;
        const aging = Math.max(0, diffDias(ahora, new Date(fechaEstado)));
        const req = parseFechaSegura(exp.fecha_requerimiento);
        const retraso = Number.isNaN(req.getTime()) ? 0 : diffDias(ahora, req);

        return {
          id: exp.id,
          po: exp.po_tiquetera,
          ruta: exp.tipo_po,
          expId: exp.exp_id,
          modulo: (exp.tipo_modulo || '').toLowerCase(),
          estado: exp.estado_expediente,
          responsable: exp.responsable_creacion,
          solicitante: exp.solicitante,
          prioridad: exp.prioridad,
          urgente: !!exp.prioridad_urgente,
          fechaCreacion: exp.created_at || exp.fecha_creacion_expediente,
          fechaRequerimiento: exp.fecha_requerimiento,
          aging,
          retraso,
          nivelAging: nivelAging(aging),
          nivelRetraso: nivelRetraso(retraso)
        };
      })
      .sort((a, b) => b.aging - a.aging);
  }, [expedientes, tiemposAbiertos, ahora]);

  // ── Entregados con retraso (terminales que se pasaron del vencimiento) ──
  const entregadosConRetraso: FilaAtraso[] = useMemo(() => {
    return expedientes
      .filter((exp) => esTerminal(exp))
      .map((exp) => {
        const req = parseFechaSegura(exp.fecha_requerimiento);
        let retraso = 0;
        if (!Number.isNaN(req.getTime())) {
          if (exp.fecha_liberacion) {
            retraso = diffDias(new Date(exp.fecha_liberacion), req);
          } else if (exp.dias_entrega_real != null && exp.dias_entrega != null) {
            retraso = exp.dias_entrega_real - exp.dias_entrega;
          }
        }
        return {
          id: exp.id,
          po: exp.po_tiquetera,
          expId: exp.exp_id,
          modulo: (exp.tipo_modulo || '').toLowerCase(),
          responsable: exp.responsable_creacion,
          solicitante: exp.solicitante,
          fechaRequerimiento: exp.fecha_requerimiento,
          fechaLiberacion: exp.fecha_liberacion,
          retraso
        };
      })
      .filter((f) => f.retraso > 0)
      .sort((a, b) => b.retraso - a.retraso);
  }, [expedientes]);

  // ── Filtros ──
  const estancadosFiltrados = estancados.filter((f) => {
    if (filtroModulo !== 'todos' && f.modulo !== filtroModulo) return false;
    if (filtroNivel !== 'todos' && f.nivelAging !== filtroNivel) return false;
    if (busqueda) {
      const term = busqueda.toLowerCase();
      const coincide =
        f.po.toLowerCase().includes(term) ||
        f.expId.toLowerCase().includes(term) ||
        f.responsable.toLowerCase().includes(term) ||
        f.solicitante.toLowerCase().includes(term) ||
        f.estado.toLowerCase().includes(term);
      if (!coincide) return false;
    }
    return true;
  });

  // ── KPIs ──
  const totalEnProceso = estancados.length;
  const criticos = estancados.filter((f) => f.nivelAging === 'rojo').length;
  const atrasados = estancados.filter((f) => f.retraso > 0).length;
  const entregadosTarde = entregadosConRetraso.length;
  const sumaRetraso = estancados.reduce((s, f) => s + Math.max(0, f.retraso), 0) +
    entregadosConRetraso.reduce((s, f) => s + f.retraso, 0);
  const totalConRetraso = atrasados + entregadosTarde;
  const promedioRetraso = totalConRetraso > 0 ? Math.round((sumaRetraso / totalConRetraso) * 10) / 10 : 0;

  const exportarCSV = () => {
    const headers = ['PO', 'EXP ID', 'Módulo', 'Estado', 'Responsable', 'Solicitante', 'Prioridad', 'Días en estado', 'Vencimiento', 'Días de retraso'];
    const rows = estancadosFiltrados.map((f) => [
      f.po,
      f.expId,
      f.modulo === 'dropship' ? 'Dropship' : 'ZF',
      f.estado,
      f.responsable,
      f.solicitante,
      f.urgente ? 'URGENTE' : f.prioridad,
      f.aging,
      formatearFechaCorta(f.fechaRequerimiento),
      f.retraso
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-atrasos-aging.csv';
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
          <p className="mt-4 text-gray-600">Calculando atrasos y envejecimiento...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atrasos &amp; Aging</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Expedientes estancados con semáforo de envejecimiento y días de retraso vs. vencimiento
          </p>
        </div>
        <button
          onClick={exportarCSV}
          disabled={estancadosFiltrados.length === 0}
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
            <p className="text-sm text-gray-500">En proceso</p>
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <i className="ri-loader-4-line text-teal-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalEnProceso}</p>
          <p className="text-xs text-gray-500 mt-1">expedientes sin finalizar</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Estancados críticos</p>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <i className="ri-alarm-warning-line text-red-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-red-600 mt-2">{criticos}</p>
          <p className="text-xs text-gray-500 mt-1">más de {UMBRAL_AGING_ROJO} días en su estado</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Con retraso</p>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <i className="ri-time-line text-amber-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-2">{totalConRetraso}</p>
          <p className="text-xs text-gray-500 mt-1">{atrasados} en proceso + {entregadosTarde} entregados tarde</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Retraso promedio</p>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <i className="ri-bar-chart-box-line text-gray-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{promedioRetraso}</p>
          <p className="text-xs text-gray-500 mt-1">días de atraso promedio</p>
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

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'verde', label: 'Verde' },
              { id: 'ambar', label: 'Ámbar' },
              { id: 'rojo', label: 'Rojo' }
            ] as const).map((n) => (
              <button
                key={n.id}
                onClick={() => setFiltroNivel(n.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  filtroNivel === n.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {n.id !== 'todos' && <span className={`w-2 h-2 rounded-full ${COLORES[n.id as Nivel].dot}`}></span>}
                {n.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por PO, EXP, responsable..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Leyenda semáforo */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Semáforo de envejecimiento:</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 0–{UMBRAL_AGING_AMBAR} días
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> {UMBRAL_AGING_AMBAR + 1}–{UMBRAL_AGING_ROJO} días
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> &gt; {UMBRAL_AGING_ROJO} días
          </span>
        </div>
      </div>

      {/* Tabla de estancados */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Expedientes en proceso</h2>
          <span className="text-sm text-gray-500">{estancadosFiltrados.length} de {totalEnProceso}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Envejecimiento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / EXP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Prioridad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Creado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días en estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días de retraso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estancadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay expedientes en esta categoría</p>
                  </td>
                </tr>
              ) : (
                estancadosFiltrados.map((f) => {
                  const c = COLORES[f.nivelAging];
                  const cr = COLORES[f.nivelRetraso];
                  return (
                    <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${f.nivelAging === 'rojo' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${c.chip}`}>
                          <span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
                          {c.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{f.po}</div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">{f.expId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          f.modulo === 'dropship' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                        }`}>
                          {f.modulo === 'dropship' ? 'Dropship' : 'ZF'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 whitespace-nowrap">{f.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.responsable}</td>
                      <td className="px-4 py-3">
                        {f.urgente ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap">
                            URGENTE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            {f.prioridad}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(f.fechaCreacion)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-base font-bold ${c.text}`}>{f.aging}</span>
                        <span className="text-xs text-gray-400 ml-1">días</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(f.fechaRequerimiento)}</td>
                      <td className="px-4 py-3 text-center">
                        {f.retraso > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cr.chip}`}>
                            <i className="ri-alarm-warning-fill"></i> +{f.retraso} días
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">A tiempo</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entregados con retraso */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Entregados con retraso</h2>
          <span className="text-sm text-gray-500">{entregadosConRetraso.length} expedientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / EXP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Entregado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días de retraso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entregadosConRetraso.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-checkbox-circle-line text-4xl mb-2"></i>
                    <p className="text-sm">Sin entregas fuera de plazo 🎉</p>
                  </td>
                </tr>
              ) : (
                entregadosConRetraso.map((f) => {
                  const cr = COLORES[nivelRetraso(f.retraso)];
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{f.po}</div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">{f.expId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          f.modulo === 'dropship' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                        }`}>
                          {f.modulo === 'dropship' ? 'Dropship' : 'ZF'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.responsable}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(f.fechaRequerimiento)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{f.fechaLiberacion ? formatearFechaCorta(f.fechaLiberacion) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cr.chip}`}>
                          <i className="ri-alarm-warning-fill"></i> +{f.retraso} días
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}