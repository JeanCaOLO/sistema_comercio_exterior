import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cargarRolesAprobacionEtd } from '@/lib/permisos';
import { contarPendientesCambios, type TipoCambioOrden } from '@/lib/cambiosOrden';
import { puedeVerQaEtd } from '@/lib/etdCambios';
import SolicitarCambioEtd from '@/pages/home/components/SolicitarCambioEtd';
import SolicitarCambioCampo from './SolicitarCambioCampo';
import DashboardCambios from './DashboardCambios';
import ListaCambios from './ListaCambios';

export type VistaCambios =
  | 'dashboard'
  | 'etd-solicitar'
  | 'carga-lista-solicitar'
  | 'incoterm-solicitar'
  | 'aprobaciones'
  | 'historial';

interface GestionCambiosOrdenProps {
  vista: VistaCambios;
  onCambiarVista: (vista: VistaCambios) => void;
  solicitudObjetivoId?: string | null;
  onObjetivoConsumido?: () => void;
}

const TABS: { id: VistaCambios; label: string; icono: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icono: 'ri-dashboard-3-line' },
  { id: 'etd-solicitar', label: 'Solicitar ETD Inicial', icono: 'ri-calendar-2-line' },
  { id: 'carga-lista-solicitar', label: 'Solicitar Carga Lista', icono: 'ri-file-list-2-line' },
  { id: 'incoterm-solicitar', label: 'Solicitar Incoterm', icono: 'ri-exchange-dollar-line' },
  { id: 'aprobaciones', label: 'Aprobaciones Pendientes', icono: 'ri-checkbox-multiple-line' },
  { id: 'historial', label: 'Historial de Solicitudes', icono: 'ri-history-line' },
];

export default function GestionCambiosOrden({
  vista,
  onCambiarVista,
  solicitudObjetivoId = null,
  onObjetivoConsumido,
}: GestionCambiosOrdenProps) {
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

  useEffect(() => {
    cargarRolesAprobacionEtd().then(setRolesAprobacion);
  }, []);

  const refrescarPendientes = useCallback(async () => {
    try {
      const count = await contarPendientesCambios({ incluirQa });
      setPendientes(count);
    } catch {
      setPendientes(0);
    }
  }, [incluirQa]);

  useEffect(() => {
    refrescarPendientes();
  }, [refrescarPendientes]);

  const tipos: Record<'carga-lista-solicitar' | 'incoterm-solicitar', Extract<TipoCambioOrden, 'carga_lista' | 'incoterm'>> = {
    'carga-lista-solicitar': 'carga_lista',
    'incoterm-solicitar': 'incoterm',
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-git-pull-request-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Cambios de Órdenes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Solicita, revisa y aprueba cambios de ETD Inicial, carga lista teórica e incoterm de compra.
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
              vista === t.id ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
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
        <DashboardCambios
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeAprobar={puedeAprobar}
          puedeAprobarPropias={puedeAprobarPropias}
          incluirQa={incluirQa}
          onIrA={(destino) => {
            if (destino === 'etd-aprobaciones') onCambiarVista('aprobaciones');
            else if (destino === 'etd-historial') onCambiarVista('historial');
            else if (destino === 'etd-solicitar') onCambiarVista('etd-solicitar');
            else if (destino === 'carga-lista-solicitar') onCambiarVista('carga-lista-solicitar');
            else if (destino === 'incoterm-solicitar') onCambiarVista('incoterm-solicitar');
          }}
        />
      )}

      {vista === 'etd-solicitar' && (
        <SolicitarCambioEtd
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeElegirEntorno={puedeElegirEntorno}
        />
      )}

      {(vista === 'carga-lista-solicitar' || vista === 'incoterm-solicitar') && (
        <SolicitarCambioCampo
          tipo={tipos[vista]}
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeElegirEntorno={puedeElegirEntorno}
        />
      )}

      {vista === 'aprobaciones' && (
        puedeAprobar ? (
          <ListaCambios
            modo="aprobaciones"
            usuarioId={usuarioId}
            usuarioNombre={usuarioNombre}
            puedeAprobar={puedeAprobar}
            puedeAprobarPropias={puedeAprobarPropias}
            incluirQa={incluirQa}
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
        <ListaCambios
          modo="historial"
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeAprobar={puedeAprobar}
          puedeAprobarPropias={puedeAprobarPropias}
          incluirQa={incluirQa}
        />
      )}
    </div>
  );
}