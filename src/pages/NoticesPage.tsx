import { useEffect, useState } from 'react'
import { fetchNotices, markAllNoticesRead, markNoticeRead } from '../services/viletApi'
import type { ViletNotice } from '../types'

type Props = { onBack: () => void }

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function NoticesPage({ onBack }: Props) {
  const [items, setItems] = useState<ViletNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | 'all' | null>(null)
  const [error, setError] = useState('')
  const unread = items.filter((item) => item.estado !== 'leido').length

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setItems(await fetchNotices())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los avisos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function markOne(id: number) {
    setBusyId(id)
    setError('')
    try {
      await markNoticeRead(id)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo marcar el aviso.')
    } finally {
      setBusyId(null)
    }
  }

  async function markAll() {
    setBusyId('all')
    setError('')
    try {
      await markAllNoticesRead()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron actualizar los avisos.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="notice-screen" aria-label="Avisos de Secretaría">
      <header className="notice-toolbar">
        <div><span className="notice-title-icon" aria-hidden="true">♟</span><div><span className="notice-kicker">VILET · SECRETARÍA</span><h1>Avisos</h1><p>Comunicados publicados por Administración</p></div></div>
        <button className="notice-back" onClick={onBack}>← Regresar</button>
      </header>

      <div className="notice-overview">
        <div><strong>{unread}</strong><span>{unread === 1 ? 'aviso sin leer' : 'avisos sin leer'}</span></div>
        <button onClick={() => void markAll()} disabled={unread === 0 || busyId !== null}>{busyId === 'all' ? 'Actualizando…' : '✓ Marcar todos como leídos'}</button>
      </div>

      {error && <p className="notice-error" role="alert">{error}</p>}
      <div className="notice-list">
        {loading ? <div className="notice-empty">Cargando avisos…</div> : items.length === 0 ? (
          <div className="notice-empty"><span aria-hidden="true">♧</span><strong>Todo tranquilo por aquí</strong><p>Cuando el administrador publique un aviso, aparecerá en esta lista.</p></div>
        ) : items.map((item) => (
          <article key={item.id} className={'notice-card' + (item.estado === 'leido' ? ' notice-card-read' : '')}>
            <div className="notice-card-header">
              <div><span className="notice-card-symbol" aria-hidden="true">✦</span><h2>{item.titulo}</h2></div>
              <span className={'notice-state' + (item.estado === 'leido' ? ' notice-state-read' : '')}>{item.estado === 'leido' ? 'LEÍDO' : 'NO LEÍDO'}</span>
            </div>
            <p className="notice-message">{item.mensaje}</p>
            <time className="notice-date" dateTime={item.fecha}>◷ {displayDate(item.fecha)}</time>
            {item.estado !== 'leido' && <div className="notice-card-actions"><button onClick={() => void markOne(item.id)} disabled={busyId !== null}>{busyId === item.id ? 'Guardando…' : '✓ Marcar leído'}</button></div>}
          </article>
        ))}
      </div>
    </section>
  )
}