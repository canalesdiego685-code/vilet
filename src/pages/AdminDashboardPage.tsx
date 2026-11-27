import { ProfilePhotoControl } from '../components/ProfilePhotoControl'
import { ViletMark } from '../components/ViletMark'
import type { AuthenticatedUser } from '../types'

type Props = {
  user: AuthenticatedUser
  isLight: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onOpenUsers: () => void
  onOpenInventory: () => void
  onOpenHistory: () => void
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
  { title: 'Historial', description: 'Entradas y salidas', icon: '↺', action: 'history' },
  { title: 'Reportes', description: 'Producción y movimientos', icon: '▥', action: 'reports' },
  { title: 'Avisos', description: 'Publica mensajes a Secretaría', icon: '♢', action: 'notices' },
  { title: 'Rendimiento', description: 'Hojas por área', icon: '▧', action: 'performance' },
  { title: 'Asistencias', description: 'Control semanal del personal', icon: '▦', action: 'attendance' },
  { title: 'Clientes', description: 'Compras y datos de clientes', icon: '♧', action: 'clients' },
] as const

export function AdminDashboardPage({ user, isLight, onToggleTheme, onLogout, onOpenUsers, onOpenInventory, onOpenHistory, onOpenRawMaterials, onOpenReports, onOpenNotices, onOpenClients, onOpenPerformance, onOpenAttendance }: Props) {
  const name = user.name.split(' ')[0] || user.username
  const actions = {
    users: onOpenUsers,
    raw: onOpenRawMaterials,
    inventory: onOpenInventory,
    history: onOpenHistory,
    reports: onOpenReports,
    notices: onOpenNotices,
    performance: onOpenPerformance,
    attendance: onOpenAttendance,
    clients: onOpenClients,
  }

  return (
    <section className="admin-dashboard-screen" aria-label="Panel de administración">
      <header className="admin-dashboard-toolbar">
        <div className="admin-dashboard-brand"><ViletMark small /><span>VILET</span><i>ADMINISTRACIÓN</i></div>
        <div className="admin-dashboard-actions">
          <ProfilePhotoControl user={user} variant="admin" />
          <span className="admin-dashboard-user">{name}</span>
          <button className="admin-dashboard-theme" onClick={onToggleTheme} aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>{isLight ? '☀' : '☾'}</button>
          <button className="admin-dashboard-logout" onClick={onLogout}>↪ Cerrar sesión</button>
        </div>
      </header>

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
    </section>
  )
}
