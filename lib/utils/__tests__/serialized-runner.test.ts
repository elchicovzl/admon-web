import { describe, expect, it } from 'vitest'
import { createSerializedRunner } from '../serialized-runner'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createSerializedRunner', () => {
  it('runs immediately when idle', async () => {
    let runs = 0
    const run = createSerializedRunner(async () => {
      runs++
    })
    await run()
    await run()
    expect(runs).toBe(2)
  })

  it('never overlaps runs and coalesces a burst into one follow-up', async () => {
    const gates = [deferred(), deferred(), deferred()]
    let started = 0
    let active = 0
    let maxActive = 0
    const run = createSerializedRunner(async () => {
      const gate = gates[started++]
      active++
      maxActive = Math.max(maxActive, active)
      await gate.promise
      active--
    })

    const first = run()
    const second = run()
    const third = run()
    const fourth = run()
    expect(started).toBe(1)
    expect(second).toBe(third)
    expect(third).toBe(fourth)

    gates[0].resolve()
    await first
    await Promise.resolve()
    expect(started).toBe(2)

    gates[1].resolve()
    await Promise.all([second, third, fourth])
    expect(started).toBe(2)
    expect(maxActive).toBe(1)
  })

  it('starts the follow-up AFTER the call that requested it', async () => {
    const order: string[] = []
    const gate = deferred()
    let n = 0
    const run = createSerializedRunner(async () => {
      const id = ++n
      order.push(`start ${id}`)
      if (id === 1) await gate.promise
      order.push(`end ${id}`)
    })

    const first = run()
    const requestedWhileBusy = run()
    gate.resolve()
    await Promise.all([first, requestedWhileBusy])
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2'])
  })

  it('a failed run rejects its waiters but does not block the next run', async () => {
    const gate = deferred()
    let n = 0
    const run = createSerializedRunner(async () => {
      n++
      if (n === 1) await gate.promise
    })

    const first = run()
    const second = run()
    const firstOutcome = first.catch((e: Error) => e.message)
    gate.reject(new Error('boom'))

    expect(await firstOutcome).toBe('boom')
    await second
    expect(n).toBe(2)
    await run()
    expect(n).toBe(3)
  })
})
