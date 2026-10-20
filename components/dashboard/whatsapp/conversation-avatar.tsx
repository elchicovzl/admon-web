import { User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { avatarColorClass, avatarInitials } from '@/lib/whatsapp/avatar'

/**
 * Initials avatar: the Cloud API gives no customer photo. A name without letters (a bare phone)
 * gets a generic user icon. The color is derived from `seed` (the conversation id), so it never
 * changes between renders or polls.
 */
export function ConversationAvatar({
  name,
  seed,
  className,
}: {
  name: string
  seed: string
  className?: string
}) {
  const initials = avatarInitials(name)
  return (
    <Avatar className={cn('size-10', className)} aria-hidden>
      <AvatarFallback className={cn('text-sm font-medium', avatarColorClass(seed))}>
        {initials ?? <User className="size-5" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  )
}
