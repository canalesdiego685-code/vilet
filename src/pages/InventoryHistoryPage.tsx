import { useEffect, useMemo, useState } from 'react'
import { ViletMark } from '../components/ViletMark'
import { fetchInventoryMovements } from '../services/viletApi'
import type { InventoryMovement } from '../types'

type Props = { isLight: boolean; onBack: () => void; roleLabel?: string }
type MovementFilter = 'todos' | 'entrada' | 'salida'

function quantity(value: number | string) {
  const result = Number(value)
  return Number.isFinite(result) ? result.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '0'
}

function movementDate(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

function movementUnit(movement: InventoryMovement) {
  const presentation = movement.presentacion?.trim() ?? ''
  const unit = movement.unidad ?? presentation
  if (presentation && !['KG', 'PZA'].includes(presentation.toUpperCase())) return unit + ' · ' + presentation
  return unit || '—'
}

export function InventoryHistoryPage({ isLight, onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState<MovementFilter>('todos')
  const [product, setProduct] = useState('todos')
  const [updatedAt, setUpdatedAt] = useState('')

  async function loadHistory() {
    setLoading(true)
    setError('')
    try {
      const items = await fetchInventoryMovements()
      setMovements(items)
      setUpdatedAt(new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo consultar el historial.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadHistory() }, [])

  const products = useMemo(
    () => Array.from(new Set(movements.map((movement) => movement.producto))).sort((a, b) => a.localeCompare(b, 'es')),
    [movements],
  )

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return movements.filter((movement) => {
      const matchesType = type === 'todos' || movement.tipo_movimiento === type
      const matchesProduct = product === 'todos' || movement.producto === product
      const detail = [movement.producto, movement.usuario, movement.motivo, movement.cliente, movement.presentacion]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es')
      return matchesType && matchesProduct && (!term || detail.includes(term))
    })
  }, [movements, product, search, type])

  const entries = movements.filter((movement) => movement.tipo_movimiento === 'entrada').length
  const exits = movements.filter((movement) => movement.tipo_movimiento === 'salida').length

  return (
    <section className={'inventory-screen inventory-history-screen' + (isLight ? ' inventory-screen-light' : '')} aria-label="Historial de movimientos de inventario">
      <div className="inventory-print-heading">
        <div className="inventory-print-brand"><ViletMark small /><span>VILET</span></div>
        <div className="inventory-print-title"><span>CONTROL DE MOVIMIENTOS</span><h1>Historial de inventario</h1><p>Consultado el {updatedAt}</p></div>
        <div className="inventory-print-stamp">{roleLabel}<br />ENTRADAS Y SALIDAS</div>
      </div>
      <header className="inventory-toolbar">
        <div className="inventory-heading-brand">
          <ViletMark small />
          <div>
            <span>VILET · {roleLabel}</span>
            <h1>Historial de Movimientos</h1>
            <p>{loading ? 'Consultando movimientos en MySQL…' : updatedAt ? 'Datos de MySQL · Actualizado el ' + updatedAt : 'Entradas y salidas de Vilet'}</p>
          </div>
        </div>
        <div className="inventory-actions">
          <button className="inventory-action inventory-refresh" onClick={() => void loadHistory()} disabled={loading}>↻ Actualizar</button>
          <button className="inventory-action inventory-pdf" onClick={() => window.print()}>PDF</button>
          <button className="inventory-action inventory-back" onClick={onBack}>← Inventario</button>
        </div>
      </header>

      {error && <div className="inventory-error" role="alert">{error}</div>}

      <div className="inventory-summary-grid">
        <article className="inventory-summary-card"><span>MOVIMIENTOS</span><strong>{movements.length}</strong><small>registros históricos</small></article>
        <article className="inventory-summary-card"><span>ENTRADAS</span><strong>{entries}</strong><small>abastecimiento</small></article>
        <article className="inventory-summary-card"><span>SALIDAS</span><strong>{exits}</strong><small>ventas y ajustes</small></article>
        <article className="inventory-summary-card"><span>PRODUCTOS</span><strong>{products.length}</strong><small>con movimientos</small></article>
      </div>

      <div className="inventory-history-filters">
        <label>Buscar
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Producto, usuario, motivo o cliente" />
        </label>
        <label>Tipo
          <select value={type} onChange={(event) => setType(event.target.value as MovementFilter)}>
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
          </select>
        </label>
        <label>Producto
          <select value={product} onChange={(event) => setProduct(event.target.value)}>
            <option value="todos">Todos los productos</option>
            {products.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { setSearch(''); setType('todos'); setProduct('todos') }}>Limpiar filtros</button>
      </div>

      <section className="inventory-history-card inventory-history-full" aria-labelledby="inventory-history-title">
        <div className="inventory-products-heading">
          <div><span>CONTROL DE MOVIMIENTOS</span><h2 id="inventory-history-title">Entradas y salidas</h2></div>
          <span className="inventory-count">{filteredMovements.length} de {movements.length} movimientos</span>
        </div>
        {loading && movements.length === 0 ? (
          <div className="inventory-message">Cargando historial de Vilet…</div>
        ) : filteredMovements.length === 0 ? (
          <div className="inventory-history-empty">No hay movimientos que coincidan con los filtros.</div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-history-table">
              <thead><tr><th>FECHA</th><th>TIPO</th><th>PRODUCTO</th><th>UNIDAD</th><th>CANTIDAD</th><th>USUARIO</th><th>DETALLE</th></tr></thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.tipo_movimiento + '-' + movement.id}>
                    <td>{movementDate(movement.fecha)}</td>
                    <td><span className={'inventory-movement-badge inventory-movement-' + movement.tipo_movimiento}>{movement.tipo_movimiento}</span></td>
                    <td>{movement.producto}</td>
                    <td>{movementUnit(movement)}</td>
                    <td>{quantity(movement.cantidad)}</td>
                    <td>{movement.usuario || '—'}</td>
                    <td>{[movement.motivo?.trim(), movement.cliente?.trim()].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
