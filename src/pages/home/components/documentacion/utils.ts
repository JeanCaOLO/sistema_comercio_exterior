import { calcularRequisitos } from '@/pages/home/components/DocumentosBadges';
import type { DocumentoCAA, FiltrosDocumentacion } from '@/pages/home/components/documentacion/types';

export const contarDocumentos = (doc: string | string[] | null): number => {
  if (!doc) return 0;
  if (Array.isArray(doc)) return doc.length;
  try {
    const parsed = JSON.parse(doc);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return doc.trim() ? 1 : 0;
  }
};

export const formatearFecha = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const filtrarDocumentos = (
  documentos: DocumentoCAA[],
  { searchPO, filtroRuta, filtroRapido }: FiltrosDocumentacion
): DocumentoCAA[] => {
  const term = searchPO.trim().toLowerCase();

  return documentos.filter((doc) => {
    if (term) {
      const coincide =
        (doc.po_tiquetera && doc.po_tiquetera.toLowerCase().includes(term)) ||
        (doc.solicitante && doc.solicitante.toLowerCase().includes(term)) ||
        (doc.responsable_creacion && doc.responsable_creacion.toLowerCase().includes(term));
      if (!coincide) return false;
    }

    if (filtroRuta && doc.tipo_po !== filtroRuta) return false;

    if (filtroRapido !== 'todos') {
      const req = calcularRequisitos({
        doc: doc.doc,
        blCargado: doc.bl_cargado,
        packingListCargado: doc.packing_list_cargado,
        numeroContenedor: doc.numero_contenedor,
      });
      if (filtroRapido === 'con-factura' && !req.factura) return false;
      if (filtroRapido === 'con-contenedor' && !req.contenedor) return false;
      if (filtroRapido === 'sin-packing' && req.packingList) return false;
    }

    return true;
  });
};

export const rutasDeDocumentos = (documentos: DocumentoCAA[]): string[] =>
  [...new Set(documentos.map((doc) => doc.tipo_po).filter(Boolean))].sort();

export const paginar = <T,>(items: T[], pagina: number, porPagina: number) => {
  const totalPaginas = Math.ceil(items.length / porPagina);
  const paginaSegura = Math.min(pagina, Math.max(1, totalPaginas));
  const visibles = items.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);
  return {
    totalPaginas,
    paginaSegura,
    visibles,
    inicio: items.length > 0 ? (paginaSegura - 1) * porPagina + 1 : 0,
    fin: Math.min(paginaSegura * porPagina, items.length),
  };
};