'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BlogPostStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, Plus, ArrowLeft, Save, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { createBlogPostSchema, updateBlogPostSchema, type CreateBlogPostInput, type UpdateBlogPostInput } from '@/lib/validations/blog.schema'
import { createBlogPost, updateBlogPost } from '@/lib/actions/blog.actions'
import type { BlogPostWithRelations, SafeBlogCategory, SafeBlogTag } from '@/lib/types/blog.types'
import { TiptapEditor } from './tiptap-editor'
import { BlogFeaturedImageUpload } from './blog-featured-image-upload'
import { BlogCategoryDialog } from './blog-category-dialog'
import { BlogTagInput } from './blog-tag-input'
import { BlogSeoPreview } from './blog-seo-preview'

interface BlogPostFormProps {
  post?: BlogPostWithRelations
  categories: SafeBlogCategory[]
  tags: SafeBlogTag[]
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function BlogPostForm({ post, categories: initialCategories, tags: initialTags }: BlogPostFormProps) {
  const router = useRouter()
  const isEditing = !!post
  const [loading, setLoading] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categories, setCategories] = useState(initialCategories)
  const [availableTags, setAvailableTags] = useState(initialTags)
  const [seoOpen, setSeoOpen] = useState(false)

  const form = useForm<CreateBlogPostInput>({
    resolver: zodResolver(isEditing ? updateBlogPostSchema : createBlogPostSchema),
    defaultValues: {
      ...(isEditing && post ? { id: post.id } : {}),
      title: post?.title || '',
      slug: post?.slug || '',
      excerpt: post?.excerpt || '',
      content: post?.content || '',
      status: post?.status || BlogPostStatus.DRAFT,
      categoryId: post?.category?.id || '',
      tagIds: post?.tags?.map((t) => t.id) || [],
      featuredImageUrl: post?.featuredImageUrl || '',
      featuredImageS3Key: post?.featuredImageS3Key || '',
      metaTitle: post?.metaTitle || '',
      metaDescription: post?.metaDescription || '',
      keywords: post?.keywords || '',
      ogImageUrl: post?.ogImageUrl || '',
      ogImageS3Key: post?.ogImageS3Key || '',
    },
  })

  const watchTitle = form.watch('title')
  const watchSlug = form.watch('slug')
  const watchMetaTitle = form.watch('metaTitle')
  const watchMetaDescription = form.watch('metaDescription')
  const watchStatus = form.watch('status')

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('title', e.target.value)
    if (!slugManuallyEdited) {
      form.setValue('slug', generateSlug(e.target.value))
    }
  }, [form, slugManuallyEdited])

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true)
    form.setValue('slug', e.target.value)
  }, [form])

  async function onSubmit(data: CreateBlogPostInput) {
    setLoading(true)
    try {
      const result = isEditing
        ? await updateBlogPost(data as UpdateBlogPostInput)
        : await createBlogPost(data)

      if (result.success) {
        toast.success(result.message)
        router.push('/dashboard/blog')
      } else {
        toast.error(result.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/blog">
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Post' : 'Crear Post'}
          </h1>
        </div>
        <div className="flex gap-2">
          {isEditing && post && (
            <Link href={`/blog/preview/${post.id}`} target="_blank">
              <Button type="button" variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Vista previa
              </Button>
            </Link>
          )}
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - Main content */}
        <div className="space-y-4 lg:col-span-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={watchTitle}
              onChange={handleTitleChange}
              placeholder="Título del artículo"
              className="text-lg"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/blog/</span>
              <Input
                id="slug"
                value={watchSlug}
                onChange={handleSlugChange}
                placeholder="mi-articulo"
              />
            </div>
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
            )}
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">Extracto</Label>
            <Textarea
              id="excerpt"
              {...form.register('excerpt')}
              placeholder="Breve descripción del artículo..."
              rows={2}
            />
            {form.formState.errors.excerpt && (
              <p className="text-sm text-destructive">{form.formState.errors.excerpt.message}</p>
            )}
          </div>

          {/* Content Editor */}
          <div className="space-y-2">
            <Label>Contenido</Label>
            <TiptapEditor
              content={post?.content || ''}
              onChange={(html) => form.setValue('content', html, { shouldValidate: true })}
              postId={post?.id}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
            )}
          </div>
        </div>

        {/* Right column - Sidebar */}
        <div className="space-y-4">
          {/* Publish */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Publicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={watchStatus}
                  onValueChange={(value) => form.setValue('status', value as BlogPostStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Borrador</SelectItem>
                    <SelectItem value="PUBLISHED">Publicado</SelectItem>
                    <SelectItem value="ARCHIVED">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Featured Image */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Imagen Destacada</CardTitle>
            </CardHeader>
            <CardContent>
              <BlogFeaturedImageUpload
                imageUrl={form.watch('featuredImageUrl') || null}
                onImageChange={(url, s3Key) => {
                  form.setValue('featuredImageUrl', url || '')
                  form.setValue('featuredImageS3Key', s3Key || '')
                }}
                postId={post?.id}
              />
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={form.watch('categoryId') || 'none'}
                onValueChange={(value) => form.setValue('categoryId', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setCategoryDialogOpen(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Nueva Categoría
              </Button>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <BlogTagInput
                availableTags={availableTags}
                selectedTagIds={form.watch('tagIds') || []}
                onChange={(tagIds) => form.setValue('tagIds', tagIds)}
                onTagCreated={(tag) => setAvailableTags((prev) => [...prev, tag])}
                onTagUpdated={(updated) =>
                  setAvailableTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                }
                onTagDeleted={(id) => {
                  setAvailableTags((prev) => prev.filter((t) => t.id !== id))
                  const current = form.getValues('tagIds') || []
                  if (current.includes(id)) {
                    form.setValue('tagIds', current.filter((tid) => tid !== id))
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">SEO</CardTitle>
                    <ChevronDown className={`h-4 w-4 transition-transform ${seoOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="metaTitle">
                      Meta Título
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({(watchMetaTitle || '').length}/70)
                      </span>
                    </Label>
                    <Input
                      id="metaTitle"
                      {...form.register('metaTitle')}
                      placeholder={watchTitle || 'Título para buscadores'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metaDescription">
                      Meta Descripción
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({(watchMetaDescription || '').length}/160)
                      </span>
                    </Label>
                    <Textarea
                      id="metaDescription"
                      {...form.register('metaDescription')}
                      placeholder="Descripción para buscadores..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Palabras Clave</Label>
                    <Input
                      id="keywords"
                      {...form.register('keywords')}
                      placeholder="seguridad social, eps, afp"
                    />
                  </div>
                  <div className="pt-2">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Vista previa en Google</p>
                    <BlogSeoPreview
                      title={watchMetaTitle || watchTitle || ''}
                      description={watchMetaDescription || form.watch('excerpt') || ''}
                      slug={watchSlug}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </div>

      <BlogCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categories}
        onCreated={(category) => setCategories((prev) => [...prev, category])}
        onUpdated={(updated) =>
          setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
        onDeleted={(id) => {
          setCategories((prev) => prev.filter((c) => c.id !== id))
          // If the deleted category was selected, clear it
          if (form.getValues('categoryId') === id) {
            form.setValue('categoryId', '')
          }
        }}
      />
    </form>
  )
}
