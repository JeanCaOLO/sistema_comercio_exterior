interface BarraDesglose {
  porcentaje: number;
  colorClass: string;
}

interface LineaDesglose {
  icono: string;
  texto: string;
  colorClass: string;
}

interface TarjetaDesgloseProps {
  etiqueta: string;
  valor: number | string;
  sufijo?: string;
  valorClass?: string;
  barra?: BarraDesglose | null;
  linea?: LineaDesglose | null;
  footer?: string;
  nota?: string;
  resaltado?: boolean;
  onClick?: () => void;
}

export default function TarjetaDesglose({
  etiqueta,
  valor,
  sufijo,
  valorClass = 'text-gray-800',
  barra,
  linea,
  footer,
  nota,
  resaltado,
  onClick
}: TarjetaDesgloseProps) {
  const clickeable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-5 border-2 ${
        resaltado ? 'border-red-300' : 'border-gray-200'
      } ${clickeable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <p className="text-xs font-medium text-gray-500 mb-2">{etiqueta}</p>

      <div className="flex items-baseline gap-1">
        <span className={`text-4xl font-bold ${valorClass}`}>{valor}</span>
        {sufijo && <span className="text-lg text-gray-500">{sufijo}</span>}
      </div>

      {barra && (
        <div className="mt-3 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${barra.colorClass}`}
            style={{ width: `${barra.porcentaje}%` }}
          ></div>
        </div>
      )}

      {linea && (
        <div className="flex items-center gap-1 mt-3">
          <i className={`${linea.icono} text-lg ${linea.colorClass}`}></i>
          <span className={`text-xs font-medium ${linea.colorClass}`}>{linea.texto}</span>
        </div>
      )}

      {footer && <p className="text-xs text-gray-500 mt-2">{footer}</p>}
      {nota && <p className="text-xs text-teal-600 mt-1 font-medium">{nota}</p>}
    </div>
  );
}