import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TermsGate } from './TermsGate'

const { update, exitApp } = vi.hoisted(() => ({
  update: vi.fn(),
  exitApp: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ update }),
}))
vi.mock('../lib/appControl', () => ({ exitApp }))

beforeEach(() => {
  update.mockClear()
  exitApp.mockClear()
})

describe('TermsGate', () => {
  it('cannot be accepted until the agreement box is ticked', async () => {
    const user = userEvent.setup()
    render(<TermsGate />)

    const agree = screen.getByRole('button', { name: 'Agree and continue' })
    expect(agree).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))
    expect(agree).toBeEnabled()

    await user.click(agree)
    expect(update).toHaveBeenCalledWith({ termsAcceptedAt: expect.any(String) })
  })

  it('keeps the full terms behind an optional disclosure', async () => {
    const user = userEvent.setup()
    render(<TermsGate />)

    const disclosure = screen.getByRole('button', { name: 'Read the full terms' })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('1. Accepting these terms')).not.toBeVisible()

    await user.click(disclosure)

    expect(screen.getByRole('button', { name: 'Hide the full terms' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('1. Accepting these terms')).toBeVisible()
  })

  it('can be accepted without opening the full terms', async () => {
    const user = userEvent.setup()
    render(<TermsGate />)

    // Reading is optional; ticking the box is what unlocks continuing.
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Agree and continue' }))

    expect(update).toHaveBeenCalledWith({ termsAcceptedAt: expect.any(String) })
  })

  it('declining explicitly closes the app', async () => {
    const user = userEvent.setup()
    render(<TermsGate />)

    await user.click(screen.getByRole('button', { name: 'Decline and close' }))
    expect(exitApp).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('Thanks for stopping by')).toBeInTheDocument()
  })

  it('ignores Escape so an accidental keypress cannot close the app', async () => {
    const user = userEvent.setup()
    render(<TermsGate />)

    await user.keyboard('{Escape}')
    // Give the microtask queue a turn; nothing should have happened.
    await Promise.resolve()

    expect(exitApp).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Terms of Use' })).toBeInTheDocument()
  })
})
