export type PageKey = 'inicio' | 'quienes' | 'quesos'
export type UserRole = 'Encargado' | 'Secretaría'
export type DatabaseRole = 'Encargado' | 'secretaria'
export type ConnectionState = 'checking' | 'connected' | 'offline'
export type CatalogState = 'loading' | 'ready' | 'error'
export type ProductUnit = 'KG' | 'PZA' | 'AMBOS'

export type Product = {
  id_producto: number
  nombre: string
  unidad: 'KG' | 'PZA' | 'AMBOS'
}

export type DatabaseHealth = {
  connected: boolean
  database?: string
  version?: string
  mongo?: {
    connected: boolean
    configured: boolean
    database?: string
    version?: string
  }
}

export type AuthenticatedUser = {
  id: number
  name: string
  username: string
  role: UserRole
}

export type AccountRegistration = {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  email: string
  usuario: string
  password: string
  role: UserRole
}

export type ViletAdminAccount = {
  id: number
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  email: string
  usuario: string
  rol: UserRole
  estado: number
  fechaRegistro: string
}
export type RegisteredAccount = {
  message: string
  role: UserRole
}


export type InventoryItem = {
  id_producto: number
  nombre: string
  unidad: 'KG' | 'PZA' | 'AMBOS'
  tiene_registro: boolean | number
  stock_kg: number | string | null
  stock_piezas: number | string | null
  entradas_kg: number | string | null
  salidas_kg: number | string | null
  entradas_piezas: number | string | null
  salidas_piezas: number | string | null
  fecha_actualizacion: string | null
}
export type RawMaterial = {
  id: number
  nombre: string
  cantidad: number
  fecha: string
}
export type ViletNotice = {
  id: number
  titulo: string
  mensaje: string
  fecha: string
  estado: 'no_leido' | 'leido'
}

export type ViletClient = {
  id: number
  nombre: string
  telefono: string
  compras: number
  ultima_compra: string | null
}

export type ClientPurchase = {
  id: number
  fecha: string
}
export type PerformanceSheet = {
  id: string
  area: string
  descripcion: string | null
  archivo: string
  mimeType: string
  fecha: string
}

export type ViletEmployee = {
  id: number
  nombre: string
  puesto: string | null
}

export type AttendanceCode = '' | 'V' | 'R' | 'F' | 'P'

export type AttendanceRecord = {
  empleado_id: number
  fecha: string
  estado: string | null
}