// Auth actions
export {
  login,
  logout,
  register,
  getSession,
  changePassword,
} from './auth.actions'

// User actions
export {
  getUsers,
  getUserById,
  createManager,
  updateUser,
  deleteUser,
  getUsersCount,
  toggleUserStatus,
  changeUserPassword,
} from './user.actions'

// Client actions
export {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  addClientNote,
  deleteClientNote,
  getClientsCount,
} from './client.actions'

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
