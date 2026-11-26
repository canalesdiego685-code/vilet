import { useState, type ChangeEvent } from 'react'
import { ViletMark } from '../components/ViletMark'
import type { AuthenticatedUser } from '../types'

type Props = {
  user: AuthenticatedUser
  isLight: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onOpenUsers: () => void
  onOpenInventory: () => void
  onOpenRawMaterials: () => void
  onOpenReports: () => void
  onOpenNotices: () => void
  onOpenClients: () => void
  onOpenPerformance: () => void
  onOpenAttendance: () => void
}

const shortcuts = [
  { title: 'Usuarios', description: 'Cuentas, roles y acceso', icon: '♙', action: 'users' },
  { title: 'Materia prima', description: 'Insumos y existencias', icon: '⬡', action: 'raw' },
  { title: 'Inventario', description: 'Existencias de queso Vilet', icon: '▣', action: 'inventory' },
  { title: 'Reportes', description: 'Producción y movimientos', icon: '▥', action: 'reports' },
  { title: 'Avisos', description: 'Publica mensajes a Secretaría', icon: '♢', action: 'notices' },
  { title: 'Rendimiento', description: 'Hojas por área', icon: '▧', action: 'performance' },
  { title: 'Asistencias', description: 'Control semanal del personal', icon: '▦', action: 'attendance' },
  { title: 'Clientes', description: 'Compras y datos de clientes', icon: '♧', action: 'clients' },
] as const

export function AdminDashboardPage({ user, isLight, onToggleTheme, onLogout, onOpenUsers, onOpenInventory, onOpenRawMaterials, onOpenReports, onOpenNotices, onOpenClients, onOpenPerformance, onOpenAttendance }: Props) {
  const name = user.name.split(' ')[0] || user.username
  const photoKey = 'vilet-profile-photo-' + user.id
  const [profilePhoto, setProfilePhoto] = useState(() => {
    try { return window.localStorage.getItem(photoKey) ?? '' } catch { return '' }
  })
  const [showPhotoPreview, setShowPhotoPreview] = useState(false)
  const [photoNotice, setPhotoNotice] = useState('')
  const initials = user.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || user.username.slice(0, 1).toUpperCase()
  const actions = {
    users: onOpenUsers,
    raw: onOpenRawMaterials,
    inventory: onOpenInventory,
    reports: onOpenReports,
    notices: onOpenNotices,
    performance: onOpenPerformance,
    attendance: onOpenAttendance,
    clients: onOpenClients,
  }

  function addProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoNotice('Selecciona un archivo de imagen.')
      input.value = ''
      return
    }
    if (file.size > 1_500_000) {
      setPhotoNotice('La foto debe pesar menos de 1.5 MB.')
      input.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const image = typeof reader.result === 'string' ? reader.result : ''
      if (!image) { setPhotoNotice('No se pudo abrir la imagen.'); return }
      try {
        window.localStorage.setItem(photoKey, image)
        setProfilePhoto(image)
        setPhotoNotice('Foto de perfil guardada.')
      } catch { setPhotoNotice('No hay espacio para guardar la foto en este navegador.') }
    }
    reader.onerror = () => setPhotoNotice('No se pudo abrir la imagen.')
    reader.readAsDataURL(file)
    input.value = ''
  }

  function removeProfilePhoto() {
    try {
      window.localStorage.removeItem(photoKey)
      setProfilePhoto('')
      setPhotoNotice('Foto de perfil eliminada.')
      setShowPhotoPreview(false)
    } catch { setPhotoNotice('No se pudo eliminar la foto de perfil.') }
  }

  return (
    <section className="admin-dashboard-screen" aria-label="Panel de administración">
      <header className="admin-dashboard-toolbar">
        <div className="admin-dashboard-brand"><ViletMark small /><span>VILET</span><i>ADMINISTRACIÓN</i></div>
        <div className="admin-dashboard-actions">
          <div className="admin-profile-controls">
            <button className="admin-profile-avatar" onClick={() => setShowPhotoPreview(true)} aria-label="Ampliar foto de perfil">
              {profilePhoto ? <img src={profilePhoto} alt="" /> : <span>{initials}</span>}
            </button>
            <label className="admin-profile-action" htmlFor="admin-profile-photo" title="Agregar foto" aria-label="Agregar foto">＋</label>
            <button className="admin-profile-action admin-profile-remove" onClick={removeProfilePhoto} disabled={!profilePhoto} title="Eliminar foto" aria-label="Eliminar foto">⌫</button>
            <input className="admin-profile-photo-input" id="admin-profile-photo" type="file" accept="image/*" onChange={addProfilePhoto} />
          </div>
          <span className="admin-dashboard-user">{name}</span>
          <button className="admin-dashboard-theme" onClick={onToggleTheme} aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>{isLight ? '☀' : '☾'}</button>
          <button className="admin-dashboard-logout" onClick={onLogout}>↪ Cerrar sesión</button>
        </div>
      </header>

      {photoNotice && <p className="admin-photo-notice" role="status">{photoNotice}</p>}

      <section className="admin-dashboard-welcome">
        <span>CONTROL GENERAL DE VILET</span>
        <h1>Bienvenido, {name}</h1>
        <p>Administra usuarios, existencias y operaciones desde un solo lugar.</p>
      </section>

      <div className="admin-dashboard-grid">
        {shortcuts.map((item, index) => (
          <button className={'admin-dashboard-card admin-card-' + (index + 1)} key={item.action} onClick={actions[item.action]}>
            <span className="admin-dashboard-card-icon" aria-hidden="true">{item.icon}</span>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>

      {showPhotoPreview && <div className="admin-photo-preview-backdrop" onClick={() => setShowPhotoPreview(false)}>
        <section className="admin-photo-preview" role="dialog" aria-modal="true" aria-label="Foto de perfil ampliada" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => setShowPhotoPreview(false)} aria-label="Cerrar foto">×</button>
          <div>{profilePhoto ? <img src={profilePhoto} alt={'Foto de perfil de ' + name} /> : <span>{initials}</span>}</div>
          <h2>{name}</h2>
          <p>Administrador · Encargado</p>
          <label htmlFor="admin-profile-photo-preview">＋ Cambiar foto</label>
          <input className="admin-profile-photo-input" id="admin-profile-photo-preview" type="file" accept="image/*" onChange={addProfilePhoto} />
          <button className="admin-photo-remove-large" onClick={removeProfilePhoto} disabled={!profilePhoto}>Eliminar foto</button>
        </section>
      </div>}
    </section>
  )
}
