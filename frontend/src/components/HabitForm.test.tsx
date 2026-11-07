import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HabitForm } from './HabitForm'

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      notificationsEnabled: false,
      defaultReminderOffset: null,
      timeFormat: '24',
    },
  }),
}))

describe('HabitForm', () => {
  it('refuses to save a weekday habit with no days selected', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<HabitForm mode="create" onClose={() => undefined} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Habit name'), 'Read')
    await user.click(screen.getByRole('radio', { name: 'Days' }))

    // The default is Mon–Fri; clear every day so nothing is selected.
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await user.click(screen.getByRole('button', { name: day }))
    }

    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Choose at least one day.')).toBeInTheDocument()
  })
})
