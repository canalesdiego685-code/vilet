export function ViletMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`vilet-mark ${small ? 'vilet-mark-small' : ''}`} aria-hidden="true">
      <img src="/vilet-logo.png" alt="" />
    </span>
  )
}
