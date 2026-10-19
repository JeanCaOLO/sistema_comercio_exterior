import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cargarRolesAprobacionEtd } from '@/lib/permisos';
import { contarSolicitudesPendientesEtd, puedeVerQaEtd } from '@/lib/etdCambios';
import SolicitarCambioEtd from './SolicitarCambioEtd';
import AprobacionesEtd from './AprobacionesEtd';
import HistorialEtd from './HistorialEtd';

export type SeccionEtd = 'solicitar' | 'aprobaciones' | 'historial';

interface GestionCambiosEtdProps {
  seccion: SeccionEtd;
  onSeccionChange: (seccion: SeccionEtd) => void;
}

export default function GestionCambiosEtd({ seccion, onSeccionChange }: GestionCambiosEtdProps) {
  const { perfil } = useAuth();
  const [rolesAprobacion, setRolesAprobacion] = useState<string[]>([]);
  const [pendientes, setPendientes] = useState(0);

  const usuarioId = perfil?.id || '';
  const usuarioNombre = perfil?.nombre || perfil?.email || '';
  const roles = perfil?.roles || [];
  const puedeAprobar = roles.some((r) => rolesAprobacion.includes(r));
  // Solo el perfil de jalvarez puede alternar entre QA y Producción y ver registros de QA.
  const puedeElegirEntorno = puedeVerQaEtd(perfil?.email);
  const incluirQa = puedeElegirEntorno;
  // Los administradores (y el perfil de jalvarez) también pueden aprobar sus propias solicitudes.
  const esAdministrador = roles.some((r) => r.trim().toLowerCase() === 'administrador');
  const puedeAprobarPropias = esAdministrador || puedeElegirEntorno;

  useEffect(() => {
    cargarRolesAprobacionEtd().then(setRolesAprobacion);
  }, []);

  const refrescarPendientes = useCallback(async () => {
    try {
      const count = await contarSolicitudesPendientesEtd({ incluirQa });
      setPendientes(count);
    } catch {
      setPendientes(0);
    }
  }, [incluirQa]);

  useEffect(() => {
    refrescarPendientes();
  }, [refrescarPendientes]);

  const tabs: { id: SeccionEtd; label: string; icono: string; visible: boolean }[] = [
    { id: 'solicitar', label: 'Solicitar Cambio ETD Inicial', icono: 'ri-calendar-2-line', visible: true },
    { id: 'aprobaciones', label: 'Aprobaciones Pendientes', icono: 'ri-checkbox-multiple-line', visible: puedeAprobar },
    { id: 'historial', label: 'Historial de Solicitudes', icono: 'ri-history-line', visible: true },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-calendar-2-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Cambios ETD Inicial</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Solicita, revisa y aprueba cambios en la fecha ETD Inicial de una orden de compra.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {tabs.filter((t) => t.visible).map((t) => (
          <button
            key={t.id}
            onClick={() => onSeccionChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              seccion === t.id ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
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

      {seccion === 'solicitar' && (
        <SolicitarCambioEtd
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeElegirEntorno={puedeElegirEntorno}
        />
      )}

      {seccion === 'aprobaciones' && (
        puedeAprobar ? (
          <AprobacionesEtd
            usuarioId={usuarioId}
            usuarioNombre={usuarioNombre}
            puedeAprobar={puedeAprobar}
            puedeAprobarPropias={puedeAprobarPropias}
            incluirQa={incluirQa}
            onRefrescarContador={refrescarPendientes}
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

      {seccion === 'historial' && (
        <HistorialEtd usuarioId={usuarioId} usuarioNombre={usuarioNombre} puedeAprobar={puedeAprobar} puedeAprobarPropias={puedeAprobarPropias} incluirQa={incluirQa} />
      )}
    </div>
  );
}