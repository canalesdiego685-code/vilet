import mongoose, { Schema, type Model, type Types } from 'mongoose'

type ProfilePhotoRecord = {
  usuario_id: number
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp'
  contenido: Buffer
  nombre_original: string
  tamano: number
  fecha_actualizacion: Date
}

type PerformanceFileRecord = {
  nombre_original: string
  mime_type: string
  extension: string
  contenido: Buffer
  tamano: number
}

type PerformanceSheetRecord = {
  _id: Types.ObjectId
  area: string
  descripcion: string
  archivo: PerformanceFileRecord
  fecha: Date
  estado: 'activo' | 'eliminado'
  eliminado_en: Date | null
}

const performanceFileSchema = new Schema<PerformanceFileRecord>({
  nombre_original: { type: String, required: true, maxlength: 255 },
  mime_type: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
  extension: { type: String, required: true },
  contenido: { type: Buffer, required: true, select: false },
  tamano: { type: Number, required: true },
}, { _id: false })

const performanceCollectionName = process.env.MONGODB_COLLECTION ?? 'rendimiento'

const performanceSheetSchema = new Schema<PerformanceSheetRecord>({
  area: { type: String, required: true, trim: true, maxlength: 100 },
  descripcion: { type: String, default: '', trim: true, maxlength: 500 },
  archivo: { type: performanceFileSchema, required: true },
  fecha: { type: Date, default: Date.now },
  estado: { type: String, enum: ['activo', 'eliminado'], default: 'activo' },
  eliminado_en: { type: Date, default: null },
}, {
  collection: performanceCollectionName,
  versionKey: false,
})

performanceSheetSchema.index({ estado: 1, fecha: -1 })

const PerformanceSheetModel = (mongoose.models.ViletRendimiento as Model<PerformanceSheetRecord> | undefined)
  ?? mongoose.model<PerformanceSheetRecord>('ViletRendimiento', performanceSheetSchema)

const profileCollectionName = process.env.MONGODB_PROFILE_COLLECTION ?? 'perfiles'

const profilePhotoSchema = new Schema<ProfilePhotoRecord>({
  usuario_id: { type: Number, required: true, unique: true },
  mime_type: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  contenido: { type: Buffer, required: true, select: false },
  nombre_original: { type: String, required: true, maxlength: 255 },
  tamano: { type: Number, required: true, min: 1 },
  fecha_actualizacion: { type: Date, required: true, default: Date.now },
}, {
  collection: profileCollectionName,
  versionKey: false,
})

const ProfilePhotoModel = (mongoose.models.ViletPerfil as Model<ProfilePhotoRecord> | undefined)
  ?? mongoose.model<ProfilePhotoRecord>('ViletPerfil', profilePhotoSchema)

export type MongoStatus = {
  connected: boolean
  configured: boolean
  database?: string
  version?: string
}

let connectionAttempt: Promise<boolean> | null = null
const connectionAttempts = 3

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.warn('MongoDB Atlas no está configurado. Agrega MONGODB_URI en .env.local.')
    return false
  }
  if (mongoose.connection.readyState === 1) return true
  if (connectionAttempt) return connectionAttempt

  const attempt = (async () => {
    for (let intento = 1; intento <= connectionAttempts; intento += 1) {
      try {
        await mongoose.connect(uri, {
          ...(process.env.MONGODB_DATABASE ? { dbName: process.env.MONGODB_DATABASE } : {}),
          serverSelectionTimeoutMS: 5_000,
          bufferCommands: false,
        })
        console.log(`MongoDB Atlas conectado: base ${mongoose.connection.name}, colección ${performanceCollectionName}.`)
        return true
      } catch (error) {
        console.warn(`MongoDB Atlas no respondió (intento ${intento} de ${connectionAttempts}).`, error instanceof Error ? error.name : 'Error desconocido')
        if (intento < connectionAttempts) await new Promise((resolve) => setTimeout(resolve, intento * 1_000))
      }
    }
    console.error('No se pudo conectar con MongoDB Atlas. Revisa la red, el acceso de IP y la configuración de conexión.')
    return false
  })()

  connectionAttempt = attempt
  try {
    return await attempt
  } finally {
    connectionAttempt = null
  }
}

async function ensureMongoConnection() {
  if (mongoose.connection.readyState !== 1 && !await connectMongoDB()) {
    throw new Error('MongoDB Atlas no está disponible en este momento. Inténtalo de nuevo.')
  }
}

export async function readProfilePhoto(userId: number) {
  await ensureMongoConnection()
  const profile = await ProfilePhotoModel.findOne({ usuario_id: userId }).select('+contenido')
  if (!profile) return null
  return {
    data: profile.contenido,
    mimeType: profile.mime_type,
    fileName: profile.nombre_original,
    updatedAt: profile.fecha_actualizacion,
  }
}

export async function saveProfilePhoto(input: {
  userId: number
  fileName: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: Buffer
}) {
  await ensureMongoConnection()
  const profile = await ProfilePhotoModel.findOneAndUpdate(
    { usuario_id: input.userId },
    {
      $set: {
        mime_type: input.mimeType,
        contenido: input.data,
        nombre_original: input.fileName,
        tamano: input.data.byteLength,
        fecha_actualizacion: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true },
  )
  return {
    data: profile.contenido,
    mimeType: profile.mime_type,
    fileName: profile.nombre_original,
    updatedAt: profile.fecha_actualizacion,
  }
}

export async function deleteProfilePhoto(userId: number) {
  await ensureMongoConnection()
  const result = await ProfilePhotoModel.deleteOne({ usuario_id: userId })
  return result.deletedCount > 0
}

export async function readMongoStatus(): Promise<MongoStatus> {
  const configured = Boolean(process.env.MONGODB_URI)
  if (configured && mongoose.connection.readyState !== 1) await connectMongoDB()
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return { connected: false, configured }

  try {
    const information = await mongoose.connection.db.admin().command({ buildInfo: 1 }) as { version?: string }
    return {
      connected: true,
      configured,
      database: mongoose.connection.name,
      version: information.version,
    }
  } catch {
    return { connected: false, configured, database: mongoose.connection.name }
  }
}

export async function readPerformanceSheets() {
  await ensureMongoConnection()
  const sheets = await PerformanceSheetModel.find({ estado: 'activo' }, { 'archivo.contenido': 0 }).sort({ fecha: -1, _id: -1 })
  return sheets.map((sheet) => ({
    id: sheet._id.toString(),
    area: sheet.area,
    descripcion: sheet.descripcion || null,
    archivo: '/api/performance/files/' + sheet._id.toString(),
    mimeType: sheet.archivo.mime_type,
    fecha: sheet.fecha.toISOString(),
  }))
}

export async function createPerformanceSheet(input: {
  area: string
  descripcion: string
  fileName: string
  mimeType: string
  extension: string
  data: Buffer
}) {
  await ensureMongoConnection()
  const sheet = await PerformanceSheetModel.create({
    area: input.area,
    descripcion: input.descripcion,
    archivo: {
      nombre_original: input.fileName,
      mime_type: input.mimeType,
      extension: input.extension,
      contenido: input.data,
      tamano: input.data.byteLength,
    },
    fecha: new Date(),
    estado: 'activo',
    eliminado_en: null,
  })
  return sheet._id.toString()
}

export async function readPerformanceFile(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return null
  await ensureMongoConnection()
  const sheet = await PerformanceSheetModel.findOne({ _id: id, estado: 'activo' }).select('+archivo.contenido')
  if (!sheet?.archivo?.contenido) return null
  return {
    data: sheet.archivo.contenido,
    mimeType: sheet.archivo.mime_type,
    fileName: sheet.archivo.nombre_original,
  }
}

export async function deletePerformanceSheet(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return false
  await ensureMongoConnection()
  const result = await PerformanceSheetModel.updateOne(
    { _id: id, estado: 'activo' },
    { $set: { estado: 'eliminado', eliminado_en: new Date() } },
  )
  return result.modifiedCount > 0
}

export async function closeMongoDB() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
