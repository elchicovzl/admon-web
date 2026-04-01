'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2 } from 'lucide-react'
import { createBlogCategorySchema, type CreateBlogCategoryInput } from '@/lib/validations/blog.schema'
import { createBlogCategory, updateBlogCategory, deleteBlogCategory } from '@/lib/actions/blog.actions'
import { toast } from 'sonner'
import type { SafeBlogCategory } from '@/lib/types/blog.types'

interface BlogCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (category: SafeBlogCategory) => void
  onUpdated?: (category: SafeBlogCategory) => void
  onDeleted?: (id: string) => void
  categories?: SafeBlogCategory[]
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function BlogCategoryDialog({
  open,
  onOpenChange,
  onCreated,
  onUpdated,
  onDeleted,
  categories = [],
}: BlogCategoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<CreateBlogCategoryInput>({
    resolver: zodResolver(createBlogCategorySchema),
    defaultValues: { name: '', slug: '', description: '' },
  })

  function startEdit(category: SafeBlogCategory) {
    setEditingId(category.id)
    form.reset({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    form.reset({ name: '', slug: '', description: '' })
  }

  async function onSubmit(data: CreateBlogCategoryInput) {
    setLoading(true)
    try {
      if (editingId) {
        const result = await updateBlogCategory(editingId, data)
        if (result.success && result.data) {
          toast.success('Categoría actualizada')
          onUpdated?.(result.data)
          cancelEdit()
        } else {
          toast.error(result.error || 'Error al actualizar categoría')
        }
      } else {
        const result = await createBlogCategory(data)
        if (result.success && result.data) {
          toast.success('Categoría creada')
          onCreated(result.data)
          form.reset()
          onOpenChange(false)
        } else {
          toast.error(result.error || 'Error al crear categoría')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteBlogCategory(id)
    if (result.success) {
      toast.success('Categoría eliminada')
      onDeleted?.(id)
      if (editingId === id) cancelEdit()
    } else {
      toast.error(result.error || 'Error al eliminar categoría')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancelEdit(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
        </DialogHeader>

        {/* Existing categories list */}
        {categories.length > 0 && !editingId && (
          <div className="mb-2 max-h-36 overflow-y-auto rounded-md border">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span className="flex-1 truncate">{cat.name}</span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => startEdit(cat)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input
              id="cat-name"
              {...form.register('name', {
                onChange: (e) => {
                  if (!editingId) {
                    form.setValue('slug', generateSlug(e.target.value))
                  }
                },
              })}
              placeholder="Seguridad Social"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input id="cat-slug" {...form.register('slug')} placeholder="seguridad-social" />
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Descripción (opcional)</Label>
            <Textarea id="cat-desc" {...form.register('description')} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { cancelEdit(); if (!editingId) onOpenChange(false) }}
            >
              {editingId ? 'Cancelar edición' : 'Cancelar'}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
