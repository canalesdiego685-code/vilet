-- Garantiza una sola captura por empleado y día en MySQL 8.
-- Se verificó que no hay fechas repetidas en asistencias.
USE Vilet;
SET @attendance_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'asistencias'
    AND index_name = 'uq_asistencias_empleado_fecha'
);
SET @attendance_index_sql = IF(
  @attendance_index_exists = 0,
  'CREATE UNIQUE INDEX uq_asistencias_empleado_fecha ON asistencias (empleado_id, fecha)',
  'SELECT ''uq_asistencias_empleado_fecha ya existe'' AS estado'
);
PREPARE attendance_index_stmt FROM @attendance_index_sql;
EXECUTE attendance_index_stmt;
DEALLOCATE PREPARE attendance_index_stmt;