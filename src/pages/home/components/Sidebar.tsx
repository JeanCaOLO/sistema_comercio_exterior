import {
  GRUPOS_NAVEGACION,
  ITEM_CONFIGURACION,
  NOMBRE_SISTEMA,
  type GrupoNavegacion,
  type ItemNavegacion,
} from '@/lib/navegacion';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  userName: string;
  userRoles: string[];
  modulosPermitidos: string[];
}

export default function Sidebar({ activeView, setActiveView, onLogout, userName, userRoles, modulosPermitidos }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tieneAcceso = (id: string) => modulosPermitidos.includes(id);

  const renderItem = (item: ItemNavegacion) => {
    const activo = activeView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveView(item.id)}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm ${
          isCollapsed ? 'justify-center py-2.5' : 'px-3 py-2.5'
        } ${activo ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${activo ? 'text-teal-600' : 'text-gray-400'}`}>
          <i className={`${item.icon} text-lg`}></i>
        </span>
        {!isCollapsed && (
          <span className={activo ? 'font-semibold' : 'font-medium'}>{item.label}</span>
        )}
      </button>
    );
  };

  const renderGrupo = (grupo: GrupoNavegacion) => {
    const secciones = grupo.secciones
      .map((seccion) => ({
        ...seccion,
        items: seccion.items.filter((item) => tieneAcceso(item.id)),
      }))
      .filter((seccion) => seccion.items.length > 0);

    const totalItems = secciones.reduce((acc, seccion) => acc + seccion.items.length, 0);
    if (totalItems === 0) return null;

    return (
      <div key={grupo.id}>
        {isCollapsed ? (
          <div className="mx-2 my-2.5 h-px bg-gray-100"></div>
        ) : (
          <div className="flex items-center gap-2 px-3 pt-4 pb-2">
            <i className={`${grupo.icon} text-sm text-teal-600`}></i>
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">
              {grupo.nombre}
            </span>
            <span className="flex-1 h-px bg-gray-100"></span>
          </div>
        )}
        <div className="space-y-1">
          {secciones.map((seccion) => (
            <div key={`${grupo.id}-${seccion.titulo || 'principal'}`}>
              {!isCollapsed && seccion.titulo && (
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                  {seccion.titulo}
                </p>
              )}
              <div className="space-y-1">
                {seccion.items.map(renderItem)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 relative flex-shrink-0`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center text-white hover:bg-teal-700 transition-colors cursor-pointer z-10"
        title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
      >
        <i className={`${isCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-sm`}></i>
      </button>

      {/* Marca del sistema */}
      <div className={`${isCollapsed ? 'px-3' : 'px-5'} py-5 border-b border-gray-200`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-global-line text-xl text-white"></i>
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">{NOMBRE_SISTEMA}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Panel operativo</p>
            </div>
          )}
        </div>
      </div>

      {/* Módulos */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {GRUPOS_NAVEGACION.map(renderGrupo)}
      </nav>

      {/* Configuración al mismo nivel que los módulos */}
      {tieneAcceso(ITEM_CONFIGURACION.id) && (
        <div className="px-3 py-3 border-t border-gray-200">
          {renderItem(ITEM_CONFIGURACION)}
        </div>
      )}

      {/* Usuario + sesión */}
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