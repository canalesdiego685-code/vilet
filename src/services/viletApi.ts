import type { AccountRegistration, AuthenticatedUser, DatabaseHealth, InventoryItem, InventoryMovement, Product, RawMaterial, ViletClient, ClientPurchase, ViletNotice, PerformanceSheet, ViletEmployee, AttendanceRecord, AttendanceCode, RegisteredAccount, UserRole, ViletAdminAccount } from '../types'

type ProductResponse = { items: Product[] }
type LoginResponse = { user: AuthenticatedUser; token: string }
type MessageResponse = { message: string }
let apiToken = ''

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
  let response: Response
  try {
    response = await fetch(path, { ...options, headers: authorizedHeaders(options.headers) })
  } catch {
    throw new Error('No se pudo conectar con el servidor de Vilet. Revisa que la API esté encendida e inténtalo de nuevo.')
  }
  return readJsonResponse<T>(response)
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
  apiToken = result.token
  return result.user
}

export async function logoutViletUser() {
  const token = apiToken
  apiToken = ''
  if (token) await requestJson<MessageResponse>('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
}
export function registerViletAccount(account: AccountRegistration) {
  return postJson<RegisteredAccount>('/api/auth/register', account)
}

export async function fetchInventoryMovements() {
  const result = await readJson<{ items: InventoryMovement[] }>('/api/inventory/movements')
  return result.items
}

export function addInventoryEntry(entry: { id_producto: number; cantidad: number; unidad: 'KG' | 'PZA'; observaciones?: string }) {
  return postJson<{ message: string }>('/api/inventory', entry)
}

export function addInventoryExit(entry: { id_producto: number; cantidad: number; unidad: 'KG' | 'PZA'; motivo: string; cliente?: string }) {
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
