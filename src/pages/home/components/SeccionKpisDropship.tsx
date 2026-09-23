import PanelIndicador, { TonoIndicador, BadgeIndicador } from './PanelIndicador';
import TarjetaDesglose from './TarjetaDesglose';

interface KpiEtdNotificado {
  totalEvaluados: number;
  dentroRango: number;
  fueraRango: number;
  porcentajeOk: number;
  promedioDias: number;
}

interface SeccionKpisDropshipProps {
  kpiEtdNotificado: KpiEtdNotificado;
  metaEtdDias: number;
  onVerDetalleEtd: () => void;
  notificadoOkPais: number;
  totalEntregados: number;
  transitoCorto: number;
  totalDropship: number;
  expedientesSinEtd: number;
  onVerDetalleSinEtd: () => void;
}

export default function SeccionKpisDropship({
  kpiEtdNotificado,
  metaEtdDias,
  onVerDetalleEtd,
  notificadoOkPais,
  totalEntregados,
  transitoCorto,
  totalDropship,
  expedientesSinEtd,
  onVerDetalleSinEtd
}: SeccionKpisDropshipProps) {
  const etd = kpiEtdNotificado;

  const tonoEtd: TonoIndicador =
    etd.totalEvaluados === 0
      ? 'gray'
      : etd.porcentajeOk >= 80
      ? 'teal'
      : etd.porcentajeOk >= 50
      ? 'amber'
      : 'red';

  const colorPct =
    tonoEtd === 'teal'
      ? 'text-teal-600'
      : tonoEtd === 'amber'
      ? 'text-amber-600'
      : tonoEtd === 'gray'
      ? 'text-gray-400'
      : 'text-red-600';

  const colorBarra =
    tonoEtd === 'teal' ? 'bg-teal-500' : tonoEtd === 'amber' ? 'bg-amber-500' : 'bg-red-500';

  const badgeEtd: BadgeIndicador | null =
    etd.totalEvaluados > 0
      ? etd.fueraRango > 0
        ? {
            tono: 'alerta',
            texto: `${etd.fueraRango} expediente${etd.fueraRango !== 1 ? 's' : ''} fuera de rango`,
            subtexto: `Meta: ≤ ${metaEtdDias} días hábiles`
          }
        : { tono: 'ok', texto: 'Todo en orden', subtexto: '100% cumple la meta' }
      : null;

  const pctOkPais =
    totalEntregados > 0 ? Math.min(100, Math.round((notificadoOkPais / totalEntregados) * 100)) : 0;
  const pendientesOkPais = Math.max(0, totalEntregados - notificadoOkPais);

  return (
    <>
      {/* =========== KPIs de Expedientes Dropship =========== */}
      <PanelIndicador
        icono="ri-checkbox-circle-line"
        tono="amber"
        titulo="KPIs de Expedientes Dropship"
        meta="Indicadores clave para expedientes Dropship"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TarjetaDesglose
            etiqueta="Entregados con OK País"
            valor={notificadoOkPais}
            sufijo="exp."
            valorClass="text-green-600"
            barra={{ porcentaje: pctOkPais, colorClass: 'bg-green-500' }}
            footer={`${pctOkPais}% de ${totalEntregados} entregados en el período`}
          />

          <TarjetaDesglose
            etiqueta="Tránsito Corto"
            valor={transitoCorto}
            sufijo="exp."
            valorClass="text-amber-600"
            linea={{ icono: 'ri-speed-line', texto: 'Dropship con tránsito corto', colorClass: 'text-amber-700' }}
            footer={`Del total de ${totalDropship} expedientes Dropship`}
          />

          <TarjetaDesglose
            etiqueta="Pendientes de OK País"
            valor={pendientesOkPais}
            sufijo="exp."
            valorClass="text-orange-600"
            linea={{ icono: 'ri-hourglass-line', texto: 'Entregados sin marca de cierre', colorClass: 'text-orange-700' }}
            footer='Requieren marca de cierre "OK País"'
          />
        </div>
      </PanelIndicador>

      {/* =========== ETD → Notificado (Dropship) =========== */}
      <PanelIndicador
        icono="ri-ship-line"
        tono={tonoEtd}
        titulo="ETD → Notificado"
        meta={<>Meta: ≤ {metaEtdDias} días hábiles entre ETD y Notificado (Dropship)</>}
        badge={badgeEtd}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: onVerDetalleEtd,
          disabled: etd.totalEvaluados === 0
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <TarjetaDesglose
            etiqueta="Cumplimiento Global"
            valor={etd.porcentajeOk}
            sufijo="%"
            valorClass={colorPct}
            barra={{ porcentaje: etd.porcentajeOk, colorClass: colorBarra }}
            footer={`${etd.totalEvaluados} expedientes evaluados`}
          />

          <TarjetaDesglose
            etiqueta="Dentro del Rango"
            valor={etd.dentroRango}
            sufijo="exp."
            valorClass="text-teal-600"
            linea={{ icono: 'ri-checkbox-circle-fill', texto: `≤ ${metaEtdDias} días`, colorClass: 'text-teal-700' }}
            footer="Cumple la meta"
          />

          <TarjetaDesglose
            etiqueta="Fuera del Rango"
            valor={etd.fueraRango}
            sufijo="exp."
            valorClass={etd.fueraRango > 0 ? 'text-red-600' : 'text-gray-400'}
            linea={{
              icono: 'ri-error-warning-fill',
              texto: `> ${metaEtdDias} días`,
              colorClass: etd.fueraRango > 0 ? 'text-red-700' : 'text-gray-400'
            }}
            nota="Haz clic para ver el detalle"
            resaltado={etd.fueraRango > 0}
            onClick={onVerDetalleEtd}
          />

          <TarjetaDesglose
            etiqueta="Promedio"
            valor={etd.promedioDias}
            sufijo="días"
            valorClass="text-gray-800"
            linea={{ icono: 'ri-bar-chart-box-line', texto: 'Promedio del período', colorClass: 'text-gray-600' }}
            footer={`Meta: ≤ ${metaEtdDias} días hábiles`}
          />

          <TarjetaDesglose
            etiqueta="Sin ETD"
            valor={expedientesSinEtd}
            sufijo="exp."
            valorClass={expedientesSinEtd > 0 ? 'text-amber-600' : 'text-gray-400'}
            fondoClass={expedientesSinEtd > 0 ? 'bg-amber-50/70' : 'bg-white'}
            linea={{
              icono: 'ri-calendar-line',
              texto: 'Aún sin fecha ETD',
              colorClass: expedientesSinEtd > 0 ? 'text-amber-700' : 'text-gray-400'
            }}
            nota={expedientesSinEtd > 0 ? 'Haz clic para ver cuáles' : 'Todas las POs tienen ETD'}
            notaClass={expedientesSinEtd > 0 ? 'text-amber-700' : 'text-gray-400'}
            onClick={expedientesSinEtd > 0 ? onVerDetalleSinEtd : undefined}
          />
        </div>
      </PanelIndicador>
    </>
  );
}