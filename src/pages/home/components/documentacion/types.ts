export interface DocumentoCAA {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  exp_id?: string | null;
  tipo_modulo: string;
  bl_cargado: boolean;
  numero_bl?: string | null;
  numero_contenedor?: string | null;
  packing_list_cargado?: boolean;
  tc_cargado?: boolean;
  aplica_tlc?: boolean;
  doc: string | string[] | null;
  created_at: string;
  responsable_creacion: string;
}

export type FiltroRapido = 'todos' | 'con-factura' | 'con-contenedor' | 'sin-packing';

export type ModuloDestino = 'dropship' | 'zf';

export interface FiltrosDocumentacion {
  searchPO: string;
  filtroRuta: string;
  filtroRapido: FiltroRapido;
}