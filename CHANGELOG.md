# Changelog — Resumen de Últimos 200 Cambios

**Sistema de Gestión de Expedientes de Comercio Exterior**  
*Dropship & Zona Franca (ZF)*  
*Última actualización: 27 de agosto de 2026*

---

## 🏗️ Infraestructura y Core (1–12)

1. **Cliente Supabase** — Singleton con reintentos automáticos, validación de conexión, y fetch con CORS configurado
2. **AuthContext** — Provider global con email/password + Google OAuth, soporte multi-rol desde `usuario_roles`
3. **Página de Login** — Formulario con manejo de errores específicos (credenciales inválidas, email no confirmado, sin cuenta) y login con Google
4. **Reset de contraseña** — Página independiente con validación de coincidencia y mínimo 6 caracteres
5. **Sidebar colapsable** — Menú lateral con toggle expandir/contraer, visibilidad condicionada por roles del usuario
6. **Sistema de roles** — 6 roles: Administrador, Gestor Dropship, Gestor ZF, Bodega, Documentos, Expedientes
7. **Tabla usuario_roles** — Soporte multi-rol por usuario con relación a tabla `roles`, fallback al campo `rol` legacy
8. **Seguridad RLS** — Row Level Security en todas las tablas de Supabase
9. **i18n** — Infraestructura de internacionalización lista para expansión
10. **Variables de entorno** — Configuración segura con `VITE_PUBLIC_SUPABASE_URL` y `VITE_PUBLIC_SUPABASE_ANON_KEY`
11. **Safety net** — Timeout de 15 segundos para evitar pantallas de carga bloqueadas permanentemente
12. **Estructura modular** — Separación en pages, components, contexts, lib, hooks, mocks, router, i18n, seed

---

## 📊 Dashboard (13–36)

13. **KPIs principales** — 6 tarjetas: Total Solicitudes, Alta Prioridad, Carga de Trabajo (min), Volumen de Líneas OC, Promedio → Notificado (DS), Promedio → Completado (ZF)
14. **Tendencias comparativas** — Cada KPI muestra % de cambio vs mes anterior y vs año anterior
15. **Filtros de período** — Mes Actual, Mes Anterior, Trimestre, Año Actual, y rango personalizado con fechas
16. **Selector de período personalizado** — Inputs de fecha inicio/fin con botones Aplicar y Limpiar
17. **Donut chart** — Distribución por dificultad (Baja/Media/Alta) renderizado en canvas
18. **Bar chart** — Top 5 solicitantes por volumen de expedientes
19. **Progress bars de estados** — Visualización general, Dropship y ZF con tabs intercambiables (12 estados)
20. **Tiempos promedio entre estados** — Visualización de transiciones con filtro por módulo (Todos/Dropship/ZF)
21. **Datos reales vs estimados** — Los tiempos de transición se obtienen de `expedientes_tiempos_estados` con badge indicando fuente
22. **Tabla de expedientes** — Últimos 10 con PO, EXP ID, solicitante, estado, responsable, y botón "Ver Historial"
23. **Modal de historial** — Timeline con tiempos por estado y cambios registrados, incluyendo usuario y fecha
24. **KPI ZF: Creado → Espera de Respuesta** — Promedio en días con meta ≤15 días, badge de cumplimiento
25. **KPI Dropship: OK País** — Contador de expedientes Notificado/Visto Listo con ok_pais=true
26. **KPI Dropship: Tránsito Corto** — Contador de expedientes con transito_corto=true
27. **KPI Dropship: Pendientes OK País** — Entregados sin marca de cierre (total entregados − ok_pais)
28. **KPI ETD → Notificado (Dropship)** — Días entre fecha ETD y llegada a Notificado, meta ≤5 días
29. **KPI Duración Mínima 2 días** — Bloque completo con métricas de cumplimiento, barras de progreso, y alertas visuales
30. **Reporte de cumplimiento** — Modal con tabla filtrable (Todos/Cumplen/No Cumplen), resumen rápido y detalle por expediente
31. **Cálculo de días hábiles** — Excluye fines de semana y 10 feriados de El Salvador
32. **Timer congelado en estados finales** — Tiempo se congela al llegar a Notificado/Visto Listo (DS) o Completado (ZF)
33. **Cálculo automático de duración** — Desde `created_at` hasta `fecha_liberacion` o momento actual
34. **Carga progresiva** — Spinner mientras se consultan expedientes + datos comparativos de meses/años anteriores
35. **Estados Dropship (9)** — No Asignado, Asignado, En Proceso, Espera de Respuesta, Liberación, Recepción de Carga, Facturación, Notificado, Visto Listo
36. **Estados ZF (5)** — No Asignado, Asignado, En Proceso, Espera de Respuesta, Completado

---

## 📋 Kanban — Gestión de Expedientes (37–68)

37. **Tablero Kanban** — Columnas por estado con drag-and-drop para cambiar estado de expedientes
38. **Filtros del Kanban** — Búsqueda por texto (PO, EXP ID, solicitante, responsable) + filtro por persona asignada + filtro por prioridad
39. **Badges en tarjetas** — URGENTE (rojo), TC/Tránsito Corto (ámbar), OK País (verde), BL (azul), TLC (verde)
40. **Timer en tiempo real** — Cada tarjeta muestra minutos y días hábiles transcurridos, actualizado cada minuto
41. **Timer congelado** — Al llegar a estado final (Notificado/Visto Listo/Completado), el timer se congela
42. **Modal de detalles/edición** — Click en tarjeta abre modal con todos los campos editables
43. **Edición de expediente** — Modificación de PO, ruta, solicitante, estado, prioridad, BL, TC, TLC, ETD, ETA, comentarios, etc.
44. **Subida de documentos en edición** — Drag-and-drop + selector de archivos (PDF, Excel, CSV) con integración a Supabase Storage
45. **Modal de documentos** — Visualización de archivos adjuntos con preview y descarga
46. **Modal de historial** — Registro cronológico de todos los cambios del expediente con usuario, fecha, valor anterior/nuevo
47. **Eliminación de expediente** — Borrado con confirmación, actualización automática de la vista
48. **Validación de asignación** — Al mover de "No Asignado" a "Asignado" se requiere BL cargado y al menos un documento
49. **Registro de tiempo entre estados** — Cada cambio de estado abre/cierra registros en `expedientes_tiempos_estados`
50. **Cálculo de tiempo real** — Al llegar a estado final, se calculan minutos reales y días hábiles de entrega
51. **Notificaciones por email** — Dropship: notifica al responsable en cada cambio de estado; ZF: notifica a lista configurada en "Arribo de Carga"
52. **Recarga silenciosa** — Sincronización en background sin bloquear la UI tras cada operación
53. **Safety net** — Timeout de 15 segundos fuerza salida del loading si la carga se bloquea
54. **Auto-hide Dropship** — Tickets en "Visto Listo" desaparecen del kanban 2 días después (solo visual, no se borran)
55. **Auto-hide ZF** — Tickets en "Completado" desaparecen del kanban 2 días después (solo visual, no se borran)
56. **Registro de fecha_liberacion** — Se actualiza automáticamente al llegar a Visto Listo o Completado
57. **Colores de estado** — 14 colores distintos para cada estado del flujo
58. **Colores de prioridad** — Rojo (Urgente), Naranja (Alta), Amarillo (Media), Verde (Baja)
59. **Colores de dificultad** — Rojo (Alta), Amarillo (Media), Verde (Baja) con iconos direccionales
60. **Selector de ruta logística** — 9 rutas disponibles con filtrado por tipo de módulo
61. **Campos ETD/ETA** — ETD (fecha) solo para Dropship, ETA Real (fecha) solo para ZF
62. **Toggle BL Cargado** — Interruptor visual con badge azul en tarjeta
63. **Toggle OK País** — Solo Dropship, badge verde con check
64. **Toggle Tránsito Corto** — Ambos módulos, badge ámbar
65. **Toggle TLC** — Ambos módulos, badge verde
66. **Prioridad urgente con motivo** — Al activar prioridad urgente se requiere seleccionar motivo de una lista predefinida
67. **Contador de tarjetas por columna** — Badge numérico en el encabezado de cada columna
68. **Barra de resultados filtrados** — Muestra cantidad de expedientes con filtros activos y botón para limpiar

---

## 📑 Lista de Expedientes (69–86)

69. **Tabla paginada** — 25 expedientes por página con navegación completa (anterior/siguiente, números de página, elipsis)
70. **5 filtros simultáneos** — Búsqueda por texto + Tipo de Módulo + Persona Asignada + Prioridad + Estado
71. **Reset automático de página** — Al cambiar cualquier filtro, vuelve a la página 1
72. **Estados combinados** — Muestra expedientes de ambos módulos con estados unificados (12 únicos)
73. **Colores de estado** — Badges de colores para identificación visual rápida en la tabla
74. **Timer en tabla** — Igual que en kanban: minutos y días hábiles con congelación en estados finales
75. **Click en fila** — Abre modal de detalles/edición del expediente
76. **Modal de edición completo** — Igual que en kanban: todos los campos, toggles BL/TC/TLC, subida de documentos
77. **Historial y documentos** — Botones independientes en cada fila para ver historial y documentos
78. **Descarga de documentos** — Fetch + blob download con fallback a nueva pestaña si hay error CORS
79. **Banner de resultados** — Muestra rango paginado, total de expedientes y total en base de datos
80. **Skeleton de carga** — Spinner grande con icono y texto descriptivo mientras se cargan datos
81. **Safety net** — Timeout de 15 segundos para evitar carga infinita
82. **Recarga silenciosa** — Background sync sin bloquear UI
83. **Registro de cambios en historial** — Todos los campos modificados se registran con usuario, email y timestamp
84. **Registro de documentos agregados** — Entrada especial en historial cuando se suben archivos nuevos
85. **Cálculo de tiempo real al finalizar** — Al cambiar a estado final, se calculan minutos y días reales
86. **Actualización local instantánea** — Cambios reflejados en UI antes de que termine la recarga silenciosa

---

## 📝 Formulario de Creación de Expediente (87–102)

87. **Formulario multi-sección** — Identificación, Clasificación y Tiempos, Datos del Expediente, Detalles Adicionales
88. **Cálculo automático de dificultad** — Baja (≤51 líneas), Media (52-128), Alta (>128) según líneas OC ingresadas
89. **Cálculo automático de tiempos** — Minutos y días de entrega se derivan de dificultad y líneas OC
90. **Detección automática de usuario** — Solicitante y responsable se preasignan desde la sesión de Supabase Auth
91. **POs múltiples** — Textarea que acepta múltiples POs separadas por comas o saltos de línea
92. **Selector de ruta logística** — 9 opciones con formato descriptivo completo
93. **Prioridad urgente con motivo** — 4 motivos predefinidos: ARRIBADO NO NOTIFICADO, DOCUMENTOS TARDÍOS, TERRESTRE, TRÁNSITO CORTO
94. **Subida de documentos** — Drag-and-drop + selector con validación de formatos (PDF, Excel, CSV)
95. **Toggle BL Cargado** — Con advertencia visual si se marca sin adjuntar documentos
96. **Toggle TLC** — Toggle verde en sección de Datos del Expediente
97. **Toggle Tránsito Corto** — Toggle ámbar disponible para ambos módulos
98. **Campo ETD** — Solo visible para Dropship
99. **Campo ETA Real** — Solo visible para ZF
100. **Creación con auditoría** — Registro en historial con resumen completo de la creación, incluyendo BL, TC, TLC
101. **Registro de tiempo inicial** — Se abre registro "Nuevo → Asignado" en `expedientes_tiempos_estados`
102. **Subida asíncrona de documentos** — Los archivos se suben a Supabase Storage y las URLs se guardan como array JSON

---

## 📁 Carga de Documentos CAA (103–118)

103. **Selección de módulo** — Tarjetas visuales para Dropship (barco) y ZF (edificio) con check de selección
104. **Filtrado de rutas por módulo** — Solo se muestran las rutas correspondientes al módulo seleccionado
105. **Drag-and-drop de archivos** — Zona de drop con feedback visual (cambio de color, ícono, texto)
106. **Selector de archivos** — Click en zona + input oculto para selección tradicional
107. **Validación de formatos** — Solo PDF, Excel, CSV, Word; formatos inválidos se filtran automáticamente
108. **Lista de archivos** — Vista previa con ícono según tipo, nombre, tamaño, y botón para quitar
109. **Múltiples POs** — Sistema de inputs dinámicos con botón Agregar/Quitar, cada PO numerada
110. **Toggle BL** — ¿El documento cargado es un BL? con badge azul
111. **Toggle TC** — ¿Documentación de Tránsito Corto? con badge ámbar
112. **Toggle TLC** — ¿Aplica Tratado de Libre Comercio? con badge verde
113. **Campo de comentario** — Textarea opcional con contador de 500 caracteres
114. **Validación de POs duplicadas** — Verifica contra `documentos_caa` y `expedientes` antes de guardar, con logging detallado
115. **Resumen previo** — Grid de 8 celdas mostrando módulo, ruta, #docs, #POs, BL, TC, TLC, destino
116. **Subida a Supabase Storage** — Archivos a bucket `expedientes-documentos` con sanitización de nombres
117. **Registro en Documentación** — Se guarda en `documentos_caa` con estado "Documentación", no crea ticket aún
118. **Pantalla de éxito** — Muestra POs guardadas con botones "Cargar más documentos" e "Ir a Documentación"

---

## 📂 Documentación (119–130)

119. **Tabla de documentos CAA** — Lista todos los registros en staging con checkboxes de selección múltiple
120. **Búsqueda** — Filtro por PO, solicitante o responsable con campo de texto y botón limpiar
121. **Filtro por ruta logística** — Dropdown con todas las rutas disponibles en los documentos cargados
122. **Selector de módulo destino** — Toggle Dropship/ZF para elegir a dónde se enviará el ticket consolidado
123. **Selección múltiple** — Checkbox por fila + checkbox "seleccionar todo" en cabecera
124. **Consolidación en 1 ticket** — Todas las filas seleccionadas se fusionan en un solo expediente con POs y docs únicos
125. **Eliminación de seleccionados** — Modal de confirmación antes de borrar de `documentos_caa`
126. **Columnas informativas** — POs, Módulo, Ruta, BL, TC, TLC, #Docs, Cargado por, Fecha
127. **Badges visuales** — BL (azul), TC (ámbar), TLC (verde) en celdas correspondientes
128. **Paginación** — 25 documentos por página con navegación completa
129. **Contador en toolbar** — Muestra seleccionados/total, página actual, y resultados filtrados
130. **Notificación al generar ticket** — Aviso a solicitante y responsable cuando se crea el expediente consolidado

---

## 🗄️ Repositorio de Documentación (131–150)

131. **Vista unificada** — Combina datos de `documentos_caa` (staging) y `expedientes` (activos) en una sola tabla
132. **Columna de estado** — Badge de color para cada estado del flujo (14 colores distintos)
133. **Recuperación de responsable original** — Si el expediente ya fue promovido, busca el responsable_creacion desde el registro CAA original
134. **Filas expandibles** — Click en contador de documentos despliega lista de archivos con preview y descarga
135. **Descarga de archivos** — Fetch + blob download con ícono de carga y fallback a nueva pestaña
136. **Búsqueda global** — Filtra por PO, EXP ID, solicitante, responsable, ruta logística
137. **Filtro por estado** — Dropdown con 12 estados (Documentación hasta Visto Listo/Completado)
138. **Filtro por módulo** — Toggle Todos/Dropship/ZF
139. **Botón Editar** — Abre modal de edición completo (ver sección EditarDocumentoModal)
140. **Botón Historial** — Abre modal de timeline de modificaciones (ver sección HistorialDocumentoModal)
141. **Paginación** — 25 registros por página con navegación y contador de rango
142. **Loading skeleton** — Spinner grande, barras de progreso animadas, esqueleto de tabla con 5 filas fantasma
143. **Texto descriptivo de carga** — "Consultando documentos en la base de datos..."
144. **Estado vacío** — Mensaje y icono cuando no hay documentos en el repositorio
145. **Columnas completas** — POs, EXP ID, Módulo, Estado, Ruta, Solicitante, Docs, BL, TC, TLC, Cargado por, Fecha, Acción, Historial
146. **Iconos de módulo** — Barco para Dropship, edificio para ZF en badges
147. **Truncado de ruta** — Ruta logística con truncado + tooltip en hover para textos largos
148. **Avatar de usuario** — Círculo con inicial en columna "Cargado por"
149. **Origen del registro** — Diferencia entre `cca` (Documentación) y `expediente` (ya promovido) para edición correcta
150. **Responsive** — Tabla con scroll horizontal en pantallas pequeñas

---

## ✏️ Editar Documento Modal (151–168)

151. **Edición de POs** — Sistema de tags individuales: cada PO se edita por separado, se pueden agregar/quitar
152. **Documentos existentes** — Lista con íconos por tipo, botones Ver (nueva pestaña) y Quitar (marca para eliminar)
153. **Restauración de documentos** — Los documentos marcados para eliminar se pueden restaurar antes de guardar
154. **Agregar nuevos documentos** — Drag-and-drop + selector con vista previa de archivos pendientes
155. **Toggle BL** — Interruptor con texto "Marcado como BL" / "No es un BL"
156. **Toggle TC** — Interruptor con texto "Marcado como TC" / "No es TC"
157. **Toggle TLC** — Interruptor con texto "Sí aplica TLC" / "No aplica TLC"
158. **Campo de comentario** — Textarea de 500 caracteres con contador, independiente de las instrucciones
159. **Resumen de cambios** — Panel ámbar que muestra documentos agregados, eliminados, cambios en BL/TC/TLC/POs
160. **Sincronización cruzada** — Si el registro existe en ambas tablas, se actualizan `documentos_caa` y `expedientes`
161. **Auditoría completa** — Cada modificación se registra en `documento_modificaciones` con detalle de archivos anterior/nuevo
162. **Notificación** — Aviso a solicitante y responsable con resumen de cambios realizados
163. **Validación** — No permite guardar sin al menos un documento
164. **Subida a Storage** — Nuevos archivos se suben al bucket `expedientes-documentos`
165. **Sanitización de nombres** — Elimina acentos, espacios y caracteres especiales de nombres de archivo
166. **Info del registro** — Cabecera con módulo, ruta, estado y solicitante del registro que se está editando
167. **Footer informativo** — "Los cambios quedan registrados con tu usuario"
168. **Carga asíncrona** — Spinner en botón Guardar mientras se procesan archivos y actualizaciones

---

## 📜 Historial de Documento Modal (169–176)

169. **Timeline visual** — Línea vertical con puntos que marcan cada evento (creación + modificaciones)
170. **Evento de creación** — Siempre visible primero, muestra responsable y lista de archivos iniciales (expandible)
171. **Modificaciones** — Cada cambio registrado en `documento_modificaciones` con usuario, email, fecha y acción
172. **Tiempo relativo** — "Hace X min", "Hace Xh", "Hace X días" o fecha completa para eventos antiguos
173. **Detalle de archivos** — Expansible por evento: muestra documentos agregados (verde) y eliminados (rojo)
174. **Manejo de errores** — Si la tabla de auditoría no existe, muestra mensaje descriptivo con instrucciones
175. **Contador de eventos** — Footer muestra total de eventos (X modificaciones + 1 creación)
176. **Navegación** — Botón Cerrar en header y footer

---

## 🔔 Campanita de Notificaciones (177–189)

177. **Ícono de campana** — Con badge rojo de contador de no leídas (99+ para números grandes)
178. **Panel desplegable** — 520px de alto máximo con scroll interno, posicionado debajo de la campana
179. **Header del panel** — "Notificaciones" con contador de sin leer y botón "Marcar todas leídas"
180. **Lista de notificaciones** — Cada item con ícono tipado, badge de tipo, mensaje, tiempo relativo y PO reference
181. **Estados leído/no leído** — Fondo teal suave para no leídas + punto indicador verde
182. **Marcar como leída** — Click en cualquier notificación la marca como leída y actualiza contador
183. **Polling cada 30s** — Actualización automática del contador (y lista si el panel está abierto)
184. **Cerrar al click fuera** — Detecta clicks fuera del panel y la campana para cerrar
185. **Tipos de notificación** — documento_agregado (teal), documento_modificado (ámbar), ticket_creado (esmeralda)
186. **Etiquetas de tipo** — "Doc. agregado", "Doc. modificado", "Ticket creado" en cada notificación
187. **Truncado de PO** — Si la referencia de PO excede 20 caracteres, se trunca con "..."
188. **Estado vacío** — "Sin notificaciones" con icono y texto descriptivo cuando no hay actividad
189. **Loading** — Spinner mientras se cargan notificaciones al abrir el panel

---

## 📊 Módulo de Reportes (190–196)

190. **Tipos de reporte** — 6 opciones visuales: Solicitudes del Mes, Alta Prioridad, Por Solicitante, Por Estado, Carga de Trabajo, Completo
191. **Filtro por rango de fechas** — Fecha inicio y fecha fin con inputs tipo date
192. **Exportación a CSV** — Descarga de datos filtrados con headers automáticos desde las columnas de Supabase
193. **Exportación a PDF** — Placeholder con mensaje descriptivo para futura implementación
194. **Registro de reportes** — Cada exportación se guarda en `reportes_historicos` con tipo, fechas, usuario y formato
195. **Reportes recientes** — Sidebar con historial simulado de últimos 4 reportes generados
196. **Panel informativo** — Gradiente teal con descripción del funcionamiento de reportes

---

## 📤 Carga Masiva (197–200)

197. **Importación CSV** — Subida de archivo con drag-and-drop o selector, parsing de headers y datos
198. **Vista previa** — Muestra las primeras 5 filas del archivo en tabla antes de importar
199. **Conversión de fechas** — Soporta formatos dd/mm/yyyy, yyyy/mm/dd, yyyy-mm-dd con fallback a fecha actual
200. **Inserción masiva** — Bulk insert a tabla `expedientes` con mapeo automático de columnas desde headers CSV

---

## 🚢 Campos de Usuario en Dropship (201–204)

201. **Nuevo campo "Cargador de Documentos"** — Cada expediente guarda quién subió originalmente los documentos y las POs en Carga CAA. Este dato queda **inmutable** (candado) y nunca se pisa.
202. **Solicitante inmutable** — Antes editable, ahora queda bloqueado: registra quién consolidó y creó el ticket, y se mantiene en el tiempo.
203. **Responsable de Creación editable** — Es el único de los tres roles que puede cambiar, porque es quien se asigna para trabajar el ticket.
204. **Separación de los 3 roles** — Cada ticket guarda 3 datos de usuario claros e independientes: **cargador** (fijo), **solicitante/consolidador** (fijo) y **responsable** (editable), visibles con candado en el detalle y reflejados correctamente en el historial.

---

## 📊 KPIs MCG y Nuevos Indicadores del Dashboard (205–210)

205. **Sección "KPIs MCG"** — Los expedientes marcados con MCG se evalúan por separado con sus propias reglas y metas, sin mezclarse con las estadísticas generales. Mide la Creación del expediente (meta: máximo 2 días) y el tramo ETD → Notificado (meta: menos de 2 días).
206. **Indicador de Duración Mínima ajustado** — La meta pasó de 2 a 3 días y ahora solo aplica a Dropship; los expedientes de Zona Franca ya no entran en esta medición.
207. **KPI "Duración Promedio Asignado → Notificado"** — Promedio de días desde asignación hasta notificación para Dropship, con botón para ver el desglose completo (promedio, máximo, mínimo).
208. **KPI "ETD → Notificado" con detalle** — Además del contador, ahora se puede abrir el detalle de POs para ver cuáles cumplen y cuáles no la meta de ≤5 días.
209. **Descarga en Excel** — Todos los reportes nuevos del dashboard incluyen botón de descarga a Excel.
210. **Filtros de fecha más claros** — Los errores de rango de fechas (ej. inicio mayor a fin) se muestran directamente en pantalla en lugar de una ventana emergente. El promedio "→ Notificado (Dropship)" ahora también incluye los expedientes en "Visto Listo".

---

## 📈 Renovación del Módulo de Reportes (211–213)

211. **Nuevo enfoque analítico** — El antiguo generador de reportes (Solicitudes del Mes, Alta Prioridad, etc.) se reemplazó por **3 pestañas analíticas** enfocadas en productividad y eficiencia.
212. **Atrasos & Aging** — Expedientes atrasados y su antigüedad. **Por Ruta** — Rendimiento agrupado por ruta logística. **Ciclo Asig→Notif** — Tiempo del ciclo completo desde asignación hasta notificación.
213. **Skeleton de carga unificado** — Documentación y Lista de Expedientes ahora muestran el mismo esqueleto de carga "fantasma" que Dropship (silueta de tabla pulsando + mensaje descriptivo), cada módulo conservando su color. Además, cualquier usuario con rol Administrador puede cargar documentos y POs en Carga CAA.

---

*Documento generado automáticamente — versión 213 del proyecto*