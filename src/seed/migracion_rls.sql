-- =============================================
-- MIGRACIÓN: Políticas RLS (Row Level Security)
-- Soluciona el error 42501 "new row violates
-- row-level security policy"
--
-- Ejecutar en: Supabase > SQL Editor (pegarlo y RUN)
-- =============================================

-- 1. CONFIGURACION_SISTEMA (la que fallaba al guardar)
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_sistema_select" ON configuracion_sistema;
DROP POLICY IF EXISTS "config_sistema_insert" ON configuracion_sistema;
DROP POLICY IF EXISTS "config_sistema_update" ON configuracion_sistema;
DROP POLICY IF EXISTS "config_sistema_delete" ON configuracion_sistema;

CREATE POLICY "config_sistema_select" ON configuracion_sistema
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_sistema_insert" ON configuracion_sistema
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "config_sistema_update" ON configuracion_sistema
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "config_sistema_delete" ON configuracion_sistema
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 2. USUARIOS
-- =============================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete" ON usuarios;

CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "usuarios_delete" ON usuarios
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 3. USUARIO_ROLES
-- =============================================
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_roles_select" ON usuario_roles;
DROP POLICY IF EXISTS "usuario_roles_insert" ON usuario_roles;
DROP POLICY IF EXISTS "usuario_roles_update" ON usuario_roles;
DROP POLICY IF EXISTS "usuario_roles_delete" ON usuario_roles;

CREATE POLICY "usuario_roles_select" ON usuario_roles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "usuario_roles_insert" ON usuario_roles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "usuario_roles_update" ON usuario_roles
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "usuario_roles_delete" ON usuario_roles
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 4. ROLES
-- =============================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
DROP POLICY IF EXISTS "roles_delete" ON roles;

CREATE POLICY "roles_select" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "roles_insert" ON roles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "roles_update" ON roles
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "roles_delete" ON roles
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 5. EXPEDIENTES
-- =============================================
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expedientes_select" ON expedientes;
DROP POLICY IF EXISTS "expedientes_insert" ON expedientes;
DROP POLICY IF EXISTS "expedientes_update" ON expedientes;
DROP POLICY IF EXISTS "expedientes_delete" ON expedientes;

CREATE POLICY "expedientes_select" ON expedientes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "expedientes_insert" ON expedientes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "expedientes_update" ON expedientes
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "expedientes_delete" ON expedientes
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 6. EXPEDIENTES_HISTORIAL
-- =============================================
ALTER TABLE expedientes_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historial_select" ON expedientes_historial;
DROP POLICY IF EXISTS "historial_insert" ON expedientes_historial;
DROP POLICY IF EXISTS "historial_update" ON expedientes_historial;
DROP POLICY IF EXISTS "historial_delete" ON expedientes_historial;

CREATE POLICY "historial_select" ON expedientes_historial
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "historial_insert" ON expedientes_historial
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "historial_update" ON expedientes_historial
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "historial_delete" ON expedientes_historial
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 7. EXPEDIENTES_TIEMPOS_ESTADOS
-- =============================================
ALTER TABLE expedientes_tiempos_estados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tiempos_select" ON expedientes_tiempos_estados;
DROP POLICY IF EXISTS "tiempos_insert" ON expedientes_tiempos_estados;
DROP POLICY IF EXISTS "tiempos_update" ON expedientes_tiempos_estados;
DROP POLICY IF EXISTS "tiempos_delete" ON expedientes_tiempos_estados;

CREATE POLICY "tiempos_select" ON expedientes_tiempos_estados
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tiempos_insert" ON expedientes_tiempos_estados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tiempos_update" ON expedientes_tiempos_estados
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tiempos_delete" ON expedientes_tiempos_estados
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 8. NOTIFICACIONES
-- =============================================
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_insert" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_update" ON notificaciones;
DROP POLICY IF EXISTS "notificaciones_delete" ON notificaciones;

CREATE POLICY "notificaciones_select" ON notificaciones
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "notificaciones_insert" ON notificaciones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notificaciones_update" ON notificaciones
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notificaciones_delete" ON notificaciones
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 9. DOCUMENTOS_CAA
-- =============================================
ALTER TABLE documentos_caa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_caa_select" ON documentos_caa;
DROP POLICY IF EXISTS "documentos_caa_insert" ON documentos_caa;
DROP POLICY IF EXISTS "documentos_caa_update" ON documentos_caa;
DROP POLICY IF EXISTS "documentos_caa_delete" ON documentos_caa;

CREATE POLICY "documentos_caa_select" ON documentos_caa
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "documentos_caa_insert" ON documentos_caa
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "documentos_caa_update" ON documentos_caa
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "documentos_caa_delete" ON documentos_caa
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 10. DOCUMENTO_MODIFICACIONES
-- =============================================
ALTER TABLE documento_modificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_mod_select" ON documento_modificaciones;
DROP POLICY IF EXISTS "doc_mod_insert" ON documento_modificaciones;
DROP POLICY IF EXISTS "doc_mod_update" ON documento_modificaciones;
DROP POLICY IF EXISTS "doc_mod_delete" ON documento_modificaciones;

CREATE POLICY "doc_mod_select" ON documento_modificaciones
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "doc_mod_insert" ON documento_modificaciones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "doc_mod_update" ON documento_modificaciones
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "doc_mod_delete" ON documento_modificaciones
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- ✅ COMPLETADO
-- Después de ejecutar esto, el guardado de la
-- Configuración General y la Matriz de Permisos
-- funcionará correctamente.
-- =============================================