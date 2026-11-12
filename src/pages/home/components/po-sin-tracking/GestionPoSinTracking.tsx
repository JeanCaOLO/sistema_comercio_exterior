import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cargarRolesAprobacionEtd, puedeCambiarRutaLogisticaPo } from '@/lib/permisos';
import { contarPendientesFechas } from '@/lib/cambiosFechasPo';
import { puedeVerQaEtd } from '@/lib/etdCambios';
import SolicitarCambioFechas from './SolicitarCambioFechas';
import DashboardFechas from './DashboardFechas';
import ListaCambiosFechas from './ListaCambiosFechas';
import type { VistaPoTracking } from './types';

interface GestionPoSinTrackingProps {
  vista: VistaPoTracking;
  onCambiarVista: (vista: VistaPoTracking) => void;
  solicitudObjetivoId?: string | null;
  onObjetivoConsumido?: () => void;
}

const TABS: { id: VistaPoTracking; label: string; icono: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icono: 'ri-dashboard-3-line' },
  { id: 'solicitar', label: 'Cargar Fechas de PO', icono: 'ri-calendar-schedule-line' },
  { id: 'aprobaciones', label: 'Aprobaciones Pendientes', icono: 'ri-checkbox-multiple-line' },
  { id: 'historial', label: 'Historial de Solicitudes', icono: 'ri-history-line' },
];

export default function GestionPoSinTracking({
  vista,
  onCambiarVista,
  solicitudObjetivoId = null,
  onObjetivoConsumido,
}: GestionPoSinTrackingProps) {
  const { perfil } = useAuth();
  const [rolesAprobacion, setRolesAprobacion] = useState<string[]>([]);
  const [pendientes, setPendientes] = useState(0);

  const usuarioId = perfil?.id || '';
  const usuarioNombre = perfil?.nombre || perfil?.email || '';
  const roles = perfil?.roles || [];
  const puedeAprobar = roles.some((r) => rolesAprobacion.includes(r));
  const puedeElegirEntorno = puedeVerQaEtd(perfil?.email);
  const incluirQa = puedeElegirEntorno;
  const esAdministrador = roles.some((r) => r.trim().toLowerCase() === 'administrador');
  const puedeAprobarPropias = esAdministrador || puedeElegirEntorno;
  // La ruta logística solo la modifican usuarios autorizados (administradores).
  const puedeCambiarRuta = puedeCambiarRutaLogisticaPo(roles, {
    email: perfil?.email,
    id: perfil?.id,
    nombre: perfil?.nombre,
  });

  useEffect(() => {
    cargarRolesAprobacionEtd().then(setRolesAprobacion);
  }, []);

  const refrescarPendientes = useCallback(async () => {
    try {
      const count = await contarPendientesFechas({ incluirQa });
      setPendientes(count);
    } catch {
      setPendientes(0);
    }
  }, [incluirQa]);

  useEffect(() => {
    refrescarPendientes();
  }, [refrescarPendientes]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-sky-600 rounded-lg flex-shrink-0">
            <i className="ri-calendar-schedule-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cambios PO sin Tracking</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Carga y modifica las fechas de las órdenes de compra, con aprobación, dashboard e historial.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {TABS.filter((t) => t.id !== 'aprobaciones' || puedeAprobar).map((t) => (
          <button
            key={t.id}
            onClick={() => onCambiarVista(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              vista === t.id ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className={t.icono}></i>
            {t.label}
            {t.id === 'aprobaciones' && pendientes > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {vista === 'dashboard' && (
        <DashboardFechas
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeAprobar={puedeAprobar}
          puedeAprobarPropias={puedeAprobarPropias}
          incluirQa={incluirQa}
          onIrA={onCambiarVista}
        />
      )}

      {vista === 'solicitar' && (
        <SolicitarCambioFechas
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeElegirEntorno={puedeElegirEntorno}
          puedeCambiarRuta={puedeCambiarRuta}
        />
      )}

      {vista === 'aprobaciones' && (
        puedeAprobar ? (
          <ListaCambiosFechas
            modo="aprobaciones"
            usuarioId={usuarioId}
            usuarioNombre={usuarioNombre}
            puedeAprobar={puedeAprobar}
            puedeAprobarPropias={puedeAprobarPropias}
            incluirQa={incluirQa}
            puedeCambiarRuta={puedeCambiarRuta}
            onRefrescarContador={refrescarPendientes}
            solicitudObjetivoId={solicitudObjetivoId}
            onObjetivoConsumido={onObjetivoConsumido}
          />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
            <i className="ri-lock-line text-4xl text-amber-600 mb-3"></i>
            <h3 className="text-lg font-semibold text-amber-900 mb-1">Acceso restringido</h3>
            <p className="text-sm text-amber-700">
              No tienes el permiso de aprobación (can_approve_etd_change). Solicítalo a un administrador.
            </p>
          </div>
        )
      )}

      {vista === 'historial' && (
        <ListaCambiosFechas
          modo="historial"
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeAprobar={puedeAprobar}
          puedeAprobarPropias={puedeAprobarPropias}
          puedeCambiarRuta={puedeCambiarRuta}
          incluirQa={incluirQa}
        />
      )}
    </div>
  );
}