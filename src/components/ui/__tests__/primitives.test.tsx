import type { ChangeEvent } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select, Toggle, Alert, Card, CardBody } from '@/components/ui'

describe('UI primitives', () => {
  describe('Select', () => {
    it('associates labels, required marker, and value', () => {
      render(
        <Select label="Timezone" required defaultValue="Australia/Sydney">
          <option value="Australia/Sydney">Sydney</option>
          <option value="Australia/Perth">Perth</option>
        </Select>
      )

      const select = screen.getByRole('combobox', { name: /timezone/i }) as HTMLSelectElement
      expect(select).toBeInTheDocument()
      expect(select.value).toBe('Australia/Sydney')
      expect(screen.getByLabelText('required')).toBeInTheDocument()
    })

    it('exposes help text and error messaging', () => {
      const { rerender } = render(
        <Select label="Timezone" helpText="Choose wisely">
          <option value="Australia/Sydney">Sydney</option>
        </Select>
      )

      expect(screen.getByText('Choose wisely')).toBeInTheDocument()

      rerender(
        <Select label="Timezone" error="Invalid timezone">
          <option value="Australia/Sydney">Sydney</option>
        </Select>
      )

      expect(screen.getByRole('alert')).toHaveTextContent('Invalid timezone')
    })
  })

  describe('Toggle', () => {
    it('renders an accessible checkbox with description', () => {
      render(
        <Toggle label="Active" description="Enable pay guide" defaultChecked />
      )

      const checkbox = screen.getByRole('checkbox', { name: /active/i }) as HTMLInputElement
      expect(checkbox.type).toBe('checkbox')
      expect(checkbox.checked).toBe(true)
      expect(screen.getByText('Enable pay guide')).toBeInTheDocument()
    })

    it('supports disabled state', () => {
      render(<Toggle label="Active" disabled />)

      expect(screen.getByRole('checkbox', { name: /active/i })).toBeDisabled()
    })

    it('toggles value when activated via keyboard', async () => {
      const onChange = vi.fn()
      render(<Toggle label="Active" onChange={onChange} />)

      const checkbox = screen.getByRole('checkbox', { name: /active/i }) as HTMLInputElement
      checkbox.focus()
      expect(checkbox).toHaveFocus()

      fireEvent.keyDown(checkbox, { key: ' ', code: 'Space' })
      fireEvent.keyUp(checkbox, { key: ' ', code: 'Space' })
      fireEvent.click(checkbox, { detail: 0 })
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(
        (onChange.mock.calls[0][0] as ChangeEvent<HTMLInputElement>).target.checked
      ).toBe(true)

      fireEvent.keyDown(checkbox, { key: ' ', code: 'Space' })
      fireEvent.keyUp(checkbox, { key: ' ', code: 'Space' })
      fireEvent.click(checkbox, { detail: 0 })
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(
        (onChange.mock.calls[1][0] as ChangeEvent<HTMLInputElement>).target.checked
      ).toBe(false)
    })
  })

  describe('Alert', () => {
    it('assigns role based on tone', () => {
      const { rerender } = render(<Alert tone="danger">Danger message</Alert>)
      expect(screen.getByRole('alert')).toHaveTextContent('Danger message')

      rerender(<Alert tone="info" role="status">Info message</Alert>)
      expect(screen.getByRole('status')).toHaveTextContent('Info message')
    })
  })

  describe('Card', () => {
    it('surfaces interactive affordances when clickable', async () => {
      const onClick = vi.fn()

      render(
        <Card interactive onClick={onClick}>
          <CardBody>Clickable card</CardBody>
        </Card>
      )

      const buttonLike = screen.getByRole('button', { name: 'Clickable card' })
      buttonLike.click()

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('renders loading skeletons when loading is true', () => {
      render(<Card loading>Loading content</Card>)

      const skeletons = document.querySelectorAll('.skeleton')
      expect(skeletons).toHaveLength(3)
    })

    it('applies padding modifiers to the root element', () => {
      const { container } = render(
        <Card padding="lg">
          <CardBody>Spacious content</CardBody>
        </Card>
      )

      const card = container.querySelector('.chrona-card')
      expect(card?.className).toContain('chrona-card--padding-lg')
    })
  })
})
