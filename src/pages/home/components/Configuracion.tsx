import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export default function Configuracion() {
  const [activeTab, setActiveTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    roles: [] as string[],
    departamento: '',
    estado: 'Activo'
  });
  const { perfil } = useAuth();

  // Roles disponibles
  const rolesDisponibles = [
    { id: 'Administrador', nombre: 'Administrador', descripcion: 'Acceso completo a todos los módulos' },
    { id: 'Gestor Dropship', nombre: 'Gestor Dropship', descripcion: 'Gestión de Expedientes Dropship y Lista' },
    { id: 'Gestor ZF', nombre: 'Gestor ZF', descripcion: 'Gestión de Expedientes ZF y Lista' }
  ];

  useEffect(() => {
    if (activeTab === 'usuarios') {
      cargarUsuarios();
    }
  }, [activeTab]);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setFormData(prev => {
      const roles = prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId];
      return { ...prev, roles };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.roles.length === 0) {
      alert('Debe seleccionar al menos un rol');
      return;
    }

    try {
      const rolesString = formData.roles.join(',');

      if (editingUser) {
        // Actualizar usuario existente
        const { error } = await supabase
          .from('usuarios')
          .update({
            nombre: formData.nombre,
            rol: rolesString,
            departamento: formData.departamento,
            estado: formData.estado
          })
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        // Crear nuevo usuario con Supabase Auth
        if (!formData.password || formData.password.length < 6) {
          alert('La contraseña debe tener al menos 6 caracteres');
          return;
        }

        // Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true,
          user_metadata: {
            nombre: formData.nombre,
            rol: rolesString,
          }
        });

        if (authError) throw authError;

        // Crear perfil en tabla usuarios
        if (authData.user) {
          const { error: perfilError } = await supabase
            .from('usuarios')
            .insert([{
              id: authData.user.id,
              nombre: formData.nombre,
              email: formData.email,
              rol: rolesString,
              departamento: formData.departamento,
              estado: formData.estado
            }]);

          if (perfilError) throw perfilError;
        }
      }

      setShowModal(false);
      setEditingUser(null);
      setFormData({
        nombre: '',
        email: '',
        password: '',
        roles: [],
        departamento: '',
        estado: 'Activo'
      });
      cargarUsuarios();
    } catch (error: any) {
      console.error('Error al guardar usuario:', error);
      alert('Error al guardar usuario: ' + error.message);
    }
  };

  const handleEdit = (usuario: any) => {
    setEditingUser(usuario);
    
    // Convertir el string de roles a array
    let rolesArray: string[] = [];
    if (usuario.rol) {
      if (usuario.rol.includes(',')) {
        rolesArray = usuario.rol.split(',').map((r: string) => r.trim());
      } else {
        rolesArray = [usuario.rol];
      }
    }

    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      roles: rolesArray,
      departamento: usuario.departamento || '',
      estado: usuario.estado
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.')) return;

    try {
      // Eliminar de la tabla usuarios (el perfil)
      const { error: deleteError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Eliminar del sistema de autenticación
      const { error: authError } = await supabase.auth.admin.deleteUser(id);
      
      if (authError) {
        console.warn('No se pudo eliminar del sistema de autenticación:', authError);
      }

      cargarUsuarios();
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      alert('Error al eliminar usuario: ' + error.message);
    }
  };

  const toggleEstado = async (usuario: any) => {
    try {
      const nuevoEstado = usuario.estado === 'Activo' ? 'Inactivo' : 'Activo';
      const { error } = await supabase
        .from('usuarios')
        .update({ estado: nuevoEstado })
        .eq('id', usuario.id);

      if (error) throw error;
      cargarUsuarios();
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar estado: ' + error.message);
    }
  };

  // Función para obtener los roles de un usuario
  const obtenerRolesUsuario = (rolString: string): string[] => {
    if (!rolString) return [];
    if (rolString.includes(',')) {
      return rolString.split(',').map(r => r.trim());
    }
    return [rolString];
  };

  // Verificar si el usuario actual es administrador
  const esAdministrador = perfil?.rol === 'Administrador';

  if (!esAdministrador && activeTab === 'usuarios') {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <i className="ri-error-warning-line text-4xl text-amber-600 mb-3"></i>
          <h3 className="text-lg font-semibold text-amber-900 mb-2">Acceso Restringido</h3>
          <p className="text-amber-700">Solo los administradores pueden gestionar usuarios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configuración del Sistema</h1>
        <p className="text-gray-500 mt-2">Administre usuarios y configuraciones generales</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'usuarios'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="ri-user-line mr-2"></i>
              Usuarios
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="ri-settings-3-line mr-2"></i>
              General
            </button>
            <button
              onClick={() => setActiveTab('datos')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'datos'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="ri-database-2-line mr-2"></i>
              Datos
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'usuarios' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Gestión de Usuarios</h2>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setFormData({
                      nombre: '',
                      email: '',
                      password: '',
                      roles: [],
                      departamento: '',
                      estado: 'Activo'
                    });
                    setShowModal(true);
                  }}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-add-line mr-2"></i>
                  Agregar Usuario
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                  <p className="mt-4 text-gray-600">Cargando usuarios...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Nombre</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Roles</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Departamento</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Estado</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((usuario) => {
                        const rolesUsuario = obtenerRolesUsuario(usuario.rol);
                        return (
                          <tr key={usuario.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-900">{usuario.nombre}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{usuario.email}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {rolesUsuario.map((rol) => (
                                  <span
                                    key={rol}
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      rol === 'Administrador' ? 'bg-purple-100 text-purple-800' :
                                      rol === 'Gestor Dropship' ? 'bg-blue-100 text-blue-800' :
                                      rol === 'Gestor ZF' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {rol}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">{usuario.departamento || '-'}</td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => toggleEstado(usuario)}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                  usuario.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {usuario.estado}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEdit(usuario)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                  title="Editar"
                                >
                                  <i className="ri-edit-line text-lg"></i>
                                </button>
                                <button
                                  onClick={() => handleDelete(usuario.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="Eliminar"
                                >
                                  <i className="ri-delete-bin-line text-lg"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'general' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuración General</h2>
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Empresa
                  </label>
                  <input
                    type="text"
                    defaultValue="Mi Empresa"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días de Alerta de Vencimiento
                  </label>
                  <input
                    type="number"
                    defaultValue="3"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo Estimado - Dificultad Baja (minutos)
                  </label>
                  <input
                    type="number"
                    defaultValue="30"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo Estimado - Dificultad Media (minutos)
                  </label>
                  <input
                    type="number"
                    defaultValue="60"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo Estimado - Dificultad Alta (minutos)
                  </label>
                  <input
                    type="number"
                    defaultValue="120"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <button className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer">
                  Guardar Cambios
                </button>
              </div>
            </div>
          )}

          {activeTab === 'datos' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Gestión de Datos</h2>
              <div className="space-y-4 max-w-2xl">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">Respaldo de Datos</h3>
                      <p className="text-sm text-blue-700 mb-3">
                        Cree una copia de seguridad de todos los expedientes y configuraciones
                      </p>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-download-line mr-2"></i>
                        Descargar Respaldo
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <i className="ri-alert-line text-amber-600 text-xl mt-0.5"></i>
                    <div>
                      <h3 className="font-semibold text-amber-900 mb-1">Limpiar Datos Antiguos</h3>
                      <p className="text-sm text-amber-700 mb-3">
                        Eliminar expedientes con más de 2 años de antigüedad
                      </p>
                      <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-delete-bin-line mr-2"></i>
                        Limpiar Datos
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm disabled:bg-gray-100"
                />
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-1">El email no se puede modificar</p>
                )}
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Roles <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {rolesDisponibles.map((rol) => (
                    <div
                      key={rol.id}
                      onClick={() => toggleRole(rol.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.roles.includes(rol.id)
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          formData.roles.includes(rol.id)
                            ? 'border-teal-500 bg-teal-500'
                            : 'border-gray-300'
                        }`}>
                          {formData.roles.includes(rol.id) && (
                            <i className="ri-check-line text-white text-sm"></i>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{rol.nombre}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              rol.id === 'Administrador' ? 'bg-purple-100 text-purple-800' :
                              rol.id === 'Gestor Dropship' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {rol.id}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{rol.descripcion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {formData.roles.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">Debe seleccionar al menos un rol</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento
                </label>
                <input
                  type="text"
                  value={formData.departamento}
                  onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {editingUser ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
