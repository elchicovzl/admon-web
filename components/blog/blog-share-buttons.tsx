'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Link2 } from 'lucide-react'

interface BlogShareButtonsProps {
  title: string
  url: string
}

export function BlogShareButtons({ title, url }: BlogShareButtonsProps) {
  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)

  function copyLink() {
    navigator.clipboard.writeText(url)
    toast.success('Enlace copiado')
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Compartir:</span>
      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Twitter
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink}>
        <Link2 className="mr-1 h-3 w-3" />
        Copiar
      </Button>
    </div>
  )
}
