import type { ConnectionState, PageKey } from '../types'
import { ViletMark } from './ViletMark'

type Props = {
  activePage: PageKey
  connectionState: ConnectionState
  isLight: boolean
  onNavigate: (page: PageKey) => void
  onToggleTheme: () => void
}

const links: { id: PageKey; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'quienes', label: 'Quiénes somos' },
  { id: 'quesos', label: 'Tipos de queso' },
]

export function SiteHeader({ activePage, connectionState, isLight, onNavigate, onToggleTheme }: Props) {
  const statusLabel = connectionState === 'connected'
    ? 'Catálogo conectado'
    : connectionState === 'checking'
      ? 'Conectando catálogo'
      : 'Catálogo sin conexión'

  return (
    <header className="site-header">
      <button className="brand-lockup" onClick={() => onNavigate('inicio')} aria-label="Vilet, ir al inicio">
        <ViletMark small />
        <span className="brand-word">VILET</span>
      </button>

      <nav className="main-nav" aria-label="Navegación principal">
        {links.map((link) => (
          <button
            key={link.id}
            className={`nav-link ${activePage === link.id ? 'nav-link-active' : ''}`}
            onClick={() => onNavigate(link.id)}
            aria-current={activePage === link.id ? 'page' : undefined}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <span className={`connection-pill connection-${connectionState}`} title={statusLabel}>
          <i />
          <span>{statusLabel}</span>
        </span>
        <button className="theme-toggle" onClick={onToggleTheme} aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'} title="Cambiar tema">
          {isLight ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  )
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.7 8.7 0 0 1 8.8 3.5 8.8 8.8 0 1 0 20.5 15.2Z" /></svg>
}
