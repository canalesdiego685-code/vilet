import { useEffect, useState, type FormEvent } from 'react'
import { fetchClientHistory, fetchClients, registerClientPurchase, updateClient } from '../services/viletApi'
import type { ClientPurchase, ViletClient } from '../types'

type Props = { onBack: () => void; roleLabel?: string }

function displayDate(value: string | null) {
  if (!value) return 'Sin compras registradas'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ClientsPage({ onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [items, setItems] = useState<ViletClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<ViletClient | null>(null)
  const [historyClient, setHistoryClient] = useState<ViletClient | null>(null)
  const [history, setHistory] = useState<ClientPurchase[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try { setItems(await fetchClients()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron consultar los clientes.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  const filtered = items.filter((client) =>
    client.nombre.toLocaleLowerCase('es-MX').includes(search.trim().toLocaleLowerCase('es-MX'))
    || client.telefono.includes(search.replace(/\D/g, '')),
  )
  const totalPurchases = items.reduce((sum, client) => sum + Number(client.compras), 0)

  async function registerPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const nombre = String(data.get('nombre') ?? '').trim()
    const telefono = String(data.get('telefono') ?? '')
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await registerClientPurchase({ nombre, telefono })
      setNotice(result.message)
      form.reset()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo registrar la compra.')
    } finally { setSaving(false) }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const data = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      const result = await updateClient(editing.id, {
        nombre: String(data.get('nombre') ?? '').trim(),
        telefono: String(data.get('telefono') ?? ''),
      })
      setNotice(result.message)
      setEditing(null)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los cambios.')
    } finally { setSaving(false) }
  }

  async function openHistory(client: ViletClient) {
    setHistoryClient(client)
    setHistoryLoading(true)
    setHistory([])
    try { setHistory(await fetchClientHistory(client.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial.') }
    finally { setHistoryLoading(false) }
  }

  return (
    <section className="clients-screen" aria-label="Gestión de clientes">
      <header className="clients-toolbar">
        <div><span className="clients-icon" aria-hidden="true">♟</span><div><span className="clients-kicker">VILET · {roleLabel}</span><h1>Gestión de Clientes</h1></div></div>
        <button className="clients-back" onClick={onBack}>← Volver</button>
      </header>

      <section className="clients-register-card">
        <div><span className="clients-kicker">NUEVA COMPRA</span><h2>Registrar compra de cliente</h2><p>El teléfono identifica a la persona: si vuelve a comprar, su contador aumenta en la misma fila.</p></div>
        <form onSubmit={registerPurchase}>
          <label>Nombre del cliente<input name="nombre" required maxLength={100} placeholder="Nombre completo" /></label>
          <label>Teléfono<input name="telefono" type="tel" required minLength={7} maxLength={20} placeholder="10 dígitos" /></label>
          <button type="submit" disabled={saving}>{saving ? 'Guardando…' : '+ Registrar compra'}</button>
        </form>
      </section>

      {error && <p className="clients-alert clients-alert-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar">×</button></p>}
      {notice && <p className="clients-alert clients-alert-success" role="status">{notice}</p>}

      <section className="clients-list-card">
        <div className="clients-list-heading">
          <div><span className="clients-kicker">DIRECTORIO VILET</span><h2>Clientes registrados</h2><p>{items.length} personas · {totalPurchases} compras registradas</p></div>
          <div className="clients-list-tools"><label><span aria-hidden="true">⌕</span><input aria-label="Buscar cliente" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar persona…" /></label><button className="clients-pdf" onClick={() => window.print()}>▣ PDF</button></div>
        </div>
        <div className="clients-table-wrap">
          <table className="clients-table">
            <thead><tr><th>CLIENTE</th><th>COMPRAS</th><th>ÚLTIMA COMPRA</th><th>ACCIONES</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="clients-empty">Cargando clientes…</td></tr> : filtered.length === 0 ? <tr><td colSpan={4} className="clients-empty">{search ? 'No hay clientes que coincidan con la búsqueda.' : 'Aún no hay clientes. Registra una compra arriba para crear la primera ficha.'}</td></tr> : filtered.map((client) => (
                <tr key={client.id}>
                  <td><strong>{client.nombre}</strong><small>{client.telefono}</small></td>
                  <td><span className="clients-purchase-count">{client.compras}</span></td>
                  <td>{displayDate(client.ultima_compra)}</td>
                  <td><div className="clients-row-actions"><button className="clients-history" onClick={() => void openHistory(client)}>◷ Historial</button><button className="clients-edit" onClick={() => setEditing(client)}>✎ Editar</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="clients-table-footer"><span>{filtered.length} de {items.length} clientes</span><button onClick={() => void refresh()} disabled={loading}>↻ Actualizar</button></footer>
      </section>

      {editing && <div className="clients-modal-backdrop" onClick={() => !saving && setEditing(null)}><section className="clients-modal" role="dialog" aria-modal="true" aria-labelledby="client-edit-title" onClick={(event) => event.stopPropagation()}><button className="clients-modal-close" onClick={() => setEditing(null)} aria-label="Cerrar">×</button><span className="clients-kicker">CLIENTE #{editing.id}</span><h2 id="client-edit-title">Editar datos</h2><form onSubmit={saveEdit}><label>Nombre<input name="nombre" defaultValue={editing.nombre} required maxLength={100} /></label><label>Teléfono<input name="telefono" type="tel" defaultValue={editing.telefono} required minLength={7} maxLength={20} /></label><div><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div></form></section></div>}

      {historyClient && <div className="clients-modal-backdrop" onClick={() => setHistoryClient(null)}><section className="clients-modal clients-history-modal" role="dialog" aria-modal="true" aria-labelledby="client-history-title" onClick={(event) => event.stopPropagation()}><button className="clients-modal-close" onClick={() => setHistoryClient(null)} aria-label="Cerrar">×</button><span className="clients-kicker">HISTORIAL DE COMPRAS</span><h2 id="client-history-title">{historyClient.nombre}</h2><p>{historyClient.compras} compras · {historyClient.telefono}</p>{historyLoading ? <div className="clients-empty">Cargando historial…</div> : history.length === 0 ? <div className="clients-empty">Este cliente todavía no tiene compras registradas.</div> : <ol>{history.map((purchase, index) => <li key={purchase.id}><span>Compra {history.length - index}</span><time>{new Date(purchase.fecha).toLocaleString('es-MX')}</time></li>)}</ol>}</section></div>}
    </section>
  )
}