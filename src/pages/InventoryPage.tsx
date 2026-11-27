import { useEffect, useState, type FormEvent } from 'react'
import { ViletMark } from '../components/ViletMark'
import { addInventoryEntry, addInventoryExit, fetchInventory, fetchInventoryMovements, fetchInventoryPresentations } from '../services/viletApi'
import { downloadInventoryWorkbook } from '../services/inventoryExports'
import { inventoryPresentationFamilies, inventoryPresentationFamily } from '../inventoryPresentations'
import type { InventoryItem, InventoryMovement, InventoryPresentationBalance } from '../types'

type Props = { isLight: boolean; onBack: () => void; onOpenHistory: () => void; roleLabel?: string }
type EntryUnit = 'KG' | 'PZA'
type MovementMode = 'entrada' | 'salida'

const inventoryImages: Record<string, string> = {
  BOTANERO: '/images/inventory/botanero.webp',
  CANASTO: '/images/inventory/canasto.webp',
  COTIJA: '/images/inventory/cotija.webp',
  'MOLIDO COTIJA': '/images/inventory/cotija.webp',
  MANCHEGO: '/images/inventory/manchego.webp',
  OAXACA: '/images/inventory/oaxaca.webp',
  PANELA: '/images/inventory/panela.webp',
  MOLIDO: '/images/inventory/rayado.webp',
  RAYADO: '/images/inventory/rayado.webp',
  TENATE: '/images/inventory/tenate.webp',
}

function inventoryImage(productName: string) {
  return inventoryImages[productName.trim().toUpperCase()] ?? '/images/inventory/queso-generico.svg'
}

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

export function InventoryPage({ isLight, onBack, onOpenHistory, roleLabel = 'SECRETARÍA' }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [presentationBalances, setPresentationBalances] = useState<InventoryPresentationBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [inventoryLoaded, setInventoryLoaded] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [movementMode, setMovementMode] = useState<MovementMode | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [unit, setUnit] = useState<EntryUnit>('KG')
  const [presentation, setPresentation] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  async function refreshInventory() {
    setLoading(true)
    setError('')
    setWarning('')
    const auxiliaryErrors: string[] = []
    let inventorySucceeded = false

    await Promise.all([
      fetchInventory().then((result) => {
        setItems(result)
        setInventoryLoaded(true)
        inventorySucceeded = true
      }).catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'No se pudo consultar el inventario.')
      }),
      fetchInventoryMovements().then(setMovements).catch((reason) => {
        auxiliaryErrors.push(reason instanceof Error ? reason.message : 'No se pudo consultar el historial.')
      }),
      fetchInventoryPresentations().then(setPresentationBalances).catch((reason) => {
        auxiliaryErrors.push(reason instanceof Error ? reason.message : 'No se pudo consultar las presentaciones.')
      }),
    ])

    if (inventorySucceeded) {
      setLastUpdated(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
      setReportDate(new Date().toLocaleString('es-MX'))
    }
    if (auxiliaryErrors.length > 0) setWarning(auxiliaryErrors.join(' '))
    setLoading(false)
  }

  useEffect(() => { void refreshInventory() }, [])

  function openMovement(mode: MovementMode, productId = '', entryUnit: EntryUnit = 'KG') {
    const product = items.find((item) => item.id_producto === Number(productId))
    const family = inventoryPresentationFamily(product?.nombre ?? '')
    setFormError('')
    setNotice('')
    setSelectedProductId(productId)
    setUnit(family ? 'PZA' : entryUnit)
    setPresentation(family?.presentations[0]?.code ?? '')
    setMovementMode(mode)
  }

  function selectProduct(value: string) {
    setSelectedProductId(value)
    const product = items.find((item) => item.id_producto === Number(value))
    const family = inventoryPresentationFamily(product?.nombre ?? '')
    if (family) {
      setUnit('PZA')
      setPresentation(family.presentations[0].code)
    } else if (product?.unidad === 'KG' || product?.unidad === 'PZA') {
      setUnit(product.unidad)
      setPresentation('')
    }
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
          presentacion: String(values.get('presentacion') ?? '').trim(),
          observaciones: String(values.get('observaciones') ?? '').trim(),
        })
        setNotice('Entrada registrada y existencias actualizadas desde MySQL.')
      } else {
        await addInventoryExit({
          id_producto: idProducto,
          cantidad,
          unidad: selectedUnit,
          presentacion: String(values.get('presentacion') ?? '').trim(),
          motivo: String(values.get('motivo') ?? '').trim(),
          cliente: String(values.get('cliente') ?? '').trim(),
        })
        setNotice('Salida registrada y existencias descontadas correctamente.')
      }
      form.reset()
      setMovementMode(null)
      setSelectedProductId('')
      setUnit('KG')
      setPresentation('')
      await refreshInventory()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  const presentationBalanceByKey = new Map(presentationBalances.map((balance) => [balance.id_producto + ':' + balance.presentacion, balance]))
  const selectedItem = items.find((item) => item.id_producto === Number(selectedProductId))
  const selectedFamily = inventoryPresentationFamily(selectedItem?.nombre ?? '')
  const availableUnits: EntryUnit[] = selectedFamily ? ['PZA'] : ['KG', 'PZA']

  function presentationBalance(item: InventoryItem, code: string) {
    return numberValue(presentationBalanceByKey.get(item.id_producto + ':' + code)?.piezas)
  }

  function assignedPieces(item: InventoryItem) {
    const family = inventoryPresentationFamily(item.nombre)
    return family ? family.presentations.reduce((sum, entry) => sum + presentationBalance(item, entry.code), 0) : 0
  }

  function unassignedPieces(item: InventoryItem) {
    return inventoryPresentationFamily(item.nombre) ? Math.max(0, numberValue(item.stock_piezas) - assignedPieces(item)) : 0
  }

  function itemKilograms(item: InventoryItem) {
    const family = inventoryPresentationFamily(item.nombre)
    if (!family) return numberValue(item.stock_kg)
    return family.presentations.reduce((sum, entry) => sum + presentationBalance(item, entry.code) * (entry.weightKg ?? 0), 0)
  }

  const families = Object.values(inventoryPresentationFamilies).map((family) => {
    const item = items.find((entry) => inventoryPresentationFamily(entry.nombre)?.key === family.key)
    return { ...family, item }
  })
  const selectedPresentationBalance = selectedItem && selectedFamily ? presentationBalance(selectedItem, presentation) : 0
  const selectedUnassignedBalance = selectedItem ? unassignedPieces(selectedItem) : 0
  const selectedStock = selectedItem
    ? selectedFamily
      ? presentation === 'S/A' ? selectedUnassignedBalance : selectedPresentationBalance
      : numberValue(unit === 'KG' ? selectedItem.stock_kg : selectedItem.stock_piezas)
    : 0
  const totalPieces = items.reduce((sum, item) => sum + numberValue(item.stock_piezas), 0)
  const totalKilograms = items.reduce((sum, item) => sum + itemKilograms(item), 0)
  const registeredCount = items.filter(hasRecord).length

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
          <button className="inventory-action inventory-history-link" onClick={onOpenHistory}>Historial</button>
          <button className="inventory-action inventory-pdf" onClick={() => window.print()}>PDF</button>
          <button className="inventory-action inventory-excel" onClick={() => downloadInventoryWorkbook(items, movements)}>Excel</button>
          <button className="inventory-action inventory-back" onClick={onBack}>← Regresar</button>
        </div>
      </header>

      {error && <div className="inventory-error" role="alert">{error}</div>}
      {warning && <div className="inventory-warning" role="status">{warning}</div>}
      {notice && <div className="inventory-notice" role="status">{notice}</div>}
      {loading && items.length === 0 ? (
        <div className="inventory-message">Cargando inventario de Vilet…</div>
      ) : !inventoryLoaded && error ? null : (
        <>
          <div className="inventory-family-grid">
            {families.map((family) => {
              const totalKg = family.item ? itemKilograms(family.item) : 0
              const unassigned = family.item ? unassignedPieces(family.item) : 0
              return (
                <section className={'inventory-family-card inventory-family-' + family.key} key={family.key}>
                  <h2>{family.title}</h2>
                  {!family.item ? (
                    <p className="inventory-family-empty">Sin productos de esta categoría.</p>
                  ) : (
                    <>
                      <div className="inventory-table-wrap">
                        <table className="inventory-family-table">
                          <thead><tr>{family.presentations.map((entry) => <th key={entry.code}>{entry.label}</th>)}<th>TOTAL KG</th></tr></thead>
                          <tbody>
                            <tr>
                              {family.presentations.map((entry) => <td key={entry.code}>{quantity(presentationBalance(family.item!, entry.code))}</td>)}
                              <td className="inventory-family-total">{quantity(totalKg)} kg</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {unassigned > 0 && <p className="inventory-family-unassigned">{quantity(unassigned)} piezas sin presentación asignada</p>}
                    </>
                  )}
                </section>
              )
            })}
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

          {inventoryLoaded && items.length === 0 && !error ? (
            <div className="inventory-message">No hay productos registrados en la base de datos.</div>
          ) : (
            <div className="inventory-product-grid">
              {items.map((item) => {
                const family = inventoryPresentationFamily(item.nombre)
                return (
                  <article className="inventory-product-card" key={item.id_producto}>
                    <div className="inventory-product-image">
                      <img src={inventoryImage(item.nombre)} alt={'Queso ' + item.nombre} loading="lazy" />
                    </div>
                    <h3>{item.nombre}</h3>
                    <div className="inventory-product-stats">
                      <div><strong>{quantity(item.stock_piezas)}</strong><span>Piezas</span></div>
                      <div><strong>{quantity(itemKilograms(item))}</strong><span>kg</span></div>
                    </div>
                    <small>{hasRecord(item) ? 'Existencia registrada' : 'Sin registro · se muestra en cero'}</small>
                    <div className="inventory-product-actions">
                      <button type="button" onClick={() => openMovement('entrada', String(item.id_producto), 'PZA')} aria-label={'Agregar piezas de ' + item.nombre}>＋ Piezas</button>
                      {!family && <button type="button" onClick={() => openMovement('entrada', String(item.id_producto), 'KG')} aria-label={'Agregar kilogramos de ' + item.nombre}>＋ kg</button>}
                    </div>
                  </article>
                )
              })}
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
              {selectedFamily && (
                <label>Presentación
                  <select name="presentacion" required value={presentation} onChange={(event) => setPresentation(event.target.value)}>
                    {selectedFamily.presentations.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
                    {movementMode === 'salida' && selectedUnassignedBalance > 0 && <option value="S/A">Sin asignar ({quantity(selectedUnassignedBalance)} pzas)</option>}
                  </select>
                </label>
              )}
              <div className="inventory-form-row">
                <label>Cantidad
                  <input name="cantidad" type="number" min={unit === 'PZA' ? '1' : '0.01'} max={movementMode === 'salida' && selectedItem ? selectedStock : undefined} step={unit === 'PZA' ? '1' : '0.01'} required placeholder="0.00" />
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
