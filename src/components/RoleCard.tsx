import type { UserRole } from '../types'

type Props = { role: UserRole; subtitle: string; onClick: () => void }

export function RoleCard({ role, subtitle, onClick }: Props) {
  return (
    <button className="role-card" onClick={onClick}>
      <span className="role-icon" aria-hidden="true">{role === 'Encargado' ? <ManagerIcon /> : <SecretaryIcon />}</span>
      <span className="role-name">{role}</span>
      <span className="role-subtitle">{subtitle}</span>
      <span className="role-arrow" aria-hidden="true">↗</span>
    </button>
  )
}

function ManagerIcon() {
  return <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19v-1.4c0-2.1 1.7-3.8 3.8-3.8h3.4c2.1 0 3.8 1.7 3.8 3.8V19M18 6.5v6m-3-3h6" /></svg>
}

function SecretaryIcon() {
  return <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1.5M9 11h6m-6 4h6" /></svg>
}
