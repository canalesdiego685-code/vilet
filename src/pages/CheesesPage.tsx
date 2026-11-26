import type { CatalogState, Product, ProductUnit } from '../types'

type Props = { products: Product[]; state: CatalogState; errorMessage: string }

const unitLabel: Record<ProductUnit, string> = {
  KG: 'Disponible por kilogramo',
  PZA: 'Disponible por pieza',
  AMBOS: 'Disponible por kilogramo y pieza',
}

export function CheesesPage({ products, state, errorMessage }: Props) {
  return (
    <section className="inner-page cheeses-page" aria-labelledby="cheeses-title">
      <div className="section-kicker"><span className="kicker-line" /> SABORES VILET <span className="kicker-line" /></div>
      <h1 id="cheeses-title">Nuestros <em>quesos</em></h1>
      <p className="section-lead">Explora las variedades que forman parte del catálogo de Vilet.</p>

      {state === 'loading' && <div className="catalog-message"><span className="loading-ring" /> Cargando el catálogo de Vilet…</div>}
      {state === 'error' && <div className="catalog-message catalog-message-error"><span>!</span>{errorMessage}</div>}
      {state === 'ready' && products.length === 0 && <div className="catalog-message">Aún no hay productos registrados en el catálogo.</div>}
      {state === 'ready' && products.length > 0 && (
        <>
          <div className="catalog-heading"><span>VARIEDADES REGISTRADAS</span><b>{String(products.length).padStart(2, '0')} <small>productos</small></b></div>
          <div className="product-grid">
            {products.map((product, index) => (
              <article className="product-card" key={product.id_producto}>
                <div className={`product-art product-art-${index % 4}`} aria-hidden="true"><CheeseIcon /></div>
                <div className="product-card-copy">
                  <span className="product-kicker">QUESO VILET <i>·</i> {String(index + 1).padStart(2, '0')}</span>
                  <h2>{product.nombre}</h2>
                  <p><span className="unit-dot" />{unitLabel[product.unidad] ?? 'Presentación registrada en Vilet'}</p>
                </div>
                <span className="product-card-corner" aria-hidden="true">✦</span>
              </article>
            ))}
          </div>
        </>
      )}
      <p className="catalog-footnote">Variedades y presentaciones consultadas directamente del catálogo de productos de Vilet.</p>
    </section>
  )
}

function CheeseIcon() {
  return <svg viewBox="0 0 120 92" fill="none"><path d="m13 29 66-19 29 16-2 45-68 15-25-15V29Z" fill="currentColor" opacity=".18"/><path d="m13 29 66-19 29 16-2 45-68 15-25-15V29Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="m13 29 25 15 68-18M38 44v42" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><circle cx="66" cy="26" r="5" fill="currentColor"/><circle cx="85" cy="51" r="4" fill="currentColor"/><circle cx="25" cy="58" r="4" fill="currentColor"/><circle cx="56" cy="67" r="4" fill="currentColor"/></svg>
}
