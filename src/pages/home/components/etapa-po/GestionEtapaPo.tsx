import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { contarPendientesEtapa } from '@/lib/etapaPo';
import { puedeVerEtapaPo } from '@/lib/permisos';
import SolicitarCambioEtapa from './SolicitarCambioEtapa';
import ListaSolicitudesEtapa from './ListaSolicitudesEtapa';

export type VistaEtapaPo = 'solicitar' | 'aprobaciones' | 'historial';

interface GestionEtapaPoProps {
  vista: VistaEtapaPo;
  onCambiarVista: (vista: VistaEtapaPo) => void;
  solicitudObjetivoId?: string | null;
  onObjetivoConsumido?: () => void;
}

const TABS: { id: VistaEtapaPo; label: string; icono: string }[] = [
  { id: 'solicitar', label: 'Mover de Etapa', icono: 'ri-kanban-view' },
  { id: 'aprobaciones', label: 'Aprobaciones Pendientes', icono: 'ri-checkbox-multiple-line' },
  { id: 'historial', label: 'Historial', icono: 'ri-history-line' },
];

export default function GestionEtapaPo({
  vista,
  onCambiarVista,
  solicitudObjetivoId = null,
  onObjetivoConsumido,
}: GestionEtapaPoProps) {
  const { perfil } = useAuth();
  const [pendientes, setPendientes] = useState(0);

  const autorizado = puedeVerEtapaPo({
    email: perfil?.email || '',
    nombre: perfil?.nombre || '',
    id: perfil?.id || '',
  });

  const usuarioId = perfil?.id || '';
  const usuarioNombre = perfil?.nombre || perfil?.email || '';
  const roles = perfil?.roles || [];
  const esAdministrador = roles.some((r) => {
    const normalizado = (r || '').trim().toLowerCase();
    return normalizado === 'administrador' || normalizado === 'admin';
  });
  const puedeAprobar = esAdministrador;
  // El entorno QA es una herramienta de prueba: solo el Administrador decide
  // dónde operar y la pantalla siempre arranca en Producción.
  const puedeElegirEntorno = esAdministrador;
  const incluirQa = esAdministrador;

  const refrescarPendientes = useCallback(async () => {
    try {
      setPendientes(await contarPendientesEtapa(incluirQa));
    } catch {
      setPendientes(0);
    }
  }, [incluirQa]);

  useEffect(() => {
    refrescarPendientes();
  }, [refrescarPendientes]);

  return (
    <div className="p-6 lg:p-8">
      {!autorizado ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <i className="ri-lock-line text-4xl text-gray-400 mb-3"></i>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Acceso restringido</h3>
          <p className="text-sm text-gray-500">
            Este módulo está reservado a un usuario autorizado. Si necesitás mover una PO de etapa,
            contactá al responsable del proceso.
          </p>
        </div>
      ) : (
      <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-kanban-view text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cambio de Etapa de PO</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Mové una orden de compra a otra etapa del kanban de Raga, con flujo de aprobación y prueba en QA o Producción.
            </p>
          </div>
        </div>
      </div>

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

      {vista === 'solicitar' && (
        <SolicitarCambioEtapa
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          puedeElegirEntorno={puedeElegirEntorno}
        />
      )}

      {vista === 'aprobaciones' && (
        puedeAprobar ? (
          <ListaSolicitudesEtapa
            modo="aprobaciones"
            puedeAprobar={puedeAprobar}
            usuarioId={usuarioId}
            usuarioNombre={usuarioNombre}
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
              Solo un Administrador puede aprobar cambios de etapa de una PO.
            </p>
          </div>
        )
      )}

      {vista === 'historial' && (
        <ListaSolicitudesEtapa
          modo="historial"
          puedeAprobar={puedeAprobar}
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          incluirQa={incluirQa}
        />
      )}
      </>
      )}
    </div>
  );
}