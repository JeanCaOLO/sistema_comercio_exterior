// Tipos compartidos de la Lista de Expedientes.
// Se reutiliza el tipo del tablero de Gestión para no duplicar la forma del registro.

export type { Expediente } from '@/pages/home/components/gestion/types';

export interface FiltrosLista {
  searchTerm: string;
  filterPersona: string;
  filterPrioridad: string;
  filterEstado: string;
  filterTipoModulo: string;
}