export type InventoryPresentation = {
  code: string
  label: string
  weightKg: number | null
}

export type InventoryPresentationFamily = {
  key: 'oaxaca' | 'panela'
  title: string
  presentations: InventoryPresentation[]
}

export const inventoryPresentationFamilies: Record<InventoryPresentationFamily['key'], InventoryPresentationFamily> = {
  oaxaca: {
    key: 'oaxaca',
    title: 'OAXACA',
    presentations: [
      { code: '0.50', label: '0.50 kg', weightKg: 0.5 },
      { code: '1.00', label: '1.00 kg', weightKg: 1 },
      { code: 'GR', label: 'GR', weightKg: null },
    ],
  },
  panela: {
    key: 'panela',
    title: 'PANELA',
    presentations: [
      { code: 'C0.5', label: 'C0.5', weightKg: 0.5 },
      { code: 'B0.5', label: 'B0.5', weightKg: 0.5 },
      { code: '1.00', label: '1.00 kg', weightKg: 1 },
      { code: 'C', label: 'C', weightKg: null },
      { code: 'M', label: 'M', weightKg: null },
    ],
  },
}

export function inventoryPresentationFamily(productName: string) {
  const normalized = productName.trim().toLocaleLowerCase()
  if (normalized === 'oaxaca') return inventoryPresentationFamilies.oaxaca
  if (normalized === 'panela') return inventoryPresentationFamilies.panela
  return null
}
