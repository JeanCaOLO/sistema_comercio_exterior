import { useAuth } from '@/contexts/AuthContext';
import { esSoloLectura } from '@/lib/permisos';

/**
 * Indica si el usuario actual está en modo consulta (rol Cliente Consulta).
 * En ese caso solo puede visualizar la información: no crea, edita, elimina,
 * aprueba ni sube archivos.
 */
export function useSoloLectura(): boolean {
  const { perfil } = useAuth();
  return esSoloLectura(perfil?.roles || []);
}

export default useSoloLectura;