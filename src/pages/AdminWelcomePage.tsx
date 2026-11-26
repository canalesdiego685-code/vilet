import { useEffect, useState, type FormEvent } from 'react'
import { ViletMark } from '../components/ViletMark'
import { createNotice, deleteAdminNotice, fetchNotices } from '../services/viletApi'
import type { AuthenticatedUser, ViletNotice } from '../types'

type Props = { user: AuthenticatedUser; onBack: () => void }

export function AdminWelcomePage({ user, onBack }: Props) {
  const [items, setItems] = useState<ViletNotice[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh() {
    try { setItems(await fetchNotices()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los avisos.') }
  }

  useEffect(() => { void refresh() }, [])


  async function archive(item: ViletNotice) {
    if (!window.confirm('¿Ocultar el aviso "' + item.titulo + '" a Secretaría? El registro se conservará en MySQL.')) return
    setError('')
    setNotice('')
    try {
      const result = await deleteAdminNotice(item.id)
      setNotice(result.message)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo archivar el aviso.')
    }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const titulo = String(data.get('titulo') ?? '').trim()
    const mensaje = String(data.get('mensaje') ?? '').trim()
    if (!titulo || !mensaje) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await createNotice({ titulo, mensaje })
      setNotice(result.message)
      form.reset()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo publicar el aviso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-home-screen">
      <header className="admin-home-toolbar">
        <div className="admin-home-brand"><ViletMark small /><span>VILET · ADMINISTRACIÓN</span></div>
        <button className="admin-back-button" onClick={onBack}>← Regresar al panel</button>
      </header>
      <section className="admin-home-welcome"><span>CONTROL GENERAL DE VILET</span><h1>Bienvenido, {user.name.split(' ')[0] || user.username}</h1><p>Publica comunicados para que Secretaría pueda consultarlos en su sección de Avisos.</p></section>
      <div className="admin-notice-grid">
        <form className="admin-publish-card" onSubmit={publish}>
          <span className="notice-kicker">COMUNICACIÓN INTERNA</span><h2>Nuevo aviso para Secretaría</h2><p>El mensaje aparecerá en el panel de Secretaría y quedará marcado como no leído.</p>
          <label>Título<input name="titulo" required maxLength={150} placeholder="Ej. Reunión de producción" /></label>
          <label>Mensaje<textarea name="mensaje" required maxLength={5000} rows={5} placeholder="Escribe el aviso para el equipo…" /></label>
          {error && <span className="admin-notice-error" role="alert">{error}</span>}
          {notice && <span className="admin-notice-success" role="status">{notice}</span>}
          <button type="submit" disabled={saving}>{saving ? 'Publicando…' : '↗ Publicar aviso'}</button>
        </form>
        <section className="admin-recent-notices">
          <div><span className="notice-kicker">VILET · AVISOS</span><h2>Comunicados recientes</h2></div>
          {items.length === 0 ? <p className="admin-recent-empty">Aún no hay comunicados.</p> : items.slice(0, 5).map((item) => (
            <article key={item.id}><div><strong>{item.titulo}</strong><span>{new Date(item.fecha).toLocaleDateString('es-MX')}</span></div><p>{item.mensaje}</p><div className="admin-notice-card-footer"><small>{item.estado === 'leido' ? 'Leído por Secretaría' : 'Pendiente de lectura'}</small><button onClick={() => void archive(item)} aria-label="Archivar aviso" title="Archivar aviso">⌫</button></div></article>
          ))}
        </section>
      </div>
    </section>
  )
}