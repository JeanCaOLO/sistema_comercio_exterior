import { useEffect, useMemo, useState } from 'react';
import Paginacion from '@/components/feature/Paginacion';
import { descargarExcelHojas } from '@/lib/exportar';
import { hoyLocal } from '@/lib/fechas';
import FiltrosHistorialTiquetes from './historial-tiquetes/FiltrosHistorialTiquetes';
import TablaMovimientos from './historial-tiquetes/TablaMovimientos';
import VistaPorTiquete from './historial-tiquetes/VistaPorTiquete';
import { useHistorialTiquetes } from './historial-tiquetes/useHistorialTiquetes';
import type { FiltrosHistorial, OrdenHistorial, VistaHistorial } from './historial-tiquetes/types';
import {
  FILTROS_INICIALES,
  contarFiltrosActivos,
  etiquetaModulo,
  fechaHora,
  filtrarTiquetes,
  listarOpciones,
  movimientosPlanos,
  ordenarTiquetes,
} from './historial-tiquetes/utils';

const POR_PAGINA_TIQUETES = 20;
const POR_PAGINA_MOVIMIENTOS = 100;

export default function ReporteHistorialTiquetes() {
  const { tiquetes, cargando, error, recargar } = useHistorialTiquetes();
  const [filtros, setFiltros] = useState<FiltrosHistorial>(FILTROS_INICIALES);
  const [soloSinMovimientos, setSoloSinMovimientos] = useState(false);
  const [vista, setVista] = useState<VistaHistorial>('tiquete');
  const [orden, setOrden] = useState<OrdenHistorial>('actividad');
  const [paginaTiquetes, setPaginaTiquetes] = useState(1);
  const [paginaMovimientos, setPaginaMovimientos] = useState(1);

  useEffect(() => {
    setPaginaTiquetes(1);
    setPaginaMovimientos(1);
  }, [filtros, orden, soloSinMovimientos, vista]);

  const opciones = useMemo(() => listarOpciones(tiquetes), [tiquetes]);

  const filtrados = useMemo(() => {
    const base = filtrarTiquetes(tiquetes, filtros);
    return soloSinMovimientos
      ? base.filter((tiquete) => tiquete.totalMovimientosHistoricos === 0)
      : base;
  }, [tiquetes, filtros, soloSinMovimientos]);

  const ordenados = useMemo(() => ordenarTiquetes(filtrados, orden), [filtrados, orden]);
  const movimientos = useMemo(() => movimientosPlanos(filtrados), [filtrados]);

  const totalTiquetes = filtrados.length;
  const totalMovimientos = movimientos.length;
  const promedio = totalTiquetes > 0 ? (totalMovimientos / totalTiquetes).toFixed(1) : '0.0';
  const sinMovimientos = filtrados.filter((t) => t.totalMovimientosHistoricos === 0).length;

  const totalPaginasTiquetes = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA_TIQUETES));
  const totalPaginasMovimientos = Math.max(1, Math.ceil(movimientos.length / POR_PAGINA_MOVIMIENTOS));

  const tiquetesPagina = ordenados.slice(
    (paginaTiquetes - 1) * POR_PAGINA_TIQUETES,
    paginaTiquetes * POR_PAGINA_TIQUETES
  );

  const movimientosPagina = movimientos.slice(
    (paginaMovimientos - 1) * POR_PAGINA_MOVIMIENTOS,
    paginaMovimientos * POR_PAGINA_MOVIMIENTOS
  );

  const activos = contarFiltrosActivos(filtros) + (soloSinMovimientos ? 1 : 0);

  const cambiarFiltros = (parcial: Partial<FiltrosHistorial>) =>
    setFiltros((prev) => ({ ...prev, ...parcial }));

  const limpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES);
    setSoloSinMovimientos(false);
  };

  const descripcionFiltros = useMemo(() => {
    const partes: string[] = [];
    if (filtros.busqueda.trim()) partes.push(`Búsqueda: ${filtros.busqueda.trim()}`);
    if (filtros.modulo !== 'todos') partes.push(`Módulo: ${etiquetaModulo(filtros.modulo)}`);
    if (filtros.campo !== 'todos') partes.push(`Campo: ${filtros.campo}`);
    if (filtros.usuario !== 'todos') partes.push(`Usuario: ${filtros.usuario}`);
    if (filtros.estado !== 'todos') partes.push(`Estado actual: ${filtros.estado}`);
    if (filtros.fechaInicio) partes.push(`Desde: ${filtros.fechaInicio}`);
    if (filtros.fechaFin) partes.push(`Hasta: ${filtros.fechaFin}`);
    if (soloSinMovimientos) partes.push('Solo tíquetes sin movimientos');
    return partes.length > 0 ? partes.join(' | ') : 'Sin filtros (todos los tíquetes)';
  }, [filtros, soloSinMovimientos]);

  const exportar = () => {
    if (filtrados.length === 0) return;

    const filasMovimientos = movimientos.map((mov) => ({
      'Fecha del movimiento': fechaHora(mov.fechaCambio),
      PO: mov.po,
      'EXP ID': mov.expId,
      Módulo: etiquetaModulo(mov.modulo),
      'Estado actual': mov.estadoActual,
      'Campo modificado': mov.campoModificado,
      'Valor anterior': mov.valorAnterior || 'N/A',
      'Valor nuevo': mov.valorNuevo || 'N/A',
      Usuario: mov.usuario,
      'Email usuario': mov.usuarioEmail,
      Solicitante: mov.solicitante,
      Responsable: mov.responsable,
      'Fecha solicitud': mov.fechaSolicitud ? fechaHora(mov.fechaSolicitud) : '',
    }));

    const filasTiquetes = ordenados.map((tiquete) => ({
      PO: tiquete.po,
      'EXP ID': tiquete.expId,
      Módulo: etiquetaModulo(tiquete.modulo),
      'Estado actual': tiquete.estadoActual,
      Prioridad: tiquete.urgente ? 'URGENTE' : tiquete.prioridad,
      Solicitante: tiquete.solicitante,
      Responsable: tiquete.responsable,
      'Fecha solicitud': tiquete.fechaSolicitud ? fechaHora(tiquete.fechaSolicitud) : '',
      'Total movimientos': tiquete.totalMovimientos,
      'Primer movimiento': fechaHora(tiquete.primerCambio),
      'Último movimiento': fechaHora(tiquete.ultimoCambio),
      'Días sin movimiento':
        tiquete.diasSinMovimiento === null ? 'Sin movimientos' : tiquete.diasSinMovimiento,
      'Usuarios que intervinieron': tiquete.usuarios.join(', '),
      'Campos modificados': tiquete.campos.join(', '),
    }));

    const filasResumen = [
      { Concepto: 'Fecha de generación', Valor: fechaHora(new Date().toISOString()) },
      { Concepto: 'Filtros aplicados', Valor: descripcionFiltros },
      { Concepto: 'Tíquetes incluidos', Valor: totalTiquetes },
      { Concepto: 'Tíquetes sin movimientos', Valor: sinMovimientos },
      { Concepto: 'Movimientos registrados', Valor: totalMovimientos },
      { Concepto: 'Promedio de movimientos por tíquete', Valor: promedio },
    ];

    const sufijoModulo = filtros.modulo === 'todos' ? 'todos' : filtros.modulo;

    descargarExcelHojas(`historial-tiquetes-${sufijoModulo}-${hoyLocal()}.xlsx`, [
      { nombre: 'Resumen', filas: filasResumen },
      { nombre: 'Por Tíquete', filas: filasTiquetes },
      { nombre: 'Movimientos', filas: filasMovimientos },
    ]);
  };

  if (cargando) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600 text-sm">
            Cargando el historial de todos los tíquetes...
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Se incluyen los tíquetes antiguos y todos sus movimientos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Tíquetes</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Movimiento histórico de cada tíquete, incluidos los antiguos, con filtros y descarga a Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={recargar}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            Actualizar
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={filtrados.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line"></i>
            Descargar Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl"></i>
          <div className="flex-1 min-w-0">
            <p className="text-red-800 font-semibold text-sm">No se pudo cargar el historial</p>
            <p className="text-red-600 text-xs mt-0.5 break-all">{error}</p>
          </div>
          <button
            type="button"
            onClick={recargar}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 cursor-pointer whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Tíquetes en el reporte</p>
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <i className="ri-ticket-2-line text-teal-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalTiquetes}</p>
          <p className="text-xs text-gray-500 mt-1">con los filtros aplicados</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Movimientos registrados</p>
            <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center">
              <i className="ri-history-line text-sky-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalMovimientos}</p>
          <p className="text-xs text-gray-500 mt-1">cambios en el historial</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Promedio por tíquete</p>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <i className="ri-bar-chart-box-line text-amber-600 text-xl"></i>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{promedio}</p>
          <p className="text-xs text-gray-500 mt-1">movimientos en promedio</p>
        </div>

        <div className={`rounded-xl border p-5 ${sinMovimientos > 0 ? 'bg-red-50/60 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Sin movimientos</p>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sinMovimientos > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <i className={`ri-file-unknow-line text-xl ${sinMovimientos > 0 ? 'text-red-600' : 'text-gray-500'}`}></i>
            </div>
          </div>
          <p className={`text-3xl font-bold mt-2 ${sinMovimientos > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {sinMovimientos}
          </p>
          <p className="text-xs text-gray-500 mt-1">tíquetes sin historial registrado</p>
        </div>
      </div>

      <FiltrosHistorialTiquetes
        filtros={filtros}
        opciones={opciones}
        activos={activos}
        onCambiar={cambiarFiltros}
        onLimpiar={limpiarFiltros}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setVista('tiquete')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              vista === 'tiquete' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-group-line mr-1.5"></i>
            Por tíquete
          </button>
          <button
            type="button"
            onClick={() => setVista('movimientos')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              vista === 'movimientos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-list-check-2 mr-1.5"></i>
            Todos los movimientos
          </button>
        </div>

        {vista === 'tiquete' && (
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenHistorial)}
            className="px-3 py-2 pr-8 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            <option value="actividad">Ordenar: actividad reciente</option>
            <option value="antiguos">Ordenar: más antiguos primero</option>
            <option value="movimientos">Ordenar: más movimientos</option>
          </select>
        )}

        <button
          type="button"
          onClick={() => setSoloSinMovimientos((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
            soloSinMovimientos
              ? 'bg-red-600 border-red-600 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="ri-file-unknow-line"></i>
          Solo sin movimientos
        </button>

        <span className="ml-auto text-sm text-gray-500 whitespace-nowrap">
          {totalTiquetes} tíquete{totalTiquetes === 1 ? '' : 's'} · {totalMovimientos} movimiento
          {totalMovimientos === 1 ? '' : 's'}
        </span>
      </div>

      {vista === 'tiquete' ? (
        <>
          <VistaPorTiquete tiquetes={tiquetesPagina} />
          <Paginacion
            pagina={paginaTiquetes}
            totalPaginas={totalPaginasTiquetes}
            onCambiar={setPaginaTiquetes}
            resumen={
              ordenados.length > 0
                ? `Mostrando ${(paginaTiquetes - 1) * POR_PAGINA_TIQUETES + 1}-${Math.min(
                    paginaTiquetes * POR_PAGINA_TIQUETES,
                    ordenados.length
                  )} de ${ordenados.length} tíquetes`
                : undefined
            }
            colorActivo="grafito"
          />
        </>
      ) : (
        <>
          <TablaMovimientos movimientos={movimientosPagina} total={totalMovimientos} />
          <Paginacion
            pagina={paginaMovimientos}
            totalPaginas={totalPaginasMovimientos}
            onCambiar={setPaginaMovimientos}
            resumen={
              totalMovimientos > 0
                ? `Mostrando ${(paginaMovimientos - 1) * POR_PAGINA_MOVIMIENTOS + 1}-${Math.min(
                    paginaMovimientos * POR_PAGINA_MOVIMIENTOS,
                    totalMovimientos
                  )} de ${totalMovimientos} movimientos`
                : undefined
            }
            colorActivo="grafito"
          />
        </>
      )}
    </div>
  );
}