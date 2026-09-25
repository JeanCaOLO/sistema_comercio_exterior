# Cálculo de KPIs — Gestión de Expedientes

Documento de referencia técnica. Explica **cómo se calcula cada indicador**, tanto en el
**Dashboard de Control** como en la sección de **Reportes**.

> Toda la lógica descrita aquí vive en:
> - Dashboard: `src/pages/home/components/Dashboard.tsx`, `SeccionKpisDropship.tsx`, `SeccionKpisMcg.tsx`, `SeccionKpisZf.tsx`, `TopMotivosEspera.tsx`
> - Reportes: `ReporteAtrasos.tsx`, `ReporteCiclo.tsx`, `ReporteRuta.tsx`
> - Utilidades de fecha: `src/lib/fechas.ts`

---

## 0. Reglas transversales (aplican a casi todo)

### 0.1 Días hábiles (`diasHabilesEntre`)
Es la unidad base de la mayoría de KPIs de tiempo.

- Se cuenta **desde el día siguiente al inicio** hasta el día de fin, **ambos inclusivos** en
  el recorrido (el día de inicio **no** cuenta).
- Se **excluyen**: sábados, domingos y **feriados de Costa Rica** (fijos + Jueves y Viernes
  Santo calculados con el Domingo de Pascua).
- Si la fecha de fin es menor o igual a la de inicio → devuelve `0`.
- Se interpretan las fechas tipo `YYYY-MM-DD` como fecha **local** (para evitar el corrimiento
  de un día por zona horaria).

```txt
diasHabiles(fechaInicio, fechaFin) = nº de días L-V, no feriados,
                                    posteriores a fechaInicio y hasta fechaFin (inclusive)
```

> ⚠️ Importante: **no todos** los reportes usan días hábiles. Los reportes *Ciclo* y *Por Ruta*
> usan **días calendario** (diferencia de milisegundos / 86400000). Revisá cada sección.

### 0.2 Filtro por período (Dashboard)
- El rango seleccionado (Mes Actual, Mes Anterior, Semana Anterior, Trimestre, Año Actual o
  personalizado) se aplica **según la FECHA DE ASIGNADO** de cada PO.
- Es decir: solo entran los expedientes que **pasaron por el estado "Asignado"** dentro del rango.
- La fecha de asignado se obtiene de `expedientes_tiempos_estados` buscando `estado_nuevo = 'Asignado'`
  y `fecha_inicio` dentro del rango; si hay varias, se toma **la más temprana**.
- Las POs **nunca asignadas** quedan fuera por diseño.

### 0.3 Comparativos (Mes Anterior / Año Anterior)
Para cada KPI se calculan los mismos valores sobre el rango desplazado -1 mes y -1 año, y luego:

```txt
cambio% = (actual - anterior) / anterior * 100
```
- Si `anterior = 0` → devuelve `+100%` si `actual > 0`, o `0%` si `actual = 0`.
- El resultado se muestra con 1 decimal y signo `+` cuando es positivo.

### 0.4 Separación de módulos
- **Dropship Normal**: expedientes `tipo_modulo === 'dropship'` **sin** el check `mcg`.
- **MCG**: expedientes Dropship con `mcg === true`. **Tienen reglas y metas propias y quedan
  EXCLUIDOS de los KPIs generales de Dropship.**
- **ZF (Zona Franca)**: expedientes `tipo_modulo === 'zf'`. KPIs independientes.

### 0.5 Estados terminales
- Dropship: `Notificado` o `Visto Listo`.
- ZF: `Completado` (y en reportes también `Liberación`).

---

# PARTE A — DASHBOARD DE CONTROL

## A.1 Tarjetas KPI superiores

| KPI | Fórmula |
|---|---|
| **Total Solicitudes** | Cantidad de expedientes con **fecha de asignado dentro del período**. |
| **Alta Prioridad** | Cantidad de expedientes donde `prioridad === 'Alta'` **o** `prioridad_urgente === true`. |
| **Carga de Trabajo (min)** | Suma de `tiempo_minutos` de todos los expedientes del período. |
| **Volumen de Líneas OC** | Suma de `lineas_oc` de todos los expedientes del período. |
| **Promedio → Notificado (DS)** | Ver A.9 (Duración Promedio Asignado → Notificado). |
| **Pendientes en Documentación** | Cantidad de **filas** (registros) en la tabla `documentos_caa`. |

Cada tarjeta (excepto las dos últimas) muestra además el comparativo **vs. mes anterior** y
**vs. año anterior** (ver 0.3).

---

## A.2 Distribución por Dificultad (dona)

Cuenta los expedientes del período por `dificultad` (Baja / Media / Alta):

```txt
total = Baja + Media + Alta
% dificultad = round( (conteo dificultad / total) * 100 )
```
Si `total = 0`, todos los porcentajes quedan en `0`.

---

## A.3 Top Solicitantes (barras)

- Agrupa los expedientes por `solicitante` y cuenta cuántos tiene cada uno.
- Ordena de mayor a menor y **toma solo los 5 primeros**.

---

## A.4 Estado de Expedientes (barras de progreso)

Agrupa por `estado_expediente` usando la función `contarEstados`. Los estados considerados:

| Grupo | Estados que lo alimentan |
|---|---|
| Asignado | `Asignado` |
| En Proceso | `En Proceso` |
| Espera de Respuesta | `Espera de Respuesta`, `Espera de respuesta` |
| Recepción de Carga | `Recepción de Carga`, `Recepcion de Carga` |
| Liberación | `Liberado`, `LIBERADO`, `Liberación`, `Liberacion` |
| Facturación | `Facturación`, `Facturacion` |
| Notificado | `Notificado` |
| Completado | `Completado` |

- `total` = cantidad de expedientes de la lista (según la vista General / Dropship / ZF).
- Cada barra = `valor del estado` (el texto junto a la barra es el conteo absoluto).

---

## A.5 Tiempos Promedio Entre Estados

- **Datos reales**: agrupa `expedientes_tiempos_estados` por transición (`estado_anterior → estado_nuevo`)
  y promedia solo los registros con `minutos_transcurridos > 0`.
  ```txt
  minutosPromedio transición = round( suma(minutos) / nº de registros de esa transición )
  ```
- **Estimación (fallback)** si no hay datos reales: agrupa por estado actual y estima a partir del
  tiempo total (`tiempo_real_minutos`) o del tiempo transcurrido desde `created_at`.
- El badge indica si la fuente es **"Datos reales"** o **"Estimación"**.

---

## A.6 Indicador de Duración Mínima de Expedientes  *(solo Dropship Normal)*

**Meta: cada expediente debe durar MENOS de 3 días hábiles.**

- Universo: expedientes Dropship **normal** (excluye MCG).
- **Inicio del conteo** = fecha en que pasó a `Asignado` (fallback: `created_at`).
- **Fin del conteo** = `fecha_liberacion`; si aún está en curso, se usa **el momento actual**.
- `díasDuración = diasHabiles(inicio, fin)`.

```txt
cumpleMeta  = díasDuración < 3
%Cumplimiento = round( cumplen / totalEvaluados * 100 )
díasPromedio  = round( suma(díasDuración) / totalEvaluados * 10 ) / 10
```
- Semáforo del panel: ≥80% verde, ≥50% ámbar, <50% rojo.
- El reporte interno se puede filtrar por `Todos / Cumplen / No cumplen` y exportar a Excel.

---

## A.7 KPIs Dropship — OK País y Tránsito

| KPI | Fórmula |
|---|---|
| **Entregados con OK País** | Expedientes Dropship en `Notificado` o `Visto Listo` **con** `ok_pais === true`. |
| **Pendientes de OK País** | `max(0, Total Entregados − Entregados con OK País)`. |
| **Tránsito Corto** | Expedientes Dropship con `transito_corto === true`. |

- **Total Entregados** = (Dropship en estado `Notificado`) + (Dropship en `Visto Listo`).
- `% OK País = min(100, round(notificadoOkPais / totalEntregados * 100))`.

---

## A.8 ETD → Notificado  *(Dropship Normal)*

**Meta: ≤ 5 días hábiles entre el ETD y la fecha de Notificado.**

- Universo: Dropship **normal** en `Notificado` o `Visto Listo` **con** `etd` presente.
- Fecha de notificado = primera vez que llegó a `Notificado` en `expedientes_tiempos_estados`.
- `días = diasHabiles(etd, fechaNotificado)`.

```txt
cumple = días <= 5
% Ok   = round( dentroRango / totalEvaluados * 100 )
días promedio = round( suma(días) / totalEvaluados * 10 ) / 10
```

### POs "Sin ETD"
- Cuenta los expedientes Dropship (**incluye MCG**) cuyo campo `etd` está **vacío**, sin importar su estado.
- Es un KPI de alerta: son POs a las que todavía les falta cargar la fecha ETD.

---

## A.9 Duración Promedio Asignado → Notificado  *(Dropship Normal)*

- Universo: Dropship **normal** en `Notificado` o `Visto Listo`.
- **Inicio** = fecha en que pasó a `Asignado` (fallback: `created_at`).
- **Fin** = fecha en que llegó a `Notificado` (de `expedientes_tiempos_estados`; si falta, se usa
  el historial de cambios de estado).
- `días = diasHabiles(inicio, fin)`.

```txt
promedio = round( suma(días) / nº registros * 10 ) / 10
```
El desglose muestra además el **Máximo** y el **Mínimo** de días.

---

## A.10 KPIs MCG — Creación de Expediente  *(expedientes con mcg = true)*

**Meta: ≤ 2 días hábiles desde la asignación hasta la liberación.**

- **Inicio** = fecha en que pasó a `Asignado` (fallback: `created_at`).
- **Fin** = fecha en que llegó a `Liberación` (o `Liberado`); fallback: campo `fecha_liberacion`.
- Se exige que exista la fecha de liberación (si no, el ticket **no** se cuenta).
- `días = diasHabiles(inicio, fin)`.

```txt
cumple = días <= 2
%Cumplimiento = round( cumplen / totalEvaluados * 100 )
díasPromedio  = round( suma(días) / totalEvaluados * 10 ) / 10
```

---

## A.11 KPIs MCG — ETD → Notificado  *(expedientes con mcg = true)*

**Meta: MENOS de 2 días hábiles entre ETD y Notificado.**

- Universo: MCG en `Notificado` o `Visto Listo` **con** `etd`.
- `días = diasHabiles(etd, fechaNotificado)`.

```txt
cumple = días < 2
% Ok   = round( dentroRango / totalEvaluados * 100 )
promedio = round( suma(días) / totalEvaluados * 10 ) / 10
```

---

## A.12 KPIs ZF — Creado → Espera de Respuesta

**Meta: menos de 15 días hábiles.**

- Universo: expedientes ZF.
- **Inicio** = `created_at`.
- **Fin** = primera vez que **ENTRÓ** a `Espera de Respuesta`. Se toma de
  `expedientes_tiempos_estados` (filas con `estado_nuevo = 'Espera de Respuesta'`) usando
  **`fecha_inicio`** (el momento de entrada al estado). Si falta, se usa el historial de cambios
  (`valor_nuevo = 'Espera de Respuesta'`).
- Se incluyen también los tickets que **siguen** en `Espera de Respuesta` (no se exige que tengan
  fecha de salida).
- `días = diasHabiles(created_at, fechaEspera)`.

```txt
días promedio = round( suma(días) / nº registros * 10 ) / 10
cumpleMeta    = días promedio < 15
```

> El botón **Ver detalle de POs** muestra el desglose por ticket (PO, EXP ID, solicitante, fecha
> de creación, fecha de entrada a Espera de Respuesta, días y si cumple la meta), con descarga a Excel.

> Internamente también se calcula el **promedio ZF Creación → Completado** (inicio `created_at`,
> fin llegada a `Completado`) bajo las mismas reglas de días hábiles.

---

## A.13 Motivos de Espera de Respuesta  *(Dropship)*

- Universo: expedientes Dropship en estado `Espera de Respuesta`.
- Se analiza el campo `instrucciones_adicionales` (observaciones) y se clasifica por **categoría**
  según palabras clave (la primera coincidencia gana):

| Categoría | Palabras clave (aprox.) |
|---|---|
| Permisos / Autorizaciones | permiso, senasa, ministerio, autorizac, licencia, aprobacion |
| Documentos pendientes | documento, doc, docs, papel, faltan, faltante, documentacion |
| Confirmación del cliente | cliente |
| Confirmación del proveedor | proveedor, supplier, vendedor |
| Aduana / Autoridades | aduana, autoridad, portuari, aduanal |
| Embarque / Despacho | embarque, despacho |
| Pagos / Facturación | pago, factura, cobro, cancelar, abono |

- Si no hay observación → **"Sin observación"**. Si no coincide con ninguna → **"Otros"**.
```txt
cantidad por categoría = nº de tickets que caen en esa categoría
% = round( cantidad / totalTickets * 100 )
```
- Ordena de mayor a menor y muestra Top 10 (con opción de ver todos).

---

# PARTE B — REPORTES

> Los reportes filtran por **fecha de solicitud** (`fecha_solicitud`, fallback `created_at`),
> a diferencia del Dashboard que filtra por **fecha de asignación**.

## B.1 Reporte: Atrasos & Aging

### Umbrales (ajustables en el código)

| Concepto | Ámbar | Rojo |
|---|---|---|
| **Aging** (días en el estado actual) | > 3 días | > 7 días |
| **Retraso** (días vs. vencimiento) | > 0 días | > 3 días |

### Definiciones
- **Expediente terminal** = Dropship en `Notificado`/`Visto Listo`, o ZF en `Completado`.
- **Aging** = días entre la **fecha de entrada al estado actual** (la más temprana con `fecha_fin`
  nula en `expedientes_tiempos_estados`; fallback `created_at`) y **hoy**.
- **Retraso (en proceso)** = días entre `fecha_requerimiento` (vencimiento) y **hoy**.
- **Retraso (entregado)** = `fecha_liberacion − fecha_requerimiento`; si no hay liberación, se usa
  `dias_entrega_real − dias_entrega`.

### KPIs del reporte

| KPI | Fórmula |
|---|---|
| **En proceso** | Cantidad de expedientes NO terminales. |
| **Estancados críticos** | En proceso con aging en rojo (> 7 días). |
| **Con retraso** | `atrasados (en proceso, retraso>0)` **+** `entregadosTarde`. |
| **Retraso promedio** | `suma(retrasos) / totalConRetraso` (redondeado a 1 decimal). |

- Los retrasos negativos se tratan como 0 al sumar.
- Tablas separadas: **Expedientes en proceso** y **Entregados con retraso** (solo `retraso > 0`).
- Exportable a **CSV**.

---

## B.2 Reporte: Ciclo Asignado → Terminal

> ⚠️ Este reporte usa **días calendario**, no días hábiles.

- **Universo (activos)**: Dropship en `Notificado`/`Visto Listo`, o ZF en `Completado`/`Liberación`.
- **fechaAsignado** = primera vez que llegó a `Asignado` (fallback `created_at`).
- **fechaTerminal** = primera llegada a `Notificado` / `Completado` / `Liberación`
  (de `expedientes_tiempos_estados`; fallback historial).
- `días = (fechaTerminal − fechaAsignado) en milisegundos / 86400000`, redondeado a 1 decimal.

```txt
promedio = round( suma(días) / total * 10 ) / 10
máximo   = max(días)
mínimo   = min(días)
```
- Exportable a **CSV**.

---

## B.3 Reporte: Rendimiento por Ruta

Agrupa todos los expedientes por **ruta** (`tipo_po`).

### Por cada ruta

| Métrica | Fórmula |
|---|---|
| **Total** | Expedientes de la ruta. |
| **Finalizados** | Tienen `fecha_liberacion` **o** están en estado terminal. |
| **En proceso** | `Total − Finalizados`. |
| **Ciclo promedio** | Promedio de `dias_entrega_real`; si no existe, `fecha_liberacion − created_at` (solo finalizados). |
| **Retrasados** | Expedientes con retraso > 0. |
| **Tasa de retraso** | `round(retrasados / Total * 100)`. |
| **Retraso promedio** | Promedio de los retrasos > 0. |
| **Tránsito corto** | Conteo (`transito_corto`), mostrado con `%` sobre el total. |
| **Alta prioridad** | `prioridad === 'Alta'` o `prioridad_urgente`. |
| **Módulo** | Dropship si ≥ mitad del grupo es Dropship; si no, ZF. |

- **Retraso** de un expediente = `fecha_liberacion − fecha_requerimiento` (si ya está liberado) o
  `hoy − fecha_requerimiento` (si sigue en proceso). Se acota a ≥ 0.
- Las métricas usan **días calendario**.

### KPIs de ciclo (solo Dropship)

Se promedian sobre **todos** los expedientes Dropship (global y por ruta):

| Ciclo | Fórmula |
|---|---|
| **Asignado → Liberado** | `fecha_liberacion − fechaAsignado`. |
| **ETD → Notificado (MCG)** | `fechaNotificado − etd`, solo con `mcg = true`. |
| **ETD → Notificado (Normal)** | `fechaNotificado − etd`, solo sin `mcg`. |
| **Asignado → Notificado** | `fechaNotificado − fechaAsignado`. |

- `fechaAsignado` y `fechaNotificado` se toman de `expedientes_tiempos_estados` (con fallback al
  historial para Notificado); `fechaAsignado` cae a `created_at` si no existe.
- Solo se cuentan diferencias ≥ 0.
- `promedio = round( suma / nº * 10 ) / 10`. El conteo de expedientes se muestra entre paréntesis.

### KPIs generales del reporte

| KPI | Fórmula |
|---|---|
| **Rutas activas** | Nº de rutas con expedientes. |
| **Total expedientes** | Total entre todas las rutas. |
| **Mayor volumen** | Ruta con más expedientes. |
| **Mayor retraso** | Ruta con mayor tasa de retraso. |

- Exportable a **CSV**.

---

## Resumen rápido de metas

| Indicador | Módulo | Meta |
|---|---|---|
| Duración del expediente | Dropship Normal | < 3 días hábiles |
| ETD → Notificado | Dropship Normal | ≤ 5 días hábiles |
| Creación (Asignado → Liberado) | MCG | ≤ 2 días hábiles |
| ETD → Notificado | MCG | < 2 días hábiles |
| Creado → Espera de Respuesta | ZF | < 15 días hábiles |
| Aging "crítico" | Todos | > 7 días |

---

*Última revisión: ver `CHANGELOG.md` para el historial de cambios de esta lógica.*