import { useEffect, useState } from 'react';
import type { ResultadoComparacion } from '@/lib/comparadorDocumentos';
import {
  descargarReportePdf,
  nombreReportePdf,
  textoCorreoProveedor,
} from '@/lib/reporteComparadorPdf';

interface PanelEnviarProveedorProps {
  abierto: boolean;
  onCerrar: () => void;
  resultado: ResultadoComparacion;
  factura: string;
  po: string;
}

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function PanelEnviarProveedor({
  abierto,
  onCerrar,
  resultado,
  factura,
  po,
}: PanelEnviarProveedorProps) {
  const [correo, setCorreo] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [descargado, setDescargado] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) {
      setError(null);
      setDescargado(null);
    }
  }, [abierto]);

  if (!abierto) return null;

  const params = {
    resultado,
    factura,
    po,
    proveedor: proveedor.trim() || undefined,
    mensaje,
  };
  const { asunto, cuerpo } = textoCorreoProveedor(params);
  const archivo = nombreReportePdf(params);
  const correoOk = !correo.trim() || CORREO_VALIDO.test(correo.trim());
  const destino = correoOk && correo.trim() ? correo.trim() : '';
  const href = `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

  const preparar = () => {
    if (!correoOk) {
      setError('Revisá el correo del proveedor (parece incompleto).');
      return;
    }
    setError(null);
    try {
      const nombre = descargarReportePdf(params);
      setDescargado(nombre);
    } catch {
      setError('No se pudo generar el PDF. Probá de nuevo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <header className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
            <i className="ri-mail-send-line text-lg"></i>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Enviar el reporte al proveedor</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Se descarga el PDF y se abre tu correo con el mensaje listo para adjuntarlo.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
            title="Cerrar"
          >
            <i className="ri-close-line"></i>
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Proveedor
              </label>
              <input
                type="text"
                value={proveedor}
                onChange={(event) => setProveedor(event.target.value)}
                placeholder="Nombre del proveedor"
                className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-2 bg-white text-gray-800"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Correo del proveedor
              </label>
              <input
                type="email"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                placeholder="compras@proveedor.com"
                className={`w-full text-sm border rounded-md px-2.5 py-2 bg-white text-gray-800 ${
                  correoOk ? 'border-gray-300' : 'border-red-300'
                }`}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Mensaje (opcional)
            </label>
            <textarea
              value={mensaje}
              onChange={(event) => setMensaje(event.target.value.slice(0, 600))}
              rows={3}
              maxLength={600}
              placeholder="Hola, adjuntamos las diferencias encontradas entre su factura y nuestro pedido."
              className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-2 bg-white text-gray-800 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">{mensaje.length}/600</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-start gap-2">
            <i className="ri-file-pdf-2-line text-red-500 mt-0.5"></i>
            <div className="min-w-0">
              <p className="text-xs text-gray-700 break-all">{archivo}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Incluye resumen, hallazgos y la comparación completa.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-start gap-1.5">
              <i className="ri-error-warning-line mt-0.5"></i>
              <span>{error}</span>
            </p>
          )}
          {descargado && !error && (
            <p className="text-xs text-emerald-700 flex items-start gap-1.5">
              <i className="ri-checkbox-circle-line mt-0.5"></i>
              <span>PDF descargado: {descargado}. Adjuntalo en el correo que se abre.</span>
            </p>
          )}
        </div>

        <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60">
          <button
            type="button"
            onClick={onCerrar}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={preparar}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-teal-300 rounded-lg text-sm font-medium text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-download-2-line"></i>
            Solo descargar PDF
          </button>
          <a
            href={correoOk ? href : undefined}
            onClick={() => preparar()}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              correoOk
                ? 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <i className="ri-mail-send-line"></i>
            Descargar y abrir correo
          </a>
        </footer>
      </div>
    </div>
  );
}