-- ============================================================
-- MIGRACIÓN: entorno de Raga por solicitud ETD
-- Permite distinguir si una solicitud de cambio de ETD Inicial
-- fue creada contra QA o contra Producción, y que la aprobación
-- se ejecute contra el mismo entorno.
--
-- Producción es el entorno por defecto para todos los usuarios
-- autenticados (lectura y modificación). QA queda solo como
-- entorno de pruebas.
-- ============================================================

ALTER TABLE etd_initial_change_requests
  ADD COLUMN IF NOT EXISTS api_env text NOT NULL DEFAULT 'production';

-- Producción pasa a ser el valor por defecto.
ALTER TABLE etd_initial_change_requests
  ALTER COLUMN api_env SET DEFAULT 'production';

-- Las solicitudes históricas sin entorno quedan marcadas como QA
-- (es el entorno con el que realmente se crearon).
UPDATE etd_initial_change_requests
  SET api_env = 'qa'
  WHERE api_env IS NULL;

COMMENT ON COLUMN etd_initial_change_requests.api_env IS
  'Entorno de Raga usado al crear la solicitud: qa | production';