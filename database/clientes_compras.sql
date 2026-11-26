-- VILET · historial de compras por cliente · MySQL 8
USE Vilet;

-- El teléfono identifica a la persona. Como clientes estaba vacío al crear
-- esta función, el índice único evita duplicar el mismo teléfono.
SET @client_phone_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'clientes'
    AND index_name = 'uq_clientes_telefono'
);
SET @client_phone_index_sql = IF(
  @client_phone_index_exists = 0,
  'CREATE UNIQUE INDEX uq_clientes_telefono ON clientes (telefono)',
  'SELECT ''uq_clientes_telefono ya existe'' AS estado'
);
PREPARE client_phone_index_stmt FROM @client_phone_index_sql;
EXECUTE client_phone_index_stmt;
DEALLOCATE PREPARE client_phone_index_stmt;

CREATE TABLE IF NOT EXISTS cliente_compras (
  id INT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cliente_compras_cliente_fecha (id_cliente, fecha),
  CONSTRAINT fk_cliente_compras_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB;