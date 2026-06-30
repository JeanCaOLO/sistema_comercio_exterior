-- =============================================
-- SEED EXPANDIDO — 55 EXPEDIENTES FICTICIOS
-- 30 Dropship + 25 ZF
-- Ejecutar en: Supabase > SQL Editor
-- Este seed REEMPLAZA el seed anterior.
-- =============================================

-- =============================================
-- PASO 0 — AGREGAR COLUMNAS FALTANTES (si no existen)
-- =============================================
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS etd date;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS eta_real date;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS transito_corto boolean DEFAULT false;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS ok_pais boolean DEFAULT false;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS tiempo_real_minutos integer;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS dias_entrega_real integer;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS fecha_liberacion timestamptz;

-- =============================================
-- PASO 1 — LIMPIAR DATOS ANTERIORES DEL SEED
-- =============================================
DELETE FROM expedientes_tiempos_estados
 WHERE expediente_id::text LIKE 'b1000000%'
    OR expediente_id::text LIKE 'c1000000%'
    OR expediente_id::text LIKE 'd1000000%'
    OR expediente_id::text LIKE 'e1000000%';

DELETE FROM expedientes_historial
 WHERE expediente_id::text LIKE 'b1000000%'
    OR expediente_id::text LIKE 'c1000000%'
    OR expediente_id::text LIKE 'd1000000%'
    OR expediente_id::text LIKE 'e1000000%';

DELETE FROM expedientes
 WHERE id::text LIKE 'b1000000%'
    OR id::text LIKE 'c1000000%'
    OR id::text LIKE 'd1000000%'
    OR id::text LIKE 'e1000000%';

-- =============================================
-- PASO 2 — USUARIOS (mantener o actualizar)
-- =============================================
INSERT INTO usuarios (id, nombre, email, rol, departamento, estado, created_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001','Carlos Mendoza', 'carlos.mendoza@empresa.com','Administrador',    'Operaciones', 'Activo', NOW()-INTERVAL '6 months'),
  ('a1000000-0000-0000-0000-000000000002','Ana García',     'ana.garcia@empresa.com',    'Gestor',           'Logística',   'Activo', NOW()-INTERVAL '5 months'),
  ('a1000000-0000-0000-0000-000000000003','Luis Ramírez',   'luis.ramirez@empresa.com',  'Gestor',           'Zona Franca', 'Activo', NOW()-INTERVAL '4 months'),
  ('a1000000-0000-0000-0000-000000000004','María Torres',   'maria.torres@empresa.com',  'Gestor',           'Logística',   'Activo', NOW()-INTERVAL '3 months'),
  ('a1000000-0000-0000-0000-000000000005','Roberto Flores', 'roberto.flores@empresa.com','Gestor',           'Comercial',   'Activo', NOW()-INTERVAL '2 months'),
  ('a1000000-0000-0000-0000-000000000006','Sandra López',   'sandra.lopez@empresa.com',  'Gestor',           'Zona Franca', 'Activo', NOW()-INTERVAL '2 months'),
  ('a1000000-0000-0000-0000-000000000007','Diego Herrera',  'diego.herrera@empresa.com', 'Administrador',    'Gerencia',    'Activo', NOW()-INTERVAL '1 month'),
  ('a1000000-0000-0000-0000-000000000008','Patricia Vega',  'patricia.vega@empresa.com', 'Bodega',           'Bodega',      'Activo', NOW()-INTERVAL '1 month')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre, email = EXCLUDED.email,
  rol = EXCLUDED.rol, departamento = EXCLUDED.departamento,
  estado = EXCLUDED.estado;

-- =============================================
-- PASO 3 — 30 EXPEDIENTES DROPSHIP
-- Distribuidos en: mes actual, mes anterior, trimestre
-- =============================================
INSERT INTO expedientes (
  id, po_tiquetera, tipo_po, solicitante,
  fecha_solicitud, prioridad, prioridad_urgente, motivo_urgencia,
  dificultad, tiempo_minutos, dias_entrega,
  fecha_requerimiento, exp_id, lineas_oc,
  fecha_creacion_expediente, estado_expediente,
  responsable_creacion, instrucciones_adicionales,
  tipo_modulo, etd, transito_corto, ok_pais,
  tiempo_real_minutos, dias_entrega_real, fecha_liberacion,
  created_at
) VALUES

-- ── MES ACTUAL: en proceso ──────────────────────────────────
('d1000000-0000-0000-0000-000000000001','PO-2026-0401','GT',   'Ana García',     CURRENT_DATE-1,  'Alta',  false,NULL,                 'Baja', 55,2, CURRENT_DATE+4,  'EXP-DS-001',28, CURRENT_DATE-1,  'Asignado',           'Ana García',   'Revisar documentos de origen',              'dropship',CURRENT_DATE+10,false,false,NULL, NULL,NULL, NOW()-INTERVAL '1 day'),
('d1000000-0000-0000-0000-000000000002','PO-2026-0402','SV',   'Roberto Flores', CURRENT_DATE-2,  'Media', false,NULL,                 'Media',185,3, CURRENT_DATE+5,  'EXP-DS-002',62, CURRENT_DATE-2,  'En Proceso',         'Roberto Flores','Coordinar con proveedor - stock listo',      'dropship',CURRENT_DATE+12,false,false,NULL, NULL,NULL, NOW()-INTERVAL '2 days'),
('d1000000-0000-0000-0000-000000000003','PO-2026-0403','CR',   'Ana García',     CURRENT_DATE-3,  'Alta',  true, 'EMBARQUE URGENTE',  'Alta', 530,5, CURRENT_DATE+2,  'EXP-DS-003',135,CURRENT_DATE-3,  'Espera de Respuesta','Ana García',   'Cliente solicitó adelantar despacho',        'dropship',CURRENT_DATE+7, true, false,NULL, NULL,NULL, NOW()-INTERVAL '3 days'),
('d1000000-0000-0000-0000-000000000004','PO-2026-0404','GLGT', 'María Torres',   CURRENT_DATE-4,  'Baja',  false,NULL,                 'Baja', 42,2, CURRENT_DATE+9,  'EXP-DS-004',22, CURRENT_DATE-4,  'Liberación',         'María Torres', NULL,                                        'dropship',CURRENT_DATE+14,false,false,NULL, NULL,NULL, NOW()-INTERVAL '4 days'),
('d1000000-0000-0000-0000-000000000005','PO-2026-0405','INT',  'Roberto Flores', CURRENT_DATE-5,  'Media', false,NULL,                 'Media',215,4, CURRENT_DATE+4,  'EXP-DS-005',72, CURRENT_DATE-5,  'Recepción de Carga', 'Roberto Flores','Verificar peso y volumen del embarque',      'dropship',CURRENT_DATE+6, false,false,NULL, NULL,NULL, NOW()-INTERVAL '5 days'),
('d1000000-0000-0000-0000-000000000006','PO-2026-0406','VZ',   'Ana García',     CURRENT_DATE-6,  'Alta',  true, 'PROVEEDOR VIP',     'Alta', 490,5, CURRENT_DATE+1,  'EXP-DS-006',122,CURRENT_DATE-6,  'Facturación',        'Ana García',   'Factura requiere aprobación de gerencia',    'dropship',CURRENT_DATE+5, false,false,NULL, NULL,NULL, NOW()-INTERVAL '6 days'),
('d1000000-0000-0000-0000-000000000007','PO-2026-0407','GT',   'María Torres',   CURRENT_DATE-8,  'Baja',  false,NULL,                 'Baja', 65,2, CURRENT_DATE+10, 'EXP-DS-007',32, CURRENT_DATE-8,  'En Proceso',         'María Torres', NULL,                                        'dropship',CURRENT_DATE+3, false,false,NULL, NULL,NULL, NOW()-INTERVAL '8 days'),
('d1000000-0000-0000-0000-000000000008','PO-2026-0408','SV',   'Roberto Flores', CURRENT_DATE-9,  'Media', false,NULL,                 'Media',155,3, CURRENT_DATE+6,  'EXP-DS-008',52, CURRENT_DATE-9,  'Asignado',           'Roberto Flores','Documentos en revisión por aduana',          'dropship',CURRENT_DATE+9, false,false,NULL, NULL,NULL, NOW()-INTERVAL '9 days'),
('d1000000-0000-0000-0000-000000000009','PO-2026-0409','CR',   'Ana García',     CURRENT_DATE-10, 'Alta',  false,NULL,                 'Alta', 565,6, CURRENT_DATE+3,  'EXP-DS-009',142,CURRENT_DATE-10, 'Espera de Respuesta','Ana García',   'Permisos SENASA requeridos',                 'dropship',CURRENT_DATE+7, false,false,NULL, NULL,NULL, NOW()-INTERVAL '10 days'),
('d1000000-0000-0000-0000-000000000010','PO-2026-0410','MI',   'María Torres',   CURRENT_DATE-11, 'Media', false,NULL,                 'Media',195,3, CURRENT_DATE+7,  'EXP-DS-010',65, CURRENT_DATE-11, 'En Proceso',         'María Torres', 'Esperando confirmación del proveedor',       'dropship',CURRENT_DATE+8, true, false,NULL, NULL,NULL, NOW()-INTERVAL '11 days'),

-- ── MES ACTUAL: completados (Notificado) ───────────────────
('d1000000-0000-0000-0000-000000000011','PO-2026-0411','GT',   'Roberto Flores', CURRENT_DATE-13, 'Baja',  false,NULL,                 'Baja', 65,2, CURRENT_DATE-6,  'EXP-DS-011',32, CURRENT_DATE-13, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-4, false,true, 18720,13,NOW()-INTERVAL '2 days',  NOW()-INTERVAL '13 days'),
('d1000000-0000-0000-0000-000000000012','PO-2026-0412','SV',   'Ana García',     CURRENT_DATE-15, 'Alta',  true, 'TRÁNSITO CORTO',    'Alta', 510,5, CURRENT_DATE-8,  'EXP-DS-012',128,CURRENT_DATE-15, 'Notificado',         'Ana García',   'Carga llegó al puerto',                     'dropship',CURRENT_DATE-5, true, true, 21600,15,NOW()-INTERVAL '1 day',  NOW()-INTERVAL '15 days'),
('d1000000-0000-0000-0000-000000000013','PO-2026-0413','CR',   'María Torres',   CURRENT_DATE-14, 'Media', false,NULL,                 'Media',178,3, CURRENT_DATE-7,  'EXP-DS-013',58, CURRENT_DATE-14, 'Notificado',         'María Torres', NULL,                                        'dropship',CURRENT_DATE-4, false,false,20160,14,NOW()-INTERVAL '2 days',  NOW()-INTERVAL '14 days'),
('d1000000-0000-0000-0000-000000000014','PO-2026-0414','GLGT', 'Roberto Flores', CURRENT_DATE-12, 'Baja',  false,NULL,                 'Baja', 48,2, CURRENT_DATE-5,  'EXP-DS-014',24, CURRENT_DATE-12, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-3, false,true, 17280,12,NOW()-INTERVAL '3 days',  NOW()-INTERVAL '12 days'),

-- ── MES ANTERIOR ───────────────────────────────────────────
('d1000000-0000-0000-0000-000000000015','PO-2026-0315','INT',  'Ana García',     CURRENT_DATE-33, 'Media', false,NULL,                 'Media',175,3, CURRENT_DATE-26, 'EXP-DS-015',58, CURRENT_DATE-33, 'Notificado',         'Ana García',   NULL,                                        'dropship',CURRENT_DATE-22,false,true, 47520,33,NOW()-INTERVAL '2 days 3 hours',NOW()-INTERVAL '33 days'),
('d1000000-0000-0000-0000-000000000016','PO-2026-0316','VZ',   'Roberto Flores', CURRENT_DATE-35, 'Alta',  true, 'CLIENTE VIP',       'Alta', 540,5, CURRENT_DATE-28, 'EXP-DS-016',135,CURRENT_DATE-35, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-25,false,true, 50400,35,NOW()-INTERVAL '1 day 4 hours', NOW()-INTERVAL '35 days'),
('d1000000-0000-0000-0000-000000000017','PO-2026-0317','GT',   'María Torres',   CURRENT_DATE-38, 'Baja',  false,NULL,                 'Baja', 48,2, CURRENT_DATE-31, 'EXP-DS-017',24, CURRENT_DATE-38, 'Notificado',         'María Torres', NULL,                                        'dropship',CURRENT_DATE-28,false,false,54720,38,NOW()-INTERVAL '4 hours',    NOW()-INTERVAL '38 days'),
('d1000000-0000-0000-0000-000000000018','PO-2026-0318','SV',   'Ana García',     CURRENT_DATE-40, 'Media', false,NULL,                 'Media',220,4, CURRENT_DATE-33, 'EXP-DS-018',74, CURRENT_DATE-40, 'Notificado',         'Ana García',   NULL,                                        'dropship',CURRENT_DATE-30,true, true, 57600,40,NOW()-INTERVAL '6 hours',    NOW()-INTERVAL '40 days'),
('d1000000-0000-0000-0000-000000000019','PO-2026-0319','CR',   'Roberto Flores', CURRENT_DATE-42, 'Alta',  false,NULL,                 'Alta', 475,5, CURRENT_DATE-35, 'EXP-DS-019',118,CURRENT_DATE-42, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-32,false,true, 60480,42,NOW()-INTERVAL '8 hours',    NOW()-INTERVAL '42 days'),
('d1000000-0000-0000-0000-000000000020','PO-2026-0320','MI',   'María Torres',   CURRENT_DATE-45, 'Baja',  false,NULL,                 'Baja', 55,2, CURRENT_DATE-38, 'EXP-DS-020',28, CURRENT_DATE-45, 'Notificado',         'María Torres', NULL,                                        'dropship',CURRENT_DATE-35,false,false,64800,45,NOW()-INTERVAL '10 hours',   NOW()-INTERVAL '45 days'),
('d1000000-0000-0000-0000-000000000021','PO-2026-0321','GT',   'Ana García',     CURRENT_DATE-48, 'Media', false,NULL,                 'Media',165,3, CURRENT_DATE-41, 'EXP-DS-021',55, CURRENT_DATE-48, 'Notificado',         'Ana García',   NULL,                                        'dropship',CURRENT_DATE-38,false,true, 69120,48,NOW()-INTERVAL '12 hours',   NOW()-INTERVAL '48 days'),
('d1000000-0000-0000-0000-000000000022','PO-2026-0322','GLSV', 'Roberto Flores', CURRENT_DATE-50, 'Alta',  true, 'TRÁNSITO CORTO',    'Alta', 555,6, CURRENT_DATE-43, 'EXP-DS-022',140,CURRENT_DATE-50, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-40,true, true, 72000,50,NOW()-INTERVAL '14 hours',   NOW()-INTERVAL '50 days'),

-- ── TRIMESTRE (hace 2-3 meses) ─────────────────────────────
('d1000000-0000-0000-0000-000000000023','PO-2025-1223','SV',   'Ana García',     CURRENT_DATE-65, 'Baja',  false,NULL,                 'Baja', 60,2, CURRENT_DATE-58, 'EXP-DS-023',30, CURRENT_DATE-65, 'Notificado',         'Ana García',   NULL,                                        'dropship',CURRENT_DATE-55,false,true, 93600,65,NOW()-INTERVAL '2 days',     NOW()-INTERVAL '65 days'),
('d1000000-0000-0000-0000-000000000024','PO-2025-1224','CR',   'María Torres',   CURRENT_DATE-70, 'Media', false,NULL,                 'Media',150,3, CURRENT_DATE-63, 'EXP-DS-024',50, CURRENT_DATE-70, 'Notificado',         'María Torres', NULL,                                        'dropship',CURRENT_DATE-60,false,false,100800,70,NOW()-INTERVAL '3 days',  NOW()-INTERVAL '70 days'),
('d1000000-0000-0000-0000-000000000025','PO-2025-1225','VZ',   'Roberto Flores', CURRENT_DATE-75, 'Alta',  true, 'PRIORIDAD ALTA',    'Alta', 560,6, CURRENT_DATE-68, 'EXP-DS-025',140,CURRENT_DATE-75, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-65,true, true, 108000,75,NOW()-INTERVAL '4 days', NOW()-INTERVAL '75 days'),
('d1000000-0000-0000-0000-000000000026','PO-2025-1226','GT',   'Ana García',     CURRENT_DATE-80, 'Baja',  false,NULL,                 'Baja', 40,2, CURRENT_DATE-73, 'EXP-DS-026',20, CURRENT_DATE-80, 'Notificado',         'Ana García',   NULL,                                        'dropship',CURRENT_DATE-70,false,true, 115200,80,NOW()-INTERVAL '5 days', NOW()-INTERVAL '80 days'),
('d1000000-0000-0000-0000-000000000027','PO-2025-1227','MI',   'María Torres',   CURRENT_DATE-85, 'Media', false,NULL,                 'Media',180,3, CURRENT_DATE-78, 'EXP-DS-027',60, CURRENT_DATE-85, 'Notificado',         'María Torres', NULL,                                        'dropship',CURRENT_DATE-75,false,false,122400,85,NOW()-INTERVAL '6 days',NOW()-INTERVAL '85 days'),
('d1000000-0000-0000-0000-000000000028','PO-2025-1228','SV',   'Roberto Flores', CURRENT_DATE-88, 'Alta',  false,NULL,                 'Alta', 470,5, CURRENT_DATE-81, 'EXP-DS-028',115,CURRENT_DATE-88, 'Notificado',         'Roberto Flores',NULL,                                        'dropship',CURRENT_DATE-78,false,true, 126720,88,NOW()-INTERVAL '7 days',NOW()-INTERVAL '88 days'),
('d1000000-0000-0000-0000-000000000029','PO-2025-1229','CR',   'Ana García',     CURRENT_DATE-90, 'Baja',  false,NULL,                 'Baja', 45,2, CURRENT_DATE-83, 'EXP-DS-029',22, CURRENT_DATE-90, 'Notificado',         'Ana García',   NULL,                                        'dropship',CURRENT_DATE-80,false,false,129600,90,NOW()-INTERVAL '8 days',NOW()-INTERVAL '90 days'),
('d1000000-0000-0000-0000-000000000030','PO-2025-1230','GLGT', 'María Torres',   CURRENT_DATE-92, 'Media', false,NULL,                 'Media',185,3, CURRENT_DATE-85, 'EXP-DS-030',62, CURRENT_DATE-92, 'Notificado',         'María Torres', NULL,                                        'dropship',CURRENT_DATE-82,false,true, 132480,92,NOW()-INTERVAL '9 days',NOW()-INTERVAL '92 days');


-- =============================================
-- PASO 4 — 25 EXPEDIENTES ZF
-- =============================================
INSERT INTO expedientes (
  id, po_tiquetera, tipo_po, solicitante,
  fecha_solicitud, prioridad, prioridad_urgente, motivo_urgencia,
  dificultad, tiempo_minutos, dias_entrega,
  fecha_requerimiento, exp_id, lineas_oc,
  fecha_creacion_expediente, estado_expediente,
  responsable_creacion, instrucciones_adicionales,
  tipo_modulo, eta_real, transito_corto, ok_pais,
  tiempo_real_minutos, dias_entrega_real, fecha_liberacion,
  created_at
) VALUES

-- ── MES ACTUAL: en proceso ──────────────────────────────────
('e1000000-0000-0000-0000-000000000001','ZF-2026-0401','GT',   'Luis Ramírez',  CURRENT_DATE-1,  'Alta',  false,NULL,                 'Baja', 52,2, CURRENT_DATE+4,  'EXP-ZF-001',26, CURRENT_DATE-1,  'Asignado',           'Luis Ramírez', 'Verificar certificado de origen',           'zf',CURRENT_DATE+10,false,false,NULL,NULL,NULL, NOW()-INTERVAL '1 day'),
('e1000000-0000-0000-0000-000000000002','ZF-2026-0402','SV',   'Sandra López',  CURRENT_DATE-3,  'Media', false,NULL,                 'Media',188,3, CURRENT_DATE+6,  'EXP-ZF-002',63, CURRENT_DATE-3,  'En Proceso',         'Sandra López', 'Coordinar con agente aduanal',              'zf',CURRENT_DATE+12,false,false,NULL,NULL,NULL, NOW()-INTERVAL '3 days'),
('e1000000-0000-0000-0000-000000000003','ZF-2026-0403','CR',   'Luis Ramírez',  CURRENT_DATE-4,  'Alta',  true, 'DOCUMENTOS CRÍTICOS','Alta', 525,5, CURRENT_DATE+2,  'EXP-ZF-003',132,CURRENT_DATE-4,  'Espera de Respuesta','Luis Ramírez', 'Pendiente respuesta ministerio',            'zf',CURRENT_DATE+7, false,false,NULL,NULL,NULL, NOW()-INTERVAL '4 days'),
('e1000000-0000-0000-0000-000000000004','ZF-2026-0404','GLGT', 'María Torres',  CURRENT_DATE-5,  'Baja',  false,NULL,                 'Baja', 43,2, CURRENT_DATE+9,  'EXP-ZF-004',21, CURRENT_DATE-5,  'Completado',         'María Torres', NULL,                                        'zf',CURRENT_DATE+14,false,false,NULL,NULL,NULL, NOW()-INTERVAL '5 days'),
('e1000000-0000-0000-0000-000000000005','ZF-2026-0405','INT',  'Sandra López',  CURRENT_DATE-7,  'Alta',  true, 'EMBARQUE CRÍTICO',  'Alta', 495,5, CURRENT_DATE+3,  'EXP-ZF-005',124,CURRENT_DATE-7,  'Arribo de Carga',    'Sandra López', 'Carga en puerto - inspección aduanal',      'zf',CURRENT_DATE+5, false,false,NULL,NULL,NULL, NOW()-INTERVAL '7 days'),
('e1000000-0000-0000-0000-000000000006','ZF-2026-0406','VZ',   'Luis Ramírez',  CURRENT_DATE-9,  'Media', false,NULL,                 'Media',212,4, CURRENT_DATE+5,  'EXP-ZF-006',71, CURRENT_DATE-9,  'Pendiente Proforma', 'Luis Ramírez', 'Proforma pendiente de firma proveedor',     'zf',CURRENT_DATE+6, false,false,NULL,NULL,NULL, NOW()-INTERVAL '9 days'),
('e1000000-0000-0000-0000-000000000007','ZF-2026-0407','GT',   'Sandra López',  CURRENT_DATE-11, 'Baja',  false,NULL,                 'Baja', 66,2, CURRENT_DATE+11, 'EXP-ZF-007',33, CURRENT_DATE-11, 'Liberación',         'Sandra López', NULL,                                        'zf',CURRENT_DATE+4, false,false,NULL,NULL,NULL, NOW()-INTERVAL '11 days'),
('e1000000-0000-0000-0000-000000000008','ZF-2026-0408','SV',   'Luis Ramírez',  CURRENT_DATE-12, 'Media', false,NULL,                 'Media',152,3, CURRENT_DATE+7,  'EXP-ZF-008',51, CURRENT_DATE-12, 'Asignado',           'Luis Ramírez', 'Asignación de bodega zona franca',          'zf',CURRENT_DATE+8, false,false,NULL,NULL,NULL, NOW()-INTERVAL '12 days'),
('e1000000-0000-0000-0000-000000000009','ZF-2026-0409','CR',   'María Torres',  CURRENT_DATE-14, 'Alta',  false,NULL,                 'Alta', 568,6, CURRENT_DATE+3,  'EXP-ZF-009',143,CURRENT_DATE-14, 'Espera de Respuesta','María Torres', 'Autoridades portuarias esperando docs',     'zf',CURRENT_DATE+6, false,false,NULL,NULL,NULL, NOW()-INTERVAL '14 days'),
('e1000000-0000-0000-0000-000000000010','ZF-2026-0410','MI',   'Sandra López',  CURRENT_DATE-16, 'Baja',  false,NULL,                 'Baja', 84,2, CURRENT_DATE+13, 'EXP-ZF-010',43, CURRENT_DATE-16, 'Completado',         'Sandra López', NULL,                                        'zf',CURRENT_DATE+2, false,false,NULL,NULL,NULL, NOW()-INTERVAL '16 days'),

-- ── MES ACTUAL: liberados ──────────────────────────────────
('e1000000-0000-0000-0000-000000000011','ZF-2026-0411','GT',   'Luis Ramírez',  CURRENT_DATE-18, 'Media', false,NULL,                 'Media',198,3, CURRENT_DATE-7,  'EXP-ZF-011',66, CURRENT_DATE-18, 'Liberación',         'Luis Ramírez', 'Liberado por aduana ZF',                    'zf',CURRENT_DATE-3, false,false,25920,18,NOW()-INTERVAL '1 day',     NOW()-INTERVAL '18 days'),
('e1000000-0000-0000-0000-000000000012','ZF-2026-0412','SV',   'Sandra López',  CURRENT_DATE-20, 'Alta',  true, 'PRIORIDAD ALTA',    'Alta', 515,5, CURRENT_DATE-9,  'EXP-ZF-012',129,CURRENT_DATE-20, 'Liberación',         'Sandra López', NULL,                                        'zf',CURRENT_DATE-4, false,false,28800,20,NOW()-INTERVAL '2 days',    NOW()-INTERVAL '20 days'),

-- ── MES ANTERIOR ───────────────────────────────────────────
('e1000000-0000-0000-0000-000000000013','ZF-2026-0313','CR',   'Luis Ramírez',  CURRENT_DATE-33, 'Media', false,NULL,                 'Media',178,3, CURRENT_DATE-26, 'EXP-ZF-013',59, CURRENT_DATE-33, 'Liberación',         'Luis Ramírez', NULL,                                        'zf',CURRENT_DATE-20,false,false,47520,33,NOW()-INTERVAL '2 days 5h', NOW()-INTERVAL '33 days'),
('e1000000-0000-0000-0000-000000000014','ZF-2026-0314','GLSV', 'Sandra López',  CURRENT_DATE-36, 'Alta',  true, 'CLIENTE VIP',       'Alta', 545,5, CURRENT_DATE-29, 'EXP-ZF-014',136,CURRENT_DATE-36, 'Liberación',         'Sandra López', NULL,                                        'zf',CURRENT_DATE-23,false,false,51840,36,NOW()-INTERVAL '3 days 4h', NOW()-INTERVAL '36 days'),
('e1000000-0000-0000-0000-000000000015','ZF-2026-0315','INT',  'María Torres',  CURRENT_DATE-38, 'Baja',  false,NULL,                 'Baja', 46,2, CURRENT_DATE-31, 'EXP-ZF-015',23, CURRENT_DATE-38, 'Liberación',         'María Torres', NULL,                                        'zf',CURRENT_DATE-26,false,false,54720,38,NOW()-INTERVAL '4 days 3h', NOW()-INTERVAL '38 days'),
('e1000000-0000-0000-0000-000000000016','ZF-2026-0316','VZ',   'Luis Ramírez',  CURRENT_DATE-40, 'Media', false,NULL,                 'Media',225,4, CURRENT_DATE-33, 'EXP-ZF-016',75, CURRENT_DATE-40, 'Liberación',         'Luis Ramírez', NULL,                                        'zf',CURRENT_DATE-29,false,false,57600,40,NOW()-INTERVAL '5 days 2h', NOW()-INTERVAL '40 days'),
('e1000000-0000-0000-0000-000000000017','ZF-2026-0317','GT',   'Sandra López',  CURRENT_DATE-43, 'Alta',  false,NULL,                 'Alta', 478,5, CURRENT_DATE-36, 'EXP-ZF-017',119,CURRENT_DATE-43, 'Liberación',         'Sandra López', NULL,                                        'zf',CURRENT_DATE-31,false,false,61920,43,NOW()-INTERVAL '6 days',    NOW()-INTERVAL '43 days'),
('e1000000-0000-0000-0000-000000000018','ZF-2026-0318','SV',   'María Torres',  CURRENT_DATE-46, 'Baja',  false,NULL,                 'Baja', 57,2, CURRENT_DATE-39, 'EXP-ZF-018',29, CURRENT_DATE-46, 'Liberación',         'María Torres', NULL,                                        'zf',CURRENT_DATE-34,false,false,66240,46,NOW()-INTERVAL '7 days',    NOW()-INTERVAL '46 days'),
('e1000000-0000-0000-0000-000000000019','ZF-2026-0319','CR',   'Luis Ramírez',  CURRENT_DATE-49, 'Media', false,NULL,                 'Media',162,3, CURRENT_DATE-42, 'EXP-ZF-019',54, CURRENT_DATE-49, 'Liberación',         'Luis Ramírez', NULL,                                        'zf',CURRENT_DATE-37,false,false,70560,49,NOW()-INTERVAL '8 days',    NOW()-INTERVAL '49 days'),

-- ── TRIMESTRE (hace 2-3 meses) ─────────────────────────────
('e1000000-0000-0000-0000-000000000020','ZF-2025-1220','GT',   'Sandra López',  CURRENT_DATE-65, 'Baja',  false,NULL,                 'Baja', 62,2, CURRENT_DATE-58, 'EXP-ZF-020',31, CURRENT_DATE-65, 'Liberación',         'Sandra López', NULL,                                        'zf',CURRENT_DATE-56,false,false,93600,65,NOW()-INTERVAL '2 days',    NOW()-INTERVAL '65 days'),
('e1000000-0000-0000-0000-000000000021','ZF-2025-1221','SV',   'María Torres',  CURRENT_DATE-70, 'Media', false,NULL,                 'Media',155,3, CURRENT_DATE-63, 'EXP-ZF-021',52, CURRENT_DATE-70, 'Liberación',         'María Torres', NULL,                                        'zf',CURRENT_DATE-62,false,false,100800,70,NOW()-INTERVAL '3 days', NOW()-INTERVAL '70 days'),
('e1000000-0000-0000-0000-000000000022','ZF-2025-1222','CR',   'Luis Ramírez',  CURRENT_DATE-75, 'Alta',  true, 'TRÁNSITO ESPECIAL', 'Alta', 560,6, CURRENT_DATE-68, 'EXP-ZF-022',140,CURRENT_DATE-75, 'Liberación',         'Luis Ramírez', NULL,                                        'zf',CURRENT_DATE-65,false,false,108000,75,NOW()-INTERVAL '4 days', NOW()-INTERVAL '75 days'),
('e1000000-0000-0000-0000-000000000023','ZF-2025-1223','VZ',   'Sandra López',  CURRENT_DATE-80, 'Baja',  false,NULL,                 'Baja', 40,2, CURRENT_DATE-73, 'EXP-ZF-023',20, CURRENT_DATE-80, 'Liberación',         'Sandra López', NULL,                                        'zf',CURRENT_DATE-70,false,false,115200,80,NOW()-INTERVAL '5 days', NOW()-INTERVAL '80 days'),
('e1000000-0000-0000-0000-000000000024','ZF-2025-1224','MI',   'María Torres',  CURRENT_DATE-85, 'Media', false,NULL,                 'Media',180,3, CURRENT_DATE-78, 'EXP-ZF-024',60, CURRENT_DATE-85, 'Liberación',         'María Torres', NULL,                                        'zf',CURRENT_DATE-75,false,false,122400,85,NOW()-INTERVAL '6 days', NOW()-INTERVAL '85 days'),
('e1000000-0000-0000-0000-000000000025','ZF-2025-1225','GT',   'Luis Ramírez',  CURRENT_DATE-90, 'Alta',  false,NULL,                 'Alta', 475,5, CURRENT_DATE-83, 'EXP-ZF-025',117,CURRENT_DATE-90, 'Liberación',         'Luis Ramírez', NULL,                                        'zf',CURRENT_DATE-80,false,false,129600,90,NOW()-INTERVAL '7 days', NOW()-INTERVAL '90 days');


-- =============================================
-- PASO 5 — TIEMPOS ENTRE ESTADOS (DATOS REALES)
-- Cubre todas las transiciones de cada flujo
-- =============================================
INSERT INTO expedientes_tiempos_estados
  (expediente_id, estado_anterior, estado_nuevo, fecha_inicio, fecha_fin, minutos_transcurridos)
VALUES

-- ── DROPSHIP EN CURSO (registro abierto sin fecha_fin) ──────
('d1000000-0000-0000-0000-000000000001','Inicio',            'Asignado',           NOW()-INTERVAL '1 day',          NULL, NULL),
('d1000000-0000-0000-0000-000000000002','Asignado',          'En Proceso',         NOW()-INTERVAL '1 day 14 hours', NULL, NULL),
('d1000000-0000-0000-0000-000000000003','En Proceso',        'Espera de Respuesta',NOW()-INTERVAL '2 days',         NULL, NULL),
('d1000000-0000-0000-0000-000000000004','En Proceso',        'Liberación',         NOW()-INTERVAL '3 days',         NULL, NULL),
('d1000000-0000-0000-0000-000000000005','En Proceso',        'Recepción de Carga', NOW()-INTERVAL '4 days',         NULL, NULL),
('d1000000-0000-0000-0000-000000000006','Recepción de Carga','Facturación',        NOW()-INTERVAL '5 days',         NULL, NULL),
('d1000000-0000-0000-0000-000000000007','Asignado',          'En Proceso',         NOW()-INTERVAL '6 days',         NULL, NULL),

-- ── DROPSHIP COMPLETADOS — transiciones cerradas ─────────────
-- EXP-DS-011 (13 días, Notificado)
('d1000000-0000-0000-0000-000000000011','Inicio',            'Asignado',           NOW()-INTERVAL '13 days',        NOW()-INTERVAL '12 days', 1440),
('d1000000-0000-0000-0000-000000000011','Asignado',          'En Proceso',         NOW()-INTERVAL '12 days',        NOW()-INTERVAL '10 days', 2880),
('d1000000-0000-0000-0000-000000000011','En Proceso',        'Liberación',         NOW()-INTERVAL '10 days',        NOW()-INTERVAL '8 days',  2880),
('d1000000-0000-0000-0000-000000000011','Liberación',        'Recepción de Carga', NOW()-INTERVAL '8 days',         NOW()-INTERVAL '6 days',  2880),
('d1000000-0000-0000-0000-000000000011','Recepción de Carga','Facturación',        NOW()-INTERVAL '6 days',         NOW()-INTERVAL '4 days',  2880),
('d1000000-0000-0000-0000-000000000011','Facturación',       'Notificado',         NOW()-INTERVAL '4 days',         NOW()-INTERVAL '2 days',  2880),

-- EXP-DS-012 (15 días, Notificado)
('d1000000-0000-0000-0000-000000000012','Inicio',            'Asignado',           NOW()-INTERVAL '15 days',        NOW()-INTERVAL '14 days', 1440),
('d1000000-0000-0000-0000-000000000012','Asignado',          'En Proceso',         NOW()-INTERVAL '14 days',        NOW()-INTERVAL '11 days', 4320),
('d1000000-0000-0000-0000-000000000012','En Proceso',        'Espera de Respuesta',NOW()-INTERVAL '11 days',        NOW()-INTERVAL '9 days',  2880),
('d1000000-0000-0000-0000-000000000012','Espera de Respuesta','Liberación',        NOW()-INTERVAL '9 days',         NOW()-INTERVAL '7 days',  2880),
('d1000000-0000-0000-0000-000000000012','Liberación',        'Recepción de Carga', NOW()-INTERVAL '7 days',         NOW()-INTERVAL '5 days',  2880),
('d1000000-0000-0000-0000-000000000012','Recepción de Carga','Facturación',        NOW()-INTERVAL '5 days',         NOW()-INTERVAL '3 days',  2880),
('d1000000-0000-0000-0000-000000000012','Facturación',       'Notificado',         NOW()-INTERVAL '3 days',         NOW()-INTERVAL '1 day',   2880),

-- EXP-DS-013 (14 días)
('d1000000-0000-0000-0000-000000000013','Inicio',            'Asignado',           NOW()-INTERVAL '14 days',        NOW()-INTERVAL '12 days', 2880),
('d1000000-0000-0000-0000-000000000013','Asignado',          'En Proceso',         NOW()-INTERVAL '12 days',        NOW()-INTERVAL '9 days',  4320),
('d1000000-0000-0000-0000-000000000013','En Proceso',        'Liberación',         NOW()-INTERVAL '9 days',         NOW()-INTERVAL '7 days',  2880),
('d1000000-0000-0000-0000-000000000013','Liberación',        'Recepción de Carga', NOW()-INTERVAL '7 days',         NOW()-INTERVAL '5 days',  2880),
('d1000000-0000-0000-0000-000000000013','Recepción de Carga','Facturación',        NOW()-INTERVAL '5 days',         NOW()-INTERVAL '3 days',  2880),
('d1000000-0000-0000-0000-000000000013','Facturación',       'Notificado',         NOW()-INTERVAL '3 days',         NOW()-INTERVAL '2 days',  1440),

-- EXP-DS-015..022 (mes anterior y trimestre — resumen simplificado)
('d1000000-0000-0000-0000-000000000015','Asignado',          'En Proceso',         NOW()-INTERVAL '32 days',        NOW()-INTERVAL '30 days', 2880),
('d1000000-0000-0000-0000-000000000015','En Proceso',        'Liberación',         NOW()-INTERVAL '30 days',        NOW()-INTERVAL '27 days', 4320),
('d1000000-0000-0000-0000-000000000015','Liberación',        'Recepción de Carga', NOW()-INTERVAL '27 days',        NOW()-INTERVAL '24 days', 4320),
('d1000000-0000-0000-0000-000000000015','Recepción de Carga','Facturación',        NOW()-INTERVAL '24 days',        NOW()-INTERVAL '21 days', 4320),
('d1000000-0000-0000-0000-000000000015','Facturación',       'Notificado',         NOW()-INTERVAL '21 days',        NOW()-INTERVAL '19 days', 2880),

('d1000000-0000-0000-0000-000000000016','Asignado',          'En Proceso',         NOW()-INTERVAL '34 days',        NOW()-INTERVAL '32 days', 2880),
('d1000000-0000-0000-0000-000000000016','En Proceso',        'Espera de Respuesta',NOW()-INTERVAL '32 days',        NOW()-INTERVAL '29 days', 4320),
('d1000000-0000-0000-0000-000000000016','Espera de Respuesta','Liberación',        NOW()-INTERVAL '29 days',        NOW()-INTERVAL '26 days', 4320),
('d1000000-0000-0000-0000-000000000016','Liberación',        'Recepción de Carga', NOW()-INTERVAL '26 days',        NOW()-INTERVAL '23 days', 4320),
('d1000000-0000-0000-0000-000000000016','Recepción de Carga','Facturación',        NOW()-INTERVAL '23 days',        NOW()-INTERVAL '20 days', 4320),
('d1000000-0000-0000-0000-000000000016','Facturación',       'Notificado',         NOW()-INTERVAL '20 days',        NOW()-INTERVAL '17 days', 4320),

-- ── ZF EN CURSO (registro abierto) ──────────────────────────
('e1000000-0000-0000-0000-000000000001','Inicio',            'Asignado',           NOW()-INTERVAL '1 day',          NULL, NULL),
('e1000000-0000-0000-0000-000000000002','Asignado',          'En Proceso',         NOW()-INTERVAL '2 days 14 hours',NULL, NULL),
('e1000000-0000-0000-0000-000000000003','En Proceso',        'Espera de Respuesta',NOW()-INTERVAL '3 days',         NULL, NULL),
('e1000000-0000-0000-0000-000000000004','En Proceso',        'Completado',         NOW()-INTERVAL '4 days',         NULL, NULL),
('e1000000-0000-0000-0000-000000000005','Completado',        'Arribo de Carga',    NOW()-INTERVAL '6 days',         NULL, NULL),
('e1000000-0000-0000-0000-000000000006','Arribo de Carga',   'Pendiente Proforma', NOW()-INTERVAL '8 days',         NULL, NULL),

-- ── ZF KPI #1: Asignado→Espera de Respuesta (~10 días ≤15 meta ✓) ──
('e1000000-0000-0000-0000-000000000003','Asignado',          'Espera de Respuesta',NOW()-INTERVAL '4 days',         NOW()-INTERVAL '3 days',  1440),
('e1000000-0000-0000-0000-000000000009','Asignado',          'Espera de Respuesta',NOW()-INTERVAL '14 days',        NOW()-INTERVAL '4 days',  14400),
('e1000000-0000-0000-0000-000000000013','Asignado',          'Espera de Respuesta',NOW()-INTERVAL '33 days',        NOW()-INTERVAL '23 days', 14400),
('e1000000-0000-0000-0000-000000000016','Asignado',          'Espera de Respuesta',NOW()-INTERVAL '40 days',        NOW()-INTERVAL '30 days', 14400),
('e1000000-0000-0000-0000-000000000020','Asignado',          'Espera de Respuesta',NOW()-INTERVAL '65 days',        NOW()-INTERVAL '55 days', 14400),
('e1000000-0000-0000-0000-000000000022','Asignado',          'Espera de Respuesta',NOW()-INTERVAL '75 days',        NOW()-INTERVAL '65 days', 14400),

-- ── ZF KPI #2: Arribo de Carga→Liberación (~32 min ≤45 meta ✓) ──
('e1000000-0000-0000-0000-000000000007','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '10 days 13 hours',NOW()-INTERVAL '10 days 12 hours 28 minutes',32),
('e1000000-0000-0000-0000-000000000011','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '17 days 10 hours',NOW()-INTERVAL '17 days 9 hours 35 minutes', 25),
('e1000000-0000-0000-0000-000000000013','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '31 days 3 hours', NOW()-INTERVAL '31 days 2 hours 27 minutes', 33),
('e1000000-0000-0000-0000-000000000015','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '36 days 4 hours', NOW()-INTERVAL '36 days 3 hours 22 minutes', 38),
('e1000000-0000-0000-0000-000000000017','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '41 days 5 hours', NOW()-INTERVAL '41 days 4 hours 30 minutes', 30),
('e1000000-0000-0000-0000-000000000020','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '63 days 6 hours', NOW()-INTERVAL '63 days 5 hours 28 minutes', 32),
('e1000000-0000-0000-0000-000000000022','Arribo de Carga',   'Liberación',         NOW()-INTERVAL '73 days 7 hours', NOW()-INTERVAL '73 days 6 hours 26 minutes', 34),

-- ── ZF COMPLETADOS — transiciones cerradas ───────────────────
-- EXP-ZF-011 (18 días, Liberación)
('e1000000-0000-0000-0000-000000000011','Inicio',            'Asignado',           NOW()-INTERVAL '18 days',        NOW()-INTERVAL '17 days', 1440),
('e1000000-0000-0000-0000-000000000011','Asignado',          'En Proceso',         NOW()-INTERVAL '17 days',        NOW()-INTERVAL '14 days', 4320),
('e1000000-0000-0000-0000-000000000011','En Proceso',        'Completado',         NOW()-INTERVAL '14 days',        NOW()-INTERVAL '11 days', 4320),
('e1000000-0000-0000-0000-000000000011','Completado',        'Arribo de Carga',    NOW()-INTERVAL '11 days',        NOW()-INTERVAL '11 days'+INTERVAL '28 minutes', 28),
('e1000000-0000-0000-0000-000000000011','Arribo de Carga',   'Pendiente Proforma', NOW()-INTERVAL '11 days',        NOW()-INTERVAL '9 days',  2880),
('e1000000-0000-0000-0000-000000000011','Pendiente Proforma','Liberación',         NOW()-INTERVAL '9 days',         NOW()-INTERVAL '1 day',   11520),

-- EXP-ZF-013 (mes anterior, Liberación)
('e1000000-0000-0000-0000-000000000013','Inicio',            'Asignado',           NOW()-INTERVAL '33 days',        NOW()-INTERVAL '32 days', 1440),
('e1000000-0000-0000-0000-000000000013','Asignado',          'En Proceso',         NOW()-INTERVAL '32 days',        NOW()-INTERVAL '28 days', 5760),
('e1000000-0000-0000-0000-000000000013','En Proceso',        'Espera de Respuesta',NOW()-INTERVAL '28 days',        NOW()-INTERVAL '23 days', 7200),
('e1000000-0000-0000-0000-000000000013','Espera de Respuesta','Completado',        NOW()-INTERVAL '23 days',        NOW()-INTERVAL '19 days', 5760),
('e1000000-0000-0000-0000-000000000013','Completado',        'Arribo de Carga',    NOW()-INTERVAL '19 days',        NOW()-INTERVAL '19 days'+INTERVAL '33 minutes', 33),
('e1000000-0000-0000-0000-000000000013','Arribo de Carga',   'Pendiente Proforma', NOW()-INTERVAL '19 days',        NOW()-INTERVAL '16 days', 4320),
('e1000000-0000-0000-0000-000000000013','Pendiente Proforma','Liberación',         NOW()-INTERVAL '16 days',        NOW()-INTERVAL '2 days',  20160),

-- EXP-ZF-016 (trimestre, Liberación)
('e1000000-0000-0000-0000-000000000016','Inicio',            'Asignado',           NOW()-INTERVAL '40 days',        NOW()-INTERVAL '39 days', 1440),
('e1000000-0000-0000-0000-000000000016','Asignado',          'En Proceso',         NOW()-INTERVAL '39 days',        NOW()-INTERVAL '34 days', 7200),
('e1000000-0000-0000-0000-000000000016','En Proceso',        'Espera de Respuesta',NOW()-INTERVAL '34 days',        NOW()-INTERVAL '30 days', 5760),
('e1000000-0000-0000-0000-000000000016','Espera de Respuesta','Completado',        NOW()-INTERVAL '30 days',        NOW()-INTERVAL '25 days', 7200),
('e1000000-0000-0000-0000-000000000016','Completado',        'Arribo de Carga',    NOW()-INTERVAL '25 days',        NOW()-INTERVAL '25 days'+INTERVAL '38 minutes', 38),
('e1000000-0000-0000-0000-000000000016','Arribo de Carga',   'Pendiente Proforma', NOW()-INTERVAL '25 days',        NOW()-INTERVAL '21 days', 5760),
('e1000000-0000-0000-0000-000000000016','Pendiente Proforma','Liberación',         NOW()-INTERVAL '21 days',        NOW()-INTERVAL '5 days',  23040)

ON CONFLICT DO NOTHING;


-- =============================================
-- PASO 6 — HISTORIAL DE CAMBIOS
-- =============================================
INSERT INTO expedientes_historial (expediente_id, campo_modificado, valor_anterior, valor_nuevo, usuario, fecha_cambio)
VALUES
  -- Dropship en proceso
  ('d1000000-0000-0000-0000-000000000002','Estado','Asignado','En Proceso',                'Ana García',     NOW()-INTERVAL '1 day 14 hours'),
  ('d1000000-0000-0000-0000-000000000003','Estado','Asignado','En Proceso',                'Roberto Flores', NOW()-INTERVAL '2 days 20 hours'),
  ('d1000000-0000-0000-0000-000000000003','Estado','En Proceso','Espera de Respuesta',     'Roberto Flores', NOW()-INTERVAL '2 days'),
  ('d1000000-0000-0000-0000-000000000004','Estado','Asignado','En Proceso',                'María Torres',   NOW()-INTERVAL '3 days 18 hours'),
  ('d1000000-0000-0000-0000-000000000004','Estado','En Proceso','Liberación',              'María Torres',   NOW()-INTERVAL '3 days'),
  ('d1000000-0000-0000-0000-000000000005','Estado','Asignado','En Proceso',                'Roberto Flores', NOW()-INTERVAL '4 days 16 hours'),
  ('d1000000-0000-0000-0000-000000000005','Estado','En Proceso','Recepción de Carga',      'Roberto Flores', NOW()-INTERVAL '4 days'),
  ('d1000000-0000-0000-0000-000000000006','Estado','Asignado','En Proceso',                'Ana García',     NOW()-INTERVAL '5 days 14 hours'),
  ('d1000000-0000-0000-0000-000000000006','Estado','En Proceso','Liberación',              'Ana García',     NOW()-INTERVAL '5 days'),
  ('d1000000-0000-0000-0000-000000000006','Estado','Liberación','Recepción de Carga',      'Ana García',     NOW()-INTERVAL '4 days 12 hours'),
  ('d1000000-0000-0000-0000-000000000006','Estado','Recepción de Carga','Facturación',     'Ana García',     NOW()-INTERVAL '5 days'),
  -- Dropship completados
  ('d1000000-0000-0000-0000-000000000011','Estado','Asignado','En Proceso',                'Roberto Flores', NOW()-INTERVAL '12 days'),
  ('d1000000-0000-0000-0000-000000000011','Estado','En Proceso','Liberación',              'Roberto Flores', NOW()-INTERVAL '10 days'),
  ('d1000000-0000-0000-0000-000000000011','Estado','Liberación','Recepción de Carga',      'Roberto Flores', NOW()-INTERVAL '8 days'),
  ('d1000000-0000-0000-0000-000000000011','Estado','Recepción de Carga','Facturación',     'Roberto Flores', NOW()-INTERVAL '6 days'),
  ('d1000000-0000-0000-0000-000000000011','Estado','Facturación','Notificado',             'Roberto Flores', NOW()-INTERVAL '2 days'),
  ('d1000000-0000-0000-0000-000000000012','Estado','Asignado','En Proceso',                'Ana García',     NOW()-INTERVAL '14 days'),
  ('d1000000-0000-0000-0000-000000000012','Estado','En Proceso','Espera de Respuesta',     'Ana García',     NOW()-INTERVAL '11 days'),
  ('d1000000-0000-0000-0000-000000000012','Estado','Espera de Respuesta','Liberación',     'Ana García',     NOW()-INTERVAL '9 days'),
  ('d1000000-0000-0000-0000-000000000012','Estado','Liberación','Recepción de Carga',      'Ana García',     NOW()-INTERVAL '7 days'),
  ('d1000000-0000-0000-0000-000000000012','Estado','Recepción de Carga','Facturación',     'Ana García',     NOW()-INTERVAL '5 days'),
  ('d1000000-0000-0000-0000-000000000012','Estado','Facturación','Notificado',             'Ana García',     NOW()-INTERVAL '1 day'),
  -- ZF en proceso
  ('e1000000-0000-0000-0000-000000000002','Estado','Asignado','En Proceso',                'Sandra López',   NOW()-INTERVAL '2 days 14 hours'),
  ('e1000000-0000-0000-0000-000000000003','Estado','Asignado','En Proceso',                'Luis Ramírez',   NOW()-INTERVAL '3 days 20 hours'),
  ('e1000000-0000-0000-0000-000000000003','Estado','En Proceso','Espera de Respuesta',     'Luis Ramírez',   NOW()-INTERVAL '3 days'),
  ('e1000000-0000-0000-0000-000000000004','Estado','Asignado','En Proceso',                'María Torres',   NOW()-INTERVAL '4 days 16 hours'),
  ('e1000000-0000-0000-0000-000000000004','Estado','En Proceso','Completado',              'María Torres',   NOW()-INTERVAL '4 days'),
  ('e1000000-0000-0000-0000-000000000005','Estado','Asignado','En Proceso',                'Sandra López',   NOW()-INTERVAL '6 days 18 hours'),
  ('e1000000-0000-0000-0000-000000000005','Estado','En Proceso','Completado',              'Sandra López',   NOW()-INTERVAL '6 days'),
  ('e1000000-0000-0000-0000-000000000005','Estado','Completado','Arribo de Carga',         'Sandra López',   NOW()-INTERVAL '6 days'+INTERVAL '30 minutes'),
  ('e1000000-0000-0000-0000-000000000006','Estado','Asignado','En Proceso',                'Luis Ramírez',   NOW()-INTERVAL '8 days 16 hours'),
  ('e1000000-0000-0000-0000-000000000006','Estado','En Proceso','Completado',              'Luis Ramírez',   NOW()-INTERVAL '8 days'),
  ('e1000000-0000-0000-0000-000000000006','Estado','Completado','Arribo de Carga',         'Luis Ramírez',   NOW()-INTERVAL '7 days 23 hours 22 minutes'),
  ('e1000000-0000-0000-0000-000000000006','Estado','Arribo de Carga','Pendiente Proforma', 'Luis Ramírez',   NOW()-INTERVAL '8 days'+INTERVAL '35 minutes'),
  -- ZF completados
  ('e1000000-0000-0000-0000-000000000011','Estado','Asignado','En Proceso',                'Luis Ramírez',   NOW()-INTERVAL '17 days'),
  ('e1000000-0000-0000-0000-000000000011','Estado','En Proceso','Completado',              'Luis Ramírez',   NOW()-INTERVAL '14 days'),
  ('e1000000-0000-0000-0000-000000000011','Estado','Completado','Arribo de Carga',         'Luis Ramírez',   NOW()-INTERVAL '11 days'),
  ('e1000000-0000-0000-0000-000000000011','Estado','Arribo de Carga','Pendiente Proforma', 'Luis Ramírez',   NOW()-INTERVAL '11 days'+INTERVAL '28 minutes'),
  ('e1000000-0000-0000-0000-000000000011','Estado','Pendiente Proforma','Liberación',      'Luis Ramírez',   NOW()-INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- =============================================
-- ✅ SEED COMPLETADO
-- Totales:
--   8 usuarios
--   30 expedientes Dropship (10 en curso + 4 mes actual + 8 mes anterior + 8 trimestre)
--   25 expedientes ZF (10 en curso + 2 mes actual + 7 mes anterior + 6 trimestre)
--   ~70 registros tiempos_estados (datos reales con fechas cerradas)
--   ~40 registros de historial
--   KPI ZF #1: ~10 días ✓ (meta ≤15)
--   KPI ZF #2: ~32 min ✓ (meta ≤45)
-- =============================================