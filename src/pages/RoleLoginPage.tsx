import { useState, type FormEvent  } from 'react'
import { ViletMark  } from '../components/ViletMark'
import { loginViletUser, registerViletAccount  } from '../services/viletApi'
import type { AuthenticatedUser, UserRole  } from '../types'

type Props = {
  role: UserRole
  isLight: boolean
  onBack: () => void
  onToggleTheme: () => void
  onAuthenticated: (user: AuthenticatedUser) => void
  onAccountCreated: (role: UserRole) => void
}

type Notice = { kind: 'success' | 'error'; text: string  }

export function RoleLoginPage({ role, isLight, onBack, onToggleTheme, onAuthenticated, onAccountCreated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [registrationRole, setRegistrationRole] = useState<UserRole>('Secretaría')
  const [showPassword, setShowPassword] = useState(false)
  const [savedUsername, setSavedUsername] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isAdmin = role === 'Encargado'

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setIsSubmitting(true)
    setNotice(null)
    try {
      const user = await loginViletUser(role, String(data.get('usuario') ?? ''), String(data.get('password') ?? ''))
      onAuthenticated(user)
     } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo iniciar sesión.'  })
     } finally {
      setIsSubmitting(false)
     }
   }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const username = String(data.get('usuario') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('confirmarPassword') ?? '')
    if (password !== confirmation) {
      setNotice({ kind: 'error', text: 'Las contraseñas no coinciden.'  })
      return
     }

    setIsSubmitting(true)
    setNotice(null)
    try {
      const result = await registerViletAccount({
        nombre: String(data.get('nombre') ?? '').trim(),
        apellidoPaterno: String(data.get('apellidoPaterno') ?? '').trim(),
        apellidoMaterno: String(data.get('apellidoMaterno') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        usuario: username,
        password,
        role: registrationRole,
       })
      setSavedUsername(username)
      setMode('login')
      setNotice({ kind: 'success', text: result.message  })
      onAccountCreated(result.role)
     } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo crear la cuenta.'  })
     } finally {
      setIsSubmitting(false)
     }
   }

  const heading = mode === 'register'
    ? `Crear cuenta de ${registrationRole === 'Secretaría' ? 'Secretaría' : 'Encargado' }`
    : isAdmin ? 'Bienvenid@ Administrador' : 'Bienvenid@ Secretaría'
  const description = mode === 'register'
    ? 'Registra los datos de acceso para una cuenta de Vilet.'
    : isAdmin
      ? 'Panel administrativo para gestionar el sistema Vilet y sus procesos.'
      : 'Ingresa para continuar con la operación diaria de Vilet y atender nuestros pedidos.'

  return (
    <section className={`secretary-login-stage ${isAdmin ? 'admin-login-stage' : '' }` } aria-labelledby="role-login-title">
      <button className="login-theme-toggle" onClick={onToggleTheme } aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro' } title="Cambiar tema">
        {isLight ? <SunIcon /> : <MoonIcon /> }
      </button>

      <div className={`secretary-login-card ${isAdmin ? 'admin-login-card' : '' }` }>
        <div className="secretary-login-logo"><ViletMark /></div>
        <p className="secretary-login-kicker">{mode === 'register' ? 'CREAR USUARIO' : 'ACCESO A VILET' }</p>
        <h1 id="role-login-title">{heading }</h1>
        <p className="secretary-login-description">{description }</p>

        <form className={`secretary-login-form ${mode === 'register' ? 'registration-form' : '' }` } onSubmit={mode === 'register' ? handleRegistration : handleLogin }>
          {mode === 'register' && <>
            <label className="login-field-label" htmlFor="account-role">Rol de la cuenta</label>
            <select className="login-input login-role-select" id="account-role" value={registrationRole } onChange={(event) => setRegistrationRole(event.target.value as UserRole) }>
              <option value="Secretaría">Secretaría</option>
              <option value="Encargado">Encargado / Administrador</option>
            </select>
            <label className="login-field-label" htmlFor="admin-name">Nombre</label>
            <input className="login-input" id="admin-name" name="nombre" type="text" placeholder="Tu nombre" autoComplete="given-name" required />
            <div className="registration-name-row">
              <div>
                <label className="login-field-label" htmlFor="admin-lastname">Apellido paterno</label>
                <input className="login-input" id="admin-lastname" name="apellidoPaterno" type="text" placeholder="Paterno" autoComplete="family-name" required />
              </div>
              <div>
                <label className="login-field-label" htmlFor="admin-second-lastname">Apellido materno</label>
                <input className="login-input" id="admin-second-lastname" name="apellidoMaterno" type="text" placeholder="Materno" required />
              </div>
            </div>
            <label className="login-field-label" htmlFor="admin-email">Correo electrónico</label>
            <input className="login-input" id="admin-email" name="email" type="email" placeholder="tu@correo.com" autoComplete="email" required />
          </> }

          <label className="login-field-label" htmlFor="role-username">Usuario</label>
          <input className="login-input" id="role-username" name="usuario" type="text" placeholder="Escribe tu usuario" autoComplete="username" defaultValue={mode === 'login' ? savedUsername : undefined } required />

          <label className="login-field-label" htmlFor="role-password">Contraseña</label>
          <div className="login-password-wrap">
            <input className="login-input" id="role-password" name="password" type={showPassword ? 'text' : 'password' } placeholder={mode === 'register' ? 'Crea una contraseña (mínimo 8)' : 'Escribe tu contraseña' } autoComplete={mode === 'register' ? 'new-password' : 'current-password' } minLength={mode === 'register' ? 8 : undefined } required />
            <button className="password-visibility" type="button" onClick={() => setShowPassword((value) => !value) } aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña' } title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña' }>
              {showPassword ? <EyeOffIcon /> : <EyeIcon /> }
            </button>
          </div>

          {mode === 'register' && <>
            <label className="login-field-label" htmlFor="admin-confirm-password">Confirmar contraseña</label>
            <input className="login-input" id="admin-confirm-password" name="confirmarPassword" type="password" placeholder="Repite tu contraseña" autoComplete="new-password" minLength={8 } required />
          </> }

          <button className="secretary-submit" type="submit" disabled={isSubmitting }>
            {isSubmitting ? 'Un momento…' : mode === 'register' ? 'Crear cuenta' : 'Ingresar' }
          </button>
          {notice && <p className={`login-notice login-notice-${notice.kind }` } role="status">{notice.text }</p> }
        </form>


        <div className="login-alternate-actions">
          <button className="login-back" onClick={onBack }>← Volver</button>
        </div>
      </div>
    </section>
  )
 }

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.7 8.7 0 0 1 8.8 3.5 8.8 8.8 0 1 0 20.5 15.2Z" /></svg>
 }
function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l-1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
 }
function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
 }
function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.2 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.7M6.2 6.3C3.8 7.7 2.5 12 2.5 12s3.3 6 9.5 6c1.2 0 2.3-.2 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
 }



