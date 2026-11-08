// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CELEBRATE_EVENT, celebrate, tap } from './feedback'

let vibrate: ReturnType<typeof vi.fn>

beforeEach(() => {
  vibrate = vi.fn()
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  Reflect.deleteProperty(window, 'matchMedia')
  vi.restoreAllMocks()
})

describe('tap', () => {
  it('does not vibrate when haptics are off', () => {
    tap({ haptics: false, celebrations: false })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('vibrates briefly when haptics are on', () => {
    tap({ haptics: true, celebrations: false })
    expect(vibrate).toHaveBeenCalledOnce()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('is suppressed by reduced motion', () => {
    tap({ haptics: true, celebrations: true, reducedMotion: true })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('reads the OS preference when reducedMotion is omitted', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
      writable: true,
    })
    tap({ haptics: true, celebrations: false })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('lets an explicit reducedMotion override the OS preference', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
      writable: true,
    })
    tap({ haptics: true, celebrations: false, reducedMotion: false })
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('never throws when navigator.vibrate is missing', () => {
    Reflect.deleteProperty(navigator, 'vibrate')
    expect(() => tap({ haptics: true, celebrations: false })).not.toThrow()
  })
})

describe('celebrate', () => {
  it('dispatches the event with the kind when enabled', () => {
    const listener = vi.fn()
    window.addEventListener(CELEBRATE_EVENT, listener)

    celebrate({ haptics: false, celebrations: true }, 'milestone')

    expect(listener).toHaveBeenCalledOnce()
    const event = listener.mock.calls[0][0] as CustomEvent<{ kind: string }>
    expect(event.detail).toEqual({ kind: 'milestone' })

    window.removeEventListener(CELEBRATE_EVENT, listener)
  })

  it('defaults the kind to habit', () => {
    const listener = vi.fn()
    window.addEventListener(CELEBRATE_EVENT, listener)

    celebrate({ haptics: false, celebrations: true })

    const event = listener.mock.calls[0][0] as CustomEvent<{ kind: string }>
    expect(event.detail).toEqual({ kind: 'habit' })

    window.removeEventListener(CELEBRATE_EVENT, listener)
  })

  it('does nothing when celebrations are off', () => {
    const listener = vi.fn()
    window.addEventListener(CELEBRATE_EVENT, listener)

    celebrate({ haptics: true, celebrations: false })

    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener(CELEBRATE_EVENT, listener)
  })

  it('is suppressed by reduced motion', () => {
    const listener = vi.fn()
    window.addEventListener(CELEBRATE_EVENT, listener)

    celebrate({ haptics: true, celebrations: true, reducedMotion: true }, 'task')

    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener(CELEBRATE_EVENT, listener)
  })
})
