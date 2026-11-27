import { useEffect, useState, type ReactNode } from 'react'
import { ProfilePhotoControl } from '../components/ProfilePhotoControl'
import { ViletMark } from '../components/ViletMark'
import { fetchNotices } from '../services/viletApi'
import type { AuthenticatedUser } from '../types'

type Props = {
  user: AuthenticatedUser
  isLight: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onOpenInventory: () => void
  onOpenHistory: () => void
  onOpenRawMaterials: () => void
  onOpenReports: () => void
  onOpenNotices: () => void
  onOpenClients: () => void
  onOpenPerformance: () => void
  onOpenAttendance: () => void
}
type Module = { title: string; description: string; icon: ReactNode }

export function SecretaryDashboardPage({ user, isLight, onToggleTheme, onLogout, onOpenInventory, onOpenHistory, onOpenRawMaterials, onOpenReports, onOpenNotices, onOpenClients, onOpenPerformance, onOpenAttendance }: Props) {
  const [unreadNotices, setUnreadNotices] = useState(0)
  const [activeModule, setActiveModule] = useState<Module | null>(null)

  useEffect(() => {
    let active = true
    const loadUnread = async () => {
      try {
        const notices = await fetchNotices()
        if (active) setUnreadNotices(notices.filter((notice) => notice.estado !== 'leido').length)
      } catch { /* Se conserva disponible el panel si MySQL no responde. */ }
    }
    void loadUnread()
    const interval = window.setInterval(() => void loadUnread(), 20000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  const modules: Module[] = [
    { title: 'Inventario', description: 'Control de productos', icon: <InventoryIcon /> },
    { title: 'Historial', description: 'Entradas y salidas', icon: <HistoryIcon /> },
    { title: 'Materia Prima', description: 'Entradas y salidas', icon: <RawMaterialIcon /> },
    { title: 'Reportes', description: 'Estadísticas', icon: <ReportsIcon /> },
    { title: 'Avisos', description: 'Alertas y mensajes', icon: <NoticeIcon /> },
    { title: 'Clientes', description: 'Administración', icon: <ClientsIcon /> },
    { title: 'Rendimiento', description: 'Seguimiento', icon: <PerformanceIcon /> },
    { title: 'Asistencias', description: 'Control del personal', icon: <AttendanceIcon /> },
  ]

  function openModule(module: Module) {
    if (module.title === 'Inventario') onOpenInventory()
    else if (module.title === 'Historial') onOpenHistory()
    else if (module.title === 'Materia Prima') onOpenRawMaterials()
    else if (module.title === 'Reportes') onOpenReports()
    else if (module.title === 'Avisos') onOpenNotices()
    else if (module.title === 'Clientes') onOpenClients()
    else if (module.title === 'Rendimiento') onOpenPerformance()
    else if (module.title === 'Asistencias') onOpenAttendance()
    else setActiveModule(module)
  }

  return (
    <section className="secretary-dashboard" aria-label="Panel de Secretaría">
      <header className="secretary-toolbar">
        <div className="secretary-dashboard-brand"><ViletMark small /><span>VILET</span></div>
        <div className="secretary-toolbar-actions">
          <button className="dashboard-icon-button notification-button" onClick={onOpenNotices} aria-label={'Ver avisos: ' + unreadNotices + ' sin leer'}>
            <NoticeIcon />{unreadNotices > 0 && <span className="notification-badge" aria-hidden="true">{unreadNotices > 9 ? '9+' : unreadNotices}</span>}
          </button>
          <ProfilePhotoControl user={user} variant="secretary" />
          <button className="dashboard-theme-button" onClick={onToggleTheme} aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
            {isLight ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="dashboard-logout" onClick={onLogout}><LogoutIcon /><span>Cerrar sesión</span></button>
        </div>
      </header>

      <div className="secretary-module-grid">
        {modules.map((module, index) => (
          <button key={module.title} className={`secretary-module-card module-card-${index + 1}`} onClick={() => openModule(module)}>
            <span className="module-icon">{module.icon}</span>
            <strong>{module.title}</strong>
            <span>{module.description}</span>
          </button>
        ))}
      </div>

      {activeModule && (
        <div className="module-dialog-backdrop" onClick={() => setActiveModule(null)}>
          <section className="module-dialog" role="dialog" aria-modal="true" aria-labelledby="module-dialog-title" onClick={(event) => event.stopPropagation()}>
            <button className="module-dialog-close" onClick={() => setActiveModule(null)} aria-label="Cerrar">×</button>
            <span className="module-icon">{activeModule.icon}</span>
            <h2 id="module-dialog-title">{activeModule.title}</h2>
            <p>Esta sección está preparada para conectar sus funciones y datos.</p>
            <button className="secretary-submit" onClick={() => setActiveModule(null)}>Entendido</button>
          </section>
        </div>
      )}
    </section>
  )
}

function InventoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v9M8 5.2l8 4.6" /></svg>
}
function HistoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7" /><path d="M12 7v5l3 2" /></svg>
}
function RawMaterialIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 12 3l9 3.5v11L12 21l-9-3.5z" /><path d="m3 7 9 3.5L21 7M12 10.5V21m-5-15 9 3.5" /></svg>
}
function ReportsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h17M7 15l4-4 3 2 6-7" /><path d="M16 6h4v4" /></svg>
}
function NoticeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
}
function ClientsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1m1-5a4 4 0 0 1 5 4v1" /></svg>
}
function PerformanceIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h17" /><path d="M7 15a5 5 0 0 0 5-5V6a5 5 0 0 1 5-5m-6 14a5 5 0 0 0 5-5V9a5 5 0 0 1 5-5" /></svg>
}
function AttendanceIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 20v-1.5a6 6 0 0 1 12 0V20m2-7 2 2 4-5" /></svg>
}
function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.7 8.7 0 0 1 8.8 3.5 8.8 8.8 0 1 0 20.5 15.2Z" /></svg>
}
function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l-1.42-1.42m11.3-11.3-1.42-1.42" /></svg>
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m8-9h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-9" /></svg>
}
