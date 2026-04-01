'use client'

import { useState, useCallback } from 'react'
import { X, Plus, Pencil, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { createBlogTag, updateBlogTag, deleteBlogTag } from '@/lib/actions/blog.actions'
import { toast } from 'sonner'
import type { SafeBlogTag } from '@/lib/types/blog.types'

interface BlogTagInputProps {
  availableTags: SafeBlogTag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  onTagCreated: (tag: SafeBlogTag) => void
  onTagUpdated?: (tag: SafeBlogTag) => void
  onTagDeleted?: (id: string) => void
}

export function BlogTagInput({
  availableTags,
  selectedTagIds,
  onChange,
  onTagCreated,
  onTagUpdated,
  onTagDeleted,
}: BlogTagInputProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id))
  const filteredTags = availableTags.filter(
    (t) => !selectedTagIds.includes(t.id) && t.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleToggle = useCallback((tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }, [selectedTagIds, onChange])

  const handleRemove = useCallback((tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }, [selectedTagIds, onChange])

  const handleCreate = useCallback(async () => {
    if (!search.trim()) return
    setCreating(true)
    try {
      const result = await createBlogTag({ name: search.trim() })
      if (result.success && result.data) {
        onTagCreated(result.data)
        onChange([...selectedTagIds, result.data.id])
        setSearch('')
        toast.success('Tag creado')
      } else {
        toast.error(result.error || 'Error al crear tag')
      }
    } finally {
      setCreating(false)
    }
  }, [search, selectedTagIds, onChange, onTagCreated])

  const handleEditSave = useCallback(async (id: string) => {
    if (!editingName.trim()) return
    const result = await updateBlogTag(id, editingName)
    if (result.success && result.data) {
      onTagUpdated?.(result.data)
      toast.success('Tag actualizado')
    } else {
      toast.error(result.error || 'Error al actualizar tag')
    }
    setEditingId(null)
    setEditingName('')
  }, [editingName, onTagUpdated])

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteBlogTag(id)
    if (result.success) {
      onTagDeleted?.(id)
      // Remove from selected if it was selected
      onChange(selectedTagIds.filter((sid) => sid !== id))
      toast.success('Tag eliminado')
    } else {
      toast.error(result.error || 'Error al eliminar tag')
    }
  }, [selectedTagIds, onChange, onTagDeleted])

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1">
            {tag.name}
            <button type="button" onClick={() => handleRemove(tag.id)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Popover to add / manage tags */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start text-muted-foreground">
            <Plus className="mr-1 h-3 w-3" />
            Agregar tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input
            placeholder="Buscar o crear tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {/* Available (unselected) tags */}
            {filteredTags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-1">
                {editingId === tag.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-7 flex-1 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleEditSave(tag.id) }
                        if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                      }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleEditSave(tag.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex-1 rounded px-2 py-1 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        handleToggle(tag.id)
                        setSearch('')
                      }}
                    >
                      {tag.name}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={() => { setEditingId(tag.id); setEditingName(tag.name) }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive opacity-0 hover:opacity-100"
                      onClick={() => handleDelete(tag.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {/* Create new tag option */}
            {search.trim() && !availableTags.some((t) => t.name.toLowerCase() === search.toLowerCase()) && (
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-left text-sm text-primary hover:bg-accent"
                onClick={handleCreate}
                disabled={creating}
              >
                <Plus className="mr-1 inline h-3 w-3" />
                Crear &quot;{search}&quot;
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
