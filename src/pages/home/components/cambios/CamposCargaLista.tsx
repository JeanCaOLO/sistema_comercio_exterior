import { formatearFechaCorta } from '@/lib/fechas';
import { normalizarFecha, type CampoDetectado } from '@/lib/ragaApi';

// Nombre técnico con el que la PO expone cada dato. Solo se usa como
// respaldo cuando la respuesta no devuelve esa columna.
export const CLAVE_ESTANDAR_CARGA_LISTA: Record<string, string> = {
  teorica: 'date_theorical_load',
  variable: 'date_variable_date',
};

export type PropuestasCargaLista = Record<string, string>;

export function claveCargaLista(campo: CampoDetectado): string {
  return campo.clave || CLAVE_ESTANDAR_CARGA_LISTA[campo.id] || '';
}

// Valor legible del dato: fecha corta o Sí / No para el flag.
export function formatearValorCargaLista(valor: string, esBooleano: boolean): string {
  const texto = (valor || '').trim();
  if (!texto) return 'Sin valor';
  if (esBooleano || /^(true|false)$/i.test(texto)) {
    if (/^true$/i.test(texto)) return 'Sí';
    if (/^false$/i.test(texto)) return 'No';
    return 'Sin valor';
  }
  const fecha = normalizarFecha(texto);
  if (fecha) return formatearFechaCorta(fecha);
  return texto;
}

function valorComparable(valor: string, esBooleano: boolean): string {
  const texto = (valor || '').trim();
  if (!texto) return '';
  if (esBooleano || /^(true|false)$/i.test(texto)) return texto.toLowerCase();
  return normalizarFecha(texto) || texto;
}

interface ListaValoresProps {
  campos: CampoDetectado[];
}

// Tarjeta de solo lectura: lo que hoy tiene la PO.
export function ListaValoresCargaLista({ campos }: ListaValoresProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase">Valores actuales de la orden</p>
        <span className="text-[11px] text-gray-400">Solo lectura</span>
      </div>
      <div className="divide-y divide-gray-100">
        {campos.map((c) => {
          const esBooleano = c.tipo === 'booleano';
          return (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">{c.etiqueta}</p>
                  <p
                    className={`mt-0.5 text-sm font-bold break-words ${
                      esBooleano && /^true$/i.test((c.valor || '').trim())
                        ? 'text-emerald-700'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatearValorCargaLista(c.valor, esBooleano)}
                  </p>
                </div>
                {!c.clave && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <i className="ri-question-line"></i>
                    No viene en la PO
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-4 py-2.5 border-t border-gray-100 text-[11px] text-gray-500">
        <i className="ri-information-line mr-1"></i>
        Estos son los datos que hoy tiene la PO. Abajo indicás cuáles querés cambiar.
      </p>
    </div>
  );
}

interface EditorProps {
  campos: CampoDetectado[];
  propuestas: PropuestasCargaLista;
  onCambiar: (id: string, valor: string) => void;
}

// Editor múltiple: cada dato se puede dejar vacío (sin cambio) o completar
// con el valor propuesto. Se pueden proponer varios cambios a la vez.
export function EditorPropuestasCargaLista({ campos, propuestas, onCambiar }: EditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-800">Propuesta de cambio</p>
        <span className="text-[11px] text-gray-500">Completá solo los datos que querés cambiar</span>
      </div>

      {campos.map((c) => {
        const esBooleano = c.tipo === 'booleano';
        const propuesta = propuestas[c.id] || '';
        const actual = formatearValorCargaLista(c.valor, esBooleano);
        const hayCambio = Boolean(
          propuesta.trim()
          && valorComparable(propuesta, esBooleano) !== valorComparable(c.valor, esBooleano)
        );
        const mismoValor = Boolean(
          propuesta.trim()
          && valorComparable(propuesta, esBooleano) === valorComparable(c.valor, esBooleano)
        );

        return (
          <div
            key={c.id}
            className={`rounded-lg border px-4 py-3 transition-colors ${
              hayCambio ? 'border-teal-300 bg-teal-50/60' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-800">{c.etiqueta}</p>
              <p className="text-xs text-gray-500">
                Actual: <span className="font-semibold text-gray-800">{actual}</span>
              </p>
            </div>

            <div className="mt-2">
              {esBooleano ? (
                <select
                  value={propuesta}
                  onChange={(e) => onCambiar(c.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer bg-white"
                >
                  <option value="">Sin cambio</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type="date"
                  value={propuesta}
                  onChange={(e) => onCambiar(c.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer bg-white"
                />
              )}
            </div>

            {hayCambio && (
              <p className="mt-1.5 text-xs text-teal-700">
                <i className="ri-arrow-right-line mr-1"></i>
                Cambio: {actual} → {formatearValorCargaLista(propuesta, esBooleano)}
              </p>
            )}
            {mismoValor && (
              <p className="mt-1.5 text-xs text-amber-700">
                <i className="ri-information-line mr-1"></i>
                Ya es el valor actual. Elegí otro o dejalo vacío.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}