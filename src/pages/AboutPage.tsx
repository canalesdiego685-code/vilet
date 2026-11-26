export function AboutPage() {
  return (
    <section className="inner-page about-page" aria-labelledby="about-title">
      <div className="section-kicker"><span className="kicker-line" /> CONOCE VILET <span className="kicker-line" /></div>
      <h1 id="about-title">Una historia hecha con <em>calidad</em></h1>
      <p className="section-lead">
        Desde 1997 nos encontramos comprometidos con la calidad de nuestros productos,
        buscando que siempre estés listo para la receta perfecta.
      </p>

      <div className="about-layout">
        <article className="about-story-card">
          <div className="story-number">01 <span>— NUESTRA ESENCIA</span></div>
          <h2>El sabor que acompaña tu mesa</h2>
          <p>
            En Vilet creemos que un buen queso convierte cada receta en un momento para compartir.
            Por eso, nuestra historia se cuenta a través de productos preparados con dedicación y
            un compromiso constante con la calidad.
          </p>
          <button className="gold-link" onClick={() => document.getElementById('about-values')?.scrollIntoView({ behavior: 'smooth' })}>
            Lo que nos guía <span>↓</span>
          </button>
        </article>
        <div className="about-side-cards" id="about-values">
          <article className="value-card value-card-gold">
            <span className="value-icon">✳</span>
            <div><span className="value-label">DESDE 1997</span><h3>Una historia con raíces</h3><p>Un compromiso que vive en cada producto de Vilet.</p></div>
          </article>
          <article className="value-card value-card-blue">
            <span className="value-icon">◇</span>
            <div><span className="value-label">NUESTRO COMPROMISO</span><h3>Calidad para tu receta</h3><p>Productos pensados para acompañar tus mejores momentos.</p></div>
          </article>
        </div>
      </div>
    </section>
  )
}
