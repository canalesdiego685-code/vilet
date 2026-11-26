import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { closeDatabasePool, createViletAccount, findUserForLogin, addInventoryEntry, addRawMaterial, deleteRawMaterial, readDatabaseStatus, readInventory, readProducts, readRawMaterials, updateRawMaterial, readNotices, createNotice, markNoticeRead, markAllNoticesRead, readClients, recordClientPurchase, updateClient, readClientHistory, readEmployees, addEmployee, deactivateEmployee, readAttendanceWeek, saveAttendance, readAdminAccounts, updateAdminAccount, deactivateAdminAccount, isActiveAccount, deleteNotice } from './db.js'
import { closeMongoDB, connectMongoDB, createPerformanceSheet, deletePerformanceSheet, readMongoStatus, readPerformanceFile, readPerformanceSheets } from './mongo.js'

const port = Number(process.env.API_PORT ?? 3001)
const host = '127.0.0.1'
const authSessions = new Map<string, { userId: number; role: string; expiresAt: number }>()

class RequestError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request: IncomingMessage, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let totalBytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > maxBytes) throw new RequestError(413, 'La solicitud es demasiado grande.')
    chunks.push(buffer)
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(400, 'Los datos enviados no son válidos.')
    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(400, 'Los datos enviados no son válidos.')
  }
}

function field(body: Record<string, unknown>, name: string) {
  return typeof body[name] === 'string' ? body[name].trim() : ''
}



function sessionFromRequest(request: IncomingMessage) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice(7).trim()
  const session = authSessions.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token)
    return null
  }
  return { token, session }
}

async function requireAdmin(request: IncomingMessage, response: ServerResponse) {
  const auth = sessionFromRequest(request)
  if (!auth) {
    sendJson(response, 401, { message: 'Inicia sesión como administrador para continuar.' })
    return null
  }
  if (auth.session.role !== 'Encargado') {
    sendJson(response, 403, { message: 'Esta acción requiere una cuenta de administrador.' })
    return null
  }
  if (!await isActiveAccount(auth.session.userId)) {
    authSessions.delete(auth.token)
    sendJson(response, 401, { message: 'La cuenta de administrador ya no está activa.' })
    return null
  }
  return auth.session
}

async function requirePerformanceSession(request: IncomingMessage, response: ServerResponse, requiredRole: 'secretaria' | null = null) {
  const auth = sessionFromRequest(request)
  if (!auth) {
    sendJson(response, 401, { message: 'Inicia sesión para consultar las hojas de rendimiento.' })
    return null
  }
  if (requiredRole && auth.session.role !== requiredRole) {
    sendJson(response, 403, { message: 'Esta acción requiere una cuenta de Secretaría.' })
    return null
  }
  if (!await isActiveAccount(auth.session.userId)) {
    authSessions.delete(auth.token)
    sendJson(response, 401, { message: 'La cuenta ya no está activa.' })
    return null
  }
  return auth.session
}

function performanceMimeExtension(mimeType: string) {
  const allowed: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }
  return allowed[mimeType] ?? null
}

function hasValidFileSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
  if (mimeType === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  if (mimeType === 'application/pdf') return buffer.toString('ascii', 0, 5) === '%PDF-'
  return false
}

async function handleLogin(request: IncomingMessage, response: ServerResponse) {
  const body = await readJsonBody(request)
  const username = field(body, 'username')
  const password = typeof body.password === 'string' ? body.password : ''
  const requestedRole = field(body, 'role')
  const databaseRole = requestedRole === 'Encargado' ? 'Encargado' : requestedRole === 'Secretaría' ? 'secretaria' : null

  if (!username || !password || !databaseRole) {
    sendJson(response, 400, { message: 'Escribe tu usuario y contraseña.' })
    return
  }

  try {
    const user = await findUserForLogin(username, databaseRole)
    let passwordMatches = false
    if (user && user.estado === 1) passwordMatches = await bcrypt.compare(password, user.contrasena)
    if (!user || !passwordMatches) {
      sendJson(response, 401, { message: 'Usuario o contraseña incorrectos.' })
      return
    }

    const name = [user.nombre, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ')
    const token = randomUUID()
    authSessions.set(token, { userId: user.id_usuario, role: user.rol, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })
    sendJson(response, 200, {
      token,
      user: {
        id: user.id_usuario,
        name,
        username: user.usuario,
        role: user.rol === 'secretaria' ? 'Secretaría' : 'Encargado',
      },
    })
  } catch (error) {
    console.error('No fue posible iniciar sesión en Vilet:', error instanceof Error ? error.message : 'Error desconocido')
    sendJson(response, 503, { message: 'No se pudo consultar la cuenta. Revisa la conexión con MySQL.' })
  }
}

async function handleRegistration(request: IncomingMessage, response: ServerResponse) {
  const body = await readJsonBody(request)
  const nombre = field(body, 'nombre')
  const apellidoPaterno = field(body, 'apellidoPaterno')
  const apellidoMaterno = field(body, 'apellidoMaterno')
  const email = field(body, 'email').toLowerCase()
  const usuario = field(body, 'usuario')
  const password = typeof body.password === 'string' ? body.password : ''
  const requestedRole = field(body, 'role')
  const databaseRole = requestedRole === 'Encargado' ? 'Encargado' : requestedRole === 'Secretaría' ? 'secretaria' : null

  if (!nombre || !apellidoPaterno || !apellidoMaterno || !email || !usuario || !password || !databaseRole) {
    sendJson(response, 400, { message: 'Completa todos los campos para crear la cuenta.' })
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { message: 'Escribe un correo electrónico válido.' })
    return
  }
  if (password.length < 8) {
    sendJson(response, 400, { message: 'La contraseña debe tener al menos 8 caracteres.' })
    return
  }

  try {
    const encryptedPassword = await bcrypt.hash(password, 12)
    const id = await createViletAccount({ nombre, apellidoPaterno, apellidoMaterno, email, usuario, contrasena: encryptedPassword, rol: databaseRole })
    sendJson(response, 201, {
      id,
      role: databaseRole === 'secretaria' ? 'Secretaría' : 'Encargado',
      message: `Cuenta de ${databaseRole === 'secretaria' ? 'Secretaría' : 'Encargado'} creada. Ya puedes ingresar.`,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      sendJson(response, 409, { message: 'Ese correo o usuario ya está registrado. Prueba con otro.' })
      return
    }
    console.error('No fue posible crear la cuenta de Vilet:', error instanceof Error ? error.message : 'Error desconocido')
    sendJson(response, 503, { message: 'No se pudo guardar la cuenta. Revisa la conexión con MySQL.' })
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
  const pathname = requestUrl.pathname

  const performanceFileMatch = pathname.match(/^\/api\/performance\/files\/([a-fA-F0-9]{24})$/)
  if (request.method === 'GET' && performanceFileMatch) {
    if (!await requirePerformanceSession(request, response)) return
    try {
      const file = await readPerformanceFile(performanceFileMatch[1])
      if (!file) {
        sendJson(response, 404, { message: 'No se encontró ese archivo en MongoDB.' })
        return
      }
      response.writeHead(200, {
        'Content-Type': file.mimeType,
        'Content-Length': file.data.byteLength,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      })
      response.end(file.data)
    } catch (error) {
      console.error('No fue posible leer el archivo de MongoDB:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'MongoDB Atlas no está disponible para consultar el archivo.' })
    }
    return
  }

  if (request.method === 'GET' && pathname === '/api/performance') {
    if (!await requirePerformanceSession(request, response)) return
    try {
      sendJson(response, 200, { items: await readPerformanceSheets(), storage: 'MongoDB Atlas' })
    } catch (error) {
      console.error('No fue posible leer rendimiento en MongoDB:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'No se pudieron consultar las hojas de rendimiento en MongoDB Atlas.' })
    }
    return
  }

  if (request.method === 'POST' && pathname === '/api/performance') {
    if (!await requirePerformanceSession(request, response, 'secretaria')) return
    const body = await readJsonBody(request, 7_500_000)
    const area = field(body, 'area')
    const descripcion = field(body, 'descripcion')
    const fileName = field(body, 'fileName')
    const mimeType = field(body, 'mimeType')
    const dataBase64 = field(body, 'dataBase64')
    const extension = performanceMimeExtension(mimeType)
    if (!area || area.length > 100 || descripcion.length > 500 || !fileName || fileName.length > 255 || !extension || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
      sendJson(response, 400, { message: 'Completa el área, la descripción y selecciona una imagen o PDF válido.' })
      return
    }
    const fileData = Buffer.from(dataBase64, 'base64')
    if (fileData.length < 1 || fileData.length > 5 * 1024 * 1024 || !hasValidFileSignature(fileData, mimeType)) {
      sendJson(response, 400, { message: 'El archivo no se reconoce o supera el límite de 5 MB. Usa JPG, PNG, WEBP o PDF.' })
      return
    }
    try {
      const id = await createPerformanceSheet({ area, descripcion, fileName, mimeType, extension, data: fileData })
      sendJson(response, 201, { id, message: 'Hoja de rendimiento guardada en MongoDB Atlas.' })
    } catch (error) {
      console.error('No fue posible guardar rendimiento en MongoDB:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'MongoDB Atlas no está disponible para guardar la hoja.' })
    }
    return
  }

  const performanceIdMatch = pathname.match(/^\/api\/performance\/([a-fA-F0-9]{24})$/)
  if (performanceIdMatch && request.method === 'DELETE') {
    if (!await requirePerformanceSession(request, response, 'secretaria')) return
    try {
      const deleted = await deletePerformanceSheet(performanceIdMatch[1])
      if (!deleted) {
        sendJson(response, 404, { message: 'No se encontró esa hoja de rendimiento activa.' })
        return
      }
      sendJson(response, 200, { message: 'Hoja de rendimiento eliminada de MongoDB Atlas.' })
    } catch (error) {
      console.error('No fue posible eliminar rendimiento en MongoDB:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'MongoDB Atlas no está disponible para eliminar la hoja.' })
    }
    return
  }

  if (request.method === 'GET' && pathname === '/api/employees') {
    sendJson(response, 200, { items: await readEmployees() })
    return
  }

  if (request.method === 'POST' && pathname === '/api/employees') {
    const body = await readJsonBody(request)
    const nombre = field(body, 'nombre')
    if (!nombre || nombre.length > 150) {
      sendJson(response, 400, { message: 'Escribe el nombre del empleado.' })
      return
    }
    const result = await addEmployee(nombre)
    sendJson(response, result.created ? 201 : 200, {
      id: result.id,
      message: result.created ? 'Empleado agregado.' : 'Ese empleado ya estaba en la lista.',
    })
    return
  }

  const employeeMatch = pathname.match(/^\/api\/employees\/(\d+)$/)
  if (employeeMatch && request.method === 'DELETE') {
    const removed = await deactivateEmployee(Number(employeeMatch[1]))
    if (!removed) {
      sendJson(response, 404, { message: 'No se encontró ese empleado activo.' })
      return
    }
    sendJson(response, 200, { message: 'Empleado quitado de la lista; su historial se conserva.' })
    return
  }

  if (request.method === 'GET' && pathname === '/api/attendance') {
    const start = requestUrl.searchParams.get('start') ?? ''
    const end = requestUrl.searchParams.get('end') ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      sendJson(response, 400, { message: 'Selecciona una semana válida.' })
      return
    }
    sendJson(response, 200, { items: await readAttendanceWeek(start, end) })
    return
  }

  if (request.method === 'PUT' && pathname === '/api/attendance') {
    const body = await readJsonBody(request)
    const empleadoId = Number(body.empleado_id)
    const fecha = field(body, 'fecha')
    const estado = typeof body.estado === 'string' ? body.estado : ''
    if (!Number.isInteger(empleadoId) || empleadoId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !['', 'V', 'R', 'F', 'P'].includes(estado)) {
      sendJson(response, 400, { message: 'Revisa el empleado, la fecha y el estado.' })
      return
    }
    await saveAttendance(empleadoId, fecha, estado)
    sendJson(response, 200, { message: estado ? 'Asistencia guardada.' : 'Captura diaria borrada.' })
    return
  }
  const adminUsersPath = pathname === '/api/admin/users'
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/)
  if ((adminUsersPath || adminUserMatch) && (request.method === 'GET' || request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE')) {
    const session = await requireAdmin(request, response)
    if (!session) return
    if (adminUsersPath && request.method === 'GET') {
      const rows = await readAdminAccounts()
      sendJson(response, 200, { items: rows.map((row) => ({
        id: row.id_usuario,
        nombre: row.nombre,
        apellidoPaterno: row.apellido_paterno,
        apellidoMaterno: row.apellido_materno,
        email: row.email,
        usuario: row.usuario,
        rol: row.rol === 'secretaria' ? 'Secretaría' : 'Encargado',
        estado: Number(row.estado),
        fechaRegistro: row.fecha_registro,
      })) })
      return
    }
    if (adminUsersPath && request.method === 'POST') {
      const body = await readJsonBody(request)
      const nombre = field(body, 'nombre')
      const apellidoPaterno = field(body, 'apellidoPaterno')
      const apellidoMaterno = field(body, 'apellidoMaterno')
      const email = field(body, 'email').toLowerCase()
      const usuario = field(body, 'usuario')
      const password = typeof body.password === 'string' ? body.password : ''
      const requestedRole = field(body, 'rol')
      const role = requestedRole === 'Secretaría' ? 'secretaria' : requestedRole === 'Encargado' ? 'Encargado' : null
      if (!nombre || !apellidoPaterno || !apellidoMaterno || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !usuario || !role || password.length < 8) {
        sendJson(response, 400, { message: 'Completa los datos y usa una contraseña de al menos 8 caracteres.' })
        return
      }
      try {
        const id = await createViletAccount({ nombre, apellidoPaterno, apellidoMaterno, email, usuario, contrasena: await bcrypt.hash(password, 12), rol: role })
        sendJson(response, 201, { id, message: 'Usuario creado y guardado en MySQL.' })
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
          sendJson(response, 409, { message: 'Ese correo o nombre de usuario ya está registrado.' })
          return
        }
        throw error
      }
      return
    }
    if (adminUserMatch) {
      const id = Number(adminUserMatch[1])
      if (id === session.userId) {
        sendJson(response, 409, { message: 'Por seguridad, no puedes modificar ni desactivar tu propia cuenta.' })
        return
      }
      if (request.method === 'PUT') {
        const body = await readJsonBody(request)
        const nombre = field(body, 'nombre')
        const apellidoPaterno = field(body, 'apellidoPaterno')
        const apellidoMaterno = field(body, 'apellidoMaterno')
        const email = field(body, 'email').toLowerCase()
        const usuario = field(body, 'usuario')
        const requestedRole = field(body, 'rol')
        const role = requestedRole === 'Secretaría' ? 'secretaria' : requestedRole === 'Encargado' ? 'Encargado' : null
        const estado = body.estado === true || Number(body.estado) === 1 ? 1 : 0
        const password = typeof body.password === 'string' ? body.password : ''
        if (!nombre || !apellidoPaterno || !apellidoMaterno || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !usuario || !role || (password !== '' && password.length < 8)) {
          sendJson(response, 400, { message: 'Revisa los datos del usuario. La contraseña nueva debe tener al menos 8 caracteres.' })
          return
        }
        try {
          const result = await updateAdminAccount(id, { nombre, apellidoPaterno, apellidoMaterno, email, usuario, rol: role, estado, ...(password ? { contrasena: await bcrypt.hash(password, 12) } : {}) })
          if (result === 'not-found') sendJson(response, 404, { message: 'No se encontró ese usuario.' })
          else if (result === 'last-admin') sendJson(response, 409, { message: 'No puedes desactivar o cambiar el rol del último administrador activo.' })
          else sendJson(response, 200, { message: 'Datos de usuario actualizados en MySQL.' })
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
            sendJson(response, 409, { message: 'Ese correo o nombre de usuario ya está registrado.' })
            return
          }
          throw error
        }
        return
      }
      const result = await deactivateAdminAccount(id)
      if (result === 'not-found') sendJson(response, 404, { message: 'No se encontró ese usuario.' })
      else if (result === 'last-admin') sendJson(response, 409, { message: 'No puedes desactivar al último administrador activo.' })
      else sendJson(response, 200, { message: 'Cuenta desactivada. Se conservó su registro en MySQL.' })
      return
    }
  }
  if (request.method === 'GET' && pathname === '/api/status') {
    const mongo = await readMongoStatus()
    try {
      const databaseStatus = await readDatabaseStatus()
      sendJson(response, 200, { connected: true, ...databaseStatus, mongo })
    } catch (error) {
      console.error('No fue posible consultar MySQL:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { connected: false, mongo, message: 'No se pudo conectar con la base de datos Vilet.' })
    }
    return
  }

  if (request.method === 'GET' && pathname === '/api/products') {
    try {
      sendJson(response, 200, { items: await readProducts() })
    } catch (error) {
      console.error('No fue posible leer el catálogo:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'No se pudo consultar el catálogo de Vilet.' })
    }
    return
  }

  if (request.method === 'POST' && pathname === '/api/inventory') {
    const body = await readJsonBody(request)
    const idProducto = Number(body.id_producto)
    const cantidad = Number(body.cantidad)
    const unidad = body.unidad
    if (!Number.isInteger(idProducto) || idProducto < 1 || !Number.isFinite(cantidad) || cantidad <= 0) {
      sendJson(response, 400, { message: 'Selecciona un producto y una cantidad mayor que cero.' })
      return
    }
    if (unidad !== 'KG' && unidad !== 'PZA') {
      sendJson(response, 400, { message: 'Selecciona kilogramos o piezas.' })
      return
    }
    const result = await addInventoryEntry(idProducto, cantidad, unidad)
    if (result === 'product-not-found') {
      sendJson(response, 404, { message: 'No se encontró el producto seleccionado.' })
      return
    }
    if (result === 'unit-mismatch') {
      sendJson(response, 400, { message: 'La unidad no corresponde al producto seleccionado.' })
      return
    }
    sendJson(response, 201, { message: 'Existencias agregadas al inventario.' })
    return
  }

  if (request.method === 'GET' && pathname === '/api/inventory') {
    try {
      sendJson(response, 200, { items: await readInventory() })
    } catch (error) {
      console.error('No fue posible leer el inventario:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'No se pudo consultar el inventario de Vilet.' })
    }
    return
  }

  if (request.method === 'GET' && pathname === '/api/notices') {
    try {
      sendJson(response, 200, { items: await readNotices() })
    } catch (error) {
      console.error('No fue posible leer avisos:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'No se pudieron consultar los avisos de Vilet.' })
    }
    return
  }

  if (request.method === 'POST' && pathname === '/api/notices') {
    const session = await requireAdmin(request, response)
    if (!session) return
    const body = await readJsonBody(request)
    const titulo = field(body, 'titulo')
    const mensaje = field(body, 'mensaje')
    if (!titulo || titulo.length > 150 || !mensaje || mensaje.length > 5000) {
      sendJson(response, 400, { message: 'Escribe un título y un mensaje de hasta 5,000 caracteres.' })
      return
    }
    const id = await createNotice(titulo, mensaje)
    sendJson(response, 201, { id, message: 'Aviso publicado para Secretaría.' })
    return
  }

  const adminNoticeMatch = pathname.match(/^\/api\/notices\/(\d+)$/)
  if (adminNoticeMatch && request.method === 'DELETE') {
    const session = await requireAdmin(request, response)
    if (!session) return
    const deleted = await deleteNotice(Number(adminNoticeMatch[1]))
    if (!deleted) sendJson(response, 404, { message: 'No se encontró el aviso activo.' })
    else sendJson(response, 200, { message: 'Aviso archivado. Se puede recuperar desde MySQL.' })
    return
  }
  if (request.method === 'PATCH' && pathname === '/api/notices/read-all') {
    await markAllNoticesRead()
    sendJson(response, 200, { message: 'Todos los avisos están marcados como leídos.' })
    return
  }

  const noticeReadMatch = pathname.match(/^\/api\/notices\/(\d+)\/read$/)
  if (noticeReadMatch && request.method === 'PATCH') {
    const updated = await markNoticeRead(Number(noticeReadMatch[1]))
    if (!updated) {
      sendJson(response, 404, { message: 'No se encontró el aviso.' })
      return
    }
    sendJson(response, 200, { message: 'Aviso marcado como leído.' })
    return
  }

  if (request.method === 'GET' && pathname === '/api/clients') {
    try {
      sendJson(response, 200, { items: await readClients() })
    } catch (error) {
      console.error('No fue posible leer clientes:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'No se pudieron consultar los clientes de Vilet.' })
    }
    return
  }

  if (request.method === 'POST' && pathname === '/api/clients/purchase') {
    const body = await readJsonBody(request)
    const nombre = field(body, 'nombre')
    const telefono = field(body, 'telefono').replace(/\D/g, '')
    if (!nombre || nombre.length > 100 || !/^\d{7,15}$/.test(telefono)) {
      sendJson(response, 400, { message: 'Escribe el nombre y un teléfono válido de 7 a 15 dígitos.' })
      return
    }
    try {
      const id = await recordClientPurchase(nombre, telefono)
      sendJson(response, 201, { id, message: 'Compra registrada; el contador del cliente se actualizó.' })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { message: 'Ese teléfono ya está asociado a otro registro. Revisa la lista de clientes.' })
        return
      }
      throw error
    }
    return
  }

  const clientHistoryMatch = pathname.match(/^\/api\/clients\/(\d+)\/purchases$/)
  if (clientHistoryMatch && request.method === 'GET') {
    sendJson(response, 200, { items: await readClientHistory(Number(clientHistoryMatch[1])) })
    return
  }

  const clientMatch = pathname.match(/^\/api\/clients\/(\d+)$/)
  if (clientMatch && request.method === 'PUT') {
    const body = await readJsonBody(request)
    const nombre = field(body, 'nombre')
    const telefono = field(body, 'telefono').replace(/\D/g, '')
    if (!nombre || nombre.length > 100 || !/^\d{7,15}$/.test(telefono)) {
      sendJson(response, 400, { message: 'Escribe el nombre y un teléfono válido de 7 a 15 dígitos.' })
      return
    }
    try {
      const updated = await updateClient(Number(clientMatch[1]), nombre, telefono)
      if (!updated) {
        sendJson(response, 404, { message: 'No se encontró ese cliente.' })
        return
      }
      sendJson(response, 200, { message: 'Datos del cliente actualizados.' })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { message: 'Ese teléfono ya pertenece a otra persona.' })
        return
      }
      throw error
    }
    return
  }
  if (request.method === 'GET' && pathname === '/api/raw-materials') {
    try {
      sendJson(response, 200, { items: await readRawMaterials() })
    } catch (error) {
      console.error('No fue posible leer la materia prima:', error instanceof Error ? error.message : 'Error desconocido')
      sendJson(response, 503, { message: 'No se pudo consultar la materia prima de Vilet.' })
    }
    return
  }

  if (request.method === 'POST' && pathname === '/api/raw-materials') {
    const body = await readJsonBody(request)
    const nombre = field(body, 'nombre')
    const cantidad = Number(body.cantidad)
    if (!nombre || nombre.length > 120 || !Number.isInteger(cantidad) || cantidad <= 0) {
      sendJson(response, 400, { message: 'Escribe el nombre y una cantidad entera mayor que cero.' })
      return
    }
    await addRawMaterial(nombre, cantidad)
    sendJson(response, 201, { message: 'Materia prima guardada y existencias actualizadas.' })
    return
  }

  const rawMaterialMatch = pathname.match(/^\/api\/raw-materials\/(\d+)$/)
  if (rawMaterialMatch && request.method === 'PUT') {
    const id = Number(rawMaterialMatch[1])
    const body = await readJsonBody(request)
    const nombre = field(body, 'nombre')
    const cantidad = Number(body.cantidad)
    if (!Number.isInteger(id) || id < 1 || !nombre || nombre.length > 120 || !Number.isInteger(cantidad) || cantidad < 0) {
      sendJson(response, 400, { message: 'Revisa el nombre y la cantidad del material.' })
      return
    }
    const updated = await updateRawMaterial(id, nombre, cantidad)
    if (!updated) {
      sendJson(response, 404, { message: 'No se encontró ese material.' })
      return
    }
    sendJson(response, 200, { message: 'Materia prima actualizada.' })
    return
  }

  if (rawMaterialMatch && request.method === 'DELETE') {
    const deleted = await deleteRawMaterial(Number(rawMaterialMatch[1]))
    if (!deleted) {
      sendJson(response, 404, { message: 'No se encontró ese material.' })
      return
    }
    sendJson(response, 200, { message: 'Materia prima eliminada.' })
    return
  }
  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const auth = sessionFromRequest(request)
    if (auth) authSessions.delete(auth.token)
    sendJson(response, 200, { message: 'Sesión cerrada.' })
    return
  }
  if (request.method === 'POST' && pathname === '/api/auth/login') {
    await handleLogin(request, response)
    return
  }

  if (request.method === 'POST' && pathname === '/api/auth/register') {
    await handleRegistration(request, response)
    return
  }

  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'DELETE' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE')
    sendJson(response, 405, { message: 'Método no permitido.' })
    return
  }
  sendJson(response, 404, { message: 'Ruta no encontrada.' })
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    if (error instanceof RequestError) {
      sendJson(response, error.status, { message: error.message })
      return
    }
    console.error('Error inesperado en la API:', error instanceof Error ? error.message : 'Error desconocido')
    if (!response.headersSent) sendJson(response, 500, { message: 'Error interno.' })
    else response.end()
  })
})

void connectMongoDB()
server.listen(port, host, () => console.log(`API de Vilet lista en http://${host}:${port}`))

async function shutDown() {
  server.close()
  await Promise.all([closeDatabasePool(), closeMongoDB()])
}
process.once('SIGINT', () => void shutDown())
process.once('SIGTERM', () => void shutDown())


