import PanelIndicador, { BadgeIndicador } from './PanelIndicador';
import TarjetaDesglose from './TarjetaDesglose';

interface KpiCreacion {
  totalEvaluados: number;
  cumplen: number;
  noCumplen: number;
  porcentajeCumplimiento: number;
  diasPromedio: number;
}

interface KpiEtd {
  totalEvaluados: number;
  dentroRango: number;
  fueraRango: number;
  porcentajeOk: number;
  promedioDias: number;
}

interface SeccionKpisMcgProps {
  creacion: KpiCreacion;
  etd: KpiEtd;
  metaCreacionDias: number;
  metaEtdDias: number;
  onVerDetalleCreacion: () => void;
  onVerDetalleEtd: () => void;
  disabledCreacion: boolean;
  disabledEtd: boolean;
}

const colorPorcentaje = (pct: number, sinDatos: boolean) => {
  if (sinDatos) return 'text-gray-400';
  if (pct >= 80) return 'text-teal-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-600';
};

const colorBarra = (pct: number) => {
  if (pct >= 80) return 'bg-teal-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
};

export default function SeccionKpisMcg({
  creacion,
  etd,
  metaCreacionDias,
  metaEtdDias,
  onVerDetalleCreacion,
  onVerDetalleEtd,
  disabledCreacion,
  disabledEtd
}: SeccionKpisMcgProps) {
  const sinDatosCreacion = creacion.totalEvaluados === 0;
  const sinDatosEtd = etd.totalEvaluados === 0;

  const badgeCreacion: BadgeIndicador | null = sinDatosCreacion
    ? null
    : creacion.noCumplen > 0
    ? {
        tono: 'alerta',
        texto: `${creacion.noCumplen} expediente${creacion.noCumplen !== 1 ? 's' : ''} fuera de rango`,
        subtexto: `Meta: ≤ ${metaCreacionDias} días hábiles`
      }
    : { tono: 'ok', texto: 'Todo en orden', subtexto: '100% cumple la meta' };

  const badgeEtd: BadgeIndicador | null = sinDatosEtd
    ? null
    : etd.fueraRango > 0
    ? {
        tono: 'alerta',
        texto: `${etd.fueraRango} expediente${etd.fueraRango !== 1 ? 's' : ''} fuera de rango`,
        subtexto: `Meta: < ${metaEtdDias} días hábiles`
      }
    : { tono: 'ok', texto: 'Todo en orden', subtexto: '100% cumple la meta' };

  return (
    <>
      {/* =========== KPIs MCG · Creación de Expediente =========== */}
      <PanelIndicador
        icono="ri-file-add-line"
        tono="indigo"
        titulo="KPIs MCG · Creación de Expediente"
        meta={<>Asignado → liberación · Meta: ≤ {metaCreacionDias} días hábiles (MCG)</>}
        badge={badgeCreacion}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: onVerDetalleCreacion,
          disabled: disabledCreacion
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TarjetaDesglose
            etiqueta="Cumplimiento Global"
            valor={creacion.porcentajeCumplimiento}
            sufijo="%"
            valorClass={colorPorcentaje(creacion.porcentajeCumplimiento, sinDatosCreacion)}
            barra={{ porcentaje: creacion.porcentajeCumplimiento, colorClass: colorBarra(creacion.porcentajeCumplimiento) }}
            footer={`${creacion.totalEvaluados} expedientes evaluados`}
          />

          <TarjetaDesglose
            etiqueta="Cumplen Meta"
            valor={creacion.cumplen}
            sufijo="exp."
            valorClass="text-teal-600"
            linea={{ icono: 'ri-checkbox-circle-fill', texto: `≤ ${metaCreacionDias} días`, colorClass: 'text-teal-700' }}
            footer="Dentro del rango aceptable"
          />

          <TarjetaDesglose
            etiqueta="No Cumplen Meta"
            valor={creacion.noCumplen}
            sufijo="exp."
            valorClass={creacion.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}
            linea={{
              icono: 'ri-error-warning-fill',
              texto: `> ${metaCreacionDias} días`,
              colorClass: creacion.noCumplen > 0 ? 'text-red-700' : 'text-gray-400'
            }}
            nota="Haz clic para ver el detalle"
            resaltado={creacion.noCumplen > 0}
            onClick={onVerDetalleCreacion}
          />

          <TarjetaDesglose
            etiqueta="Duración Promedio"
            valor={creacion.diasPromedio}
            sufijo="días"
            valorClass="text-gray-800"
            linea={{ icono: 'ri-bar-chart-box-line', texto: 'Promedio del período', colorClass: 'text-gray-600' }}
            footer={`Meta: ≤ ${metaCreacionDias} días hábiles`}
          />
        </div>
      </PanelIndicador>

      {/* =========== KPIs MCG · ETD → Notificado =========== */}
      <PanelIndicador
        icono="ri-ship-line"
        tono="indigo"
        titulo="KPIs MCG · ETD → Notificado"
        meta={<>Meta: &lt; {metaEtdDias} días hábiles entre ETD y Notificado (MCG)</>}
        badge={badgeEtd}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: onVerDetalleEtd,
          disabled: disabledEtd
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TarjetaDesglose
            etiqueta="Cumplimiento Global"
            valor={etd.porcentajeOk}
            sufijo="%"
            valorClass={colorPorcentaje(etd.porcentajeOk, sinDatosEtd)}
            barra={{ porcentaje: etd.porcentajeOk, colorClass: colorBarra(etd.porcentajeOk) }}
            footer={`${etd.totalEvaluados} expedientes evaluados`}
          />

          <TarjetaDesglose
            etiqueta="Dentro del Rango"
            valor={etd.dentroRango}
            sufijo="exp."
            valorClass="text-teal-600"
            linea={{ icono: 'ri-checkbox-circle-fill', texto: `< ${metaEtdDias} días`, colorClass: 'text-teal-700' }}
            footer="Cumple la meta"
          />

          <TarjetaDesglose
            etiqueta="Fuera del Rango"
            valor={etd.fueraRango}
            sufijo="exp."
            valorClass={etd.fueraRango > 0 ? 'text-red-600' : 'text-gray-400'}
            linea={{
              icono: 'ri-error-warning-fill',
              texto: `≥ ${metaEtdDias} días`,
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
            footer={`Meta: < ${metaEtdDias} días hábiles`}
          />
        </div>
      </PanelIndicador>
    </>
  );
}