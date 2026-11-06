import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ToastHost } from './ToastHost'
import { showToast } from '../lib/toast'

describe('ToastHost', () => {
  it('shows a message published on the toast bus', () => {
    render(<ToastHost />)
    act(() => showToast('Everything is working.'))

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Everything is working.')
    expect(toast).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the latest message when a second toast arrives', () => {
    render(<ToastHost />)
    act(() => showToast('First'))
    act(() => showToast('Second', 'error'))

    // The previous toast may still be animating out, so assert on the latest.
    const toasts = screen.getAllByRole('status')
    expect(toasts[toasts.length - 1]).toHaveTextContent('Second')
  })

  it('ignores empty messages', () => {
    render(<ToastHost />)
    act(() => showToast(''))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
