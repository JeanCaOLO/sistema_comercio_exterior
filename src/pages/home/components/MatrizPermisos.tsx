import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  MODULOS,
  ROLES,
  PERMISOS_DEFAULT,
  cargarMatrizPermisos,
  guardarMatrizPermisos,
  type MatrizPermisos as MatrizPermisosType,
} from '@/lib/permisos';

interface MatrizPermisosProps {
  onPermisosActualizados?: (matriz: MatrizPermisosType) => void;
}

export default function MatrizPermisos({ onPermisosActualizados }: MatrizPermisosProps) {
  const { perfil } = useAuth();
  const [matriz, setMatriz] = useState<MatrizPermisosType>({ ...PERMISOS_DEFAULT });
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const esAdmin = perfil?.roles?.includes('Administrador') ?? false;

  useEffect(() => {
    let activo = true;
    cargarMatrizPermisos()
      .then((m) => {
        if (!activo) return;
        setMatriz(m);
        onPermisosActualizados?.(m);
      })
      .catch(() => {
        if (activo) setMatriz({ ...PERMISOS_DEFAULT });
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePermiso = (rol: string, moduloId: string) => {
    if (!esAdmin || rol === 'Administrador') return;
    setMatriz((prev) => {
      const permisos = prev[rol] || [];
      const nuevo = permisos.includes(moduloId)
        ? permisos.filter((m) => m !== moduloId)
        : [...permisos, moduloId];
      return { ...prev, [rol]: nuevo };
    });
    setDirty(true);
    setMensaje(null);
  };

  const guardar = async () => {
    try {
      setSaving(true);
      setMensaje(null);
      await guardarMatrizPermisos(matriz);
      onPermisosActualizados?.(matriz);
      setDirty(false);
      setMensaje({ tipo: 'exito', texto: 'Permisos guardados correctamente' });
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + (error?.message || 'error desconocido') });
    } finally {
      setSaving(false);
    }
  };

  const restablecer = () => {
    if (!esAdmin) return;
    setMatriz({ ...PERMISOS_DEFAULT });
    setDirty(true);
    setMensaje(null);
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        <p className="mt-3 text-sm text-gray-600">Cargando matriz de permisos...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Matriz de Permisos</h2>
            <p className="text-sm text-gray-500 mt-1">
              Haz clic en cada celda para activar o desactivar el acceso de cada rol a los módulos del sistema
            </p>
          </div>
          {esAdmin && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={restablecer}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-refresh-line mr-2"></i>
                Restablecer
              </button>
              <button
                onClick={guardar}
                disabled={!dirty || saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line mr-2"></i>
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        {dirty && (
          <p className="text-xs text-amber-600 mt-2">
            <i className="ri-information-line mr-1"></i>
            Hay cambios sin guardar
          </p>
        )}
      </div>

      {mensaje && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          mensaje.tipo === 'exito'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {!esAdmin && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <i className="ri-lock-line mr-2"></i>
          Solo los administradores pueden editar la matriz de permisos. Esta vista es de solo lectura.
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-teal-500 flex items-center justify-center">
            <i className="ri-check-line text-white text-sm"></i>
          </span>
          <span className="text-sm text-gray-600">Puede ver</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
            <i className="ri-close-line text-gray-400 text-sm"></i>
          </span>
          <span className="text-sm text-gray-600">No puede ver</span>
        </div>
      </div>

      {/* Tabla matriz */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 bg-gray-50 text-left py-3 px-4 text-sm font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap min-w-[180px]">
                Rol
              </th>
              {MODULOS.map((modulo) => (
                <th
                  key={modulo.id}
                  className="py-3 px-2 text-center text-xs font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap"
                >
                  <div className="flex flex-col items-center gap-1">
                    <i className={`${modulo.icon} text-lg text-gray-500`}></i>
                    <span>{modulo.nombre}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((rol) => {
              const esAdminRol = rol.nombre === 'Administrador';
              const permisos = matriz[rol.nombre] || [];
              return (
                <tr key={rol.nombre} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="sticky left-0 bg-white py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${rol.color}`}>
                        {rol.nombre}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 max-w-[200px]">{rol.descripcion}</p>
                  </td>
                  {MODULOS.map((modulo) => {
                    const tienePermiso = permisos.includes(modulo.id);
                    return (
                      <td key={modulo.id} className="py-3 px-2 text-center">
                        <button
                          onClick={() => togglePermiso(rol.nombre, modulo.id)}
                          disabled={esAdminRol || !esAdmin}
                          title={
                            esAdminRol
                              ? 'El Administrador tiene acceso completo'
                              : esAdmin
                              ? 'Clic para alternar permiso'
                              : 'Solo lectura'
                          }
                          className={`inline-flex w-8 h-8 rounded-lg items-center justify-center border transition-colors ${
                            tienePermiso
                              ? 'bg-teal-500 border-teal-500'
                              : 'bg-gray-100 border-gray-200'
                          } ${
                            esAdminRol
                              ? 'cursor-not-allowed'
                              : esAdmin
                              ? 'cursor-pointer hover:bg-teal-600 hover:border-teal-600'
                              : 'cursor-default'
                          }`}
                        >
                          {tienePermiso ? (
                            <i className="ri-check-line text-white text-sm"></i>
                          ) : (
                            <i className="ri-close-line text-gray-400 text-sm"></i>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumen por módulo */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Acceso por módulo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULOS.map((modulo) => {
            const rolesConAcceso = ROLES.filter((r) => (matriz[r.nombre] || []).includes(modulo.id));
            return (
              <div key={modulo.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <i className={`${modulo.icon} text-teal-600`}></i>
                  <span className="font-medium text-sm text-gray-900">{modulo.nombre}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rolesConAcceso.length > 0 ? (
                    rolesConAcceso.map((r) => (
                      <span key={r.nombre} className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
                        {r.nombre}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Sin acceso asignado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}