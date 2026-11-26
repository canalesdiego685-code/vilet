import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addEmployee, deactivateEmployee, fetchAttendance, fetchEmployees, saveAttendance } from '../services/viletApi'
import type { AttendanceCode, ViletEmployee } from '../types'

type Props = { onBack: () => void; roleLabel?: string }

const labels: Record<AttendanceCode, string> = { '': 'Sin captura', V: 'Asistió', R: 'Retardo', F: 'Falta', P: 'Permiso' }
function localDateString(date: Date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}
function weekStart(selected: string) {
  const date = new Date(selected + 'T12:00:00')
  date.setDate(date.getDate() - date.getDay())
  return date
}

export function AttendancePage({ onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => localDateString(new Date()))
  const [employees, setEmployees] = useState<ViletEmployee[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const start = weekStart(selectedDate)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { iso: localDateString(date), date, weekday: date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase() }
  })
  const end = days[6].iso

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [people, rows] = await Promise.all([fetchEmployees(), fetchAttendance(days[0].iso, end)])
      setEmployees(people)
      const map: Record<string, string> = {}
      for (const row of rows) map[row.empleado_id + ':' + row.fecha.slice(0, 10)] = row.estado ?? ''
      setAttendance(map)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar la semana de asistencias.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [selectedDate])

  const totals = useMemo(() => {
    let late = 0
    let absent = 0
    for (const value of Object.values(attendance)) {
      if (value === 'R') late += 1
      if (value === 'F') absent += 1
    }
    return { late, absent, captured: Object.values(attendance).filter(Boolean).length }
  }, [attendance])

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await addEmployee(name)
      setNotice(result.message)
      setNewName('')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo agregar el empleado.')
    } finally { setSaving(false) }
  }

  async function changeStatus(employeeId: number, date: string, state: AttendanceCode) {
    const key = employeeId + ':' + date
    const previous = attendance[key] ?? ''
    setAttendance((current) => ({ ...current, [key]: state }))
    setBusyKey(key)
    setError('')
    try {
      await saveAttendance({ empleado_id: employeeId, fecha: date, estado: state })
    } catch (reason) {
      setAttendance((current) => ({ ...current, [key]: previous }))
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la asistencia.')
    } finally { setBusyKey('') }
  }

  async function removeEmployee(person: ViletEmployee) {
    if (!window.confirm('¿Quitar a ' + person.nombre + ' de la lista activa? Su historial se conservará.')) return
    setError('')
    try {
      await deactivateEmployee(person.id)
      setNotice('Empleado quitado de la lista activa.')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo quitar al empleado.')
    }
  }

  return (
    <section className="attendance-screen" aria-label="Control de asistencias">
      <header className="attendance-toolbar"><div><span className="attendance-title-icon">▦</span><div><span className="attendance-kicker">VILET · {roleLabel}</span><h1>Control de Asistencias</h1></div></div><button onClick={onBack}>← Regresar</button></header>
      <div className="attendance-week-filter"><label>Ver semana de:<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><span>{days[0].date.toLocaleDateString('es-MX',{day:'2-digit',month:'short'})} — {days[6].date.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
      <form className="attendance-add-form" onSubmit={createEmployee}><label className="visually-hidden" htmlFor="attendance-new-name">Nombre del empleado</label><input id="attendance-new-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={150} placeholder="Nombre del empleado" required /><button type="submit" disabled={saving}>{saving ? 'Agregando…' : '+ Agregar empleado'}</button><div className="attendance-legend"><span><i className="legend-present" />Asistió</span><span><i className="legend-late" />Retardo</span><span><i className="legend-absent" />Falta</span><span><i className="legend-permission" />Permiso</span></div></form>
      {error && <p className="attendance-alert attendance-error" role="alert">{error}</p>}
      {notice && <p className="attendance-alert attendance-success" role="status">{notice}</p>}
            <section className="attendance-overview" aria-label="Resumen de la semana"><article className="attendance-metric attendance-metric-people"><span>PERSONAL ACTIVO</span><strong>{employees.length}</strong><small>Empleados en la lista</small></article><article className="attendance-metric attendance-metric-late"><span>RETARDOS</span><strong>{totals.late}</strong><small>Esta semana</small></article><article className="attendance-metric attendance-metric-absent"><span>FALTAS</span><strong>{totals.absent}</strong><small>Esta semana</small></article><article className="attendance-metric attendance-metric-captured"><span>REGISTROS CAPTURADOS</span><strong>{totals.captured}</strong><small>De {employees.length * 7} días posibles</small></article></section>      <section className="attendance-table-card"><div className="attendance-table-heading"><div><span>CONTROL SEMANAL</span><h2>Asistencia por empleado</h2></div><p>{employees.length} empleados <b>·</b> 7 días</p></div><div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th className="attendance-number-head">#</th><th className="attendance-employee-head">EMPLEADO</th><th className="attendance-late-head">RETARDOS</th><th className="attendance-absent-head">FALTAS</th>{days.map((day) => <th className={'attendance-day-head attendance-day-' + (day.date.getDay() % 7)} key={day.iso}><span>{day.weekday}</span><b>{day.date.getDate()}</b></th>)}<th className="attendance-action-head">ACCIÓN</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={12} className="attendance-empty">Cargando empleados y semana…</td></tr> : employees.length === 0 ? <tr><td colSpan={12} className="attendance-empty">No hay empleados activos. Agrégalos en el formulario de arriba.</td></tr> : employees.map((person, index) => {
            const personStatuses = days.map((day) => attendance[person.id + ':' + day.iso] ?? '')
            const late = personStatuses.filter((value) => value === 'R').length
            const absent = personStatuses.filter((value) => value === 'F').length
            return <tr key={person.id}><td className="attendance-row-number">{index + 1}</td><td className="attendance-employee-name">{person.nombre}</td><td className="attendance-late-cell">{late}</td><td className="attendance-absent-cell">{absent}</td>{days.map((day) => { const key = person.id + ':' + day.iso; const value = (attendance[key] ?? '') as AttendanceCode; return <td className="attendance-day-cell" key={day.iso}><select title={labels[value]} aria-label={person.nombre + ' · ' + day.iso} className={'attendance-select attendance-value-' + (value || 'empty').toLowerCase()} value={value} onChange={(event) => void changeStatus(person.id, day.iso, event.target.value as AttendanceCode)} disabled={busyKey === key}><option value="">—</option><option value="V">✓</option><option value="R">R</option><option value="F">F</option><option value="P">P</option></select></td>})}<td className="attendance-action-cell"><button className="attendance-delete" onClick={() => void removeEmployee(person)} aria-label={'Quitar ' + person.nombre}>⌫</button></td></tr>
          })}</tbody></table></div></section>
    </section>
  )
}