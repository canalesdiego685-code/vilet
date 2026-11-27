import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { deleteProfilePhoto, fetchProfilePhoto, saveProfilePhoto } from '../services/viletApi'
import type { AuthenticatedUser } from '../types'

type Props = { user: AuthenticatedUser; variant: 'secretary' | 'admin' }
const maxPhotoBytes = 1_500_000

function initialsFor(user: AuthenticatedUser) {
  return user.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    || user.username.slice(0, 1).toUpperCase()
}

function parsePhotoData(data: string) {
  const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  return match ? { mimeType: match[1], dataBase64: match[2] } : null
}

export function ProfilePhotoControl({ user, variant }: Props) {
  const inputId = useId()
  const legacyKey = 'vilet-profile-photo-' + user.id
  const [photo, setPhoto] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const initials = initialsFor(user)

  useEffect(() => {
    let active = true

    function readLegacyPhoto() {
      try { return window.localStorage.getItem(legacyKey) ?? '' } catch { return '' }
    }

    function removeLegacyPhoto() {
      try { window.localStorage.removeItem(legacyKey) } catch { /* La copia local es opcional. */ }
    }

    async function loadPhoto() {
      const legacyPhoto = readLegacyPhoto()
      try {
        const result = await fetchProfilePhoto()
        if (!active) return
        if (result.photo) {
          setPhoto(result.photo)
          removeLegacyPhoto()
        } else if (legacyPhoto) {
          const parsed = parsePhotoData(legacyPhoto)
          if (!parsed) {
            setPhoto(legacyPhoto)
            setNotice('La foto anterior no se pudo sincronizar con MongoDB.')
          } else {
            const saved = await saveProfilePhoto({
              fileName: 'foto-perfil.' + (parsed.mimeType === 'image/jpeg' ? 'jpg' : parsed.mimeType === 'image/png' ? 'png' : 'webp'),
              mimeType: parsed.mimeType,
              dataBase64: parsed.dataBase64,
            })
            if (!active) return
            setPhoto(saved.photo ?? legacyPhoto)
            removeLegacyPhoto()
            setNotice('Foto anterior sincronizada con MongoDB Atlas.')
          }
        }
      } catch (reason) {
        if (!active) return
        if (legacyPhoto) {
          setPhoto(legacyPhoto)
          setNotice('Foto anterior conservada. No se pudo sincronizar con MongoDB.')
        } else {
          setNotice(reason instanceof Error ? reason.message : 'No se pudo consultar la foto en MongoDB.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPhoto()
    return () => { active = false }
  }, [legacyKey])

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setNotice('Selecciona una imagen JPG, PNG o WEBP.')
      input.value = ''
      return
    }
    if (file.size > maxPhotoBytes) {
      setNotice('La foto debe pesar hasta 1.5 MB.')
      input.value = ''
      return
    }

    setSaving(true)
    setNotice('')
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(new Error('No se pudo abrir esta foto.'))
        reader.readAsDataURL(file)
      })
      const parsed = parsePhotoData(data)
      if (!parsed) throw new Error('La imagen no tiene un formato válido.')
      const saved = await saveProfilePhoto({ fileName: file.name, mimeType: parsed.mimeType, dataBase64: parsed.dataBase64 })
      setPhoto(saved.photo ?? data)
      try { window.localStorage.removeItem(legacyKey) } catch { /* La copia local es opcional. */ }
      setNotice('Foto de perfil guardada en MongoDB Atlas.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'No se pudo guardar la foto.')
    } finally {
      setSaving(false)
      input.value = ''
    }
  }

  async function removePhoto() {
    setSaving(true)
    setNotice('')
    try {
      await deleteProfilePhoto()
      setPhoto('')
      setShowPreview(false)
      try { window.localStorage.removeItem(legacyKey) } catch { /* La copia local es opcional. */ }
      setNotice('Foto de perfil eliminada de MongoDB Atlas.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'No se pudo eliminar la foto.')
    } finally {
      setSaving(false)
    }
  }

  const avatar = photo ? <img src={photo} alt="" /> : <span>{initials}</span>
  const controls = (
    <>
      {variant === 'secretary' ? (
        <div className="dashboard-user dashboard-profile">
          <button className="dashboard-avatar-trigger" onClick={() => setShowPreview(true)} aria-label="Ampliar foto de perfil" title="Ver foto de perfil" disabled={loading}>
            <span className="dashboard-avatar">{avatar}</span>
          </button>
          <div className="profile-photo-controls" aria-label="Controles de foto de perfil">
            <label className="profile-action profile-add" htmlFor={inputId} title="Agregar foto de perfil" aria-label="Agregar foto de perfil"><AddPhotoIcon /></label>
            <button className="profile-action profile-delete" onClick={() => void removePhoto()} disabled={!photo || saving} title="Eliminar foto de perfil" aria-label="Eliminar foto de perfil"><TrashIcon /></button>
          </div>
          <input className="profile-photo-input" id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} aria-label="Seleccionar foto de perfil" />
          <b className="dashboard-profile-name">{user.name.split(' ')[0] || user.username}</b>
        </div>
      ) : (
        <div className="admin-profile-controls">
          <button className="admin-profile-avatar" onClick={() => setShowPreview(true)} aria-label="Ampliar foto de perfil" disabled={loading}>
            {avatar}
          </button>
          <label className="admin-profile-action" htmlFor={inputId} title="Agregar foto" aria-label="Agregar foto">＋</label>
          <button className="admin-profile-action admin-profile-remove" onClick={() => void removePhoto()} disabled={!photo || saving} title="Eliminar foto" aria-label="Eliminar foto">⌫</button>
          <input className="admin-profile-photo-input" id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
        </div>
      )}
    </>
  )

  return (
    <>
      {controls}
      {notice && <p className={'profile-photo-notice profile-photo-toast ' + (variant === 'admin' ? 'admin-photo-notice' : '')} role="status">{notice}</p>}
      {showPreview && (
        <div className="profile-preview-backdrop" onClick={() => setShowPreview(false)}>
          <section className="profile-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-preview-title" onClick={(event) => event.stopPropagation()}>
            <button className="profile-preview-close" onClick={() => setShowPreview(false)} aria-label="Cerrar">×</button>
            <h2 id="profile-preview-title">Foto de perfil</h2>
            <div className="profile-preview-image">{photo ? <img src={photo} alt={'Foto de ' + user.name} /> : <span>{initials}</span>}</div>
            <div className="profile-preview-actions">
              <label className="profile-preview-add" htmlFor={inputId}><AddPhotoIcon /> {saving ? 'Guardando…' : 'Cambiar foto'}</label>
              <button className="profile-preview-delete" onClick={() => void removePhoto()} disabled={!photo || saving}><TrashIcon /> Eliminar foto</button>
            </div>
            <p>La foto se guarda en MongoDB Atlas y está disponible en cualquier dispositivo.</p>
          </section>
        </div>
      )}
    </>
  )
}

function AddPhotoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.5-2h7L17 7h3v11H4z" /><circle cx="12" cy="12.5" r="3" /><path d="M19 3v4m-2-2h4" /></svg>
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></svg>
}
