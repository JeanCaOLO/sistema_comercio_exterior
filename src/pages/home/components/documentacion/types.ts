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
  // Etapa y fechas del embarque que se sincronizan desde Raga cada 2 horas.
  etapa?: string | null;
  etd?: string | null;
  atd?: string | null;
  raga_sync_at?: string | null;
  doc: string | string[] | null;
  created_at: string;
  responsable_creacion: string;
}

export type FiltroRapido = 'todos' | 'con-factura' | 'con-contenedor' | 'sin-packing' | 'antiguos' | 'listos';

export type ModuloDestino = 'dropship' | 'zf';

export interface FiltrosDocumentacion {
  searchPO: string;
  filtroRuta: string;
  filtroEtapa: string;
  filtroRapido: FiltroRapido;
}