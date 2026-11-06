import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useWindowedList } from './useWindowedList'

function List({ items }: { items: string[] }) {
  const { visible, hasMore, showMore } = useWindowedList(items, 2)
  return (
    <div>
      <ul>
        {visible.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {hasMore && <button onClick={showMore}>Show more</button>}
    </div>
  )
}

describe('useWindowedList', () => {
  it('mounts only the first page and grows on demand', async () => {
    const user = userEvent.setup()
    render(<List items={['A', 'B', 'C', 'D', 'E']} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('C')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('shows a short list in full with no control', () => {
    render(<List items={['Only']} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })
})
