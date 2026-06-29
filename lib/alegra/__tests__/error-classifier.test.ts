import { describe, expect, it } from 'vitest'
import {
  AlegraError,
  AuthError,
  RateLimitError,
  ValidationError,
} from '../errors'
import { classifyAlegraError } from '../error-classifier'

// -----------------------------------------------------------------------------
// Production-safe paths (digest-based — Next.js preserves `error.digest`)
// -----------------------------------------------------------------------------

describe('classifyAlegraError — production paths (digest)', () => {
  it('AuthError → auth', () => {
    expect(classifyAlegraError(new AuthError()).category).toBe('auth')
  })

  it('RateLimitError → rate_limit', () => {
    expect(classifyAlegraError(new RateLimitError('too many', Date.now())).category).toBe(
      'rate_limit',
    )
  })

  it('ValidationError → validation', () => {
    expect(classifyAlegraError(new ValidationError('bad', {})).category).toBe('validation')
  })

  it('AlegraError with code AUTH_ERROR → auth (digest match)', () => {
    // Simulates an error that crossed a Next.js boundary (only digest survived).
    const err = new AlegraError('AUTH_ERROR', '<message masked by Next.js>')
    expect(classifyAlegraError(err).category).toBe('auth')
  })

  it('AlegraError with code HTTP_404 → not_found (digest match — this is the regression from #2)', () => {
    // The handleHttpError path in client.ts throws AlegraError('HTTP_404', ...).
    // Without the digest branch, this falls through to NETWORK in prod.
    const err = new AlegraError('HTTP_404', '<message masked by Next.js>')
    expect(classifyAlegraError(err).category).toBe('not_found')
  })

  it('AlegraError with code HTTP_500 → network (5xx = generic)', () => {
    // 5xx is intentionally a generic catch-all (we can't say much beyond
    // 'something is wrong on Alegra's end'); just verify it doesn't crash.
    const err = new AlegraError('HTTP_500', 'Internal Server Error')
    expect(classifyAlegraError(err).category).toBe('network')
  })

  it('AlegraError with code NETWORK_ERROR → network', () => {
    const err = new AlegraError('NETWORK_ERROR', 'fetch failed: DNS')
    expect(classifyAlegraError(err).category).toBe('network')
  })
})

// -----------------------------------------------------------------------------
// Dev-only paths (message-based — these die in production where Next.js
// masks the message, so production tests would NOT exercise these)
// -----------------------------------------------------------------------------

describe('classifyAlegraError — dev paths (substring)', () => {
  it('substring "404" → not_found (dev only)', () => {
    const err = new Error('Resource not found at /invoices/1234 (404)')
    expect(classifyAlegraError(err).category).toBe('not_found')
  })

  it('substring "credencial" → auth (dev only)', () => {
    const err = new Error('credenciales inválidas')
    expect(classifyAlegraError(err).category).toBe('auth')
  })

  it('substring "rate limit" → rate_limit (dev only)', () => {
    const err = new Error('Rate limit exceeded — slow down')
    expect(classifyAlegraError(err).category).toBe('rate_limit')
  })

  it('substring "zod" → validation (dev only)', () => {
    const err = new Error('Zod validation failed: shape mismatch')
    expect(classifyAlegraError(err).category).toBe('validation')
  })

  it('substring "inesperado" → validation (dev only)', () => {
    const err = new Error('Alegra devolvió un shape inesperado')
    expect(classifyAlegraError(err).category).toBe('validation')
  })

  it('generic error → network', () => {
    expect(classifyAlegraError(new Error('whatever')).category).toBe('network')
  })

  it('non-Error input → network (defensive)', () => {
    expect(classifyAlegraError('string thrown' as never).category).toBe('network')
    expect(classifyAlegraError(undefined as never).category).toBe('network')
  })
})

// -----------------------------------------------------------------------------
// All paths return a non-empty title + description
// -----------------------------------------------------------------------------

describe('classifyAlegraError — shape', () => {
  for (const scenario of [
    ['AuthError', () => new AuthError()],
    ['RateLimitError', () => new RateLimitError('x', Date.now())],
    ['ValidationError', () => new ValidationError('x', {})],
    ['HTTP_404', () => new AlegraError('HTTP_404', 'x')],
    ['HTTP_500', () => new AlegraError('HTTP_500', 'x')],
    ['NETWORK_ERROR', () => new AlegraError('NETWORK_ERROR', 'x')],
    ['plain error', () => new Error('x')],
  ]) {
    it(`returns non-empty title + description for ${scenario[0]}`, () => {
      const result = classifyAlegraError((scenario[1] as () => unknown)())
      expect(result.title.length).toBeGreaterThan(0)
      expect(result.description.length).toBeGreaterThan(0)
    })
  }
})
