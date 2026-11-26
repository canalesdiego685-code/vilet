import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createAdminUser, deactivateAdminUser, fetchAdminUsers, updateAdminUser } from '../services/viletApi'
import type { UserRole, ViletAdminAccount } from '../types'

type Props = { currentUserId: number; onBack: () => void }

function fullName(user: ViletAdminAccount) {
  return [user.nombre, user.apellidoPaterno, user.apellidoMaterno].filter(Boolean).join(' ')
}

function dateLabel(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminUsersPage({ currentUserId, onBack }: Props) {
  const [items, setItems] = useState<ViletAdminAccount[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ViletAdminAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try { setItems(await fetchAdminUsers()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los usuarios.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return items
    return items.filter((user) => [fullName(user), user.email, user.usuario, user.rol].some((value) => value.toLocaleLowerCase().includes(term)))
  }, [items, search])

  function create() {
    setEditing(null)
    setError('')
    setMessage('')
    setOpen(true)
  }

  function edit(user: ViletAdminAccount) {
    setEditing(user)
    setError('')
    setMessage('')
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const payload = {
      nombre: String(data.get('nombre') ?? '').trim(),
      apellidoPaterno: String(data.get('apellidoPaterno') ?? '').trim(),
      apellidoMaterno: String(data.get('apellidoMaterno') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      usuario: String(data.get('usuario') ?? '').trim(),
      password: String(data.get('password') ?? ''),
      rol: String(data.get('rol') ?? 'Secretaría') as UserRole,
      estado: Number(data.get('estado') ?? 1),
    }
    setSaving(true)
    setError('')
    try {
      const result = editing
        ? await updateAdminUser(editing.id, payload)
        : await createAdminUser(payload)
      setMessage(result.message)
      setOpen(false)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el usuario.')
    } finally { setSaving(false) }
  }

  async function deactivate(user: ViletAdminAccount) {
    if (!window.confirm('¿Desactivar la cuenta de ' + fullName(user) + '? Su historial se conservará.')) return
    setError('')
    setMessage('')
    try {
      const result = await deactivateAdminUser(user.id)
      setMessage(result.message)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo desactivar el usuario.')
    }
  }

  return (
    <section className="admin-users-screen" aria-label="Usuarios registrados">
      <header className="admin-subpage-toolbar">
        <div><span className="admin-page-icon">♙</span><div><span>VILET · ADMINISTRACIÓN</span><h1>Usuarios registrados</h1></div></div>
        <button className="admin-back-button" onClick={onBack}>← Regresar</button>
      </header>

      <div className="admin-users-actions">
        <button className="admin-new-user" onClick={create}>＋ Nuevo usuario</button>
        <label className="admin-user-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo o usuario" /></label>
      </div>
      {error && <p className="admin-users-alert admin-users-error" role="alert">{error}</p>}
      {message && <p className="admin-users-alert admin-users-success" role="status">{message}</p>}

      <section className="admin-users-table-card">
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="admin-users-empty">Cargando usuarios…</td></tr>
                : visible.length === 0 ? <tr><td colSpan={8} className="admin-users-empty">No hay usuarios que coincidan.</td></tr>
                : visible.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td><td className="admin-user-name">{fullName(user)}</td><td>{user.email}</td><td>{user.usuario}</td>
                    <td><span className={'admin-user-role admin-role-' + (user.rol === 'Encargado' ? 'admin' : 'secretary')}>{user.rol === 'Encargado' ? 'Administrador' : user.rol}</span></td>
                    <td><span className={'admin-user-status ' + (user.estado === 1 ? 'is-active' : 'is-inactive')}>{user.estado === 1 ? 'Activo' : 'Inactivo'}</span></td>
                    <td>{dateLabel(user.fechaRegistro)}</td>
                    <td><div className="admin-user-row-actions"><button onClick={() => edit(user)} disabled={user.id === currentUserId} aria-label={'Editar ' + fullName(user)} title="Editar usuario">✎</button><button onClick={() => void deactivate(user)} disabled={user.id === currentUserId || user.estado !== 1} aria-label={'Desactivar ' + fullName(user)} title={user.id === currentUserId ? 'No puedes desactivar tu cuenta' : 'Desactivar usuario'}>⌫</button></div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {open && <div className="admin-user-modal-backdrop" onClick={() => !saving && setOpen(false)}>
        <section className="admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title" onClick={(event) => event.stopPropagation()}>
          <button className="admin-user-modal-close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          <span>VILET · CUENTAS</span><h2 id="admin-user-modal-title">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <form onSubmit={save}>
            <div className="admin-user-form-grid">
              <label>Nombre<input name="nombre" required maxLength={150} defaultValue={editing?.nombre ?? ''} /></label>
              <label>Apellido paterno<input name="apellidoPaterno" required maxLength={150} defaultValue={editing?.apellidoPaterno ?? ''} /></label>
              <label>Apellido materno<input name="apellidoMaterno" required maxLength={150} defaultValue={editing?.apellidoMaterno ?? ''} /></label>
              <label>Correo electrónico<input name="email" type="email" required maxLength={254} defaultValue={editing?.email ?? ''} /></label>
              <label>Nombre de usuario<input name="usuario" required maxLength={100} defaultValue={editing?.usuario ?? ''} /></label>
              <label>Rol<select name="rol" defaultValue={editing?.rol ?? 'Secretaría'}><option value="Secretaría">Secretaría</option><option value="Encargado">Administrador</option></select></label>
              {editing && <label>Estado<select name="estado" defaultValue={editing.estado}><option value="1">Activo</option><option value="0">Inactivo</option></select></label>}
              <label className="admin-user-password">Contraseña{editing && <small>Déjala vacía para conservar la actual.</small>}<input name="password" type="password" minLength={8} required={!editing} autoComplete="new-password" placeholder={editing ? 'Sin cambios' : 'Mínimo 8 caracteres'} /></label>
            </div>
            {error && <p className="admin-users-alert admin-users-error" role="alert">{error}</p>}
            <div className="admin-user-modal-actions"><button type="button" onClick={() => setOpen(false)} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar usuario'}</button></div>
          </form>
        </section>
      </div>}
    </section>
  )
}
