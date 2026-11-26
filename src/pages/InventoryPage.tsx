import { useEffect, useState, type FormEvent } from 'react'
import { ViletMark } from '../components/ViletMark'
import { addInventoryEntry, fetchInventory } from '../services/viletApi'
import { downloadInventoryWorkbook } from '../services/inventoryExports'
import type { InventoryItem } from '../types'

type Props = { isLight: boolean; onBack: () => void; roleLabel?: string }

type EntryUnit = 'KG' | 'PZA'

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



export function InventoryPage({ isLight, onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  async function refreshInventory() {
    setLoading(true)
    setError('')
    try {
      const result = await fetchInventory()
      setItems(result)
      setLastUpdated(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo consultar el inventario.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshInventory() }, [])

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const idProducto = Number(values.get('id_producto'))
    const cantidad = Number(values.get('cantidad'))
    const unidad = String(values.get('unidad')) as EntryUnit
    setSaving(true)
    setFormError('')
    setNotice('')
    try {
      await addInventoryEntry({ id_producto: idProducto, cantidad, unidad })
      form.reset()
      setShowAddForm(false)
      setNotice('Existencias agregadas y actualizadas desde MySQL.')
      await refreshInventory()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudieron guardar las existencias.')
    } finally {
      setSaving(false)
    }
  }

  function exportExcel() {
    downloadInventoryWorkbook(items)
  }

  const families = [
    { title: 'OAXACA', key: 'oaxaca', rows: items.filter((item) => item.nombre.toLocaleLowerCase().includes('oaxaca')) },
    { title: 'PANELA', key: 'panela', rows: items.filter((item) => item.nombre.toLocaleLowerCase().includes('panela')) },
  ]

  const totalPieces = items.reduce((sum, item) => sum + numberValue(item.stock_piezas), 0)
  const totalKilograms = items.reduce((sum, item) => sum + numberValue(item.stock_kg), 0)
  const registeredCount = items.filter(hasRecord).length
  const reportDate = new Date().toLocaleString('es-MX')

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
          <button className="inventory-action inventory-add" onClick={() => { setFormError(''); setShowAddForm(true) }} disabled={loading || items.length === 0}>＋ Agregar</button>
          <button className="inventory-action inventory-refresh" onClick={() => void refreshInventory()} disabled={loading}>↻ Actualizar</button>
          <button className="inventory-action inventory-pdf" onClick={() => window.print()}>PDF</button>
          <button className="inventory-action inventory-excel" onClick={exportExcel}>Excel</button>
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
            <p className="inventory-footnote">La tabla de existencias está vacía. Se muestran cantidades en cero; usa Agregar para registrar una entrada.</p>
          )}
        </>
      )}

      {showAddForm && (
        <div className="inventory-modal-backdrop" onClick={() => !saving && setShowAddForm(false)}>
          <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-add-title" onClick={(event) => event.stopPropagation()}>
            <button className="inventory-modal-close" onClick={() => setShowAddForm(false)} aria-label="Cerrar">×</button>
            <span className="inventory-modal-kicker">ENTRADA DE EXISTENCIAS</span>
            <h2 id="inventory-add-title">Agregar al inventario</h2>
            <p>El producto y la cantidad se guardarán en la base de datos Vilet.</p>
            <form className="inventory-add-form" onSubmit={saveEntry}>
              <label>Producto
                <select name="id_producto" required defaultValue="">
                  <option value="" disabled>Selecciona un producto</option>
                  {items.map((item) => <option key={item.id_producto} value={item.id_producto}>{item.nombre}</option>)}
                </select>
              </label>
              <div className="inventory-form-row">
                <label>Cantidad
                  <input name="cantidad" type="number" min="0.01" step="0.01" required placeholder="0.00" />
                </label>
                <label>Unidad
                  <select name="unidad" defaultValue="KG">
                    <option value="KG">Kilogramos</option>
                    <option value="PZA">Piezas</option>
                  </select>
                </label>
              </div>
              {formError && <p className="inventory-form-error" role="alert">{formError}</p>}
              <div className="inventory-form-actions">
                <button type="button" className="inventory-cancel" onClick={() => setShowAddForm(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="inventory-save" disabled={saving}>{saving ? 'Guardando…' : 'Guardar entrada'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}