import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fetchPerformanceFileUrl, fetchPerformanceSheets, uploadPerformanceSheet, deletePerformanceSheet } from '../services/viletApi'
import type { PerformanceSheet } from '../types'

type Props = { canManage: boolean; onBack: () => void; roleLabel?: string }
type PerformancePreview = { item: PerformanceSheet; url: string }

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}
function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      if (comma < 0) reject(new Error('No se pudo leer el archivo.'))
      else resolve(result.slice(comma + 1))
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}
function isImage(sheet: PerformanceSheet) { return sheet.mimeType.startsWith('image/') }

export function PerformancePage({ canManage, onBack, roleLabel = 'SECRETARÍA' }: Props) {
  const [items, setItems] = useState<PerformanceSheet[]>([])
  const [area, setArea] = useState('OAXACA')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PerformancePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [brokenImages, setBrokenImages] = useState<string[]>([])
  const [storage, setStorage] = useState('MongoDB Atlas')
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const fileUrlsRef = useRef<Record<string, string>>({})
  const refreshSequence = useRef(0)

  async function refresh() {
    const sequence = ++refreshSequence.current
    setLoading(true)
    try {
      const result = await fetchPerformanceSheets()
      if (sequence !== refreshSequence.current) return
      setItems(result.items)
      setStorage(result.storage)
      setPreview(null)

      const loadedFiles = await Promise.allSettled(result.items.map(async (item) => [item.id, await fetchPerformanceFileUrl(item.id)] as const))
      if (sequence !== refreshSequence.current) {
        for (const fileResult of loadedFiles) {
          if (fileResult.status === 'fulfilled') URL.revokeObjectURL(fileResult.value[1])
        }
        return
      }

      const nextUrls: Record<string, string> = {}
      for (const fileResult of loadedFiles) {
        if (fileResult.status === 'fulfilled') nextUrls[fileResult.value[0]] = fileResult.value[1]
      }
      for (const url of Object.values(fileUrlsRef.current)) URL.revokeObjectURL(url)
      fileUrlsRef.current = nextUrls
      setFileUrls(nextUrls)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las hojas.') }
    finally {
      if (sequence === refreshSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    return () => {
      refreshSequence.current += 1
      for (const url of Object.values(fileUrlsRef.current)) URL.revokeObjectURL(url)
      fileUrlsRef.current = {}
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!file) { setError('Selecciona una imagen o un PDF para subir.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('El archivo supera el límite de 3 MB permitido por el alojamiento web.'); return }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const dataBase64 = await readFileBase64(file)
      const result = await uploadPerformanceSheet({
        area,
        descripcion: description.trim(),
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      })
      setNotice(result.message)
      setDescription('')
      setFile(null)
      form.reset()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo subir la hoja.')
    } finally { setSaving(false) }
  }

  async function remove(item: PerformanceSheet) {
    if (!window.confirm('¿Eliminar la hoja de rendimiento de ' + item.area + '?')) return
    setBusyId(item.id)
    setError('')
    try {
      const result = await deletePerformanceSheet(item.id)
      setNotice(result.message)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la hoja.')
    } finally { setBusyId(null) }
  }

  function openPreview(item: PerformanceSheet) {
    const url = fileUrls[item.id]
    if (url) setPreview({ item, url })
  }

  return (
    <section className="performance-screen" aria-label="Hojas de rendimiento">
      <header className="performance-toolbar">
        <div><span className="performance-icon">▥</span><div><span className="performance-kicker">VILET · {roleLabel}</span><h1>Hojas de Rendimiento</h1></div></div>
        <button className="performance-back" onClick={onBack}>← Regresar</button>
      </header>

      {canManage ? <>
        <form className="performance-upload-card" onSubmit={submit}>
          <label>Área<select value={area} onChange={(event) => setArea(event.target.value)}><option value="OAXACA">Oaxaca</option><option value="PANELA">Panela</option><option value="GENERAL">General</option></select></label>
          <label className="performance-description">Descripción<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Describe la hoja de rendimiento…" /></label>
          <label className="performance-file-label">Seleccionar archivo<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} /><span>{file ? file.name : 'Sin archivo seleccionado'}</span></label>
          <button className="performance-upload-button" type="submit" disabled={saving}>{saving ? 'Subiendo…' : 'Subir archivo'}</button>
        </form>
        <p className="performance-upload-hint">Puedes subir una fotografía o PDF de hasta 3 MB. Los archivos se guardan en {storage}.</p>
      </> : <p className="performance-readonly-note">Administración puede consultar y visualizar las hojas. La subida y eliminación están reservadas para Secretaría.</p>}

      {error && <p className="performance-alert performance-alert-error" role="alert">{error}</p>}
      {notice && <p className="performance-alert performance-alert-success" role="status">{notice}</p>}

      <section className="performance-table-card">
        <div className="performance-list-heading"><div><span className="performance-kicker">ARCHIVO DE PRODUCCIÓN</span><h2>Rendimientos guardados</h2></div><button onClick={() => void refresh()} disabled={loading}>↻ Actualizar</button></div>
        <div className="performance-table-wrap"><table className="performance-table">
          <thead><tr><th>ÁREA</th><th>DESCRIPCIÓN</th><th>FECHA</th><th>ARCHIVO</th>{canManage && <th>ELIMINAR</th>}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={canManage ? 5 : 4} className="performance-empty">Cargando hojas…</td></tr> : items.length === 0 ? <tr><td colSpan={canManage ? 5 : 4} className="performance-empty">{canManage ? 'Aún no hay hojas. Sube la primera desde el formulario.' : 'Aún no hay hojas de rendimiento guardadas.'}</td></tr> : items.map((item) => {
              const url = fileUrls[item.id]
              const imageFailed = brokenImages.includes(item.id)
              return <tr key={item.id}>
                <td><span className="performance-area-chip">{item.area}</span></td>
                <td>{item.descripcion || 'Hoja de rendimiento'}</td>
                <td>{displayDate(item.fecha)}</td>
                <td>{isImage(item)
                  ? url && !imageFailed ? <button className="performance-file-preview" onClick={() => openPreview(item)} title="Ampliar imagen"><img src={url} alt={'Hoja de ' + item.area} onError={() => setBrokenImages((ids) => [...ids, item.id])} /></button> : <span className="performance-pdf-link">Archivo no disponible</span>
                  : url ? <a className="performance-pdf-link" href={url} target="_blank" rel="noreferrer">Abrir PDF ↗</a> : <span className="performance-pdf-link">Archivo no disponible</span>}</td>
                {canManage && <td><button className="performance-delete" onClick={() => void remove(item)} disabled={busyId === item.id} aria-label="Eliminar hoja">{busyId === item.id ? '…' : '⌫'}</button></td>}
              </tr>
            })}
          </tbody>
        </table></div>
      </section>

      {preview && <div className="performance-preview-backdrop" onClick={() => setPreview(null)}><section className="performance-preview-dialog" role="dialog" aria-modal="true" aria-label="Vista previa del rendimiento" onClick={(event) => event.stopPropagation()}><button onClick={() => setPreview(null)} aria-label="Cerrar">×</button><img src={preview.url} alt={preview.item.descripcion || 'Hoja de rendimiento'} /><p>{preview.item.area} · {preview.item.descripcion}</p></section></div>}
    </section>
  )
}
