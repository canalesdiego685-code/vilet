import type { UserRole } from '../types'
import { RoleCard } from '../components/RoleCard'
import { ViletMark } from '../components/ViletMark'

type Props = {
  productCount: number
  catalogReady: boolean
  onNavigate: (page: 'quienes' | 'quesos') => void
  onChooseRole: (role: UserRole) => void
}

export function HomePage({ productCount, catalogReady, onNavigate, onChooseRole }: Props) {
  return (
    <section className="home-stage" aria-labelledby="home-title">
      <div className="cheese-scene" aria-hidden="true">
        <div className="cheese-wheel wheel-left"><span /></div>
        <div className="cheese-wheel wheel-right"><span /></div>
        <div className="cheese-wheel wheel-back"><span /></div>
      </div>

      <article className="home-card">
        <div className="home-mark-wrap"><ViletMark /></div>
        <span className="home-overline">EL SABOR DE NUESTRA CASA</span>
        <h1 id="home-title">VILET</h1>
        <div className="gold-divider"><span /></div>
        <p className="home-description">
          Desde 1997 nos encontramos comprometidos con la calidad de nuestros productos,
          buscando que siempre estés listo para la receta perfecta.
        </p>

        <div className="catalog-summary" aria-live="polite">
          <span className="catalog-summary-icon">✦</span>
          <span>{catalogReady ? `${productCount} productos en nuestro catálogo` : 'Conoce nuestros productos Vilet'}</span>
        </div>

        <div className="role-grid" aria-label="Accesos al sistema">
          <RoleCard role="Encargado" subtitle="Administración total" onClick={() => onChooseRole('Encargado')} />
          <RoleCard role="Secretaría" subtitle="Operación diaria" onClick={() => onChooseRole('Secretaría')} />
        </div>

        <div className="home-discover-links">
          <button onClick={() => onNavigate('quienes')}>Conoce Vilet <span>→</span></button>
          <button onClick={() => onNavigate('quesos')}>Nuestros quesos <span>→</span></button>
        </div>
      </article>
      <div className="home-caption"><span /> Una tradición para compartir <span /></div>
    </section>
  )
}
