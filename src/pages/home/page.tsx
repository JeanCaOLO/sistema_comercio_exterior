import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import GestionExpedientes from './components/GestionExpedientes';
import ListaExpedientes from './components/ListaExpedientes';
import Reportes from './components/Reportes';
import CargaMasiva from './components/CargaMasiva';
import Configuracion from './components/Configuracion';
import FormularioExpediente from './components/FormularioExpediente';
import CargaDocumentosCAA from './components/CargaDocumentosCAA';
import Documentacion from './components/Documentacion';
import RepositorioDocumentacion from './components/RepositorioDocumentacion';

export default function Home() {
  const [activeView, setActiveView] = useState('');
  const [showFormulario, setShowFormulario] = useState(false);
  const [refreshExpedientes, setRefreshExpedientes] = useState(0);
  const [tipoModuloActual, setTipoModuloActual] = useState<'dropship' | 'zf'>('dropship');
  const navigate = useNavigate();
  const { user, perfil, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Establecer vista inicial según roles
  useEffect(() => {
    if (perfil?.roles && perfil.roles.length > 0 && !activeView) {
      const roles = perfil.roles;
      
      // Todos los roles arrancan en dashboard
      setActiveView('dashboard');
    }
  }, [perfil, activeView]);

  useEffect(() => {
    const handleOpenFormulario = (event: any) => {
      const tipoModulo = event.detail?.tipoModulo || 'dropship';
      setTipoModuloActual(tipoModulo);
      setShowFormulario(true);
    };

    const handleNavigateTo = (event: any) => {
      const view = event.detail?.view;
      if (view) setActiveView(view);
    };

    window.addEventListener('openFormularioExpediente', handleOpenFormulario);
    window.addEventListener('navigateTo', handleNavigateTo);

    return () => {
      window.removeEventListener('openFormularioExpediente', handleOpenFormulario);
      window.removeEventListener('navigateTo', handleNavigateTo);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleCloseFormulario = () => {
    setShowFormulario(false);
    // Recargar la vista de expedientes si está activa
    if (activeView === 'gestion-dropship' || activeView === 'gestion-zf') {
      setRefreshExpedientes(prev => prev + 1);
    }
  };

  const userRoles = perfil?.roles || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        onLogout={handleLogout}
        userName={perfil?.nombre || user.email || ''}
        userRoles={userRoles}
      />
      
      <div className="flex-1 overflow-auto">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'gestion-dropship' && (
          <GestionExpedientes 
            onNuevoExpediente={() => setShowFormulario(true)}
            refreshTrigger={refreshExpedientes}
            tipoModulo="dropship"
          />
        )}
        {activeView === 'gestion-zf' && (
          <GestionExpedientes 
            onNuevoExpediente={() => setShowFormulario(true)}
            refreshTrigger={refreshExpedientes}
            tipoModulo="zf"
          />
        )}
        {activeView === 'lista-expedientes' && <ListaExpedientes />}
        {activeView === 'reportes' && <Reportes />}
        {activeView === 'carga-masiva' && <CargaMasiva />}
        {activeView === 'configuracion' && <Configuracion />}
        {activeView === 'carga-caa' && <CargaDocumentosCAA />}
        {activeView === 'documentacion' && <Documentacion />}
        {activeView === 'repositorio' && <RepositorioDocumentacion />}
      </div>

      {showFormulario && (
        <FormularioExpediente 
          onClose={handleCloseFormulario} 
          tipoModulo={tipoModuloActual}
        />
      )}
    </div>
  );
}
