import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimatedTotal } from '../services/purchaseCalculations.js'

describe('Unit: purchase requisition business calculations', () => {
  test('adds quantity times unit price for multiple line items', () => {
    const total = calculateEstimatedTotal([
      { quantity: 2, estimated_unit_price: 500 },
      { quantity: 3, estimated_unit_price: 200 },
    ])
    assert.equal(total, 1600)
  })

  test('converts numeric strings before multiplying and adding', () => {
    const total = calculateEstimatedTotal([
      { quantity: '2', estimated_unit_price: '500' },
      { quantity: '3', estimated_unit_price: '200' },
    ])
    assert.equal(total, 1600)
  })

  test('includes fractional unit prices in the computed total', () => {
    const total = calculateEstimatedTotal([
      { quantity: 3, estimated_unit_price: 12.5 },
      { quantity: 2, estimated_unit_price: 0.75 },
    ])
    assert.equal(total, 39)
  })

  test('returns zero for an empty item list', () => {
    assert.equal(calculateEstimatedTotal([]), 0)
  })

  test('zero quantities and zero prices contribute nothing to the total', () => {
    const total = calculateEstimatedTotal([
      { quantity: 0, estimated_unit_price: 100 },
      { quantity: 3, estimated_unit_price: 0 },
      { quantity: 2, estimated_unit_price: 5 },
    ])
    assert.equal(total, 10)
  })
})
