import {
  CAMPOS_FECHA,
  CAMPOS_REGLA,
  formatearEntero,
  formatearFecha,
  type CampoFecha,
  type ResultadoControl,
} from '@/lib/controlFechas';
import TablaSimple from './TablaSimple';

interface PanelHallazgosProps {
  resultado: ResultadoControl;
  tabActiva: string;
  onTab: (tab: string) => void;
}

function celdaFecha(iso: string | null, marcar?: 'falta' | 'sobra') {
  if (marcar) {
    return (
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
          marcar === 'falta' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
        }`}
      >
        {marcar === 'falta' ? (formatearFecha(iso) ? `${formatearFecha(iso)} (falta)` : 'falta') : `${formatearFecha(iso)} (sobra)`}
      </span>
    );
  }
  return (
    <span className={`font-mono text-xs ${iso ? 'text-gray-700' : 'text-gray-300'}`}>
      {formatearFecha(iso) || '—'}
    </span>
  );
}

export default function PanelHallazgos({ resultado, tabActiva, onTab }: PanelHallazgosProps) {
  const diferencias = resultado.controlEtapa.filter((item) => !item.ok);

  const tabs = [
    { id: 'a', label: '2a · Fechas faltantes', total: resultado.faltantes.length },
    { id: 'b', label: '2b · ETD vencido', total: resultado.etdVencido.length },
    { id: 'c', label: '2c · ETA vencida', total: resultado.etaVencido.length },
    { id: 'e', label: '3 · Control por etapa', total: diferencias.length },
    { id: 'f', label: '4 · ATA menor a ATD', total: resultado.ataMenorAtd.length },
  ];

  const encabezadoBase = ['Etapa', 'PO', 'Proveedor', 'Naviera', 'Contenedor'];

  const fechasFaltantes = resultado.faltantes.map((item) => [
    item.po.etapa,
    <span className="font-mono text-xs text-gray-800">{item.po.po}</span>,
    <span className="max-w-[240px] truncate block" title={item.po.proveedor}>{item.po.proveedor || '—'}</span>,
    item.po.naviera || '—',
    <span className="font-mono text-xs">{item.po.contenedor}</span>,
    ...CAMPOS_FECHA.map((campo) => celdaFecha(item.po.fechas[campo])),
    <span className="inline-block rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[11px] font-semibold">
      {item.faltantes.join(', ')}
    </span>,
  ]);

  const fechasEtd = resultado.etdVencido.map((item) => [
    item.po.etapa,
    <span className="font-mono text-xs text-gray-800">{item.po.po}</span>,
    <span className="max-w-[240px] truncate block" title={item.po.proveedor}>{item.po.proveedor || '—'}</span>,
    item.po.naviera || '—',
    <span className="font-mono text-xs">{item.po.contenedor}</span>,
    ...CAMPOS_FECHA.map((campo) => celdaFecha(item.po.fechas[campo], campo === 'ETD Variable' ? 'falta' : undefined)),
    <span className="font-bold text-orange-700">{item.dias}</span>,
  ]);

  const fechasEta = resultado.etaVencido.map((item) => [
    item.po.etapa,
    <span className="font-mono text-xs text-gray-800">{item.po.po}</span>,
    <span className="max-w-[240px] truncate block" title={item.po.proveedor}>{item.po.proveedor || '—'}</span>,
    item.po.naviera || '—',
    <span className="font-mono text-xs">{item.po.contenedor}</span>,
    ...CAMPOS_FECHA.map((campo) => celdaFecha(item.po.fechas[campo], campo === 'ETA Variable' ? 'falta' : undefined)),
    <span className="font-bold text-rose-700">{item.dias}</span>,
  ]);

  const controlEtapa = diferencias.map((item) => [
    item.po.etapa,
    <span className="font-mono text-xs text-gray-800">{item.po.po}</span>,
    <span className="max-w-[220px] truncate block" title={item.po.proveedor}>{item.po.proveedor || '—'}</span>,
    item.po.naviera || '—',
    <span className="font-mono text-xs">{item.po.contenedor}</span>,
    ...CAMPOS_REGLA.map((campo: CampoFecha) =>
      celdaFecha(
        item.po.fechas[campo],
        item.faltantes.includes(campo) ? 'falta' : item.sobrantes.includes(campo) ? 'sobra' : undefined
      )
    ),
    <span className="inline-block rounded bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[11px] font-semibold">
      {item.resultado}
    </span>,
  ]);

  const ataMenor = resultado.ataMenorAtd.map((item) => [
    item.po.etapa,
    <span className="font-mono text-xs text-gray-800">{item.po.po}</span>,
    <span className="max-w-[240px] truncate block" title={item.po.proveedor}>{item.po.proveedor || '—'}</span>,
    item.po.naviera || '—',
    <span className="font-mono text-xs">{item.po.contenedor}</span>,
    ...CAMPOS_FECHA.map((campo) =>
      celdaFecha(item.po.fechas[campo], campo === 'ATD' || campo === 'ATA' ? 'falta' : undefined)
    ),
    <span className="font-bold text-teal-800">{item.dias}</span>,
  ]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-wrap gap-1 px-4 pt-3 border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              tabActiva === tab.id
                ? 'border-teal-600 text-gray-900 bg-teal-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-[11px] font-semibold ${tabActiva === tab.id ? 'text-teal-700' : 'text-gray-400'}`}>
              {formatearEntero(tab.total)}
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {tabActiva === 'a' && (
          <TablaSimple
            encabezados={[...encabezadoBase, ...CAMPOS_FECHA, 'Campos faltantes']}
            filas={fechasFaltantes}
            vacio="Todas las POs con contenedor y naviera tienen sus cuatro fechas ETD/ETA."
          />
        )}

        {tabActiva === 'b' && (
          <>
            <TablaSimple
              encabezados={[...encabezadoBase, ...CAMPOS_FECHA, 'Días vencido']}
              filas={fechasEtd}
              vacio="Ninguna PO tiene el ETD Variable vencido con este corte."
            />
            <p className="text-[11px] text-gray-500">
              Se consideran vencidas las POs con ETD Variable igual o anterior a {formatearFecha(resultado.limite)}
              {resultado.excluirReales ? ', sin ATD registrado.' : ', con o sin ATD registrado.'}
            </p>
          </>
        )}

        {tabActiva === 'c' && (
          <>
            <TablaSimple
              encabezados={[...encabezadoBase, ...CAMPOS_FECHA, 'Días vencido']}
              filas={fechasEta}
              vacio="Ninguna PO tiene el ETA Variable vencido con este corte."
            />
            <p className="text-[11px] text-gray-500">
              Se consideran vencidas las POs con ETA Variable igual o anterior a {formatearFecha(resultado.limite)}
              {resultado.excluirReales ? ', sin ATA registrado.' : ', con o sin ATA registrado.'}
            </p>
          </>
        )}

        {tabActiva === 'e' && (
          <>
            <div className="flex flex-wrap gap-2">
              {resultado.porEtapa.map((fila) => (
                <span
                  key={fila.etapa}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    fila.diferencias > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {fila.etapa}: {fila.diferencias} / {fila.total}
                </span>
              ))}
            </div>
            <TablaSimple
              encabezados={[...encabezadoBase, ...CAMPOS_REGLA, 'Resultado']}
              filas={controlEtapa}
              vacio="Todas las POs tienen las fechas que corresponden a su etapa."
            />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Solo se muestran las POs con hallazgos, igual que en el Excel. Amarillo = fecha que falta, rojo = fecha
              que sobra. En Booking sin naviera, la falta de ETD Variable no se marca como error.
              {resultado.etapasSinRegla.length > 0 && (
                <> Etapas sin regla (no evaluadas): {resultado.etapasSinRegla.map((f) => `${f.etapa} (${f.total})`).join(', ')}.</>
              )}
            </p>
          </>
        )}

        {tabActiva === 'f' && (
          <>
            <TablaSimple
              encabezados={[...encabezadoBase, ...CAMPOS_FECHA, 'Días (ATD − ATA)']}
              filas={ataMenor}
              vacio="No hay POs con arribo real anterior al zarpe real."
            />
            <p className="text-[11px] text-gray-500">
              POs cuya fecha de arribo real (ATA) es anterior a su fecha de zarpe real (ATD).
            </p>
          </>
        )}
      </div>
    </div>
  );
}