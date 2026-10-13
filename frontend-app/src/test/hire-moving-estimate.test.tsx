import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { HireMovingStepEstimate } from '@/features/moving/components/HireMovingStepEstimate'
import { todayDateInputValue, validateMovingStep3, type MovingRequestFormValues } from '@/features/moving/schemas/moving-request-schema'
import type { MovingQuote } from '@/features/moving/types'
import { renderWithProviders } from '@/test/utils'

const quote: MovingQuote = {
  pickupAddress: 'A',
  dropoffAddress: 'B',
  pickupFloorLevel: { id: 'f3', name: '3rd Floor', surchargeAmount: 30000 },
  dropoffFloorLevel: { id: 'f2', name: '2nd Floor', surchargeAmount: 20000 },
  distanceKm: 12.5,
  totalInventoryPoints: 12,
  inventoryItems: [
    { inventoryItemTypeId: 'i1', category: 'bedroom', itemName: 'Double Bed', count: 1 },
    { inventoryItemTypeId: 'i2', category: 'other', itemName: 'Medium Box', count: 4 },
  ],
  suggestedVehicleType: { id: 'v1', name: 'Motorbike with Trailer', pointFrom: 11, pointTo: 20, pricePerKm: 500, match: 'exact' },
  selectedVehicleType: { id: 'v1', name: 'Motorbike with Trailer', capacityLabel: '3–5 boxes', maxLoadKg: 200, pointFrom: 11, pointTo: 20, pricePerKm: 500 },
  pricePerKm: 500,
  pickupFloorSurcharge: 30000,
  dropoffFloorSurcharge: 20000,
  estimatedPrice: 56250,
}

const vehicles = [
  { id: 'v1', name: 'Motorbike with Trailer' },
  { id: 'v2', name: 'Mini Pickup' },
]

function Harness({ value = quote, onVehicleChange = () => {} }: { value?: MovingQuote | null; onVehicleChange?: (id: string) => void }) {
  const { register } = useForm<MovingRequestFormValues>()
  return (
    <HireMovingStepEstimate
      quote={value}
      vehicles={vehicles as never}
      vehicleTypeId="v1"
      onVehicleChange={onVehicleChange}
      register={register}
      errors={{}}
      isQuoting={false}
      isSubmitting={false}
      onBack={() => {}}
    />
  )
}

describe('moving estimate step', () => {
  it('shows the vehicle, the chosen items and a price breakdown that adds up to the quoted total', () => {
    renderWithProviders(<Harness />)

    const vehicle = screen.getByRole('region', { name: 'Suggested vehicle type' })
    expect(within(vehicle).getByText('Motorbike with Trailer', { selector: 'p' })).toBeInTheDocument()
    expect(within(vehicle).getByText('3–5 boxes')).toBeInTheDocument()
    expect(within(vehicle).getByText('200 kg')).toBeInTheDocument()

    const items = screen.getByRole('region', { name: 'Selected items' })
    expect(within(items).getByText('5 items')).toBeInTheDocument()
    expect(within(items).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringMatching(/Double Bed× 1$/),
      expect.stringMatching(/Medium Box× 4$/),
    ])

    const price = screen.getByRole('region', { name: 'Price breakdown' })
    expect(within(price).getByText('12.5 km × 500 MMK per km (Motorbike with Trailer)')).toBeInTheDocument()
    // 12.5 km at 500 MMK, plus the two floor charges, is the total the server quoted.
    expect(within(price).getByText('6,250 MMK')).toBeInTheDocument()
    expect(within(price).getByText('3rd Floor')).toBeInTheDocument()
    expect(within(price).getByText('30,000 MMK')).toBeInTheDocument()
    expect(within(price).getByText('2nd Floor')).toBeInTheDocument()
    expect(within(price).getByText('20,000 MMK')).toBeInTheDocument()
    expect(within(price).getByText('56,250 MMK')).toBeInTheDocument()
    expect(screen.queryByText(/inventory points/i)).not.toBeInTheDocument()
  })

  it('lets the customer choose another vehicle and keeps the suggestion visible', async () => {
    const onVehicleChange = vi.fn()
    const other = { ...quote, selectedVehicleType: { ...quote.selectedVehicleType, id: 'v2', name: 'Mini Pickup', capacityLabel: '8–12 boxes' } }
    renderWithProviders(<Harness value={other} onVehicleChange={onVehicleChange} />)

    const vehicle = screen.getByRole('region', { name: 'Selected vehicle' })
    expect(within(vehicle).getByText('Mini Pickup', { selector: 'p' })).toBeInTheDocument()
    expect(within(vehicle).getByText(/Suggested vehicle type:/)).toHaveTextContent('Motorbike with Trailer')

    await userEvent.setup().selectOptions(within(vehicle).getByRole('combobox'), 'v2')
    expect(onVehicleChange).toHaveBeenCalledWith('v2')
  })

  it('does not allow a move-in date in the past, and cannot confirm without a quote', () => {
    renderWithProviders(<Harness value={null} />)

    expect(document.querySelector('input[type=date]')).toHaveAttribute('min', todayDateInputValue())
    expect(screen.getByRole('button', { name: 'Confirm Booking' })).toBeDisabled()

    const t = (key: string) => key
    expect(validateMovingStep3({ moveInDate: '2020-01-01', vehicleTypeId: 'v1' }, t)).toEqual({ moveInDate: 'moving.moveInDatePast' })
    expect(validateMovingStep3({ moveInDate: todayDateInputValue(), vehicleTypeId: 'v1' }, t)).toEqual({})
  })
})
