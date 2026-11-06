import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from './useFocusTrap'

function Dialog() {
  const ref = useFocusTrap<HTMLDivElement>()
  return (
    <div ref={ref} role="dialog" aria-label="Example">
      <button type="button">First</button>
      <button type="button">Middle</button>
      <button type="button">Last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus to the first control on mount', () => {
    render(<Dialog />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps Tab from the last control back to the first', async () => {
    const user = userEvent.setup()
    render(<Dialog />)

    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })

    last.focus()
    await user.tab()
    expect(first).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control back to the last', async () => {
    const user = userEvent.setup()
    render(<Dialog />)

    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })

    first.focus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it('restores focus to the opener when the dialog unmounts', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Opener'
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(<Dialog />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
