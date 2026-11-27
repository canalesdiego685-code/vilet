import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'
import { inventoryPresentationFamily } from '../src/inventoryPresentations.js'
import { inventoryPresentationsSchema } from './inventoryPresentationsSchema.js'

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? process.env.TIDB_HOST ?? 'localhost',
  port: Number(process.env.MYSQL_PORT ?? process.env.TIDB_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE ?? process.env.TIDB_DATABASE ?? 'Vilet',
  user: process.env.MYSQL_USER ?? process.env.TIDB_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? process.env.TIDB_PASSWORD ?? '',
  charset: 'utf8mb4',
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
})

let inventoryPresentationsReady: Promise<void> | null = null

export async function ensureInventoryPresentations() {
  if (!inventoryPresentationsReady) {
    inventoryPresentationsReady = pool
      .query(inventoryPresentationsSchema)
      .then(() => undefined)
      .catch((error: unknown) => {
        inventoryPresentationsReady = null
        throw error
      })
  }
  await inventoryPresentationsReady
}

type StatusRow = RowDataPacket & { database_name: string; mysql_version: string }
export type ViletProduct = RowDataPacket & { id_producto: number; nombre: string; unidad: 'KG' | 'PZA' | 'AMBOS' }
export type DatabaseUserRole = 'Encargado' | 'cliente' | 'secretaria'
export type ViletUser = RowDataPacket & {
  id_usuario: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  email: string
  usuario: string
  contrasena: string
  rol: DatabaseUserRole
  estado: number
}
export type NewViletAccount = {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  email: string
  usuario: string
  contrasena: string
  rol: 'Encargado' | 'secretaria'
}

export async function readDatabaseStatus() {
  const [rows] = await pool.query<StatusRow[]>('SELECT DATABASE() AS database_name, VERSION() AS mysql_version')
  const row = rows[0]
  return { database: row?.database_name ?? 'Vilet', version: row?.mysql_version ?? 'MySQL 8.0' }
}

export async function readProducts() {
  const [rows] = await pool.query<ViletProduct[]>('SELECT id_producto, nombre, unidad FROM productos ORDER BY nombre')
  return rows
}

export async function readInventory() {
  const [rows] = await pool.query<(RowDataPacket & {
    id_producto: number
    nombre: string
    unidad: 'KG' | 'PZA' | 'AMBOS'
    tiene_registro: number
    stock_kg: number | string | null
    stock_piezas: number | string | null
    entradas_kg: number | string | null
    salidas_kg: number | string | null
    entradas_piezas: number | string | null
    salidas_piezas: number | string | null
    fecha_actualizacion: string | null
  })[]>(
    'SELECT p.id_producto, p.nombre, p.unidad, (i.id_inventario IS NOT NULL) AS tiene_registro, i.stock_kg, i.stock_piezas, i.entradas_kg, i.salidas_kg, i.entradas_piezas, i.salidas_piezas, i.fecha_actualizacion FROM productos p LEFT JOIN inventario i ON i.id_producto = p.id_producto ORDER BY p.nombre',
  )
  return rows
}

export type InventoryPresentationBalanceRow = RowDataPacket & {
  id_producto: number
  presentacion: string
  piezas: number | string
  entradas_piezas: number | string
  salidas_piezas: number | string
}

export async function readInventoryPresentationBalances() {
  await ensureInventoryPresentations()
  const [rows] = await pool.query<InventoryPresentationBalanceRow[]>(
    'SELECT id_producto, presentacion, piezas, entradas_piezas, salidas_piezas FROM inventario_presentaciones ORDER BY id_producto, presentacion',
  )
  return rows
}

export type InventoryMovementRow = RowDataPacket & {
  id: number
  tipo_movimiento: 'entrada' | 'salida'
  producto: string
  presentacion: string | null
  cantidad: number | string
  unidad: 'KG' | 'PZA' | null
  fecha: string
  usuario: string | null
  motivo: string | null
  cliente: string | null
}

export async function readInventoryMovements() {
  const [rows] = await pool.query<InventoryMovementRow[]>(
    `SELECT 'entrada' AS tipo_movimiento, id, producto, presentacion, cantidad,
      CASE WHEN LOWER(tipo) IN ('kg', 'pza') THEN UPPER(tipo) ELSE NULL END AS unidad,
      DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fecha, usuario, observaciones AS motivo, '' AS cliente
    FROM inventario_detalle
    UNION ALL
    SELECT 'salida' AS tipo_movimiento, id, producto, presentacion, cantidad,
      CASE
        WHEN UPPER(presentacion) IN ('KG', 'PZA') THEN UPPER(presentacion)
        WHEN LOWER(producto) IN ('oaxaca', 'panela') THEN 'PZA'
        ELSE NULL
      END AS unidad,
      DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fecha, usuario, motivo, cliente
    FROM salidas_detalle
    ORDER BY fecha DESC, id DESC
    LIMIT 100`,
  )
  return rows
}

export async function findUserForLogin(username: string, role: 'Encargado' | 'secretaria') {
  const [rows] = await pool.execute<ViletUser[]>(
    'SELECT id_usuario, nombre, apellido_paterno, apellido_materno, email, usuario, contrasena, rol, estado FROM usuarios WHERE usuario = ? AND rol = ? LIMIT 1',
    [username, role],
  )
  return rows[0] ?? null
}

export async function createViletAccount(account: NewViletAccount) {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO usuarios (nombre, apellido_paterno, apellido_materno, email, usuario, contrasena, rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [account.nombre, account.apellidoPaterno, account.apellidoMaterno, account.email, account.usuario, account.contrasena, account.rol],
  )
  return result.insertId
}

export async function closeDatabasePool() {
  await pool.end()
}

export async function addInventoryEntry(idProducto: number, cantidad: number, unidad: 'KG' | 'PZA', presentacion: string, usuario: string, observaciones: string) {
  await ensureInventoryPresentations()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [products] = await connection.execute<(RowDataPacket & { nombre: string })[]>(
      'SELECT nombre FROM productos WHERE id_producto = ? LIMIT 1 FOR UPDATE',
      [idProducto],
    )
    const product = products[0]
    if (!product) {
      await connection.rollback()
      return 'product-not-found' as const
    }

    const family = inventoryPresentationFamily(product.nombre)
    const effectivePresentation = family ? presentacion.trim().toUpperCase() : unidad
    if (family && (unidad !== 'PZA' || !family.presentations.some((item) => item.code === effectivePresentation))) {
      await connection.rollback()
      return 'invalid-presentation' as const
    }

    const [existingRows] = await connection.execute<(RowDataPacket & { id_inventario: number })[]>(
      'SELECT id_inventario FROM inventario WHERE id_producto = ? LIMIT 1 FOR UPDATE',
      [idProducto],
    )
    const existing = existingRows[0]
    if (existing && unidad === 'KG') {
      await connection.execute(
        'UPDATE inventario SET stock_kg = COALESCE(stock_kg, 0) + ?, entradas_kg = COALESCE(entradas_kg, 0) + ?, fecha_actualizacion = NOW() WHERE id_inventario = ?',
        [cantidad, cantidad, existing.id_inventario],
      )
    } else if (existing) {
      await connection.execute(
        'UPDATE inventario SET stock_piezas = COALESCE(stock_piezas, 0) + ?, entradas_piezas = COALESCE(entradas_piezas, 0) + ?, fecha_actualizacion = NOW() WHERE id_inventario = ?',
        [cantidad, cantidad, existing.id_inventario],
      )
    } else if (unidad === 'KG') {
      await connection.execute(
        'INSERT INTO inventario (id_producto, stock_kg, stock_piezas, fecha_actualizacion, entradas_piezas, salidas_piezas, entradas_kg, salidas_kg) VALUES (?, ?, 0, NOW(), 0, 0, ?, 0)',
        [idProducto, cantidad, cantidad],
      )
    } else {
      await connection.execute(
        'INSERT INTO inventario (id_producto, stock_kg, stock_piezas, fecha_actualizacion, entradas_piezas, salidas_piezas, entradas_kg, salidas_kg) VALUES (?, 0, ?, NOW(), ?, 0, 0, 0)',
        [idProducto, cantidad, cantidad],
      )
    }

    if (family) {
      await connection.execute(
        `INSERT INTO inventario_presentaciones (id_producto, presentacion, piezas, entradas_piezas, salidas_piezas)
         VALUES (?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE piezas = piezas + VALUES(piezas), entradas_piezas = entradas_piezas + VALUES(entradas_piezas), fecha_actualizacion = NOW()`,
        [idProducto, effectivePresentation, cantidad, cantidad],
      )
    }

    await connection.execute(
      'INSERT INTO inventario_detalle (producto, presentacion, cantidad, tipo, usuario, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
      [product.nombre, effectivePresentation, cantidad, unidad.toLowerCase(), usuario, observaciones],
    )
    await connection.commit()
    return 'saved' as const
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function addInventoryExit(idProducto: number, cantidad: number, unidad: 'KG' | 'PZA', presentacion: string, usuario: string, motivo: string, cliente: string) {
  await ensureInventoryPresentations()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [products] = await connection.execute<(RowDataPacket & { nombre: string })[]>(
      'SELECT nombre FROM productos WHERE id_producto = ? LIMIT 1 FOR UPDATE',
      [idProducto],
    )
    const product = products[0]
    if (!product) {
      await connection.rollback()
      return 'product-not-found' as const
    }

    const family = inventoryPresentationFamily(product.nombre)
    const effectivePresentation = family ? presentacion.trim().toUpperCase() : unidad
    const unassigned = Boolean(family && effectivePresentation === 'S/A')
    if (family && (unidad !== 'PZA' || (!unassigned && !family.presentations.some((item) => item.code === effectivePresentation)))) {
      await connection.rollback()
      return 'invalid-presentation' as const
    }

    const [inventoryRows] = await connection.execute<(RowDataPacket & {
      id_inventario: number
      stock_kg: number | string | null
      stock_piezas: number | string | null
    })[]>(
      'SELECT id_inventario, stock_kg, stock_piezas FROM inventario WHERE id_producto = ? LIMIT 1 FOR UPDATE',
      [idProducto],
    )
    const inventory = inventoryRows[0]
    const stock = Number(unidad === 'KG' ? inventory?.stock_kg : inventory?.stock_piezas)
    if (!inventory || !Number.isFinite(stock) || stock < cantidad) {
      await connection.rollback()
      return 'insufficient-stock' as const
    }

    if (family && !unassigned) {
      const [presentationRows] = await connection.execute<(RowDataPacket & { piezas: number | string })[]>(
        'SELECT piezas FROM inventario_presentaciones WHERE id_producto = ? AND presentacion = ? LIMIT 1 FOR UPDATE',
        [idProducto, effectivePresentation],
      )
      if (!presentationRows[0] || Number(presentationRows[0].piezas) < cantidad) {
        await connection.rollback()
        return 'insufficient-stock' as const
      }
    } else if (unassigned) {
      const [presentationRows] = await connection.execute<(RowDataPacket & { piezas: number | string })[]>(
        'SELECT piezas FROM inventario_presentaciones WHERE id_producto = ? FOR UPDATE',
        [idProducto],
      )
      const assigned = presentationRows.reduce((sum, row) => sum + Number(row.piezas), 0)
      if (stock - assigned < cantidad) {
        await connection.rollback()
        return 'insufficient-stock' as const
      }
    }

    if (unidad === 'KG') {
      await connection.execute(
        'UPDATE inventario SET stock_kg = stock_kg - ?, salidas_kg = COALESCE(salidas_kg, 0) + ?, fecha_actualizacion = NOW() WHERE id_inventario = ?',
        [cantidad, cantidad, inventory.id_inventario],
      )
    } else {
      await connection.execute(
        'UPDATE inventario SET stock_piezas = stock_piezas - ?, salidas_piezas = COALESCE(salidas_piezas, 0) + ?, fecha_actualizacion = NOW() WHERE id_inventario = ?',
        [cantidad, cantidad, inventory.id_inventario],
      )
    }

    if (family && !unassigned) {
      await connection.execute(
        'UPDATE inventario_presentaciones SET piezas = piezas - ?, salidas_piezas = salidas_piezas + ?, fecha_actualizacion = NOW() WHERE id_producto = ? AND presentacion = ?',
        [cantidad, cantidad, idProducto, effectivePresentation],
      )
    }

    await connection.execute(
      'INSERT INTO salidas_detalle (producto, presentacion, cantidad, tipo, fecha, usuario, motivo, cliente) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)',
      [product.nombre, effectivePresentation, cantidad, 'SALIDA', usuario, motivo, cliente],
    )
    await connection.execute(
      'INSERT INTO salidas (producto, cantidad, destino, fecha, responsable) VALUES (?, ?, ?, CURRENT_DATE, ?)',
      [product.nombre, cantidad, cliente || motivo || 'Salida de inventario', usuario],
    )
    await connection.commit()
    return 'saved' as const
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
export type ViletRawMaterial = RowDataPacket & {
  id: number
  nombre: string
  cantidad: number
  fecha: Date | string
}

async function isMateriaPrimaEncrypted() {
  const [rows] = await pool.query<(RowDataPacket & { encrypted: number; plain: number; decrypted_view: number })[]>(
    "SELECT (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materia_prima' AND COLUMN_NAME = 'nombre_cifrado') AS encrypted, (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materia_prima' AND COLUMN_NAME = 'nombre') AS plain, (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vw_materia_prima_autorizada') AS decrypted_view",
  )
  return Number(rows[0]?.encrypted ?? 0) > 0 && Number(rows[0]?.plain ?? 0) === 0 && Number(rows[0]?.decrypted_view ?? 0) > 0
}

export async function readRawMaterials() {
  const encrypted = await isMateriaPrimaEncrypted()
  if (encrypted) {
    const [rows] = await pool.query<(RowDataPacket & { id: number; nombre: string; cantidad: number; fecha: Date | string })[]>(
      'SELECT id, nombre, cantidad, fecha FROM vw_materia_prima_autorizada ORDER BY id DESC',
    )
    return rows
  }
  const [rows] = await pool.query<(RowDataPacket & { id: number; nombre: string; cantidad: number; fecha: Date | string })[]>(
    'SELECT id, nombre, cantidad, fecha FROM materia_prima ORDER BY id DESC',
  )
  return rows
}

export async function addRawMaterial(nombre: string, cantidad: number) {
  if (await isMateriaPrimaEncrypted()) {
    await pool.query('CALL sp_materia_prima_agregar(?, ?)', [nombre, cantidad])
    return
  }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      'SELECT id FROM materia_prima WHERE LOWER(nombre) = LOWER(?) ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [nombre],
    )
    const existing = rows[0]
    if (existing) {
      await connection.execute('UPDATE materia_prima SET cantidad = cantidad + ? WHERE id = ?', [cantidad, existing.id])
    } else {
      await connection.execute(
        'INSERT INTO materia_prima (nombre, cantidad, fecha) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [nombre, cantidad],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
export async function updateRawMaterial(id: number, nombre: string, cantidad: number) {
  if (await isMateriaPrimaEncrypted()) {
    await pool.query('CALL sp_materia_prima_actualizar(?, ?, ?)', [id, nombre, cantidad])
    return true
  }
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE materia_prima SET nombre = ?, cantidad = ? WHERE id = ?',
    [nombre, cantidad, id],
  )
  return result.affectedRows > 0
}
export async function deleteRawMaterial(id: number) {
  if (await isMateriaPrimaEncrypted()) {
    await pool.query('CALL sp_materia_prima_eliminar(?)', [id])
    return true
  }
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM materia_prima WHERE id = ?',
    [id],
  )
  return result.affectedRows > 0
}
export type ViletNoticeRow = RowDataPacket & {
  id: number
  titulo: string
  mensaje: string
  fecha: Date | string
  estado: 'no_leido' | 'leido' | null
}

export async function readNotices() {
  const [rows] = await pool.query<ViletNoticeRow[]>(
    "SELECT id, titulo, mensaje, fecha, COALESCE(estado, 'no_leido') AS estado FROM avisos WHERE eliminado_en IS NULL ORDER BY fecha DESC, id DESC",
  )
  return rows
}

export async function createNotice(titulo: string, mensaje: string) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO avisos (titulo, mensaje, fecha, estado) VALUES (?, ?, CURRENT_TIMESTAMP, 'no_leido')",
    [titulo, mensaje],
  )
  return result.insertId
}

export async function markNoticeRead(id: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE avisos SET estado = 'leido' WHERE id = ? AND eliminado_en IS NULL",
    [id],
  )
  return result.affectedRows
}

export async function markAllNoticesRead() {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE avisos SET estado = 'leido' WHERE eliminado_en IS NULL AND (estado IS NULL OR estado = 'no_leido')",
  )
  return result.affectedRows
}

export type ViletClientRow = RowDataPacket & {
  id: number
  nombre: string
  telefono: string
  compras: number
  ultima_compra: Date | string | null
}

export async function readClients() {
  const [rows] = await pool.query<ViletClientRow[]>(
    'SELECT c.id, c.nombre, c.telefono, COUNT(cp.id) AS compras, MAX(cp.fecha) AS ultima_compra FROM clientes c LEFT JOIN cliente_compras cp ON cp.id_cliente = c.id GROUP BY c.id, c.nombre, c.telefono ORDER BY c.nombre, c.id',
  )
  return rows
}

export async function recordClientPurchase(nombre: string, telefono: string) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      'SELECT id FROM clientes WHERE telefono = ? LIMIT 1 FOR UPDATE',
      [telefono],
    )
    let id = rows[0]?.id
    if (!id) {
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO clientes (nombre, telefono, fecha) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [nombre, telefono],
      )
      id = result.insertId
    } else {
      await connection.execute('UPDATE clientes SET nombre = ? WHERE id = ?', [nombre, id])
    }
    await connection.execute('INSERT INTO cliente_compras (id_cliente, fecha) VALUES (?, CURRENT_TIMESTAMP)', [id])
    await connection.commit()
    return id
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function updateClient(id: number, nombre: string, telefono: string) {
  const [existing] = await pool.execute<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM clientes WHERE id = ? LIMIT 1',
    [id],
  )
  if (!existing[0]) return false
  await pool.execute<ResultSetHeader>(
    'UPDATE clientes SET nombre = ?, telefono = ? WHERE id = ?',
    [nombre, telefono, id],
  )
  return true
}

export async function readClientHistory(id: number) {
  const [rows] = await pool.execute<(RowDataPacket & { id: number; fecha: Date | string })[]>(
    'SELECT cp.id, cp.fecha FROM cliente_compras cp WHERE cp.id_cliente = ? ORDER BY cp.fecha DESC, cp.id DESC',
    [id],
  )
  return rows
}
export type ViletPerformanceRow = RowDataPacket & {
  id: number
  area: string
  descripcion: string | null
  archivo: string
  fecha: Date | string
}

export async function readPerformanceSheets() {
  const [rows] = await pool.query<ViletPerformanceRow[]>(
    "SELECT id, area, descripcion, archivo, DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fecha FROM rendimiento WHERE estado = 'activo' ORDER BY fecha DESC, id DESC",
  )
  return rows
}

export async function createPerformanceSheet(area: string, descripcion: string, archivo: string) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO rendimiento (area, descripcion, archivo, fecha, estado) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'activo')",
    [area, descripcion || null, archivo],
  )
  return result.insertId
}

export async function deletePerformanceSheet(id: number) {
  const [rows] = await pool.execute<(RowDataPacket & { archivo: string })[]>(
    "SELECT archivo FROM rendimiento WHERE id = ? AND estado = 'activo' LIMIT 1",
    [id],
  )
  const row = rows[0]
  if (!row) return null
  await pool.execute("UPDATE rendimiento SET estado = 'eliminado' WHERE id = ?", [id])
  return row.archivo
}

export type ViletEmployeeRow = RowDataPacket & {
  id: number
  nombre: string
  puesto: string | null
}

export async function readEmployees() {
  const [rows] = await pool.query<ViletEmployeeRow[]>(
    "SELECT id, nombre, puesto FROM empleados WHERE estado = 'activo' ORDER BY nombre",
  )
  return rows
}

export async function addEmployee(nombre: string) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM empleados WHERE estado = 'activo' AND LOWER(TRIM(nombre)) = LOWER(?) LIMIT 1 FOR UPDATE",
      [nombre],
    )
    if (rows[0]) {
      await connection.commit()
      return { id: rows[0].id, created: false }
    }
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO empleados (nombre, estado) VALUES (?, 'activo')",
      [nombre],
    )
    await connection.commit()
    return { id: result.insertId, created: true }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deactivateEmployee(id: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE empleados SET estado = 'inactivo' WHERE id = ? AND estado = 'activo'",
    [id],
  )
  return result.affectedRows > 0
}

export type ViletAttendanceRow = RowDataPacket & {
  empleado_id: number
  fecha: string
  estado: string | null
}

export async function readAttendanceWeek(start: string, end: string) {
  const [rows] = await pool.execute<ViletAttendanceRow[]>(
    "SELECT empleado_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, estado FROM asistencias WHERE fecha BETWEEN ? AND ? ORDER BY fecha",
    [start, end],
  )
  return rows
}

export async function saveAttendance(empleadoId: number, fecha: string, estado: string) {
  if (!estado) {
    await pool.execute('DELETE FROM asistencias WHERE empleado_id = ? AND fecha = ?', [empleadoId, fecha])
    return
  }
  const [employees] = await pool.execute<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM empleados WHERE id = ? AND estado = 'activo' LIMIT 1",
    [empleadoId],
  )
  if (!employees[0]) throw new Error('No se encontró el empleado activo.')
  await pool.execute(
    'INSERT INTO asistencias (empleado_id, fecha, estado) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE estado = VALUES(estado)',
    [empleadoId, fecha, estado],
  )
}
export type ViletAdminAccount = RowDataPacket & {
  id_usuario: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  email: string
  usuario: string
  rol: 'Encargado' | 'secretaria'
  estado: number
  fecha_registro: string
}

export async function readAdminAccounts() {
  const [rows] = await pool.query<ViletAdminAccount[]>(
    "SELECT id_usuario, nombre, apellido_paterno, apellido_materno, email, usuario, rol, estado, DATE_FORMAT(fecha_registro, '%Y-%m-%d %H:%i:%s') AS fecha_registro FROM usuarios WHERE rol IN ('Encargado', 'secretaria') ORDER BY id_usuario DESC",
  )
  return rows
}

export async function updateAdminAccount(
  id: number,
  account: { nombre: string; apellidoPaterno: string; apellidoMaterno: string; email: string; usuario: string; rol: 'Encargado' | 'secretaria'; estado: number; contrasena?: string },
) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { rol: string; estado: number })[]>(
      'SELECT rol, estado FROM usuarios WHERE id_usuario = ? LIMIT 1 FOR UPDATE',
      [id],
    )
    const current = rows[0]
    if (!current) {
      await connection.rollback()
      return 'not-found' as const
    }
    if (current.rol === 'Encargado' && Number(current.estado) === 1 && (account.rol !== 'Encargado' || account.estado !== 1)) {
      const [admins] = await connection.query<(RowDataPacket & { total: number })[]>(
        "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'Encargado' AND estado = 1",
      )
      if (Number(admins[0]?.total ?? 0) <= 1) {
        await connection.rollback()
        return 'last-admin' as const
      }
    }
    if (account.contrasena) {
      await connection.execute(
        'UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ?, email = ?, usuario = ?, rol = ?, estado = ?, contrasena = ? WHERE id_usuario = ?',
        [account.nombre, account.apellidoPaterno, account.apellidoMaterno, account.email, account.usuario, account.rol, account.estado, account.contrasena, id],
      )
    } else {
      await connection.execute(
        'UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ?, email = ?, usuario = ?, rol = ?, estado = ? WHERE id_usuario = ?',
        [account.nombre, account.apellidoPaterno, account.apellidoMaterno, account.email, account.usuario, account.rol, account.estado, id],
      )
    }
    await connection.commit()
    return 'updated' as const
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function deactivateAdminAccount(id: number) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute<(RowDataPacket & { rol: string; estado: number })[]>(
      'SELECT rol, estado FROM usuarios WHERE id_usuario = ? LIMIT 1 FOR UPDATE',
      [id],
    )
    const current = rows[0]
    if (!current) {
      await connection.rollback()
      return 'not-found' as const
    }
    if (current.rol === 'Encargado' && Number(current.estado) === 1) {
      const [admins] = await connection.query<(RowDataPacket & { total: number })[]>(
        "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'Encargado' AND estado = 1",
      )
      if (Number(admins[0]?.total ?? 0) <= 1) {
        await connection.rollback()
        return 'last-admin' as const
      }
    }
    await connection.execute('UPDATE usuarios SET estado = 0 WHERE id_usuario = ?', [id])
    await connection.commit()
    return 'deactivated' as const
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function isActiveAccount(id: number) {
  const [rows] = await pool.execute<(RowDataPacket & { id_usuario: number })[]>(
    "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND estado = 1 LIMIT 1",
    [id],
  )
  return rows.length > 0
}

export async function deleteNotice(id: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE avisos SET eliminado_en = CURRENT_TIMESTAMP WHERE id = ? AND eliminado_en IS NULL',
    [id],
  )
  return result.affectedRows
}
