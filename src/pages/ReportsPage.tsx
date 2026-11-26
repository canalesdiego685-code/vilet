import { useEffect, useMemo, useState } from 'react'
import { ViletMark } from '../components/ViletMark'
import { fetchInventory } from '../services/viletApi'
import type { InventoryItem } from '../types'

type Props = { isLight: boolean; onBack: () => void; roleLabel?: string }
type ReportMode = 'Diario' | 'Semanal' | 'Mensual' | 'Producción' | 'Inventario' | 'Ventas'

const modes: Array<{ title: ReportMode; icon: string }> = [
  { title: 'Diario', icon: '▤' },
  { title: 'Semanal', icon: '▦' },
  { title: 'Mensual', icon: '▦' },
  { title: 'Producción', icon: '⚙' },
  { title: 'Inventario', icon: '▣' },
  { title: 'Ventas', icon: '◈' },
]

function n(value: number | string | null | undefined) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}
function fmt(value: number) {
  return value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function recent(item: InventoryItem, mode: ReportMode) {
  if (mode === 'Producción' || mode === 'Inventario' || mode === 'Ventas') return true
  if (!item.fecha_actualizacion) return false
  const date = new Date(item.fecha_actualizacion)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  if (mode === 'Diario') return date.toDateString() === now.toDateString()
  if (mode === 'Semanal') return date.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}
function kgMetric(item: InventoryItem, mode: ReportMode) {
  if (mode === 'Producción') return n(item.entradas_kg)
  if (mode === 'Ventas') return n(item.salidas_kg)
  return n(item.stock_kg)
}
function pzaMetric(item: InventoryItem, mode: ReportMode) {
  if (mode === 'Producción') return n(item.entradas_piezas)
  if (mode === 'Ventas') return n(item.salidas_piezas)
  return n(item.stock_piezas)
}

export function ReportsPage({ isLight, onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [mode, setMode] = useState<ReportMode>('Inventario')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchInventory().then((result) => {
      if (active) setItems(result)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron consultar los datos de Vilet.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => items.filter((item) => recent(item, mode)), [items, mode])
  const totalKg = filtered.reduce((sum, item) => sum + kgMetric(item, mode), 0)
  const totalPieces = filtered.reduce((sum, item) => sum + pzaMetric(item, mode), 0)
  const activeProducts = filtered.filter((item) => kgMetric(item, mode) > 0 || pzaMetric(item, mode) > 0).length
  const maxKg = Math.max(1, ...filtered.map((item) => kgMetric(item, mode)))
  const groups = [
    { name: 'Oaxaca', color: '#4389ff', rows: filtered.filter((item) => item.nombre.toLocaleLowerCase().includes('oaxaca')) },
    { name: 'Panela', color: '#41c792', rows: filtered.filter((item) => item.nombre.toLocaleLowerCase().includes('panela')) },
    { name: 'Otros', color: '#f1ca4c', rows: filtered.filter((item) => !item.nombre.toLocaleLowerCase().includes('oaxaca') && !item.nombre.toLocaleLowerCase().includes('panela')) },
  ]
  const groupTotals = groups.map((group) => ({ ...group, value: group.rows.reduce((sum, item) => sum + kgMetric(item, mode), 0) }))
  const totalGroupKg = groupTotals.reduce((sum, group) => sum + group.value, 0)
  let degree = 0
  const gradient = totalGroupKg === 0
    ? '#1d3554'
    : 'conic-gradient(' + groupTotals.map((group) => {
      const start = degree
      degree += group.value / totalGroupKg * 360
      return group.color + ' ' + start + 'deg ' + degree + 'deg'
    }).join(',') + ')'
  const heading = mode === 'Producción' ? 'Entradas registradas' : mode === 'Ventas' ? 'Salidas registradas' : 'Existencias por producto'
  const note = mode === 'Diario' || mode === 'Semanal' || mode === 'Mensual'
    ? 'Este corte usa la fecha de última actualización del inventario. Aún no hay una tabla con fecha individual para cada movimiento.'
    : 'Cifras acumuladas consultadas desde el inventario de Vilet.'

  return (
    <section className={'reports-screen' + (isLight ? ' reports-screen-light' : '')} aria-label="Reportes de Vilet">
      <header className="reports-toolbar">
        <div className="reports-brand"><ViletMark small /><div><span>VILET · {roleLabel}</span><h1>Reportes inteligentes</h1></div></div>
        <button className="reports-back" onClick={onBack}><span aria-hidden="true">⌂</span> Regresar</button>
      </header>

      {error && <div className="reports-alert" role="alert">{error}</div>}

      <div className="reports-summary-grid">
        <article className="reports-summary-card"><span>{mode === 'Producción' ? 'ENTRADAS EN KG' : mode === 'Ventas' ? 'SALIDAS EN KG' : 'EXISTENCIAS EN KG'}</span><strong>{fmt(totalKg)}</strong><small>{mode === 'Producción' ? 'acumuladas' : mode === 'Ventas' ? 'acumuladas' : 'disponibles'}</small></article>
        <article className="reports-summary-card"><span>MOVIMIENTOS CON DATOS</span><strong>{activeProducts}</strong><small>productos en este reporte</small></article>
        <article className="reports-summary-card"><span>PIEZAS REGISTRADAS</span><strong>{fmt(totalPieces)}</strong><small>total acumulado</small></article>
      </div>

      <nav className="reports-shortcuts" aria-label="Tipo de reporte">
        {modes.map((item) => <button key={item.title} className={mode === item.title ? 'reports-shortcut is-active' : 'reports-shortcut'} onClick={() => setMode(item.title)}><span aria-hidden="true">{item.icon}</span>Reporte {item.title}</button>)}
      </nav>

      <div className="reports-chart-grid">
        <section className="reports-chart-card">
          <div className="reports-chart-title"><span className="reports-title-icon">▥</span><div><h2>{heading}</h2><p>{loading ? 'Consultando MySQL…' : filtered.length + ' productos considerados'}</p></div></div>
          {loading ? <div className="reports-chart-empty">Cargando datos…</div> : filtered.length === 0 ? <div className="reports-chart-empty">No hay existencias o actualizaciones para este corte.</div> : (
            <div className="reports-bars">
              {filtered.slice().sort((a, b) => kgMetric(b, mode) - kgMetric(a, mode)).slice(0, 10).map((item) => (
                <div className="reports-bar-row" key={item.id_producto}>
                  <span title={item.nombre}>{item.nombre}</span><div className="reports-bar-track"><i style={{ width: Math.max(kgMetric(item, mode) > 0 ? 2 : 0, kgMetric(item, mode) / maxKg * 100) + '%' }} /></div><strong>{fmt(kgMetric(item, mode))} kg</strong>
                </div>
              ))}
            </div>
          )}
          <p className="reports-data-note">{note}</p>
        </section>

        <section className="reports-chart-card reports-participation-card">
          <div className="reports-chart-title"><span className="reports-title-icon reports-title-green">◉</span><div><h2>Participación general</h2><p>Distribución en kilogramos por categoría</p></div></div>
          <div className="reports-donut-area">
            <div className="reports-donut" style={{ background: gradient }}><div><strong>{fmt(totalGroupKg)}</strong><span>kg en total</span></div></div>
            <div className="reports-legend">{groupTotals.map((group) => <div key={group.name}><i style={{ background: group.color }} /><span>{group.name}</span><strong>{fmt(group.value)} kg</strong></div>)}</div>
          </div>
          <p className="reports-data-note">Las categorías se identifican por el nombre del producto en el catálogo.</p>
        </section>
      </div>

      <section className="reports-product-card">
        <div className="reports-chart-title"><span className="reports-title-icon reports-title-gold">▣</span><div><h2>Resumen de movimientos</h2><p>Entradas y salidas acumuladas registradas por Vilet</p></div></div>
        <div className="reports-movement-grid">
          <article><span>ENTRADAS · KG</span><strong>{fmt(filtered.reduce((sum, item) => sum + n(item.entradas_kg), 0))}</strong></article>
          <article><span>SALIDAS · KG</span><strong>{fmt(filtered.reduce((sum, item) => sum + n(item.salidas_kg), 0))}</strong></article>
          <article><span>ENTRADAS · PIEZAS</span><strong>{fmt(filtered.reduce((sum, item) => sum + n(item.entradas_piezas), 0))}</strong></article>
          <article><span>SALIDAS · PIEZAS</span><strong>{fmt(filtered.reduce((sum, item) => sum + n(item.salidas_piezas), 0))}</strong></article>
        </div>
      </section>
    </section>
  )
}