/**
 * Permiso de login de un solo uso.
 *
 * Es la pieza que ata el OTP a la creación de la sesión.
 *
 * El problema que resuelve: `authorize()` del provider Credentials es
 * alcanzable por HTTP en `/api/auth/callback/credentials`. Cualquier control
 * que viva en una Server Action —como la verificación del OTP— se saltea
 * llamando ese endpoint de frente. Para que el OTP sirva de algo,
 * `authorize()` tiene que exigir una prueba que SOLO pueda producir quien ya
 * validó el código.
 *
 * Esa prueba es este permiso: lo emite verifyOtp() después de validar el OTP,
 * y lo consume authorize(). Sin permiso no hay sesión.
 */

import { randomBytes } from 'crypto'
import prisma from '@/lib/db/prisma'

/**
 * Prefijo del `identifier` en verification_tokens.
 *
 * Separa estos permisos de los OTP, que viven en la misma tabla con
 * `identifier = email` a secas. Sin el prefijo, la búsqueda del OTP en
 * verifyOtp() podría levantar un permiso de login y compararlo como si fuera
 * un código.
 */
export const LOGIN_GRANT_PREFIX = 'login-grant:'

/**
 * 60 segundos. El permiso se emite y se consume dentro de la misma acción de
 * login, así que no necesita más; y cuanto más corto, menos vale si se filtra
 * de un log.
 */
const LOGIN_GRANT_TTL_MS = 60 * 1000

/**
 * Emite un permiso de login para un email y devuelve el secreto en claro.
 *
 * El secreto NO se hashea, a diferencia del OTP. El OTP tiene 6 dígitos y vive
 * 5 minutos: hay que hashearlo porque un volcado de la base lo dejaría
 * adivinable. Este son 256 bits aleatorios que viven 60 segundos y se borran
 * al usarse — no hay nada que adivinar, y guardarlo en claro permite
 * consumirlo con un DELETE atómico por clave única en vez de escanear y
 * comparar hashes.
 */
export async function emitirPermisoDeLogin(email: string): Promise<string> {
  const secreto = randomBytes(32).toString('hex')

  await prisma.verificationToken.create({
    data: {
      identifier: `${LOGIN_GRANT_PREFIX}${email}`,
      token: secreto,
      expires: new Date(Date.now() + LOGIN_GRANT_TTL_MS),
    },
  })

  return secreto
}
