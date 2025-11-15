'use client'

import { createContext, useContext, useRef } from 'react'
import { createStore, useStore } from 'zustand'

interface DashboardState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  createUserModalOpen: boolean
  editUserModalOpen: boolean
  deleteUserModalOpen: boolean
  selectedUserId: string | null
}

interface DashboardActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openCreateUserModal: () => void
  closeCreateUserModal: () => void
  openEditUserModal: (userId: string) => void
  closeEditUserModal: () => void
  openDeleteUserModal: (userId: string) => void
  closeDeleteUserModal: () => void
}

type DashboardStore = DashboardState & DashboardActions

const createDashboardStore = () => {
  return createStore<DashboardStore>((set) => ({
    // Initial state
    sidebarOpen: true,
    sidebarCollapsed: false,
    createUserModalOpen: false,
    editUserModalOpen: false,
    deleteUserModalOpen: false,
    selectedUserId: null,

    // Actions
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    openCreateUserModal: () => set({ createUserModalOpen: true }),
    closeCreateUserModal: () => set({ createUserModalOpen: false }),
    openEditUserModal: (userId) => set({
      editUserModalOpen: true,
      selectedUserId: userId,
    }),
    closeEditUserModal: () => set({
      editUserModalOpen: false,
      selectedUserId: null,
    }),
    openDeleteUserModal: (userId) => set({
      deleteUserModalOpen: true,
      selectedUserId: userId,
    }),
    closeDeleteUserModal: () => set({
      deleteUserModalOpen: false,
      selectedUserId: null,
    }),
  }))
}

const DashboardContext = createContext<ReturnType<typeof createDashboardStore> | null>(null)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createDashboardStore>>()

  if (!storeRef.current) {
    storeRef.current = createDashboardStore()
  }

  return (
    <DashboardContext.Provider value={storeRef.current}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard<T>(selector: (state: DashboardStore) => T): T {
  const store = useContext(DashboardContext)
  if (!store) {
    throw new Error('useDashboard must be used within DashboardProvider')
  }
  return useStore(store, selector)
}
