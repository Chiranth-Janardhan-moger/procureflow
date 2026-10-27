export interface EstimatedPurchaseItem {
  quantity: number | string
  estimated_unit_price: number | string
}

/** Sum quantity times estimated unit price using the existing requisition calculation. */
export function calculateEstimatedTotal(items: readonly EstimatedPurchaseItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.estimated_unit_price), 0)
}
