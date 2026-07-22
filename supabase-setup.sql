-- Ejecutá esto en el SQL Editor de Supabase
-- https://supabase.com/dashboard/project/aylfgwyoxvplfegshewv/sql/new

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id             BIGSERIAL PRIMARY KEY,
  archivo        TEXT,           -- nombre del archivo Excel subido
  factura        TEXT,
  nro_factura    TEXT,
  cliente        TEXT,
  ruta           TEXT,
  ubicacion      TEXT,
  zona           TEXT,
  negocio        TEXT,
  codigo_barras  TEXT,
  cod_producto   TEXT,
  producto       TEXT,
  cantidad       INTEGER,
  planilla       TEXT,
  ord_compra     TEXT,
  ord_planilla   TEXT,
  ruta_cliente   TEXT,
  separado       BOOLEAN DEFAULT FALSE,   -- checklist: ¿fue separado?
  separado_por   TEXT,                    -- quién lo marcó
  separado_at    TIMESTAMPTZ,             -- cuándo
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas si la tabla ya existe
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS archivo      TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS separado     BOOLEAN DEFAULT FALSE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS separado_por TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS separado_at  TIMESTAMPTZ;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_barras ON pedidos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_pedidos_nro_factura   ON pedidos(nro_factura);
CREATE INDEX IF NOT EXISTS idx_pedidos_archivo       ON pedidos(archivo);

-- RLS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica pedidos"  ON pedidos;
DROP POLICY IF EXISTS "Insertar pedidos"         ON pedidos;
DROP POLICY IF EXISTS "Borrar pedidos"           ON pedidos;
DROP POLICY IF EXISTS "Actualizar pedidos"       ON pedidos;

CREATE POLICY "Lectura publica pedidos"  ON pedidos FOR SELECT USING (true);
CREATE POLICY "Insertar pedidos"         ON pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Borrar pedidos"           ON pedidos FOR DELETE USING (true);
CREATE POLICY "Actualizar pedidos"       ON pedidos FOR UPDATE USING (true);

-- Tabla escaneos
CREATE TABLE IF NOT EXISTS escaneos (
  id            BIGSERIAL PRIMARY KEY,
  codigo_barras TEXT,
  nro_factura   TEXT,
  cliente       TEXT,
  estacion      TEXT,
  escaneado_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE escaneos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica escaneos" ON escaneos;
DROP POLICY IF EXISTS "Insertar escaneos"        ON escaneos;
CREATE POLICY "Lectura publica escaneos" ON escaneos FOR SELECT USING (true);
CREATE POLICY "Insertar escaneos"        ON escaneos FOR INSERT WITH CHECK (true);
