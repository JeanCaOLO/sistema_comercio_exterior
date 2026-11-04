import { useState } from 'react';
import DashboardBlContenedor from './DashboardBlContenedor';
import ActualizarBlContenedor from './ActualizarBlContenedor';
import HistorialBlContenedor from './HistorialBlContenedor';
import type { VistaBlContenedor } from './types';

interface GestionBlContenedorProps {
  vista: VistaBlContenedor;
  onCambiarVista: (vista: VistaBlContenedor) => void;
}

const TABS: { id: VistaBlContenedor; label: string; icono: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icono: 'ri-dashboard-3-line' },
  { id: 'actualizar', label: 'Cargar BL y Contenedor', icono: 'ri-ship-2-line' },
  { id: 'historial', label: 'Historial de cambios', icono: 'ri-history-line' },
];

export default function GestionBlContenedor({ vista, onCambiarVista }: GestionBlContenedorProps) {
  const [poObjetivo, setPoObjetivo] = useState('');
  const [nonce, setNonce] = useState(0);

  const irACargarPo = (po: string) => {
    setPoObjetivo(po);
    setNonce((n) => n + 1);
    onCambiarVista('actualizar');
  };

  const cambiarVista = (destino: VistaBlContenedor) => {
    if (destino === 'actualizar' && vista !== 'actualizar') setPoObjetivo('');
    onCambiarVista(destino);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-ship-2-line text-white text-xl"></i>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Agentes de Carga · BL y Contenedor</h1>
            <p className="text-sm text-gray-500 mt-0.5 max-w-3xl">
              Cargá el número de BL y de contenedor de cada PO y enviálos a Raga. El sistema completa el
              ticket, registra el cambio y lo deja disponible en el dashboard y en el historial.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => cambiarVista(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              vista === t.id ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className={t.icono}></i>
            {t.label}
          </button>
        ))}
      </div>

      {vista === 'dashboard' && (
        <DashboardBlContenedor onIrA={cambiarVista} onCargar={irACargarPo} />
      )}

      {vista === 'actualizar' && (
        <ActualizarBlContenedor
          key={`${poObjetivo}-${nonce}`}
          poInicial={poObjetivo || null}
        />
      )}

      {vista === 'historial' && <HistorialBlContenedor />}
    </div>
  );
}