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

/** Fecha sin hora (para el ETD de la bandeja). Acepta YYYY-MM-DD o ISO. */
export const formatearFechaCorta = (valor?: string | null): string => {
  const texto = (valor || '').trim();
  if (!texto) return '';
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  const fecha = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(texto);
  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/** Hace cuánto se sincronizó con Raga, en texto corto. */
export const tiempoDesdeSincronizacion = (valor?: string | null): string => {
  const texto = (valor || '').trim();
  if (!texto) return 'Sin sincronizar';
  const t = new Date(texto).getTime();
  if (isNaN(t)) return 'Sin sincronizar';
  const minutos = Math.floor((Date.now() - t) / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} d`;
};

export type NivelBandeja = 'ok' | 'atencion' | 'critico';

/** Días completos que un registro lleva esperando consolidarse en la bandeja */
export const diasEnBandeja = (createdAt?: string | null): number => {
  if (!createdAt) return 0;
  const inicio = new Date(createdAt).getTime();
  if (isNaN(inicio)) return 0;
  const dif = Date.now() - inicio;
  if (dif <= 0) return 0;
  return Math.floor(dif / 86400000);
};

/**
 * Semáforo de antigüedad en bandeja:
 * - ok: hasta 3 días (al día)
 * - atencion: 4 a 7 días (revisar)
 * - critico: más de 7 días sin consolidar
 */
export const nivelBandeja = (dias: number): NivelBandeja => {
  if (dias > 7) return 'critico';
  if (dias >= 4) return 'atencion';
  return 'ok';
};

export const filtrarDocumentos = (
  documentos: DocumentoCAA[],
  { searchPO, filtroRuta, filtroEtapa, filtroRapido }: FiltrosDocumentacion
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

    if (filtroEtapa && (doc.etapa || '').trim() !== filtroEtapa) return false;

    if (filtroRapido !== 'todos') {
      if (filtroRapido === 'antiguos' && diasEnBandeja(doc.created_at) <= 7) return false;
      if (filtroRapido === 'listos' && !estaListoParaConsolidar(doc)) return false;

      if (filtroRapido !== 'antiguos' && filtroRapido !== 'listos') {
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
    }

    return true;
  });
};

export const rutasDeDocumentos = (documentos: DocumentoCAA[]): string[] =>
  [...new Set(documentos.map((doc) => doc.tipo_po).filter(Boolean))].sort();

/** Etapas presentes en la bandeja, para el filtro por etapa. */
export const etapasDeDocumentos = (documentos: DocumentoCAA[]): string[] =>
  [...new Set(documentos.map((doc) => (doc.etapa || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

/**
 * Un registro está listo para consolidar cuando ya tiene los tres documentos
 * clave: factura, packing list y BL. Esos son los que hay que empujar primero
 * para que no sigan esperando en la bandeja.
 */
export const estaListoParaConsolidar = (doc: DocumentoCAA): boolean => {
  const req = calcularRequisitos({
    doc: doc.doc,
    blCargado: doc.bl_cargado,
    packingListCargado: doc.packing_list_cargado,
    numeroContenedor: doc.numero_contenedor,
  });
  return req.factura && req.packingList && req.bl;
};

export const contarListosParaConsolidar = (documentos: DocumentoCAA[]): number =>
  documentos.filter(estaListoParaConsolidar).length;

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