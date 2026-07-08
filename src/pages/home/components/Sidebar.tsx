import { useState } from 'react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  userName: string;
  userRoles: string[];
}

export default function Sidebar({ activeView, setActiveView, onLogout, userName, userRoles }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Verificar roles
  const esAdministrador = userRoles.includes('Administrador');
  const esGestorDropship = userRoles.includes('Gestor Dropship');
  const esGestorZF = userRoles.includes('Gestor ZF');
  const esBodega = userRoles.includes('Bodega');
  const esSolicitante = userRoles.includes('Solicitante') || userRoles.length > 0;

  // Construir menú según roles
  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: 'ri-dashboard-line',
      visible: esAdministrador || esGestorDropship || esGestorZF || esBodega
    },
    { 
      id: 'gestion-dropship', 
      label: 'Gestión Dropship', 
      icon: 'ri-ship-line',
      visible: esAdministrador || esGestorDropship
    },
    { 
      id: 'gestion-zf', 
      label: 'Gestión ZF', 
      icon: 'ri-building-line',
      visible: esAdministrador || esGestorZF || esBodega
    },
    { 
      id: 'lista-expedientes', 
      label: 'Lista de Expedientes', 
      icon: 'ri-file-list-3-line',
      visible: esAdministrador || esGestorDropship || esGestorZF || esBodega
    },
    { 
      id: 'reportes', 
      label: 'Reportes', 
      icon: 'ri-bar-chart-box-line',
      visible: esAdministrador
    },
    { 
      id: 'carga-masiva', 
      label: 'Carga Masiva', 
      icon: 'ri-upload-cloud-line',
      visible: esAdministrador
    },
    { 
      id: 'carga-caa', 
      label: 'Carga CAA', 
      icon: 'ri-file-upload-line',
      visible: esSolicitante
    },
    { 
      id: 'documentacion', 
      label: 'Documentación', 
      icon: 'ri-folder-open-line',
      visible: esAdministrador || esGestorDropship || esGestorZF || esBodega || esSolicitante
    },
    { 
      id: 'repositorio', 
      label: 'Repositorio Docs', 
      icon: 'ri-archive-line',
      visible: esAdministrador || esGestorDropship || esGestorZF || esBodega || esSolicitante
    },
    { 
      id: 'configuracion', 
      label: 'Configuración', 
      icon: 'ri-settings-3-line',
      visible: esAdministrador
    }
  ];

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 relative`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center text-white hover:bg-teal-700 transition-colors cursor-pointer z-10 shadow-lg"
        title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
      >
        <i className={`${isCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-sm`}></i>
      </button>

      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-file-text-line text-xl text-white"></i>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">Expedientes</h1>
              <p className="text-xs text-gray-500">Sistema de Gestión</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeView === item.id
                ? 'bg-teal-50 text-teal-700'
                : 'text-gray-600 hover:bg-gray-50'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? item.label : ''}
          >
            <i className={`${item.icon} text-xl flex-shrink-0`}></i>
            {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        {!isCollapsed && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-teal-700 text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {userRoles.map((role, index) => (
                    <span key={index} className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center gap-2'} px-4 py-2.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap`}
          title={isCollapsed ? 'Cerrar Sesión' : ''}
        >
          <i className="ri-logout-box-line text-lg"></i>
          {!isCollapsed && <span className="font-medium text-sm">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
}
