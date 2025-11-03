import { create } from 'zustand'

interface DashboardState {
  // Sidebar state
  sidebarOpen: boolean
  sidebarCollapsed: boolean

  // Modal states
  createUserModalOpen: boolean
  editUserModalOpen: boolean
  deleteUserModalOpen: boolean
  selectedUserId: string | null

  // Actions
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

export const useDashboardStore = create<DashboardState>((set) => ({
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
    selectedUserId: userId
  }),
  closeEditUserModal: () => set({
    editUserModalOpen: false,
    selectedUserId: null
  }),

  openDeleteUserModal: (userId) => set({
    deleteUserModalOpen: true,
    selectedUserId: userId
  }),
  closeDeleteUserModal: () => set({
    deleteUserModalOpen: false,
    selectedUserId: null
  }),
}))
