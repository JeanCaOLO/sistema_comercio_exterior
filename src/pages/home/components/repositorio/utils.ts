import type { RegistroRepositorio } from '@/pages/home/components/repositorio/types';

export const colorEstado = (estado: string): string => {
  switch (estado) {
    case 'No Asignado': return 'bg-gray-400';
    case 'Nuevo': return 'bg-blue-500';
    case 'Asignado': return 'bg-purple-500';
    case 'En Proceso': return 'bg-orange-500';
    case 'En Revisión': return 'bg-yellow-500';
    case 'Recepción de Carga': return 'bg-indigo-500';
    case 'Facturación': return 'bg-pink-500';
    case 'Completado': return 'bg-emerald-500';
    case 'Arribo de Carga': return 'bg-cyan-500';
    case 'Pendiente Proforma': return 'bg-violet-500';
    case 'Espera de Respuesta': return 'bg-amber-400';
    case 'Liberación': return 'bg-green-500';
    case 'Notificado': return 'bg-lime-500';
    case 'Visto Listo': return 'bg-rose-500';
    case 'Documentación': return 'bg-amber-600';
    default: return 'bg-gray-500';
  }
};

export const formatearFecha = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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

/**
 * Quién cargó realmente los documentos:
 * - En documentos_caa (staging) el responsable_creacion ES quien subió los docs.
 * - En expedientes el responsable_creacion es el RESPONSABLE ASIGNADO;
 *   el cargador real vive en cargador_documentos (inmutable desde la consolidación).
 */
export const obtenerCargador = (registro: RegistroRepositorio): string => {
  if (registro.origen === 'expediente') {
    return registro.cargador_documentos || registro.responsable_creacion || 'Sistema';
  }
  return registro.responsable_creacion || 'Sistema';
};

export const nombreArchivo = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    const rawName = segments[segments.length - 1] || 'documento';
    const underscoreIdx = rawName.indexOf('_');
    if (underscoreIdx > 0 && /^\d{13}_/.test(rawName)) {
      return decodeURIComponent(rawName.substring(underscoreIdx + 1));
    }
    return decodeURIComponent(rawName);
  } catch {
    return 'documento';
  }
};

export const iconoArchivo = (url: string) => {
  const name = nombreArchivo(url).toLowerCase();
  if (name.endsWith('.pdf')) return { icon: 'ri-file-pdf-line', color: 'text-red-500', bg: 'bg-red-50' };
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) return { icon: 'ri-file-excel-line', color: 'text-green-500', bg: 'bg-green-50' };
  if (name.endsWith('.csv')) return { icon: 'ri-file-text-line', color: 'text-teal-500', bg: 'bg-teal-50' };
  if (name.endsWith('.doc') || name.endsWith('.docx')) return { icon: 'ri-file-word-line', color: 'text-sky-500', bg: 'bg-sky-50' };
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.gif') || name.endsWith('.bmp')) {
    return { icon: 'ri-image-line', color: 'text-orange-500', bg: 'bg-orange-50' };
  }
  return { icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50' };
};

export const esImagen = (url: string): boolean => {
  const extension = nombreArchivo(url).split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension);
};

export const descargarArchivo = async (url: string, fileName: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al descargar');
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
};