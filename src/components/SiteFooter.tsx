import type { PageKey } from '../types'

export function SiteFooter({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return (
    <footer className="site-footer">
      <span>VILET <i>·</i> Calidad desde 1997</span>
      <div className="footer-links">
        <button onClick={() => onNavigate('quienes')}>Nuestra historia</button>
        <button onClick={() => onNavigate('quesos')}>Nuestros quesos</button>
      </div>
    </footer>
  )
}
