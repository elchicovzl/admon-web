'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'

interface BlogFeaturedImageUploadProps {
  imageUrl: string | null
  onImageChange: (url: string | null, s3Key: string | null) => void
  postId?: string
}

export function BlogFeaturedImageUpload({ imageUrl, onImageChange, postId }: BlogFeaturedImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('postId', postId || 'temp')
      formData.append('type', 'featured')

      const response = await fetch('/api/upload/blog', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Error al subir imagen')
        return
      }

      onImageChange(result.data.fileUrl, result.data.s3Key)
    } catch {
      toast.error('Error al subir imagen')
    } finally {
      setUploading(false)
    }
  }, [postId, onImageChange])

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Imagen destacada"
            className="w-full rounded-md object-cover aspect-video"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => onImageChange(null, null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors hover:border-primary/50">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {uploading ? 'Subiendo...' : 'Clic para subir imagen'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  )
}
