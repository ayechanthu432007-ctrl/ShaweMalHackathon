import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ConfirmDialog,
  DataTable,
  StatusBadge,
  statusTone,
  toCsv,
  type DataTableColumn,
} from '@/components/operational'
import { renderWithProviders } from '@/test/utils'

type Person = { id: string; name: string; score: number }

const people: Person[] = [
  { id: '1', name: 'Beta', score: 2 },
  { id: '2', name: 'Alpha', score: 10 },
]

const columns: DataTableColumn<Person>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'score', header: 'Score', cell: (row) => row.score, sortValue: (row) => row.score, align: 'right' },
]

function renderTable() {
  return renderWithProviders(
    <DataTable
      rows={people}
      columns={columns}
      rowKey={(row) => row.id}
      caption="People"
      emptyMessage="Nothing here"
    />,
    { initialEntries: ['/people'] },
  )
}

function rowNames() {
  const table = screen.getByRole('table')
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)
}

describe('DataTable', () => {
  it('sorts by a column and cycles ascending, descending, then unsorted', async () => {
    const user = userEvent.setup()
    renderTable()

    expect(rowNames()).toEqual(['Beta', 'Alpha'])

    const sortButton = screen.getByRole('button', { name: 'Sort by Name' })
    await user.click(sortButton)
    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute('aria-sort', 'ascending')
    expect(rowNames()).toEqual(['Alpha', 'Beta'])

    await user.click(sortButton)
    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute('aria-sort', 'descending')
    expect(rowNames()).toEqual(['Beta', 'Alpha'])

    await user.click(sortButton)
    expect(screen.getByRole('columnheader', { name: /name/i })).not.toHaveAttribute('aria-sort')
    expect(rowNames()).toEqual(['Beta', 'Alpha'])
  })

  it('shows skeleton rows while loading and an empty row when there is nothing to show', () => {
    const { rerender } = renderWithProviders(
      <DataTable
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        caption="People"
        isLoading
        emptyMessage="Nothing here"
      />,
    )

    expect(screen.getByRole('table').querySelector('tbody')).toHaveAttribute('aria-busy', 'true')

    rerender(
      <DataTable rows={[]} columns={columns} rowKey={(row) => row.id} caption="People" emptyMessage="Nothing here" />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})

describe('toCsv', () => {
  it('quotes delimiters, quotes, and newlines and starts with a BOM', () => {
    const csv = toCsv(
      [
        { header: 'Name', value: (row: { name: string; note: string }) => row.name },
        { header: 'Note', value: (row) => row.note },
      ],
      [{ name: 'A, "quoted"', note: 'line one\nline two' }],
    )

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"A, ""quoted"""')
    expect(csv).toContain('"line one\nline two"')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})

describe('StatusBadge', () => {
  it('maps domain statuses to one colour language', () => {
    expect(statusTone('VERIFIED')).toBe('success')
    expect(statusTone('pending')).toBe('warning')
    expect(statusTone('NOT_AVAILABLE')).toBe('neutral')
    expect(statusTone('CANCELLED')).toBe('danger')
    expect(statusTone('DRIVER_COMING')).toBe('info')
    expect(statusTone('PREMIUM')).toBe('premium')
    expect(statusTone('something-new')).toBe('neutral')
  })

  it('falls back to a readable label when none is supplied', () => {
    renderWithProviders(<StatusBadge status="NOT_AVAILABLE" />)
    expect(screen.getByText('Not Available')).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('names the record and focuses the safe action first', async () => {
    renderWithProviders(
      <ConfirmDialog
        open
        title="Delete this listing?"
        description="This cannot be undone."
        recordName="River View Condo"
        confirmLabel="Delete"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: /delete this listing/i })).toBeInTheDocument()
    expect(screen.getByText('River View Condo')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('confirms, cancels with Escape, and never confirms while pending', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { rerender } = renderWithProviders(
      <ConfirmDialog
        open
        title="Cancel this booking?"
        recordName="Downtown Apt"
        confirmLabel="Cancel booking"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(
      <ConfirmDialog
        open
        title="Cancel this booking?"
        recordName="Downtown Apt"
        confirmLabel="Cancel booking"
        isPending
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
