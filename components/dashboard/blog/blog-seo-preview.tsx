'use client'

interface BlogSeoPreviewProps {
  title: string
  description: string
  slug: string
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.co'

export function BlogSeoPreview({ title, description, slug }: BlogSeoPreviewProps) {
  const displayTitle = title || 'Título del artículo'
  const displayDesc = description || 'Descripción del artículo que aparecerá en los resultados de búsqueda...'
  const displayUrl = `${BASE_URL}/blog/${slug || 'mi-articulo'}`

  return (
    <div className="rounded-md border bg-white p-3 text-left">
      <p className="text-xs text-muted-foreground truncate">{displayUrl}</p>
      <p className="text-sm font-medium text-blue-700 truncate">{displayTitle}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">{displayDesc}</p>
    </div>
  )
}
