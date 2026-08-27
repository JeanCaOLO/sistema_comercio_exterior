-- =============================================
-- MIGRACIÓN: campo cargador_documentos
-- Agrega el campo que guarda QUIÉN cargó los
-- documentos y POs en Carga CAA (inmutable).
--
-- Ejecutar en: Supabase > SQL Editor
-- =============================================
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS cargador_documentos text;