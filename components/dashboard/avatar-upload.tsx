'use client'

import { useCallback, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Camera, Loader2, ZoomIn } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const OUTPUT_SIZE = 300 // 300x300px

interface AvatarUploadProps {
  currentImage: string | null
  userName: string | null
  userEmail: string
  /** When set, uploads avatar for this user instead of the authenticated user (SUPER_ADMIN only) */
  targetUserId?: string
  onAvatarUpdated?: (imageUrl: string) => void
}

/**
 * Crop the image using Canvas API
 */
async function getCroppedImage(imageSrc: string, cropPixels: Area): Promise<Blob> {
  const image = new Image()
  image.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Error al cargar imagen'))
    image.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Error al recortar imagen'))
      },
      'image/webp',
      0.9
    )
  })
}

export function AvatarUpload({ currentImage, userName, userEmail, targetUserId, onAvatarUpdated }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { update: updateSession } = useSession()

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click()
    }
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Solo se aceptan imágenes JPG, PNG o WebP')
      return
    }

    if (file.size > MAX_SIZE) {
      toast.error('La imagen no debe exceder 2MB')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setImageToCrop(objectUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropDialogOpen(true)
  }

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels) return

    setIsUploading(true)
    try {
      const croppedBlob = await getCroppedImage(imageToCrop, croppedAreaPixels)

      const formData = new FormData()
      formData.append('file', croppedBlob, 'avatar.webp')
      if (targetUserId) {
        formData.append('userId', targetUserId)
      }

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al subir avatar')
      }

      setPreviewUrl(result.data.imageUrl)
      toast.success('Avatar actualizado exitosamente')
      setCropDialogOpen(false)
      onAvatarUpdated?.(result.data.imageUrl)
      // Refresh JWT token so session picks up the new image (only for own avatar)
      if (!targetUserId) {
        await updateSession()
      }
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir avatar')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCropCancel = () => {
    setCropDialogOpen(false)
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop)
      setImageToCrop(null)
    }
  }

  return (
    <>
      <div className="relative group">
        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        >
          <Avatar className="h-20 w-20">
            <AvatarImage src={previewUrl || undefined} alt={userName || userEmail} />
            <AvatarFallback className="text-xl">
              {getInitials(userName, userEmail)}
            </AvatarFallback>
          </Avatar>

          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploading ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Click para cambiar
        </p>
      </div>

      <Dialog open={cropDialogOpen} onOpenChange={(open) => !open && handleCropCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recortar imagen</DialogTitle>
          </DialogHeader>

          <div className="relative w-full h-64 bg-muted rounded-md overflow-hidden">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="flex items-center gap-3 px-1">
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(values) => setZoom(values[0])}
              className="flex-1"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCropCancel} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleCropSave} disabled={isUploading}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
