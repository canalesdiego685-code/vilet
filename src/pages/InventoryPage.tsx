import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ViletMark } from '../components/ViletMark'
import { addInventoryEntry, addInventoryExit, fetchInventory, fetchInventoryMovements } from '../services/viletApi'
import { downloadInventoryWorkbook } from '../services/inventoryExports'
import type { InventoryItem, InventoryMovement } from '../types'

type Props = { isLight: boolean; onBack: () => void; roleLabel?: string }
type EntryUnit = 'KG' | 'PZA'
type MovementMode = 'entrada' | 'salida'

function hasRecord(item: InventoryItem) {
  return item.tiene_registro === true || Number(item.tiene_registro) === 1
}

function numberValue(value: number | string | null | undefined) {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

function quantity(value: number | string | null | undefined) {
  return numberValue(value).toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

function movementDate(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function InventoryPage({ isLight, onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [movementMode, setMovementMode] = useState<MovementMode | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [unit, setUnit] = useState<EntryUnit>('KG')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  async function refreshInventory() {
    setLoading(true)
    setError('')
    try {
      const [result, movementResult] = await Promise.all([fetchInventory(), fetchInventoryMovements()])
      setItems(result)
      setMovements(movementResult)
      setLastUpdated(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
      setReportDate(new Date().toLocaleString('es-MX'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo consultar el inventario.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshInventory() }, [])

  function openMovement(mode: MovementMode) {
    setFormError('')
    setNotice('')
    setSelectedProductId('')
    setUnit('KG')
    setMovementMode(mode)
  }

  function selectProduct(value: string) {
    setSelectedProductId(value)
    const product = items.find((item) => item.id_producto === Number(value))
    if (product?.unidad === 'KG' || product?.unidad === 'PZA') setUnit(product.unidad)
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!movementMode) return
    const form = event.currentTarget
    const values = new FormData(form)
    const idProducto = Number(values.get('id_producto'))
    const cantidad = Number(values.get('cantidad'))
    const selectedUnit = String(values.get('unidad')) as EntryUnit
    setSaving(true)
    setFormError('')
    setNotice('')
    try {
      if (movementMode === 'entrada') {
        await addInventoryEntry({
          id_producto: idProducto,
          cantidad,
          unidad: selectedUnit,
          observaciones: String(values.get('observaciones') ?? '').trim(),
        })
        setNotice('Entrada registrada y existencias actualizadas desde MySQL.')
      } else {
        await addInventoryExit({
          id_producto: idProducto,
          cantidad,
          unidad: selectedUnit,
          motivo: String(values.get('motivo') ?? '').trim(),
          cliente: String(values.get('cliente') ?? '').trim(),
        })
        setNotice('Salida registrada y existencias descontadas correctamente.')
      }
      form.reset()
      setMovementMode(null)
      setSelectedProductId('')
      setUnit('KG')
      await refreshInventory()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  const families = [
    { title: 'OAXACA', key: 'oaxaca', rows: items.filter((item) => item.nombre.toLocaleLowerCase().includes('oaxaca')) },
    { title: 'PANELA', key: 'panela', rows: items.filter((item) => item.nombre.toLocaleLowerCase().includes('panela')) },
  ]
  const selectedItem = items.find((item) => item.id_producto === Number(selectedProductId))
  const availableUnits: EntryUnit[] = selectedItem?.unidad === 'KG' || selectedItem?.unidad === 'PZA' ? [selectedItem.unidad] : ['KG', 'PZA']
  const selectedStock = selectedItem ? numberValue(unit === 'KG' ? selectedItem.stock_kg : selectedItem.stock_piezas) : 0
  const totalPieces = items.reduce((sum, item) => sum + numberValue(item.stock_piezas), 0)
  const totalKilograms = items.reduce((sum, item) => sum + numberValue(item.stock_kg), 0)
  const registeredCount = items.filter(hasRecord).length
  const recentMovements = useMemo(() => movements.slice(0, 20), [movements])

  return (
    <section className={'inventory-screen' + (isLight ? ' inventory-screen-light' : '')} aria-label="Inventario actual">
      <div className="inventory-print-heading">
        <div className="inventory-print-brand"><ViletMark small /><span>VILET</span></div>
        <div className="inventory-print-title"><span>REPORTE DE EXISTENCIAS</span><h1>Inventario actual</h1><p>Generado el {reportDate}</p></div>
        <div className="inventory-print-stamp">{roleLabel}<br />CONTROL DE PRODUCTOS</div>
      </div>
      <header className="inventory-toolbar">
        <div className="inventory-heading-brand">
          <ViletMark small />
          <div>
            <span>VILET · {roleLabel}</span>
            <h1>Inventario Actual</h1>
            <p>{loading ? 'Consultando existencias en MySQL…' : lastUpdated ? 'Datos de MySQL · Actualizado a las ' + lastUpdated : 'Existencias de Vilet'}</p>
          </div>
        </div>
        <div className="inventory-actions">
          <button className="inventory-action inventory-add" onClick={() => openMovement('entrada')} disabled={loading || items.length === 0}>＋ Entrada</button>
          <button className="inventory-action inventory-exit" onClick={() => openMovement('salida')} disabled={loading || items.length === 0}>－ Salida</button>
          <button className="inventory-action inventory-refresh" onClick={() => void refreshInventory()} disabled={loading}>↻ Actualizar</button>
          <button className="inventory-action inventory-pdf" onClick={() => window.print()}>PDF</button>
          <button className="inventory-action inventory-excel" onClick={() => downloadInventoryWorkbook(items, movements)}>Excel</button>
          <button className="inventory-action inventory-back" onClick={onBack}>← Regresar</button>
        </div>
      </header>

      {error && <div className="inventory-error" role="alert">{error}</div>}
      {notice && <div className="inventory-notice" role="status">{notice}</div>}
      {loading && items.length === 0 ? (
        <div className="inventory-message">Cargando inventario de Vilet…</div>
      ) : (
        <>
          <div className="inventory-family-grid">
            {families.map((family) => (
              <section className={'inventory-family-card inventory-family-' + family.key} key={family.key}>
                <h2>{family.title}</h2>
                {family.rows.length === 0 ? (
                  <p className="inventory-family-empty">Sin productos de esta categoría.</p>
                ) : (
                  <div className="inventory-table-wrap">
                    <table className="inventory-family-table">
                      <thead><tr><th>PRODUCTO</th><th>PIEZAS</th><th>KG</th><th>ENTRADAS KG</th><th>SALIDAS KG</th></tr></thead>
                      <tbody>
                        {family.rows.map((item) => (
                          <tr key={item.id_producto}>
                            <td>{item.nombre}</td>
                            <td>{quantity(item.stock_piezas)}</td>
                            <td>{quantity(item.stock_kg)}</td>
                            <td>{quantity(item.entradas_kg)}</td>
                            <td>{quantity(item.salidas_kg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className="inventory-summary-grid">
            <article className="inventory-summary-card"><span>PRODUCTOS</span><strong>{items.length}</strong><small>en catálogo</small></article>
            <article className="inventory-summary-card"><span>PIEZAS</span><strong>{quantity(totalPieces)}</strong><small>existencia actual</small></article>
            <article className="inventory-summary-card"><span>KILOGRAMOS</span><strong>{quantity(totalKilograms)}</strong><small>existencia actual</small></article>
            <article className="inventory-summary-card"><span>CON EXISTENCIAS</span><strong>{registeredCount}</strong><small>de {items.length} productos</small></article>
          </div>

          <section className="inventory-history-card" aria-labelledby="inventory-history-title">
            <div className="inventory-products-heading">
              <div><span>CONTROL DE MOVIMIENTOS</span><h2 id="inventory-history-title">Últimas entradas y salidas</h2></div>
              <span className="inventory-count">{movements.length} movimientos</span>
            </div>
            {recentMovements.length === 0 ? (
              <div className="inventory-message">Aún no hay movimientos registrados.</div>
            ) : (
              <div className="inventory-table-wrap">
                <table className="inventory-history-table">
                  <thead><tr><th>FECHA</th><th>TIPO</th><th>PRODUCTO</th><th>UNIDAD</th><th>CANTIDAD</th><th>USUARIO</th><th>DETALLE</th></tr></thead>
                  <tbody>
                    {recentMovements.map((movement) => (
                      <tr key={movement.tipo_movimiento + '-' + movement.id}>
                        <td>{movementDate(movement.fecha)}</td>
                        <td><span className={'inventory-movement-badge inventory-movement-' + movement.tipo_movimiento}>{movement.tipo_movimiento}</span></td>
                        <td>{movement.producto}</td>
                        <td>{movement.unidad ?? movement.presentacion ?? '—'}</td>
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

          <div className="inventory-products-heading">
            <div><span>EXISTENCIAS POR PRODUCTO</span><h2>Productos de Vilet</h2></div>
            <span className="inventory-count">{items.length} productos</span>
          </div>

          {items.length === 0 ? (
            <div className="inventory-message">No hay productos registrados en la base de datos.</div>
          ) : (
            <div className="inventory-product-grid">
              {items.map((item) => (
                <article className="inventory-product-card" key={item.id_producto}>
                  <span className="inventory-product-icon" aria-hidden="true">▦</span>
                  <h3>{item.nombre}</h3>
                  <div className="inventory-product-stats">
                    <div><strong>{quantity(item.stock_piezas)}</strong><span>Piezas</span></div>
                    <div><strong>{quantity(item.stock_kg)}</strong><span>kg</span></div>
                  </div>
                  <small>{hasRecord(item) ? 'Existencia registrada' : 'Sin registro · se muestra en cero'}</small>
                </article>
              ))}
            </div>
          )}
          {!loading && !error && items.length > 0 && items.every((item) => !hasRecord(item)) && (
            <p className="inventory-footnote">La tabla de existencias está vacía. Se muestran cantidades en cero; usa Entrada para registrar una entrada.</p>
          )}
        </>
      )}

      {movementMode && (
        <div className="inventory-modal-backdrop" onClick={() => !saving && setMovementMode(null)}>
          <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-movement-title" onClick={(event) => event.stopPropagation()}>
            <button className="inventory-modal-close" onClick={() => setMovementMode(null)} aria-label="Cerrar" disabled={saving}>×</button>
            <span className="inventory-modal-kicker">{movementMode === 'entrada' ? 'ENTRADA DE EXISTENCIAS' : 'SALIDA DE EXISTENCIAS'}</span>
            <h2 id="inventory-movement-title">{movementMode === 'entrada' ? 'Agregar al inventario' : 'Registrar una salida'}</h2>
            <p>{movementMode === 'entrada' ? 'La entrada aumentará el stock y quedará guardada en el historial.' : 'La salida descontará el stock disponible y no podrá dejarlo negativo.'}</p>
            <form className="inventory-add-form" onSubmit={saveMovement}>
              <label>Producto
                <select name="id_producto" required value={selectedProductId} onChange={(event) => selectProduct(event.target.value)}>
                  <option value="" disabled>Selecciona un producto</option>
                  {items.map((item) => <option key={item.id_producto} value={item.id_producto}>{item.nombre}</option>)}
                </select>
              </label>
              <div className="inventory-form-row">
                <label>Cantidad
                  <input name="cantidad" type="number" min="0.01" max={movementMode === 'salida' && selectedItem ? selectedStock : undefined} step={unit === 'PZA' ? '1' : '0.01'} required placeholder="0.00" />
                </label>
                <label>Unidad
                  <select name="unidad" value={unit} onChange={(event) => setUnit(event.target.value as EntryUnit)}>
                    {availableUnits.map((availableUnit) => <option key={availableUnit} value={availableUnit}>{availableUnit === 'KG' ? 'Kilogramos' : 'Piezas'}</option>)}
                  </select>
                </label>
              </div>
              {selectedItem && <p className="inventory-stock-hint">Existencia disponible: <strong>{quantity(selectedStock)} {unit === 'KG' ? 'kg' : 'pzas'}</strong></p>}
              {movementMode === 'salida' ? (
                <>
                  <label>Motivo
                    <select name="motivo" required defaultValue="VENTA">
                      <option value="VENTA">Venta</option>
                      <option value="PRODUCCION">Producción</option>
                      <option value="MERMA">Merma</option>
                      <option value="AJUSTE">Ajuste de inventario</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </label>
                  <label>Cliente o destino
                    <input name="cliente" type="text" maxLength={150} placeholder="Opcional" />
                  </label>
                </>
              ) : (
                <label>Observaciones
                  <input name="observaciones" type="text" maxLength={500} placeholder="Opcional" />
                </label>
              )}
              {formError && <p className="inventory-form-error" role="alert">{formError}</p>}
              <div className="inventory-form-actions">
                <button type="button" className="inventory-cancel" onClick={() => setMovementMode(null)} disabled={saving}>Cancelar</button>
                <button type="submit" className="inventory-save" disabled={saving}>{saving ? 'Guardando…' : movementMode === 'entrada' ? 'Guardar entrada' : 'Guardar salida'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
