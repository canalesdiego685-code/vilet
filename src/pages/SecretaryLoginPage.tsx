import { useState, type FormEvent } from 'react'
import { ViletMark } from '../components/ViletMark'

type Props = {
  isLight: boolean
  onBack: () => void
  onToggleTheme: () => void
}

export function SecretaryLoginPage({ isLight, onBack, onToggleTheme }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('La pantalla está lista. Falta conectar la validación de las cuentas de Secretaría.')
  }

  return (
    <section className="secretary-login-stage" aria-labelledby="secretary-login-title">
      <button
        className="login-theme-toggle"
        onClick={onToggleTheme}
        aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        title="Cambiar tema"
      >
        {isLight ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="secretary-login-card">
        <div className="secretary-login-logo"><ViletMark /></div>
        <p className="secretary-login-kicker">ACCESO A VILET</p>
        <h1 id="secretary-login-title">Bienvenida, Secretaría</h1>
        <p className="secretary-login-description">
          Ingresa para continuar con la operación diaria de Vilet y atender nuestros pedidos.
        </p>

        <form className="secretary-login-form" onSubmit={handleSubmit}>
          <label className="login-field-label" htmlFor="secretary-username">Usuario</label>
          <input
            className="login-input"
            id="secretary-username"
            name="username"
            type="text"
            placeholder="Escribe tu usuario"
            autoComplete="username"
            required
          />

          <label className="login-field-label" htmlFor="secretary-password">Contraseña</label>
          <div className="login-password-wrap">
            <input
              className="login-input"
              id="secretary-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Escribe tu contraseña"
              autoComplete="current-password"
              required
            />
            <button
              className="password-visibility"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <button className="secretary-submit" type="submit">Ingresar</button>
          {notice && <p className="login-notice" role="status">{notice}</p>}
        </form>

        <button className="login-back" onClick={onBack}>← Volver al inicio</button>
      </div>
    </section>
  )
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.7 8.7 0 0 1 8.8 3.5 8.8 8.8 0 1 0 20.5 15.2Z" /></svg>
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
}

function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.2 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.7M6.2 6.3C3.8 7.7 2.5 12 2.5 12s3.3 6 9.5 6c1.2 0 2.3-.2 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
}
