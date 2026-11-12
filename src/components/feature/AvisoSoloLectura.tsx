interface AvisoSoloLecturaProps {
  /** Texto adicional que explica qué no se puede hacer en esta pantalla. */
  detalle?: string;
  className?: string;
}

/**
 * Banda informativa para los usuarios con rol Cliente Consulta.
 * Recuerda que el acceso es únicamente de lectura.
 */
export default function AvisoSoloLectura({ detalle, className = '' }: AvisoSoloLecturaProps) {
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 ${className}`}
    >
      <span className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg bg-sky-100 flex-shrink-0">
        <i className="ri-eye-line text-sky-700 text-base"></i>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sky-900">Modo consulta</p>
        <p className="text-xs text-sky-700 mt-0.5">
          {detalle ||
            'Tu rol permite únicamente visualizar la información. Las acciones de crear, editar, eliminar, aprobar y subir archivos están deshabilitadas.'}
        </p>
      </div>
    </div>
  );
}