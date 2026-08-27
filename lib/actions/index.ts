// Auth actions
export {
  requestOtp,
  verifyOtp,
  resendOtp,
  logout,
  register,
  getSession,
} from './auth.actions'

// User actions
export {
  getUsers,
  getUserById,
  getManagers,
  createManager,
  updateUser,
  deleteUser,
  getUsersCount,
  toggleUserStatus,
} from './user.actions'

// Client actions
export {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  deleteClient,
  addClientNote,
  deleteClientNote,
  getClientsCount,
  getAvailableEmployees,
  getCompanyEmployees,
  updateLegalRepresentative,
} from './client.actions'

// Employment actions (Phase 2 — new join-table based actions)
export { createEmployment, deactivateEmployment } from './employment.actions'

// Document actions
export {
  generateUploadUrl,
  confirmUpload,
  deleteDocument,
  getClientDocuments,
} from './document.actions'

// Credential actions
export {
  getClientCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  revealCredentialPassword,
} from './credential.actions'

// Disability actions
export {
  getDisabilities,
  getDisabilityById,
  createDisability,
  updateDisability,
  toggleDisabilityStatus,
  addDisabilityObservation,
  deleteDisabilityObservation,
  getDisabilitiesCount,
} from './disability.actions'

// Novedad actions (vacaciones, permisos, calamidades)
export {
  getNovedades,
  getNovedadById,
  getEmployeesVacationStats,
  getEmployeeNovedadDetail,
  createNovedad,
  updateNovedad,
  toggleNovedadStatus,
} from './novedad.actions'

// Client Info actions (address, additional info, beneficiaries)
export {
  createOrUpdateClientAddress,
  createOrUpdateClientAdditionalInfo,
  addClientBeneficiary,
  updateClientBeneficiary,
  deleteClientBeneficiary,
} from './client-info.actions'

// Blog actions
export {
  getBlogPosts,
  getBlogPostById,
  getBlogPostForPreview,
  getBlogPostBySlug,
  getPublishedBlogPosts,
  getBlogPostsCount,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  toggleBlogPostStatus,
  getAllPublishedSlugs,
  getRelatedPosts,
  getBlogCategories,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
  getBlogTags,
  createBlogTag,
  updateBlogTag,
  deleteBlogTag,
} from './blog.actions'

// Módulo Control — libro de caja interno
export {
  getBolsillos,
  getCategorias,
  createCategoria,
  createBolsillo,
  setBolsilloActivo,
  createTipoServicio,
  setTipoServicioActivo,
  setCategoriaActiva,
  setContraparteActiva,
  getTiposServicio,
  getContrapartes,
  createContraparte,
  getMovimientos,
  createMovimiento,
  anularMovimiento,
  getPrestamos,
  createPrestamo,
  abonarPrestamo,
  marcarIncobrable,
  getServicios,
  createServicio,
  registrarPataServicio,
  getResumenPeriodo,
  getReporteAnual,
  getCotizacionesDelPeriodo,
  importarCotizacionesComoIngresos,
  registrarAperturaInicial,
  registrarConteo,
  cerrarPeriodo,
} from './control.actions'
