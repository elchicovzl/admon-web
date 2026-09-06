import { UserRole } from '@prisma/client'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      /**
       * Cheap gate for middleware and UI only. NOT authoritative: the token
       * lives 30 days, so a revoked permission lingers here. The real check is
       * hasControlAccess() in lib/auth/rbac.ts, which reads the database.
       */
      canAccessControl: boolean
    } & DefaultSession['user']
  }

  interface User {
    role: UserRole
    canAccessControl: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    canAccessControl: boolean
  }
}
