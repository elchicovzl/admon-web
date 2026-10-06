/**
 * Error messages shared by the Control server actions and the route handlers
 * that translate them to HTTP statuses. They live in one plain module (not in
 * `control.actions.ts`, which is a 'use server' file and may only export async
 * functions) so both sides compare against the same constants instead of
 * matching copies of a string.
 */

export const ERROR_NO_AUTENTICADO = 'No autenticado'
export const ERROR_SIN_ACCESO_CONTROL = 'No tenés acceso al módulo Control'
export const ERROR_RECIBO_NO_ENCONTRADO = 'Recibo no encontrado'
