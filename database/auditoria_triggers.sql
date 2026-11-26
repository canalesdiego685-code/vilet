-- VILET · Bitácora de auditoría y triggers · MySQL 8
USE Vilet;

CREATE TABLE IF NOT EXISTS Bitacora_Auditoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tabla_afectada VARCHAR(64) NOT NULL,
  operacion ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  usuario_bd VARCHAR(288) NOT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valores_anteriores JSON NULL,
  valores_nuevos JSON NULL,
  PRIMARY KEY (id),
  KEY idx_bitacora_fecha (fecha_hora),
  KEY idx_bitacora_tabla_operacion (tabla_afectada, operacion)
) ENGINE=InnoDB;

CREATE ROLE IF NOT EXISTS 'rol_auditoria_lectura';
GRANT SELECT ON Vilet.Bitacora_Auditoria TO 'rol_auditoria_lectura';

DROP TRIGGER IF EXISTS trg_aud_mp_insert;
DROP TRIGGER IF EXISTS trg_aud_mp_update;
DROP TRIGGER IF EXISTS trg_aud_mp_delete;
DROP TRIGGER IF EXISTS trg_aud_usuarios_insert;
DROP TRIGGER IF EXISTS trg_aud_usuarios_update;
DROP TRIGGER IF EXISTS trg_aud_usuarios_delete;

DELIMITER $$

CREATE TRIGGER trg_aud_mp_insert
AFTER INSERT ON materia_prima
FOR EACH ROW
BEGIN
  INSERT INTO Bitacora_Auditoria
    (tabla_afectada, operacion, usuario_bd, fecha_hora, valores_anteriores, valores_nuevos)
  VALUES
    ('materia_prima', 'INSERT', USER(), CURRENT_TIMESTAMP, NULL,
     JSON_OBJECT('id', NEW.id, 'cantidad', NEW.cantidad));
END$$

CREATE TRIGGER trg_aud_mp_update
AFTER UPDATE ON materia_prima
FOR EACH ROW
BEGIN
  INSERT INTO Bitacora_Auditoria
    (tabla_afectada, operacion, usuario_bd, fecha_hora, valores_anteriores, valores_nuevos)
  VALUES
    ('materia_prima', 'UPDATE', USER(), CURRENT_TIMESTAMP,
     JSON_OBJECT('id', OLD.id, 'cantidad', OLD.cantidad),
     JSON_OBJECT('id', NEW.id, 'cantidad', NEW.cantidad));
END$$

CREATE TRIGGER trg_aud_mp_delete
AFTER DELETE ON materia_prima
FOR EACH ROW
BEGIN
  INSERT INTO Bitacora_Auditoria
    (tabla_afectada, operacion, usuario_bd, fecha_hora, valores_anteriores, valores_nuevos)
  VALUES
    ('materia_prima', 'DELETE', USER(), CURRENT_TIMESTAMP,
     JSON_OBJECT('id', OLD.id, 'cantidad', OLD.cantidad), NULL);
END$$

CREATE TRIGGER trg_aud_usuarios_insert
AFTER INSERT ON usuarios
FOR EACH ROW
BEGIN
  INSERT INTO Bitacora_Auditoria
    (tabla_afectada, operacion, usuario_bd, fecha_hora, valores_anteriores, valores_nuevos)
  VALUES
    ('usuarios', 'INSERT', USER(), CURRENT_TIMESTAMP, NULL,
     JSON_OBJECT('id_usuario', NEW.id_usuario, 'usuario', NEW.usuario, 'rol', NEW.rol, 'estado', NEW.estado));
END$$

CREATE TRIGGER trg_aud_usuarios_update
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
  INSERT INTO Bitacora_Auditoria
    (tabla_afectada, operacion, usuario_bd, fecha_hora, valores_anteriores, valores_nuevos)
  VALUES
    ('usuarios', 'UPDATE', USER(), CURRENT_TIMESTAMP,
     JSON_OBJECT('id_usuario', OLD.id_usuario, 'usuario', OLD.usuario, 'rol', OLD.rol, 'estado', OLD.estado),
     JSON_OBJECT('id_usuario', NEW.id_usuario, 'usuario', NEW.usuario, 'rol', NEW.rol, 'estado', NEW.estado));
END$$

CREATE TRIGGER trg_aud_usuarios_delete
AFTER DELETE ON usuarios
FOR EACH ROW
BEGIN
  INSERT INTO Bitacora_Auditoria
    (tabla_afectada, operacion, usuario_bd, fecha_hora, valores_anteriores, valores_nuevos)
  VALUES
    ('usuarios', 'DELETE', USER(), CURRENT_TIMESTAMP,
     JSON_OBJECT('id_usuario', OLD.id_usuario, 'usuario', OLD.usuario, 'rol', OLD.rol, 'estado', OLD.estado), NULL);
END$$

DELIMITER ;

-- Para la evidencia, conecta un usuario de consulta y ejecuta:
-- INSERT INTO materia_prima (nombre, cantidad, fecha)
-- VALUES ('prueba_auditoria', 1, CURRENT_TIMESTAMP);
-- Después consulta Bitacora_Auditoria con rol_auditoria_lectura.
-- El trigger no registra contraseña, correo, teléfono ni nombre del insumo.