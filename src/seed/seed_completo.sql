-- =============================================
-- SEED COMPLETO v2 - SISTEMA DE EXPEDIENTES
-- Incluye: todos los estados nuevos, campos
-- transito_corto, ok_pais, KPIs ZF, etc.
-- Ejecutar en Supabase > SQL Editor
-- =============================================

-- =============================================
-- 0. TABLA configuracion_sistema (si no existe)
-- =============================================
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE NOT NULL,
  valor jsonb,
  descripcion text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 1. USUARIOS
-- =============================================
INSERT INTO usuarios (id, nombre, email, rol, departamento, estado, created_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Carlos Mendoza',  'carlos.mendoza@empresa.com',  'Administrador',             'Operaciones', 'Activo',   NOW() - INTERVAL '6 months'),
  ('a1000000-0000-0000-0000-000000000002', 'Ana García',      'ana.garcia@empresa.com',       'Gestor Dropship',           'Logística',   'Activo',   NOW() - INTERVAL '5 months'),
  ('a1000000-0000-0000-0000-000000000003', 'Luis Ramírez',    'luis.ramirez@empresa.com',     'Gestor ZF',                 'Zona Franca', 'Activo',   NOW() - INTERVAL '4 months'),
  ('a1000000-0000-0000-0000-000000000004', 'María Torres',    'maria.torres@empresa.com',     'Gestor Dropship,Gestor ZF','Logística',   'Activo',   NOW() - INTERVAL '3 months'),
  ('a1000000-0000-0000-0000-000000000005', 'Roberto Flores',  'roberto.flores@empresa.com',   'Gestor Dropship',           'Comercial',   'Activo',   NOW() - INTERVAL '2 months'),
  ('a1000000-0000-0000-0000-000000000006', 'Sandra López',    'sandra.lopez@empresa.com',     'Gestor ZF',                 'Zona Franca', 'Activo',   NOW() - INTERVAL '2 months'),
  ('a1000000-0000-0000-0000-000000000007', 'Diego Herrera',   'diego.herrera@empresa.com',    'Administrador',             'Gerencia',    'Activo',   NOW() - INTERVAL '1 month'),
  ('a1000000-0000-0000-0000-000000000008', 'Patricia Vega',   'patricia.vega@empresa.com',    'Bodega',                    'Bodega',      'Activo',   NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO UPDATE SET
  nombre       = EXCLUDED.nombre,
  email        = EXCLUDED.email,
  rol          = EXCLUDED.rol,
  departamento = EXCLUDED.departamento,
  estado       = EXCLUDED.estado;

-- =============================================
-- 2. CORREOS NOTIFICACIÓN ARRIBO DE CARGA
-- =============================================
INSERT INTO configuracion_sistema (clave, valor, descripcion)
VALUES (
  'correos_notificacion_arribo_carga',
  '["carlos.mendoza@empresa.com","luis.ramirez@empresa.com","patricia.vega@empresa.com"]',
  'Correos que reciben notificación cuando un ZF pasa a Arribo de Carga'
)
ON CONFLICT (clave) DO UPDATE SET
  valor      = EXCLUDED.valor,
  updated_at = now();

-- =============================================
-- 3. LIMPIAR EXPEDIENTES ANTERIORES DEL SEED
-- =============================================
DELETE FROM expedientes_tiempos_estados
 WHERE expediente_id::text LIKE 'b1000000%'
    OR expediente_id::text LIKE 'c1000000%';

DELETE FROM expedientes_historial
 WHERE expediente_id::text LIKE 'b1000000%'
    OR expediente_id::text LIKE 'c1000000%';

DELETE FROM expedientes
 WHERE id::text LIKE 'b1000000%'
    OR id::text LIKE 'c1000000%';

-- =============================================
-- 4. EXPEDIENTES DROPSHIP
-- =============================================
-- Columnas: transito_corto, ok_pais incluidas
INSERT INTO expedientes (
  id, po_tiquetera, tipo_po, solicitante,
  fecha_solicitud, prioridad, prioridad_urgente, motivo_urgencia,
  dificultad, tiempo_minutos, dias_entrega,
  fecha_requerimiento, exp_id, lineas_oc,
  fecha_creacion_expediente, estado_expediente, motivo_revision,
  responsable_creacion, instrucciones_adicionales,
  tipo_modulo, etd, transito_corto, ok_pais, created_at
) VALUES

-- ─── MES ACTUAL ─── (referencia: CURRENT_DATE = 17 Mar 2026)
('b1000000-0000-0000-0000-000000000001','PO-2026-0301','GT',  'Ana García',     CURRENT_DATE-1,  'Alta',  false,NULL,              'Baja', 55, 2,CURRENT_DATE+4, 'EXP-DS-001',28, CURRENT_DATE-1, 'Asignado',           NULL,'Ana García',   'Primera revisión de documentos de aduana',          'dropship',CURRENT_DATE+10,false,false, NOW()-INTERVAL '1 day'),
('b1000000-0000-0000-0000-000000000002','PO-2026-0302','SV',  'Roberto Flores', CURRENT_DATE-2,  'Media', false,NULL,              'Media',185,3,CURRENT_DATE+5, 'EXP-DS-002',62, CURRENT_DATE-2, 'En Proceso',         NULL,'Roberto Flores','Coordinar con proveedor - stock listo',             'dropship',CURRENT_DATE+12,false,false, NOW()-INTERVAL '2 days'),
('b1000000-0000-0000-0000-000000000003','PO-2026-0303','CR',  'Ana García',     CURRENT_DATE-4,  'Alta',  true, 'TRÁNSITO CORTO', 'Alta', 530,5,CURRENT_DATE+2, 'EXP-DS-003',135,CURRENT_DATE-4, 'Espera de Respuesta',NULL,'Ana García',   'Urgente: cliente confirmar embarque',               'dropship',CURRENT_DATE+7, true, false, NOW()-INTERVAL '4 days'),
('b1000000-0000-0000-0000-000000000004','PO-2026-0304','GLGT','María Torres',   CURRENT_DATE-6,  'Baja',  false,NULL,              'Baja', 42, 2,CURRENT_DATE+8, 'EXP-DS-004',22, CURRENT_DATE-6, 'Liberación',         NULL,'María Torres', NULL,                                                'dropship',CURRENT_DATE+14,false,false, NOW()-INTERVAL '6 days'),
('b1000000-0000-0000-0000-000000000005','PO-2026-0305','INT', 'Roberto Flores', CURRENT_DATE-7,  'Media', false,NULL,              'Media',215,4,CURRENT_DATE+4, 'EXP-DS-005',72, CURRENT_DATE-7, 'Recepción de Carga', NULL,'Roberto Flores','Verificar peso y volumen del embarque',             'dropship',CURRENT_DATE+6, false,false, NOW()-INTERVAL '7 days'),
('b1000000-0000-0000-0000-000000000006','PO-2026-0306','VZ',  'Ana García',     CURRENT_DATE-9,  'Alta',  true, 'TERRESTRE',      'Alta', 490,5,CURRENT_DATE+1, 'EXP-DS-006',122,CURRENT_DATE-9, 'Facturación',        NULL,'Ana García',   'Factura requiere aprobación gerencia',              'dropship',CURRENT_DATE+5, false,false, NOW()-INTERVAL '9 days'),
('b1000000-0000-0000-0000-000000000007','PO-2026-0307','GT',  'María Torres',   CURRENT_DATE-11, 'Baja',  false,NULL,              'Baja', 65, 2,CURRENT_DATE+10,'EXP-DS-007',32, CURRENT_DATE-11,'Notificado',         NULL,'María Torres', NULL,                                                'dropship',CURRENT_DATE+3, false,true,  NOW()-INTERVAL '11 days'),
('b1000000-0000-0000-0000-000000000008','PO-2026-0308','SV',  'Roberto Flores', CURRENT_DATE-13, 'Media', false,NULL,              'Media',155,3,CURRENT_DATE+6, 'EXP-DS-008',52, CURRENT_DATE-13,'En Proceso',         NULL,'Roberto Flores','Documentos en revisión por aduana',                'dropship',CURRENT_DATE+9, false,false, NOW()-INTERVAL '13 days'),
('b1000000-0000-0000-0000-000000000009','PO-2026-0309','CR',  'Ana García',     CURRENT_DATE-14, 'Alta',  false,NULL,              'Alta', 565,6,CURRENT_DATE+3, 'EXP-DS-009',142,CURRENT_DATE-14,'Asignado',           NULL,'Ana García',   'Carga especial: permisos SENASA requeridos',        'dropship',CURRENT_DATE+7, false,false, NOW()-INTERVAL '14 days'),
('b1000000-0000-0000-0000-000000000010','PO-2026-0310','MI',  'María Torres',   CURRENT_DATE-16, 'Baja',  false,NULL,              'Baja', 82, 2,CURRENT_DATE+12,'EXP-DS-010',42, CURRENT_DATE-16,'Notificado',         NULL,'María Torres', NULL,                                                'dropship',CURRENT_DATE+2, false,true,  NOW()-INTERVAL '16 days'),
('b1000000-0000-0000-0000-000000000011','PO-2026-0311','GT',  'Roberto Flores', CURRENT_DATE-17, 'Media', false,NULL,              'Media',195,3,CURRENT_DATE+7, 'EXP-DS-011',65, CURRENT_DATE-17,'Espera de Respuesta',NULL,'Roberto Flores','Esperando confirmación del proveedor',              'dropship',CURRENT_DATE+8, true, false, NOW()-INTERVAL '17 days'),
('b1000000-0000-0000-0000-000000000012','PO-2026-0312','SV',  'Ana García',     CURRENT_DATE-18, 'Alta',  true, 'DOCUMENTOS',    'Alta', 510,5,CURRENT_DATE+2, 'EXP-DS-012',128,CURRENT_DATE-18,'Recepción de Carga', NULL,'Ana García',   'Carga llegó al puerto - pendiente inspección',     'dropship',CURRENT_DATE+4, false,false, NOW()-INTERVAL '18 days'),

-- ─── MES ANTERIOR ───
('b1000000-0000-0000-0000-000000000013','PO-2026-0213','CR',  'María Torres',   CURRENT_DATE-32, 'Media', false,NULL,              'Media',175,3,CURRENT_DATE-25,'EXP-DS-013',58, CURRENT_DATE-32,'Notificado',         NULL,'María Torres', NULL,                                                'dropship',CURRENT_DATE-22,false,true,  NOW()-INTERVAL '32 days'),
('b1000000-0000-0000-0000-000000000014','PO-2026-0214','GLSV','Roberto Flores', CURRENT_DATE-35, 'Alta',  true, 'CLIENTE VIP',   'Alta', 540,5,CURRENT_DATE-28,'EXP-DS-014',135,CURRENT_DATE-35,'Notificado',         NULL,'Roberto Flores',NULL,                                                'dropship',CURRENT_DATE-25,false,true,  NOW()-INTERVAL '35 days'),
('b1000000-0000-0000-0000-000000000015','PO-2026-0215','INT', 'Ana García',     CURRENT_DATE-37, 'Baja',  false,NULL,              'Baja', 48, 2,CURRENT_DATE-30,'EXP-DS-015',24, CURRENT_DATE-37,'Notificado',         NULL,'Ana García',   NULL,                                                'dropship',CURRENT_DATE-28,false,false, NOW()-INTERVAL '37 days'),
('b1000000-0000-0000-0000-000000000016','PO-2026-0216','VZ',  'María Torres',   CURRENT_DATE-40, 'Media', false,NULL,              'Media',220,4,CURRENT_DATE-33,'EXP-DS-016',74, CURRENT_DATE-40,'Notificado',         NULL,'María Torres', NULL,                                                'dropship',CURRENT_DATE-30,true, true,  NOW()-INTERVAL '40 days'),
('b1000000-0000-0000-0000-000000000017','PO-2026-0217','GT',  'Roberto Flores', CURRENT_DATE-42, 'Alta',  false,NULL,              'Alta', 475,5,CURRENT_DATE-35,'EXP-DS-017',118,CURRENT_DATE-42,'Notificado',         NULL,'Roberto Flores',NULL,                                                'dropship',CURRENT_DATE-32,false,true,  NOW()-INTERVAL '42 days'),
('b1000000-0000-0000-0000-000000000018','PO-2026-0218','SV',  'Ana García',     CURRENT_DATE-45, 'Baja',  false,NULL,              'Baja', 55, 2,CURRENT_DATE-38,'EXP-DS-018',28, CURRENT_DATE-45,'Notificado',         NULL,'Ana García',   NULL,                                                'dropship',CURRENT_DATE-35,false,false, NOW()-INTERVAL '45 days'),
('b1000000-0000-0000-0000-000000000019','PO-2026-0219','CR',  'María Torres',   CURRENT_DATE-48, 'Media', false,NULL,              'Media',165,3,CURRENT_DATE-41,'EXP-DS-019',55, CURRENT_DATE-48,'Notificado',         NULL,'María Torres', NULL,                                                'dropship',CURRENT_DATE-38,false,true,  NOW()-INTERVAL '48 days'),
('b1000000-0000-0000-0000-000000000020','PO-2026-0220','MI',  'Roberto Flores', CURRENT_DATE-50, 'Alta',  true, 'TRÁNSITO CORTO','Alta', 555,6,CURRENT_DATE-43,'EXP-DS-020',140,CURRENT_DATE-50,'Notificado',         NULL,'Roberto Flores',NULL,                                                'dropship',CURRENT_DATE-40,true, true,  NOW()-INTERVAL '50 days'),

-- ─── HACE 2-3 MESES ───
('b1000000-0000-0000-0000-000000000021','PO-2025-1221','GT',  'Ana García',     CURRENT_DATE-65, 'Baja',  false,NULL,              'Baja', 60, 2,CURRENT_DATE-58,'EXP-DS-021',30, CURRENT_DATE-65,'Notificado',         NULL,'Ana García',   NULL,'dropship',CURRENT_DATE-55,false,true,  NOW()-INTERVAL '65 days'),
('b1000000-0000-0000-0000-000000000022','PO-2025-1222','SV',  'María Torres',   CURRENT_DATE-70, 'Media', false,NULL,              'Media',150,3,CURRENT_DATE-63,'EXP-DS-022',50, CURRENT_DATE-70,'Notificado',         NULL,'María Torres', NULL,'dropship',CURRENT_DATE-60,false,false, NOW()-INTERVAL '70 days'),
('b1000000-0000-0000-0000-000000000023','PO-2025-1223','CR',  'Roberto Flores', CURRENT_DATE-75, 'Alta',  true, 'TRÁNSITO CORTO','Alta', 560,6,CURRENT_DATE-68,'EXP-DS-023',140,CURRENT_DATE-75,'Notificado',         NULL,'Roberto Flores',NULL,'dropship',CURRENT_DATE-65,true, true,  NOW()-INTERVAL '75 days'),
('b1000000-0000-0000-0000-000000000024','PO-2025-1224','VZ',  'Ana García',     CURRENT_DATE-80, 'Baja',  false,NULL,              'Baja', 40, 2,CURRENT_DATE-73,'EXP-DS-024',20, CURRENT_DATE-80,'Notificado',         NULL,'Ana García',   NULL,'dropship',CURRENT_DATE-70,false,true,  NOW()-INTERVAL '80 days'),
('b1000000-0000-0000-0000-000000000025','PO-2025-1225','MI',  'María Torres',   CURRENT_DATE-85, 'Media', false,NULL,              'Media',180,3,CURRENT_DATE-78,'EXP-DS-025',60, CURRENT_DATE-85,'Notificado',         NULL,'María Torres', NULL,'dropship',CURRENT_DATE-75,false,false, NOW()-INTERVAL '85 days');

-- =============================================
-- 5. EXPEDIENTES ZF
-- =============================================
INSERT INTO expedientes (
  id, po_tiquetera, tipo_po, solicitante,
  fecha_solicitud, prioridad, prioridad_urgente, motivo_urgencia,
  dificultad, tiempo_minutos, dias_entrega,
  fecha_requerimiento, exp_id, lineas_oc,
  fecha_creacion_expediente, estado_expediente, motivo_revision,
  responsable_creacion, instrucciones_adicionales,
  tipo_modulo, eta_real, transito_corto, ok_pais, created_at
) VALUES

-- ─── MES ACTUAL ───
('c1000000-0000-0000-0000-000000000001','ZF-2026-0301','GT',  'Luis Ramírez',  CURRENT_DATE-1,  'Alta',  false,NULL,              'Baja', 52, 2,CURRENT_DATE+4, 'EXP-ZF-001',26, CURRENT_DATE-1, 'Asignado',            NULL,'Luis Ramírez', 'Verificar certificado de origen CL',               'zf',CURRENT_DATE+10,false,false, NOW()-INTERVAL '1 day'),
('c1000000-0000-0000-0000-000000000002','ZF-2026-0302','SV',  'Sandra López',  CURRENT_DATE-3,  'Media', false,NULL,              'Media',188,3,CURRENT_DATE+6, 'EXP-ZF-002',63, CURRENT_DATE-3, 'En Proceso',          NULL,'Sandra López', 'Coordinar con agente aduanal para liberación',     'zf',CURRENT_DATE+12,false,false, NOW()-INTERVAL '3 days'),
('c1000000-0000-0000-0000-000000000003','ZF-2026-0303','CR',  'Luis Ramírez',  CURRENT_DATE-5,  'Alta',  true, 'DOCUMENTOS',    'Alta', 525,5,CURRENT_DATE+2, 'EXP-ZF-003',132,CURRENT_DATE-5, 'Espera de Respuesta', NULL,'Luis Ramírez', 'Pendiente respuesta ministerio de hacienda',       'zf',CURRENT_DATE+7, false,false, NOW()-INTERVAL '5 days'),
('c1000000-0000-0000-0000-000000000004','ZF-2026-0304','GLGT','María Torres',  CURRENT_DATE-6,  'Baja',  false,NULL,              'Baja', 43, 2,CURRENT_DATE+9, 'EXP-ZF-004',21, CURRENT_DATE-6, 'Completado',          NULL,'María Torres', NULL,                                               'zf',CURRENT_DATE+14,false,false, NOW()-INTERVAL '6 days'),
('c1000000-0000-0000-0000-000000000005','ZF-2026-0305','INT', 'Sandra López',  CURRENT_DATE-8,  'Alta',  true, 'EMBARQUE CRÍTICO','Alta',495,5,CURRENT_DATE+3, 'EXP-ZF-005',124,CURRENT_DATE-8, 'Arribo de Carga',     NULL,'Sandra López', 'Carga llegó — inspección aduanal en progreso',     'zf',CURRENT_DATE+5, false,false, NOW()-INTERVAL '8 days'),
('c1000000-0000-0000-0000-000000000006','ZF-2026-0306','VZ',  'Luis Ramírez',  CURRENT_DATE-10, 'Media', false,NULL,              'Media',212,4,CURRENT_DATE+5, 'EXP-ZF-006',71, CURRENT_DATE-10,'Pendiente Proforma',  NULL,'Luis Ramírez', 'Proforma pendiente de firma del proveedor',        'zf',CURRENT_DATE+6, false,false, NOW()-INTERVAL '10 days'),
('c1000000-0000-0000-0000-000000000007','ZF-2026-0307','GT',  'Sandra López',  CURRENT_DATE-12, 'Baja',  false,NULL,              'Baja', 66, 2,CURRENT_DATE+11,'EXP-ZF-007',33, CURRENT_DATE-12,'Liberación',          NULL,'Sandra López', NULL,                                               'zf',CURRENT_DATE+4, false,false, NOW()-INTERVAL '12 days'),
('c1000000-0000-0000-0000-000000000008','ZF-2026-0308','SV',  'Luis Ramírez',  CURRENT_DATE-14, 'Media', false,NULL,              'Media',152,3,CURRENT_DATE+7, 'EXP-ZF-008',51, CURRENT_DATE-14,'Asignado',            NULL,'Luis Ramírez', 'Pendiente asignación de bodega zona franca',       'zf',CURRENT_DATE+8, false,false, NOW()-INTERVAL '14 days'),
('c1000000-0000-0000-0000-000000000009','ZF-2026-0309','CR',  'María Torres',  CURRENT_DATE-15, 'Alta',  false,NULL,              'Alta', 568,6,CURRENT_DATE+3, 'EXP-ZF-009',143,CURRENT_DATE-15,'Espera de Respuesta', NULL,'María Torres', 'Autoridades portuarias esperando documentos',      'zf',CURRENT_DATE+6, false,false, NOW()-INTERVAL '15 days'),
('c1000000-0000-0000-0000-000000000010','ZF-2026-0310','MI',  'Sandra López',  CURRENT_DATE-17, 'Baja',  false,NULL,              'Baja', 84, 2,CURRENT_DATE+13,'EXP-ZF-010',43, CURRENT_DATE-17,'Completado',          NULL,'Sandra López', NULL,                                               'zf',CURRENT_DATE+2, false,false, NOW()-INTERVAL '17 days'),
('c1000000-0000-0000-0000-000000000011','ZF-2026-0311','GT',  'Luis Ramírez',  CURRENT_DATE-19, 'Media', false,NULL,              'Media',198,3,CURRENT_DATE+7, 'EXP-ZF-011',66, CURRENT_DATE-19,'Arribo de Carga',     NULL,'Luis Ramírez', 'Carga en inspección — coordinar con bodega',       'zf',CURRENT_DATE+3, false,false, NOW()-INTERVAL '19 days'),
('c1000000-0000-0000-0000-000000000012','ZF-2026-0312','SV',  'Sandra López',  CURRENT_DATE-21, 'Alta',  true, 'PRIORIDAD ALTA','Alta', 515,5,CURRENT_DATE+2, 'EXP-ZF-012',129,CURRENT_DATE-21,'Pendiente Proforma',  NULL,'Sandra López', 'Proforma lista pero requiere validación legal',    'zf',CURRENT_DATE+4, false,false, NOW()-INTERVAL '21 days'),

-- ─── MES ANTERIOR ───
('c1000000-0000-0000-0000-000000000013','ZF-2026-0213','CR',  'Luis Ramírez',  CURRENT_DATE-33, 'Media', false,NULL,              'Media',178,3,CURRENT_DATE-26,'EXP-ZF-013',59, CURRENT_DATE-33,'Liberación',          NULL,'Luis Ramírez', NULL,                                               'zf',CURRENT_DATE-20,false,false, NOW()-INTERVAL '33 days'),
('c1000000-0000-0000-0000-000000000014','ZF-2026-0214','GLSV','Sandra López',  CURRENT_DATE-36, 'Alta',  true, 'CLIENTE VIP',   'Alta', 545,5,CURRENT_DATE-29,'EXP-ZF-014',136,CURRENT_DATE-36,'Liberación',          NULL,'Sandra López', NULL,                                               'zf',CURRENT_DATE-23,false,false, NOW()-INTERVAL '36 days'),
('c1000000-0000-0000-0000-000000000015','ZF-2026-0215','INT', 'María Torres',  CURRENT_DATE-38, 'Baja',  false,NULL,              'Baja', 46, 2,CURRENT_DATE-31,'EXP-ZF-015',23, CURRENT_DATE-38,'Liberación',          NULL,'María Torres', NULL,                                               'zf',CURRENT_DATE-26,false,false, NOW()-INTERVAL '38 days'),
('c1000000-0000-0000-0000-000000000016','ZF-2026-0216','VZ',  'Luis Ramírez',  CURRENT_DATE-41, 'Media', false,NULL,              'Media',225,4,CURRENT_DATE-34,'EXP-ZF-016',75, CURRENT_DATE-41,'Liberación',          NULL,'Luis Ramírez', NULL,                                               'zf',CURRENT_DATE-29,false,false, NOW()-INTERVAL '41 days'),
('c1000000-0000-0000-0000-000000000017','ZF-2026-0217','GT',  'Sandra López',  CURRENT_DATE-43, 'Alta',  false,NULL,              'Alta', 478,5,CURRENT_DATE-36,'EXP-ZF-017',119,CURRENT_DATE-43,'Liberación',          NULL,'Sandra López', NULL,                                               'zf',CURRENT_DATE-31,false,false, NOW()-INTERVAL '43 days'),
('c1000000-0000-0000-0000-000000000018','ZF-2026-0218','SV',  'María Torres',  CURRENT_DATE-46, 'Baja',  false,NULL,              'Baja', 57, 2,CURRENT_DATE-39,'EXP-ZF-018',29, CURRENT_DATE-46,'Liberación',          NULL,'María Torres', NULL,                                               'zf',CURRENT_DATE-34,false,false, NOW()-INTERVAL '46 days'),

-- ─── HACE 2-3 MESES ───
('c1000000-0000-0000-0000-000000000019','ZF-2025-1219','CR',  'Luis Ramírez',  CURRENT_DATE-67, 'Baja',  false,NULL,              'Baja', 62, 2,CURRENT_DATE-60,'EXP-ZF-019',31, CURRENT_DATE-67,'Liberación',          NULL,'Luis Ramírez', NULL,'zf',CURRENT_DATE-56,false,false, NOW()-INTERVAL '67 days'),
('c1000000-0000-0000-0000-000000000020','ZF-2025-1220','SV',  'Sandra López',  CURRENT_DATE-72, 'Media', false,NULL,              'Media',155,3,CURRENT_DATE-65,'EXP-ZF-020',52, CURRENT_DATE-72,'Liberación',          NULL,'Sandra López', NULL,'zf',CURRENT_DATE-62,false,false, NOW()-INTERVAL '72 days');


-- =============================================
-- 6. HISTORIAL DE CAMBIOS
-- =============================================
INSERT INTO expedientes_historial (expediente_id, campo_modificado, valor_anterior, valor_nuevo, usuario, fecha_cambio)
VALUES
  -- Dropship en curso
  ('b1000000-0000-0000-0000-000000000002','Estado','Asignado','En Proceso',                'Ana García',     NOW()-INTERVAL '1 day 12 hours'),
  ('b1000000-0000-0000-0000-000000000003','Estado','Asignado','En Proceso',                'Roberto Flores', NOW()-INTERVAL '3 days 8 hours'),
  ('b1000000-0000-0000-0000-000000000003','Estado','En Proceso','Espera de Respuesta',     'Roberto Flores', NOW()-INTERVAL '2 days 16 hours'),
  ('b1000000-0000-0000-0000-000000000004','Estado','Asignado','En Proceso',                'María Torres',   NOW()-INTERVAL '5 days 10 hours'),
  ('b1000000-0000-0000-0000-000000000004','Estado','En Proceso','Liberación',              'María Torres',   NOW()-INTERVAL '4 days 6 hours'),
  ('b1000000-0000-0000-0000-000000000005','Estado','Asignado','En Proceso',                'Roberto Flores', NOW()-INTERVAL '6 days 14 hours'),
  ('b1000000-0000-0000-0000-000000000005','Estado','En Proceso','Recepción de Carga',      'Roberto Flores', NOW()-INTERVAL '5 days 8 hours'),
  ('b1000000-0000-0000-0000-000000000006','Estado','Asignado','En Proceso',                'Ana García',     NOW()-INTERVAL '8 days 10 hours'),
  ('b1000000-0000-0000-0000-000000000006','Estado','En Proceso','Liberación',              'Ana García',     NOW()-INTERVAL '7 days 6 hours'),
  ('b1000000-0000-0000-0000-000000000006','Estado','Liberación','Facturación',             'Ana García',     NOW()-INTERVAL '6 days 12 hours'),
  -- Dropship completados mes actual
  ('b1000000-0000-0000-0000-000000000007','Estado','Asignado','En Proceso',                'María Torres',   NOW()-INTERVAL '10 days 10 hours'),
  ('b1000000-0000-0000-0000-000000000007','Estado','En Proceso','Liberación',              'María Torres',   NOW()-INTERVAL '9 days 6 hours'),
  ('b1000000-0000-0000-0000-000000000007','Estado','Liberación','Recepción de Carga',      'María Torres',   NOW()-INTERVAL '8 days 8 hours'),
  ('b1000000-0000-0000-0000-000000000007','Estado','Recepción de Carga','Facturación',     'María Torres',   NOW()-INTERVAL '7 days 12 hours'),
  ('b1000000-0000-0000-0000-000000000007','Estado','Facturación','Notificado',             'María Torres',   NOW()-INTERVAL '6 days 10 hours'),
  ('b1000000-0000-0000-0000-000000000010','Estado','Asignado','En Proceso',                'María Torres',   NOW()-INTERVAL '15 days 8 hours'),
  ('b1000000-0000-0000-0000-000000000010','Estado','En Proceso','Recepción de Carga',      'María Torres',   NOW()-INTERVAL '13 days 6 hours'),
  ('b1000000-0000-0000-0000-000000000010','Estado','Recepción de Carga','Liberación',      'María Torres',   NOW()-INTERVAL '11 days 14 hours'),
  ('b1000000-0000-0000-0000-000000000010','Estado','Liberación','Facturación',             'María Torres',   NOW()-INTERVAL '10 days 10 hours'),
  ('b1000000-0000-0000-0000-000000000010','Estado','Facturación','Notificado',             'María Torres',   NOW()-INTERVAL '9 days 8 hours'),
  -- ZF en curso
  ('c1000000-0000-0000-0000-000000000002','Estado','Asignado','En Proceso',                'Luis Ramírez',   NOW()-INTERVAL '2 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000003','Estado','Asignado','En Proceso',                'Sandra López',   NOW()-INTERVAL '4 days 14 hours'),
  ('c1000000-0000-0000-0000-000000000003','Estado','En Proceso','Espera de Respuesta',     'Sandra López',   NOW()-INTERVAL '3 days 6 hours'),
  ('c1000000-0000-0000-0000-000000000004','Estado','Asignado','En Proceso',                'María Torres',   NOW()-INTERVAL '5 days 12 hours'),
  ('c1000000-0000-0000-0000-000000000004','Estado','En Proceso','Completado',              'María Torres',   NOW()-INTERVAL '4 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000005','Estado','Asignado','En Proceso',                'Sandra López',   NOW()-INTERVAL '7 days 8 hours'),
  ('c1000000-0000-0000-0000-000000000005','Estado','En Proceso','Completado',              'Sandra López',   NOW()-INTERVAL '6 days 12 hours'),
  ('c1000000-0000-0000-0000-000000000005','Estado','Completado','Arribo de Carga',         'Sandra López',   NOW()-INTERVAL '5 days 16 hours'),
  ('c1000000-0000-0000-0000-000000000006','Estado','Asignado','En Proceso',                'Luis Ramírez',   NOW()-INTERVAL '9 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000006','Estado','En Proceso','Espera de Respuesta',     'Luis Ramírez',   NOW()-INTERVAL '8 days 8 hours'),
  ('c1000000-0000-0000-0000-000000000006','Estado','Espera de Respuesta','Completado',     'Luis Ramírez',   NOW()-INTERVAL '7 days 14 hours'),
  ('c1000000-0000-0000-0000-000000000006','Estado','Completado','Arribo de Carga',         'Luis Ramírez',   NOW()-INTERVAL '6 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000006','Estado','Arribo de Carga','Pendiente Proforma', 'Luis Ramírez',   NOW()-INTERVAL '5 days 6 hours'),
  ('c1000000-0000-0000-0000-000000000007','Estado','Asignado','En Proceso',                'Sandra López',   NOW()-INTERVAL '11 days 8 hours'),
  ('c1000000-0000-0000-0000-000000000007','Estado','En Proceso','Completado',              'Sandra López',   NOW()-INTERVAL '10 days 12 hours'),
  ('c1000000-0000-0000-0000-000000000007','Estado','Completado','Liberación',              'Sandra López',   NOW()-INTERVAL '9 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000011','Estado','Asignado','En Proceso',                'Luis Ramírez',   NOW()-INTERVAL '18 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000011','Estado','En Proceso','Espera de Respuesta',     'Luis Ramírez',   NOW()-INTERVAL '16 days 8 hours'),
  ('c1000000-0000-0000-0000-000000000011','Estado','Espera de Respuesta','Completado',     'Luis Ramírez',   NOW()-INTERVAL '14 days 6 hours'),
  ('c1000000-0000-0000-0000-000000000011','Estado','Completado','Arribo de Carga',         'Luis Ramírez',   NOW()-INTERVAL '12 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000012','Estado','Asignado','En Proceso',                'Sandra López',   NOW()-INTERVAL '20 days 12 hours'),
  ('c1000000-0000-0000-0000-000000000012','Estado','En Proceso','Completado',              'Sandra López',   NOW()-INTERVAL '18 days 10 hours'),
  ('c1000000-0000-0000-0000-000000000012','Estado','Completado','Arribo de Carga',         'Sandra López',   NOW()-INTERVAL '16 days 8 hours'),
  ('c1000000-0000-0000-0000-000000000012','Estado','Arribo de Carga','Pendiente Proforma', 'Sandra López',   NOW()-INTERVAL '14 days 6 hours')
ON CONFLICT DO NOTHING;


-- =============================================
-- 7. TIEMPOS ENTRE ESTADOS
--    KPI ZF #1: Creado→Espera de Respuesta ~10 días (≤15 meta ✓)
--    KPI ZF #2: Arribo→Liberación ~32 minutos (≤45 meta ✓)
-- =============================================
INSERT INTO expedientes_tiempos_estados
  (expediente_id, estado_anterior, estado_nuevo, fecha_inicio, fecha_fin, minutos_transcurridos)
VALUES
  -- ── Dropship en curso ──
  ('b1000000-0000-0000-0000-000000000001','Asignado',          'Asignado',            NOW()-INTERVAL '1 day',         NULL, NULL),
  ('b1000000-0000-0000-0000-000000000002','Asignado',          'En Proceso',          NOW()-INTERVAL '1 day 12 hours',NULL, NULL),
  ('b1000000-0000-0000-0000-000000000003','En Proceso',        'Espera de Respuesta', NOW()-INTERVAL '2 days 16 hours',NULL, NULL),
  ('b1000000-0000-0000-0000-000000000006','En Proceso',        'Facturación',         NOW()-INTERVAL '6 days 12 hours',NULL, NULL),

  -- ── Dropship completados (mes actual) ──
  ('b1000000-0000-0000-0000-000000000007','Asignado',          'En Proceso',          NOW()-INTERVAL '11 days', NOW()-INTERVAL '9 days 6 hours', 2634),
  ('b1000000-0000-0000-0000-000000000007','En Proceso',        'Liberación',          NOW()-INTERVAL '9 days 6 hours', NOW()-INTERVAL '8 days 8 hours', 1498),
  ('b1000000-0000-0000-0000-000000000007','Liberación',        'Recepción de Carga',  NOW()-INTERVAL '8 days 8 hours', NOW()-INTERVAL '7 days 12 hours', 1552),
  ('b1000000-0000-0000-0000-000000000007','Recepción de Carga','Facturación',         NOW()-INTERVAL '7 days 12 hours',NOW()-INTERVAL '6 days 10 hours',1580),
  ('b1000000-0000-0000-0000-000000000007','Facturación',       'Notificado',          NOW()-INTERVAL '6 days 10 hours',NOW()-INTERVAL '5 days',        2000),
  ('b1000000-0000-0000-0000-000000000010','Asignado',          'En Proceso',          NOW()-INTERVAL '16 days', NOW()-INTERVAL '14 days 6 hours',2514),
  ('b1000000-0000-0000-0000-000000000010','En Proceso',        'Recepción de Carga',  NOW()-INTERVAL '14 days 6 hours',NOW()-INTERVAL '11 days 14 hours',2668),
  ('b1000000-0000-0000-0000-000000000010','Recepción de Carga','Liberación',          NOW()-INTERVAL '11 days 14 hours',NOW()-INTERVAL '10 days 10 hours',1440),
  ('b1000000-0000-0000-0000-000000000010','Liberación',        'Facturación',         NOW()-INTERVAL '10 days 10 hours',NOW()-INTERVAL '9 days 8 hours',1560),
  ('b1000000-0000-0000-0000-000000000010','Facturación',       'Notificado',          NOW()-INTERVAL '9 days 8 hours', NOW()-INTERVAL '7 days',        2600),

  -- ── ZF en curso ──
  ('c1000000-0000-0000-0000-000000000001','Asignado',          'Asignado',            NOW()-INTERVAL '1 day',          NULL, NULL),
  ('c1000000-0000-0000-0000-000000000002','Asignado',          'En Proceso',          NOW()-INTERVAL '2 days 10 hours',NULL, NULL),
  ('c1000000-0000-0000-0000-000000000003','En Proceso',        'Espera de Respuesta', NOW()-INTERVAL '3 days 6 hours', NULL, NULL),
  ('c1000000-0000-0000-0000-000000000006','Arribo de Carga',   'Pendiente Proforma',  NOW()-INTERVAL '5 days 6 hours', NULL, NULL),
  ('c1000000-0000-0000-0000-000000000011','Completado',        'Arribo de Carga',     NOW()-INTERVAL '12 days 10 hours',NULL, NULL),

  -- ── ZF KPI #1: Asignado→Espera de Respuesta (~10 días = 14400 min) ──
  ('c1000000-0000-0000-0000-000000000003','Asignado',          'Espera de Respuesta', NOW()-INTERVAL '5 days',         NOW()-INTERVAL '3 days', 2880),
  ('c1000000-0000-0000-0000-000000000009','Asignado',          'Espera de Respuesta', NOW()-INTERVAL '15 days',        NOW()-INTERVAL '5 days', 14400),
  ('c1000000-0000-0000-0000-000000000013','Asignado',          'Espera de Respuesta', NOW()-INTERVAL '33 days',        NOW()-INTERVAL '23 days',14400),
  ('c1000000-0000-0000-0000-000000000016','Asignado',          'Espera de Respuesta', NOW()-INTERVAL '41 days',        NOW()-INTERVAL '31 days',14400),
  ('c1000000-0000-0000-0000-000000000019','Asignado',          'Espera de Respuesta', NOW()-INTERVAL '67 days',        NOW()-INTERVAL '57 days',14400),
  ('c1000000-0000-0000-0000-000000000020','Asignado',          'Espera de Respuesta', NOW()-INTERVAL '72 days',        NOW()-INTERVAL '62 days',14400),

  -- ── ZF KPI #2: Arribo de Carga→Liberación (~32 min) ──
  ('c1000000-0000-0000-0000-000000000007','Completado',        'Arribo de Carga',     NOW()-INTERVAL '10 days 14 hours',NOW()-INTERVAL '10 days 14 hours'+INTERVAL '28 minutes',28),
  ('c1000000-0000-0000-0000-000000000007','Arribo de Carga',   'Liberación',          NOW()-INTERVAL '10 days 13 hours',NOW()-INTERVAL '10 days 12 hours 28 minutes',32),
  ('c1000000-0000-0000-0000-000000000014','Arribo de Carga',   'Liberación',          NOW()-INTERVAL '30 days 2 hours', NOW()-INTERVAL '30 days 1 hour 25 minutes',35),
  ('c1000000-0000-0000-0000-000000000015','Arribo de Carga',   'Liberación',          NOW()-INTERVAL '32 days 3 hours', NOW()-INTERVAL '32 days 2 hours 27 minutes',33),
  ('c1000000-0000-0000-0000-000000000017','Arribo de Carga',   'Liberación',          NOW()-INTERVAL '37 days 4 hours', NOW()-INTERVAL '37 days 3 hours 30 minutes',30),
  ('c1000000-0000-0000-0000-000000000019','Arribo de Carga',   'Liberación',          NOW()-INTERVAL '61 days 5 hours', NOW()-INTERVAL '61 days 4 hours 28 minutes',32),
  ('c1000000-0000-0000-0000-000000000020','Arribo de Carga',   'Liberación',          NOW()-INTERVAL '66 days 6 hours', NOW()-INTERVAL '66 days 5 hours 26 minutes',34),

  -- ── ZF completados intermedios ──
  ('c1000000-0000-0000-0000-000000000004','Asignado',          'En Proceso',          NOW()-INTERVAL '6 days',         NOW()-INTERVAL '5 days',  1440),
  ('c1000000-0000-0000-0000-000000000004','En Proceso',        'Completado',          NOW()-INTERVAL '5 days',         NOW()-INTERVAL '4 days',  1440),
  ('c1000000-0000-0000-0000-000000000005','Asignado',          'En Proceso',          NOW()-INTERVAL '8 days',         NOW()-INTERVAL '7 days',  1440),
  ('c1000000-0000-0000-0000-000000000005','En Proceso',        'Completado',          NOW()-INTERVAL '7 days',         NOW()-INTERVAL '6 days',  1440),
  ('c1000000-0000-0000-0000-000000000005','Completado',        'Arribo de Carga',     NOW()-INTERVAL '6 days',         NULL,                     NULL),
  ('c1000000-0000-0000-0000-000000000010','Asignado',          'En Proceso',          NOW()-INTERVAL '17 days',        NOW()-INTERVAL '15 days', 2880),
  ('c1000000-0000-0000-0000-000000000010','En Proceso',        'Completado',          NOW()-INTERVAL '15 days',        NOW()-INTERVAL '13 days', 2880)
ON CONFLICT DO NOTHING;

-- =============================================
-- ✅ SEED COMPLETADO
-- Resumen:
--   8 usuarios (incl. Bodega)
--   25 expedientes Dropship
--   20 expedientes ZF
--   44 registros de historial
--   ~45 registros de tiempos entre estados
--   KPI ZF #1: ~10 días ✓ (meta ≤15)
--   KPI ZF #2: ~32 minutos ✓ (meta ≤45)
--   Correos de notificación configurados
-- =============================================
