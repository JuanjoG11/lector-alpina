-- Ejecutá esto en el SQL Editor de tu proyecto Supabase
-- https://supabase.com/dashboard/project/aylfgwyoxvplfegshewv/sql

-- Tabla de pedidos (líneas de factura)
CREATE TABLE IF NOT EXISTS pedidos (
  id             BIGSERIAL PRIMARY KEY,
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
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida por código de barras y nro factura
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_barras ON pedidos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_pedidos_nro_factura   ON pedidos(nro_factura);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente       ON pedidos(cliente);

-- Tabla de escaneos (log de lo que se escanea en cada estación)
CREATE TABLE IF NOT EXISTS escaneos (
  id               BIGSERIAL PRIMARY KEY,
  codigo_barras    TEXT NOT NULL,
  nro_factura      TEXT,
  cliente          TEXT,
  ruta             TEXT,
  zona             TEXT,
  estacion         INTEGER,
  escaneado_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escaneos_codigo ON escaneos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_escaneos_fecha  ON escaneos(escaneado_at);

-- Política RLS: acceso público (ajustá según necesites)
ALTER TABLE pedidos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE escaneos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura publica pedidos"  ON pedidos  FOR SELECT USING (true);
CREATE POLICY "Lectura publica escaneos" ON escaneos FOR SELECT USING (true);
CREATE POLICY "Insertar escaneos"        ON escaneos FOR INSERT WITH CHECK (true);
CREATE POLICY "Insertar pedidos"         ON pedidos  FOR INSERT WITH CHECK (true);
CREATE POLICY "Borrar pedidos"           ON pedidos  FOR DELETE USING (true);
