import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ViletMark } from '../components/ViletMark'
import { addRawMaterial, deleteRawMaterial, fetchRawMaterials, updateRawMaterial } from '../services/viletApi'
import type { RawMaterial } from '../types'

type Props = { isLight: boolean; onBack: () => void; roleLabel?: string }

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MateriaPrimaPage({ isLight, onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<RawMaterial | null>(null)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setMaterials(await fetchRawMaterials())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo consultar la materia prima.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const visibleMaterials = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-MX')
    if (!term) return materials
    return materials.filter((item) => item.nombre.toLocaleLowerCase('es-MX').includes(term) || String(item.id).includes(term))
  }, [materials, search])

  const totalUnits = materials.reduce((sum, item) => sum + Number(item.cantidad || 0), 0)
  const lowStockCount = materials.filter((item) => Number(item.cantidad) <= 5).length

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const cantidad = Number(data.get('cantidad'))
    if (!nombre || !Number.isInteger(cantidad) || cantidad < 1) {
      setError('Escribe el nombre y una cantidad entera mayor que cero.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await addRawMaterial({ nombre, cantidad })
      setNotice(result.message)
      form.reset()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la materia prima.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const data = new FormData(event.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    const cantidad = Number(data.get('cantidad'))
    if (!nombre || !Number.isInteger(cantidad) || cantidad < 0) {
      setError('Revisa el nombre y la cantidad.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const result = await updateRawMaterial(editing.id, { nombre, cantidad })
      setNotice(result.message)
      setEditing(null)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el material.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: RawMaterial) {
    if (!window.confirm('¿Eliminar ' + item.nombre + ' de la materia prima?')) return
    setError('')
    setNotice('')
    try {
      const result = await deleteRawMaterial(item.id)
      setNotice(result.message)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el material.')
    }
  }

  return (
    <section className={'raw-material-screen' + (isLight ? ' raw-material-screen-light' : '')} aria-label="Materia prima">
      <header className="raw-material-toolbar">
        <div className="raw-material-brand">
          <ViletMark small />
          <div><span>VILET · {roleLabel}</span><h1>Materia prima</h1><p>Entradas y existencias de producción</p></div>
        </div>
        <button className="raw-material-back" onClick={onBack}><span aria-hidden="true">⌂</span> Regresar al panel</button>
      </header>

      <div className="raw-material-welcome">
        <div><span className="raw-material-eyebrow">CONTROL DE INSUMOS</span><h2>Todo listo para producir</h2><p>Registra los insumos, mantén sus cantidades al día y consulta los movimientos disponibles.</p></div>
        <div className="raw-material-welcome-mark" aria-hidden="true">✦</div>
      </div>

      {error && <div className="raw-material-alert raw-material-alert-error" role="alert">{error}</div>}
      {notice && <div className="raw-material-alert raw-material-alert-success" role="status">{notice}</div>}

      <form className="raw-material-form-card" onSubmit={handleAdd}>
        <div className="raw-material-form-heading">
          <span className="raw-material-form-icon" aria-hidden="true">＋</span>
          <div><span className="raw-material-eyebrow">NUEVA ENTRADA</span><h2>Agregar materia prima</h2></div>
        </div>
        <div className="raw-material-form-fields">
          <label>Nombre del insumo<input name="nombre" required maxLength={120} placeholder="Ej. Leche, calcio, bolsas…" /></label>
          <label>Cantidad disponible<input name="cantidad" type="number" min="1" step="1" required placeholder="0" /></label>
          <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar entrada'} <span aria-hidden="true">↗</span></button>
        </div>
        <p className="raw-material-form-hint">Si el insumo ya existe, la nueva cantidad se suma a sus existencias.</p>
      </form>

      <div className="raw-material-stats">
        <article><span className="raw-stat-icon raw-stat-blue" aria-hidden="true">▦</span><div><small>INSUMOS REGISTRADOS</small><strong>{materials.length}</strong><span>tipos de materia prima</span></div></article>
        <article><span className="raw-stat-icon raw-stat-gold" aria-hidden="true">＋</span><div><small>UNIDADES DISPONIBLES</small><strong>{totalUnits.toLocaleString('es-MX')}</strong><span>cantidad total registrada</span></div></article>
        <article><span className="raw-stat-icon raw-stat-green" aria-hidden="true">◷</span><div><small>POR REVISAR</small><strong>{lowStockCount}</strong><span>insumos con 5 unidades o menos</span></div></article>
      </div>

      <section className="raw-material-table-card">
        <div className="raw-material-table-heading">
          <div><span className="raw-material-eyebrow">ALMACÉN VILET</span><h2>Insumos registrados</h2><p>Consulta y administra tus materias primas.</p></div>
          <label className="raw-material-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar insumo…" aria-label="Buscar materia prima" /></label>
        </div>
        <div className="raw-material-table-wrap">
          <table className="raw-material-table">
            <thead><tr><th>ID</th><th>PRODUCTO</th><th>CANTIDAD DISPONIBLE</th><th>FECHA DE REGISTRO</th><th>ACCIONES</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="raw-material-empty">Cargando insumos desde MySQL…</td></tr>
              ) : visibleMaterials.length === 0 ? (
                <tr><td colSpan={5} className="raw-material-empty">{search ? 'No hay resultados para esa búsqueda.' : 'Todavía no hay materia prima registrada. Agrega tu primer insumo arriba.'}</td></tr>
              ) : visibleMaterials.map((item) => (
                <tr key={item.id}>
                  <td><span className="raw-material-id">#{String(item.id).padStart(2, '0')}</span></td>
                  <td><strong className="raw-material-name"><span aria-hidden="true">◆</span>{item.nombre}</strong></td>
                  <td><span className={'raw-material-quantity' + (Number(item.cantidad) <= 5 ? ' raw-material-quantity-low' : '')}>{Number(item.cantidad).toLocaleString('es-MX')} <small>unid.</small></span></td>
                  <td><span className="raw-material-date">{formatDate(item.fecha)}</span></td>
                  <td><div className="raw-material-row-actions"><button className="raw-material-edit" onClick={() => { setError(''); setEditing(item) }} aria-label={'Editar ' + item.nombre} title="Editar">✎</button><button className="raw-material-delete" onClick={() => void handleDelete(item)} aria-label={'Eliminar ' + item.nombre} title="Eliminar">⌫</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="raw-material-table-footer"><span>{visibleMaterials.length} de {materials.length} insumos</span><button onClick={() => void refresh()} disabled={loading}>↻ Actualizar lista</button></footer>
      </section>

      {editing && (
        <div className="raw-material-modal-backdrop" onClick={() => !saving && setEditing(null)}>
          <section className="raw-material-modal" role="dialog" aria-modal="true" aria-labelledby="raw-material-edit-title" onClick={(event) => event.stopPropagation()}>
            <button className="raw-material-modal-close" onClick={() => setEditing(null)} aria-label="Cerrar">×</button>
            <span className="raw-material-eyebrow">EDITAR INSUMO · #{editing.id}</span>
            <h2 id="raw-material-edit-title">Actualizar materia prima</h2>
            <p>Cambia el nombre o ajusta la cantidad disponible.</p>
            <form onSubmit={handleEdit}>
              <label>Nombre del insumo<input name="nombre" defaultValue={editing.nombre} required maxLength={120} /></label>
              <label>Cantidad disponible<input name="cantidad" type="number" min="0" step="1" defaultValue={editing.cantidad} required /></label>
              <div className="raw-material-modal-actions"><button type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}