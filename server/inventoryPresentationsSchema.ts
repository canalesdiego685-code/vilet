export const inventoryPresentationsSchema = `CREATE TABLE IF NOT EXISTS inventario_presentaciones (
  id_inventario_presentacion INT NOT NULL AUTO_INCREMENT,
  id_producto INT NOT NULL,
  presentacion VARCHAR(20) NOT NULL,
  piezas DECIMAL(10,2) NOT NULL DEFAULT 0,
  entradas_piezas DECIMAL(10,2) NOT NULL DEFAULT 0,
  salidas_piezas DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_inventario_presentacion),
  UNIQUE KEY uq_inventario_producto_presentacion (id_producto, presentacion),
  CONSTRAINT fk_inventario_presentaciones_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
