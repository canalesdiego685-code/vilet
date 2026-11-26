-- VILET · Cifrado de materia prima · MySQL 8.0
-- Columna protegida: nombre del insumo (catálogo comercial interno).
-- Contraseñas de la aplicación: se almacenan con bcrypt en el servidor Node.
--
-- IMPORTANTE:
-- 1) Exporta primero materia_prima desde MySQL Workbench.
-- 2) Ejecuta la FASE 1 y comprueba diferencias = 0.
-- 3) Ejecuta la FASE 2 solo después de verificar el cifrado y tener respaldo.
-- 4) Ejecuta la FASE 3 para vistas, procedimientos y roles.

USE Vilet;

-- ═══════════════════════════════════════════════════════════════════════
-- FASE 1 · Crear la clave protegida y cifrar las filas actuales
-- Ejecutar una sola vez. Si nombre_cifrado ya existe, omite el ALTER TABLE.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vilet_claves_cifrado (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  clave VARBINARY(32) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- La clave se genera una sola vez; INSERT IGNORE conserva la existente.
INSERT IGNORE INTO vilet_claves_cifrado (id, clave)
VALUES (1, RANDOM_BYTES(32));

ALTER TABLE materia_prima
  ADD COLUMN nombre_cifrado VARBINARY(512) NULL;

UPDATE materia_prima AS mp
JOIN vilet_claves_cifrado AS ck ON ck.id = 1
SET mp.nombre_cifrado = AES_ENCRYPT(mp.nombre, ck.clave)
WHERE mp.nombre_cifrado IS NULL;

-- Verifica: sin_cifrar y diferencias deben ser 0 antes de continuar.
SELECT
  COUNT(*) AS filas,
  SUM(mp.nombre_cifrado IS NULL) AS sin_cifrar,
  SUM(CONVERT(AES_DECRYPT(mp.nombre_cifrado, ck.clave) USING utf8mb4) <> mp.nombre) AS diferencias
FROM materia_prima AS mp
JOIN vilet_claves_cifrado AS ck ON ck.id = 1;

-- Comprueba que la columna ya contiene datos binarios ilegibles.
SELECT id, HEX(nombre_cifrado) AS nombre_cifrado_hex, cantidad, fecha
FROM materia_prima
ORDER BY id DESC;

-- ═══════════════════════════════════════════════════════════════════════
-- FASE 2 · Retirar texto normal tras verificar y respaldar
-- Ejecutar solo cuando diferencias = 0. Esta acción elimina la columna
-- original en texto normal; conserva antes una exportación de Workbench.
-- ═══════════════════════════════════════════════════════════════════════

-- ALTER TABLE materia_prima DROP COLUMN nombre;
-- ALTER TABLE materia_prima MODIFY nombre_cifrado VARBINARY(512) NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- FASE 3 · Acceso mediante vistas y procedimientos con permisos separados
-- Ejecutar después de completar la FASE 2.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE SQL SECURITY DEFINER VIEW vw_materia_prima_autorizada AS
SELECT
  mp.id,
  CONVERT(AES_DECRYPT(mp.nombre_cifrado, ck.clave) USING utf8mb4) AS nombre,
  mp.cantidad,
  mp.fecha
FROM materia_prima AS mp
JOIN vilet_claves_cifrado AS ck ON ck.id = 1;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW vw_materia_prima_cifrada AS
SELECT id, nombre_cifrado, cantidad, fecha
FROM materia_prima;

DROP PROCEDURE IF EXISTS sp_materia_prima_descifrar;
DROP PROCEDURE IF EXISTS sp_materia_prima_agregar;
DROP PROCEDURE IF EXISTS sp_materia_prima_actualizar;
DROP PROCEDURE IF EXISTS sp_materia_prima_eliminar;

DELIMITER $$

CREATE PROCEDURE sp_materia_prima_descifrar(IN p_id INT)
SQL SECURITY DEFINER
BEGIN
  SELECT id, nombre, cantidad, fecha
  FROM vw_materia_prima_autorizada
  WHERE id = p_id;
END$$

CREATE PROCEDURE sp_materia_prima_agregar(IN p_nombre VARCHAR(120), IN p_cantidad INT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_id INT DEFAULT NULL;
  DECLARE v_clave VARBINARY(32);
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT clave INTO v_clave FROM vilet_claves_cifrado WHERE id = 1;
  SELECT id INTO v_id
  FROM materia_prima
  WHERE LOWER(CONVERT(AES_DECRYPT(nombre_cifrado, v_clave) USING utf8mb4)) = LOWER(p_nombre)
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO materia_prima (nombre_cifrado, cantidad, fecha)
    VALUES (AES_ENCRYPT(p_nombre, v_clave), p_cantidad, CURRENT_TIMESTAMP);
  ELSE
    UPDATE materia_prima SET cantidad = cantidad + p_cantidad WHERE id = v_id;
  END IF;
  COMMIT;
END$$

CREATE PROCEDURE sp_materia_prima_actualizar(IN p_id INT, IN p_nombre VARCHAR(120), IN p_cantidad INT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_clave VARBINARY(32);
  SELECT clave INTO v_clave FROM vilet_claves_cifrado WHERE id = 1;
  UPDATE materia_prima
  SET nombre_cifrado = AES_ENCRYPT(p_nombre, v_clave), cantidad = p_cantidad
  WHERE id = p_id;
END$$

CREATE PROCEDURE sp_materia_prima_eliminar(IN p_id INT)
SQL SECURITY DEFINER
BEGIN
  DELETE FROM materia_prima WHERE id = p_id;
END$$

DELIMITER ;

CREATE ROLE IF NOT EXISTS 'rol_mp_autorizado';
CREATE ROLE IF NOT EXISTS 'rol_mp_consulta';

-- Secretaría autorizada puede leer texto descifrado y ejecutar cambios
-- únicamente por las vistas/procedimientos definidos por el propietario.
GRANT SELECT ON Vilet.vw_materia_prima_autorizada TO 'rol_mp_autorizado';
GRANT EXECUTE ON PROCEDURE Vilet.sp_materia_prima_descifrar TO 'rol_mp_autorizado';
GRANT EXECUTE ON PROCEDURE Vilet.sp_materia_prima_agregar TO 'rol_mp_autorizado';
GRANT EXECUTE ON PROCEDURE Vilet.sp_materia_prima_actualizar TO 'rol_mp_autorizado';
GRANT EXECUTE ON PROCEDURE Vilet.sp_materia_prima_eliminar TO 'rol_mp_autorizado';

-- Consulta puede ver el cifrado (HEX), pero no tiene acceso a la clave,
-- a la vista descifrada ni a los procedimientos.
GRANT SELECT ON Vilet.vw_materia_prima_cifrada TO 'rol_mp_consulta';

-- Asigna los roles a usuarios existentes cuando ya estén creados:
-- GRANT 'rol_mp_autorizado' TO 'usr_secretaria'@'localhost';
-- SET DEFAULT ROLE 'rol_mp_autorizado' TO 'usr_secretaria'@'localhost';
-- GRANT 'rol_mp_consulta' TO 'usr_consulta'@'localhost';
-- SET DEFAULT ROLE 'rol_mp_consulta' TO 'usr_consulta'@'localhost';

-- DEMOSTRACIÓN como usuario con rol_mp_consulta:
-- SELECT id, HEX(nombre_cifrado), cantidad, fecha FROM vw_materia_prima_cifrada;
-- SELECT AES_DECRYPT(nombre_cifrado, 'clave_incorrecta') FROM materia_prima;
-- El resultado no será texto legible. CALL sp_materia_prima_descifrar(1);
-- debe fallar por falta de permiso EXECUTE.

-- DEMOSTRACIÓN como usuario con rol_mp_autorizado:
-- SELECT id, nombre, cantidad, fecha FROM vw_materia_prima_autorizada;
-- CALL sp_materia_prima_descifrar(1);
-- Ambas consultas muestran el nombre descifrado.

-- AES_ENCRYPT protege el nombre dentro de la columna; no reemplaza TLS ni
-- el cifrado de disco. En MySQL local, TDE no queda activo por instalar
-- Workbench. Si se usa DBaaS, documenta el ajuste de cifrado en reposo del
-- proveedor con una captura de su panel.