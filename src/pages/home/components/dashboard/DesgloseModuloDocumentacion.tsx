interface DesgloseModuloDocumentacionProps {
  dropship: number;
  zf: number;
  ticket: number;
  bandeja: number;
}

const items = [
  { clave: 'dropship', icono: 'ri-truck-line', etiqueta: 'Dropship' },
  { clave: 'zf', icono: 'ri-earth-line', etiqueta: 'Zona Franca' },
  { clave: 'ticket', icono: 'ri-ticket-2-line', etiqueta: 'Vía ticket creado' },
  { clave: 'bandeja', icono: 'ri-inbox-line', etiqueta: 'Vía bandeja' }
] as const;

export default function DesgloseModuloDocumentacion({
  dropship,
  zf,
  ticket,
  bandeja
}: DesgloseModuloDocumentacionProps) {
  const valores: Record<(typeof items)[number]['clave'], number> = { dropship, zf, ticket, bandeja };

  return (
    <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.clave} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <i className={`${item.icono} text-gray-500`}></i>
              <span className="text-xs font-semibold text-gray-700 truncate">{item.etiqueta}</span>
            </div>
            <span className="text-xs font-bold text-gray-800 whitespace-nowrap">{valores[item.clave]} PO</span>
          </div>
        </div>
      ))}
    </div>
  );
}