import { useEffect, useState } from 'react';
import PanelIndicador, { BadgeIndicador, TonoIndicador } from '@/pages/home/components/PanelIndicador';
import TarjetaDesglose from '@/pages/home/components/TarjetaDesglose';
import DesgloseModuloDocumentacion from '@/pages/home/components/dashboard/DesgloseModuloDocumentacion';
import ModalDetalleDocumentos from '@/pages/home/components/dashboard/ModalDetalleDocumentos';
import {
  cargarKpiDocumentacionCompleta,
  RESULTADO_DOCUMENTACION_VACIO,
  type ResultadoDocumentacionCompleta
} from '@/lib/kpisDocumentacion';

export default function KpiDocumentacionCompleta() {
  const [resultado, setResultado] = useState<ResultadoDocumentacionCompleta>(RESULTADO_DOCUMENTACION_VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<'factura' | 'completa' | null>(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await cargarKpiDocumentacionCompleta();
      setResultado(data);
    } catch (err: any) {
      console.error('Error al cargar el indicador de documentación:', err);
      setError(err?.message || 'No se pudo cargar la información de documentación.');
      setResultado(RESULTADO_DOCUMENTACION_VACIO);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sinEtapa = resultado.totalEtapa === 0;
  const sinDatos = sinEtapa || resultado.total === 0;
  const sinCompletas = sinEtapa || resultado.totalCompletas === 0;

  // ── Indicador 1: POs con solo factura ──
  const tono: TonoIndicador = sinEtapa ? 'gray' : resultado.total > 0 ? 'amber' : 'teal';
  const colorPct =
    tono === 'teal' ? 'text-teal-600' : tono === 'gray' ? 'text-gray-400' : 'text-amber-600';
  const colorBarra =
    tono === 'teal' ? 'bg-teal-500' : tono === 'gray' ? 'bg-gray-300' : 'bg-amber-500';

  const badge: BadgeIndicador | null = sinEtapa
    ? null
    : resultado.total > 0
    ? {
        tono: 'alerta',
        texto: `${resultado.total} PO${resultado.total !== 1 ? 's' : ''} solo con factura cargada`,
        subtexto: 'Faltan BL, packing list y contenedor'
      }
    : {
        tono: 'ok',
        texto: 'Ninguna PO con factura sola',
        subtexto: 'Toda la etapa ya tiene otros documentos cargados'
      };

  // ── Indicador 2: POs con todos los documentos listos ──
  const tonoCompletas: TonoIndicador = sinEtapa
    ? 'gray'
    : resultado.totalCompletas > 0
    ? 'teal'
    : 'amber';
  const colorPctCompletas =
    tonoCompletas === 'teal' ? 'text-teal-600' : tonoCompletas === 'gray' ? 'text-gray-400' : 'text-amber-600';
  const colorBarraCompletas =
    tonoCompletas === 'teal' ? 'bg-teal-500' : tonoCompletas === 'gray' ? 'bg-gray-300' : 'bg-amber-500';

  const badgeCompletas: BadgeIndicador | null = sinEtapa
    ? null
    : resultado.totalCompletas > 0
    ? {
        tono: 'ok',
        texto: `${resultado.totalCompletas} PO${resultado.totalCompletas !== 1 ? 's' : ''} con todo listo`,
        subtexto: `${resultado.porcentajeCompletas}% de la etapa documentada`
      }
    : {
        tono: 'alerta',
        texto: 'Ninguna PO con documentación completa',
        subtexto: 'Todavía hay requisitos pendientes en la etapa'
      };

  return (
    <>
      <PanelIndicador
        icono="ri-bill-line"
        tono={tono}
        titulo="POs con Solo Factura Cargada"
        meta={
          <>
            Solo se toman en cuenta las POs en etapa de documentación que tienen la
            <strong> factura cargada y ningún otro documento</strong> (sin BL, sin packing list y sin contenedor),
            <strong> incluyendo las que todavía no generaron expediente</strong>
          </>
        }
        badge={badge}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: () => setDetalle('factura'),
          disabled: sinDatos
        }}
      >
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <i className="ri-error-warning-line text-red-600 text-lg"></i>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={cargar}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Reintentar
            </button>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <span className="text-sm">Buscando estado de la documentación...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <TarjetaDesglose
                etiqueta="% de la Etapa con Factura Sola"
                valor={sinEtapa ? '—' : resultado.porcentajeEtapa}
                sufijo={sinEtapa ? undefined : '%'}
                valorClass={colorPct}
                barra={sinEtapa ? null : { porcentaje: resultado.porcentajeEtapa, colorClass: colorBarra }}
                footer={
                  sinEtapa
                    ? 'No hay POs en etapa de documentación'
                    : `${resultado.total} de ${resultado.totalEtapa} PO${resultado.totalEtapa !== 1 ? 's' : ''} en etapa de documentación`
                }
              />

              <TarjetaDesglose
                etiqueta="POs con Solo Factura"
                valor={resultado.total}
                sufijo="PO"
                valorClass={resultado.total > 0 ? 'text-amber-600' : 'text-teal-600'}
                linea={{
                  icono: resultado.total > 0 ? 'ri-error-warning-fill' : 'ri-checkbox-circle-fill',
                  texto: resultado.total > 0 ? 'Sin BL, packing list ni contenedor' : 'Nada pendiente por este criterio',
                  colorClass: resultado.total > 0 ? 'text-amber-700' : 'text-teal-700'
                }}
                nota="Haz clic para ver el detalle"
                resaltado={resultado.total > 0}
                onClick={sinDatos ? undefined : () => setDetalle('factura')}
              />

              <TarjetaDesglose
                etiqueta="Documentos por Completar"
                valor={resultado.documentosPendientes}
                sufijo="docs"
                valorClass={resultado.documentosPendientes > 0 ? 'text-red-600' : 'text-gray-400'}
                linea={{ icono: 'ri-file-copy-2-line', texto: 'BL + packing list + contenedor por PO', colorClass: 'text-gray-600' }}
                footer="Uno por cada requisito faltante"
              />

              <TarjetaDesglose
                etiqueta="Universo de la Etapa"
                valor={resultado.totalEtapa}
                sufijo="PO"
                valorClass="text-gray-800"
                linea={{ icono: 'ri-inbox-archive-line', texto: 'Tickets no asignados + bandeja', colorClass: 'text-gray-600' }}
                footer="Base sobre la que se mide el indicador"
              />

              <TarjetaDesglose
                etiqueta="Factura sin Expediente"
                valor={resultado.sinExpediente}
                sufijo="PO"
                valorClass={resultado.sinExpediente > 0 ? 'text-orange-600' : 'text-gray-800'}
                linea={{
                  icono: 'ri-user-received-2-line',
                  texto: 'Con factura pero sin expediente creado',
                  colorClass: resultado.sinExpediente > 0 ? 'text-orange-700' : 'text-gray-600'
                }}
                nota={resultado.sinExpediente > 0 ? 'Haz clic para ver el detalle' : undefined}
                notaClass="text-orange-600"
                onClick={resultado.sinExpediente > 0 ? () => setDetalle('factura') : undefined}
              />
            </div>

            <DesgloseModuloDocumentacion
              dropship={resultado.porModulo.dropship}
              zf={resultado.porModulo.zf}
              ticket={resultado.porOrigen.ticket}
              bandeja={resultado.porOrigen.bandeja}
            />

            {!sinEtapa && resultado.total === 0 && (
              <div className="mt-4 flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <i className="ri-information-line text-teal-600 text-lg flex-shrink-0"></i>
                <p className="text-xs text-teal-800">
                  Ninguna de las {resultado.totalEtapa} POs en etapa tiene únicamente la factura cargada:
                  o no tienen factura todavía, o ya sumaron BL, packing list o contenedor.
                </p>
              </div>
            )}
          </>
        )}
      </PanelIndicador>

      {/* =========== Indicador complementario: documentación completa =========== */}
      <PanelIndicador
        icono="ri-file-shield-2-line"
        tono={tonoCompletas}
        titulo="POs con Todos los Documentos Listos"
        meta={
          <>
            POs en etapa de documentación que ya tienen la
            <strong> factura, el BL, el packing list y el número de contenedor cargados</strong>,
            es decir con el juego documental completo
          </>
        }
        badge={badgeCompletas}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: () => setDetalle('completa'),
          disabled: sinCompletas
        }}
      >
        {cargando ? (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <span className="text-sm">Revisando POs con documentación completa...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <TarjetaDesglose
                etiqueta="% de la Etapa Documentada"
                valor={sinEtapa ? '—' : resultado.porcentajeCompletas}
                sufijo={sinEtapa ? undefined : '%'}
                valorClass={colorPctCompletas}
                barra={sinEtapa ? null : { porcentaje: resultado.porcentajeCompletas, colorClass: colorBarraCompletas }}
                footer={
                  sinEtapa
                    ? 'No hay POs en etapa de documentación'
                    : `${resultado.totalCompletas} de ${resultado.totalEtapa} PO${resultado.totalEtapa !== 1 ? 's' : ''} con todo listo`
                }
              />

              <TarjetaDesglose
                etiqueta="POs con Todo Listo"
                valor={resultado.totalCompletas}
                sufijo="PO"
                valorClass={resultado.totalCompletas > 0 ? 'text-teal-600' : 'text-gray-400'}
                linea={{
                  icono: resultado.totalCompletas > 0 ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill',
                  texto:
                    resultado.totalCompletas > 0
                      ? 'Factura + BL + packing list + contenedor'
                      : 'Ninguna PO completó los cuatro requisitos',
                  colorClass: resultado.totalCompletas > 0 ? 'text-teal-700' : 'text-amber-700'
                }}
                nota={resultado.totalCompletas > 0 ? 'Haz clic para ver el detalle' : undefined}
                resaltado={resultado.totalCompletas === 0 && !sinEtapa}
                onClick={sinCompletas ? undefined : () => setDetalle('completa')}
              />

              <TarjetaDesglose
                etiqueta="Documentos Cargados"
                valor={resultado.documentosListos}
                sufijo="docs"
                valorClass="text-gray-800"
                linea={{ icono: 'ri-file-check-line', texto: 'Cuatro requisitos por cada PO lista', colorClass: 'text-gray-600' }}
                footer="Factura, BL, packing list y contenedor"
              />

              <TarjetaDesglose
                etiqueta="Universo de la Etapa"
                valor={resultado.totalEtapa}
                sufijo="PO"
                valorClass="text-gray-800"
                linea={{ icono: 'ri-inbox-archive-line', texto: 'Tickets no asignados + bandeja', colorClass: 'text-gray-600' }}
                footer="Base sobre la que se mide el indicador"
              />

              <TarjetaDesglose
                etiqueta="Listas sin Expediente"
                valor={resultado.completasSinExpediente}
                sufijo="PO"
                valorClass={resultado.completasSinExpediente > 0 ? 'text-orange-600' : 'text-gray-800'}
                linea={{
                  icono: 'ri-user-received-2-line',
                  texto: 'Documentación completa sin expediente',
                  colorClass: resultado.completasSinExpediente > 0 ? 'text-orange-700' : 'text-gray-600'
                }}
                nota={resultado.completasSinExpediente > 0 ? 'Haz clic para ver el detalle' : undefined}
                notaClass="text-orange-600"
                onClick={resultado.completasSinExpediente > 0 ? () => setDetalle('completa') : undefined}
              />
            </div>

            <DesgloseModuloDocumentacion
              dropship={resultado.porModuloCompletas.dropship}
              zf={resultado.porModuloCompletas.zf}
              ticket={resultado.porOrigenCompletas.ticket}
              bandeja={resultado.porOrigenCompletas.bandeja}
            />

            {!sinEtapa && resultado.totalCompletas === 0 && (
              <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <i className="ri-information-line text-amber-600 text-lg flex-shrink-0"></i>
                <p className="text-xs text-amber-800">
                  Ninguna de las {resultado.totalEtapa} POs en etapa tiene el juego documental completo:
                  todavía falta factura, BL, packing list o número de contenedor en todas ellas.
                </p>
              </div>
            )}
          </>
        )}
      </PanelIndicador>

      <ModalDetalleDocumentos
        abierto={detalle === 'factura'}
        onCerrar={() => setDetalle(null)}
        titulo="POs con Solo Factura Cargada"
        subtitulo="POs en etapa de documentación con factura y ningún otro documento cargado"
        filas={resultado.filas}
        nombreArchivo={`reporte-pos-solo-factura-${new Date().toISOString().split('T')[0]}.xlsx`}
        tono="amber"
        resumen={
          <>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{resultado.total}</p>
              <p className="text-xs text-gray-500">POs con factura sola</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{resultado.documentosPendientes}</p>
              <p className="text-xs text-gray-500">Documentos por completar</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{resultado.sinExpediente}</p>
              <p className="text-xs text-gray-500">Con factura sin expediente</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.porModulo.dropship}</p>
              <p className="text-xs text-gray-500">Dropship</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.porModulo.zf}</p>
              <p className="text-xs text-gray-500">Zona Franca</p>
            </div>
          </>
        }
      />

      <ModalDetalleDocumentos
        abierto={detalle === 'completa'}
        onCerrar={() => setDetalle(null)}
        titulo="POs con Todos los Documentos Listos"
        subtitulo="POs en etapa de documentación con factura, BL, packing list y contenedor cargados"
        filas={resultado.filasCompletas}
        nombreArchivo={`reporte-pos-documentacion-completa-${new Date().toISOString().split('T')[0]}.xlsx`}
        tono="teal"
        resumen={
          <>
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">{resultado.totalCompletas}</p>
              <p className="text-xs text-gray-500">POs con todo listo</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.documentosListos}</p>
              <p className="text-xs text-gray-500">Documentos cargados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{resultado.completasSinExpediente}</p>
              <p className="text-xs text-gray-500">Listas sin expediente</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.porModuloCompletas.dropship}</p>
              <p className="text-xs text-gray-500">Dropship</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{resultado.porModuloCompletas.zf}</p>
              <p className="text-xs text-gray-500">Zona Franca</p>
            </div>
          </>
        }
      />
    </>
  );
}