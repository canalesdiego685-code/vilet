import mysql from 'mysql2/promise'
import { inventoryPresentationsSchema } from './inventoryPresentationsSchema.js'

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? process.env.TIDB_HOST ?? 'localhost',
  port: Number(process.env.MYSQL_PORT ?? process.env.TIDB_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE ?? process.env.TIDB_DATABASE ?? 'Vilet',
  user: process.env.MYSQL_USER ?? process.env.TIDB_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? process.env.TIDB_PASSWORD ?? '',
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  connectTimeout: 15000,
})

try {
  await connection.query(inventoryPresentationsSchema)
  console.log('Tabla inventario_presentaciones lista.')
} finally {
  await connection.end()
}
