import type { AccountRegistration, AuthenticatedUser, DatabaseHealth, InventoryItem, InventoryMovement, InventoryPresentationBalance, Product, ProfilePhoto, RawMaterial, ViletClient, ClientPurchase, ViletNotice, PerformanceSheet, ViletEmployee, AttendanceRecord, AttendanceCode, RegisteredAccount, UserRole, ViletAdminAccount } from '../types'

type ProductResponse = { items: Product[] }
type LoginResponse = { user: AuthenticatedUser; token: string }
type MessageResponse = { message: string }
type StoredSession = { user: AuthenticatedUser; token: string }
const sessionKey = 'vilet-session'

function readStoredSession(): StoredSession | null {
  try {
    const value = window.sessionStorage.getItem(sessionKey)
    if (!value) return null
    const session = JSON.parse(value) as Partial<StoredSession>
    if (!session.token || !session.user || typeof session.user.id !== 'number' || !['Encargado', 'Secretaría'].includes(session.user.role)) return null
    const encoded = session.token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(window.atob(encoded)) as { expiresAt?: number }
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) throw new Error('Sesión vencida')
    return session as StoredSession
  } catch {
    try { window.sessionStorage.removeItem(sessionKey) } catch { /* El almacenamiento puede estar bloqueado. */ }
    return null
  }
}

const storedSession = readStoredSession()
let apiToken = storedSession?.token ?? ''

export function getSavedUser() {
  return readStoredSession()?.user ?? null
}

export function clearAuthSession() {
  apiToken = ''
  try { window.sessionStorage.removeItem(sessionKey) } catch { /* El almacenamiento puede estar bloqueado. */ }
}

function saveAuthSession(user: AuthenticatedUser, token: string) {
  apiToken = token
  try { window.sessionStorage.setItem(sessionKey, JSON.stringify({ user, token })) } catch { /* La sesión sigue disponible en memoria. */ }
}

function authorizedHeaders(headers?: HeadersInit) {
  const result = new Headers(headers)
  if (apiToken) result.set('Authorization', 'Bearer ' + apiToken)
  return result
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  let body: string
  try {
    body = await response.text()
  } catch {
    throw new Error('La conexión con el servidor de Vilet se interrumpió. Inténtalo de nuevo.')
  }

  let result: (T & MessageResponse) | null = null
  if (body) {
    try {
      result = JSON.parse(body) as T & MessageResponse
    } catch {
      if (response.ok) throw new Error('El servidor de Vilet devolvió una respuesta inválida. Inténtalo de nuevo.')
    }
  }

  if (!response.ok) throw new Error(result?.message || `No se pudo completar la solicitud (${response.status}).`)
  if (!result) throw new Error('El servidor de Vilet devolvió una respuesta vacía. Inténtalo de nuevo.')
  return result
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const canRetry = method === 'GET' || method === 'HEAD' || path === '/api/auth/login'
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 55_000)
    let response: Response | null = null
    try {
      response = await fetch(path, { ...options, signal: controller.signal, headers: authorizedHeaders(options.headers) })
    } catch (error) {
      lastError = error
      if (!canRetry || attempt === 2) break
    } finally {
      window.clearTimeout(timeout)
    }

    if (!response) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 500 : 1200))
      continue
    }

    if (canRetry && (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504)) {
      await response.text().catch(() => undefined)
      lastError = new Error('El servidor está respondiendo temporalmente con lentitud.')
      if (attempt === 2) break
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 500 : 1200))
      continue
    }

    if (response.status === 401 && path !== '/api/auth/login') {
      const role = getSavedUser()?.role ?? null
      clearAuthSession()
      window.dispatchEvent(new CustomEvent('vilet-session-expired', { detail: role }))
    }
    return readJsonResponse<T>(response)
  }

  if (lastError instanceof Error && lastError.message === 'El servidor está respondiendo temporalmente con lentitud.') throw lastError
  throw new Error('No se pudo conectar con el servidor de Vilet. Revisa tu conexión e inténtalo de nuevo.')
}

async function readJson<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function fetchDatabaseHealth() {
  return readJson<DatabaseHealth>('/api/status')
}

export async function fetchProducts() {
  const result = await readJson<ProductResponse>('/api/products')
  return result.items
}

export async function fetchInventory() {
  const result = await readJson<{ items: InventoryItem[] }>('/api/inventory')
  return result.items
}

export async function loginViletUser(role: UserRole, username: string, password: string) {
  const result = await postJson<LoginResponse>('/api/auth/login', { role, username, password })
  saveAuthSession(result.user, result.token)
  return result.user
}

export async function logoutViletUser() {
  const headers = authorizedHeaders()
  const hadSession = Boolean(apiToken)
  clearAuthSession()
  if (hadSession) await requestJson<MessageResponse>('/api/auth/logout', { method: 'POST', headers }).catch(() => undefined)
}
export function registerViletAccount(account: AccountRegistration) {
  return postJson<RegisteredAccount>('/api/auth/register', account)
}

export async function fetchProfilePhoto() {
  return readJson<ProfilePhoto>('/api/profile/photo')
}

export function saveProfilePhoto(input: { fileName: string; mimeType: string; dataBase64: string }) {
  return postJson<{ message: string; photo?: string | null }>('/api/profile/photo', input)
}

export async function deleteProfilePhoto() {
  return requestJson<{ message: string }>('/api/profile/photo', { method: 'DELETE' })
}

export async function fetchInventoryMovements() {
  const result = await readJson<{ items: InventoryMovement[] }>('/api/inventory/movements')
  return result.items
}

export async function fetchInventoryPresentations() {
  const result = await readJson<{ items: InventoryPresentationBalance[] }>('/api/inventory/presentations')
  return result.items
}

export function addInventoryEntry(entry: { id_producto: number; cantidad: number; unidad: 'KG' | 'PZA'; presentacion?: string; observaciones?: string }) {
  return postJson<{ message: string }>('/api/inventory', entry)
}

export function addInventoryExit(entry: { id_producto: number; cantidad: number; unidad: 'KG' | 'PZA'; presentacion?: string; motivo: string; cliente?: string }) {
  return postJson<{ message: string }>('/api/inventory/exit', entry)
}
export async function fetchRawMaterials() {
  const result = await readJson<{ items: RawMaterial[] }>('/api/raw-materials')
  return result.items
}

export function addRawMaterial(material: { nombre: string; cantidad: number }) {
  return postJson<{ message: string }>('/api/raw-materials', material)
}

async function putJson<T>(path: string, payload: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateRawMaterial(id: number, material: { nombre: string; cantidad: number }) {
  return putJson<{ message: string }>('/api/raw-materials/' + id, material)
}

export async function deleteRawMaterial(id: number) {
  return requestJson<MessageResponse>('/api/raw-materials/' + id, { method: 'DELETE' })
}
export async function fetchNotices() {
  const result = await readJson<{ items: ViletNotice[] }>('/api/notices')
  return result.items
}

export function createNotice(notice: { titulo: string; mensaje: string }) {
  return postJson<{ message: string }>('/api/notices', notice)
}

async function patchJson<T>(path: string, payload?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
}

export function markNoticeRead(id: number) {
  return patchJson<{ message: string }>('/api/notices/' + id + '/read')
}

export function markAllNoticesRead() {
  return patchJson<{ message: string }>('/api/notices/read-all')
}

export async function fetchClients() {
  const result = await readJson<{ items: ViletClient[] }>('/api/clients')
  return result.items
}

export function registerClientPurchase(input: { nombre: string; telefono: string }) {
  return postJson<{ message: string; id: number }>('/api/clients/purchase', input)
}

export function updateClient(id: number, input: { nombre: string; telefono: string }) {
  return putJson<{ message: string }>('/api/clients/' + id, input)
}

export async function fetchClientHistory(id: number) {
  const result = await readJson<{ items: ClientPurchase[] }>('/api/clients/' + id + '/purchases')
  return result.items
}
export async function fetchPerformanceSheets() {
  const result = await readJson<{ items: PerformanceSheet[]; storage: string }>('/api/performance')
  return result
}

export async function fetchPerformanceFileUrl(id: string) {
  let response: Response
  try {
    response = await fetch('/api/performance/files/' + id, { headers: authorizedHeaders() })
  } catch {
    throw new Error('No se pudo conectar con el servidor de Vilet. Revisa que la API esté encendida e inténtalo de nuevo.')
  }
  if (!response.ok) {
    await readJsonResponse<MessageResponse>(response)
    throw new Error('No se pudo abrir el archivo de rendimiento.')
  }
  try {
    const blob = await response.blob()
    if (!blob.size) throw new Error('Archivo vacío')
    return URL.createObjectURL(blob)
  } catch {
    throw new Error('No se pudo cargar el archivo de rendimiento.')
  }
}

export function uploadPerformanceSheet(input: { area: string; descripcion: string; fileName: string; mimeType: string; dataBase64: string }) {
  return postJson<{ message: string; id: string }>('/api/performance', input)
}

export async function deletePerformanceSheet(id: string) {
  return requestJson<MessageResponse>('/api/performance/' + id, { method: 'DELETE' })
}

export async function fetchEmployees() {
  const result = await readJson<{ items: ViletEmployee[] }>('/api/employees')
  return result.items
}

export function addEmployee(nombre: string) {
  return postJson<{ message: string }>('/api/employees', { nombre })
}

export async function deactivateEmployee(id: number) {
  return requestJson<MessageResponse>('/api/employees/' + id, { method: 'DELETE' })
}

export async function fetchAttendance(start: string, end: string) {
  const query = new URLSearchParams({ start, end })
  const result = await readJson<{ items: AttendanceRecord[] }>('/api/attendance?' + query.toString())
  return result.items
}

export function saveAttendance(input: { empleado_id: number; fecha: string; estado: AttendanceCode }) {
  return putJson<{ message: string }>('/api/attendance', input)
}
export async function fetchAdminUsers() {
  const result = await readJson<{ items: ViletAdminAccount[] }>('/api/admin/users')
  return result.items
}

export function createAdminUser(input: { nombre: string; apellidoPaterno: string; apellidoMaterno: string; email: string; usuario: string; password: string; rol: UserRole }) {
  return postJson<{ id: number; message: string }>('/api/admin/users', input)
}

export function updateAdminUser(id: number, input: { nombre: string; apellidoPaterno: string; apellidoMaterno: string; email: string; usuario: string; password: string; rol: UserRole; estado: number }) {
  return putJson<{ message: string }>('/api/admin/users/' + id, input)
}

export async function deactivateAdminUser(id: number) {
  return requestJson<MessageResponse>('/api/admin/users/' + id, { method: 'DELETE' })
}

export async function deleteAdminNotice(id: number) {
  return requestJson<MessageResponse>('/api/notices/' + id, { method: 'DELETE' })
}
