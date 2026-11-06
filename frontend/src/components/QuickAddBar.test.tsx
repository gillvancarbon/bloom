import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickAddBar } from './QuickAddBar'

const NOW = new Date(2026, 10, 4, 9, 0) // Wednesday 4 November 2026, 09:00

function setup(guidance = true) {
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(<QuickAddBar now={NOW} onAdd={onAdd} guidance={guidance} />)
  return { onAdd, input: screen.getByLabelText('Quick add a task') }
}

describe('QuickAddBar', () => {
  it('completes a partial date word when a suggestion is tapped', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.type(input, 'call mum to')
    expect(screen.getByText('Suggestions:')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'tomorrow' }))
    expect(input).toHaveValue('call mum tomorrow')
    expect(screen.getByText(/Tomorrow/)).toBeInTheDocument()
  })

  it('offers an opt-in recommendation and inserts it', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.type(input, 'buy milk')
    expect(screen.getByText('Suggested:')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '#errands' }))
    expect(input).toHaveValue('buy milk #errands')
  })

  it('opens the full guide for /help and fills the line from an example', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.type(input, '/help')
    expect(screen.getByRole('region', { name: 'Quick add guide' })).toBeInTheDocument()
    expect(screen.getByText('Putting it together')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /file taxes #work !high/ }))
    expect(input).toHaveValue('file taxes #work !high')
    expect(screen.queryByRole('region', { name: 'Quick add guide' })).not.toBeInTheDocument()
  })

  it('adds a parsed task and clears the line', async () => {
    const user = userEvent.setup()
    const { onAdd, input } = setup()

    await user.type(input, 'file taxes #work !high')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'file taxes',
        category: 'work',
        importance: 'high',
        note: null,
        subtasks: [],
      }),
    )
    expect(input).toHaveValue('')
  })

  it('shows an inline error when the title is missing', async () => {
    const user = userEvent.setup()
    const { onAdd, input } = setup()

    await user.type(input, 'tomorrow')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText('Add a title for your task.')).toBeInTheDocument()
  })

  it('hides guidance chips when switched off but keeps /help available', async () => {
    const user = userEvent.setup()
    const { input } = setup(false)

    await user.click(input)
    expect(screen.queryByText('Try a whole sentence:')).not.toBeInTheDocument()

    await user.type(input, 'buy milk')
    expect(screen.queryByText('Suggested:')).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '/help')
    expect(screen.getByRole('region', { name: 'Quick add guide' })).toBeInTheDocument()
  })

  it('publishes guidance to a polite live region for screen readers', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.type(input, 'call mum to')
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/Suggestions:.*tomorrow/)
  })
})
