// src/components/public/hooks/use-cart.ts

import type { CartItem, SKU, StockPurchase } from '@renderer/components/public/types/sales'
import { useCallback, useMemo, useState } from 'react'

let cartIdCounter = 0
const genCartId = () => `cart-${++cartIdCounter}-${Date.now()}`

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = useCallback((purchase: StockPurchase, sku: SKU, unitPrice: number, qty = 1) => {
    setItems((prev) => {
      // Check if same purchase already in cart
      const existing = prev.find((i) => i.purchase.id === purchase.id)
      if (existing) {
        return prev.map((i) =>
          i.purchase.id === purchase.id
            ? { ...i, quantity: i.quantity + qty }
            : i
        )
      }
      const newItem: CartItem = {
        cartId: genCartId(),
        purchase,
        sku,
        productName: purchase.product_name || sku.product?.name || '',
        quantity: qty,
        unitPrice,
      }
      return [...prev, newItem]
    })
  }, [])

  const removeItem = useCallback((cartId: string) => {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId))
  }, [])

  const updateItem = useCallback((cartId: string, updates: Partial<Pick<CartItem, 'quantity' | 'unitPrice'>>) => {
    setItems((prev) =>
      prev.map((i) => (i.cartId === cartId ? { ...i, ...updates } : i))
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items]
  )

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  )

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    clearCart,
    subtotal,
    totalItems,
    isEmpty: items.length === 0,
  }
}

export type UseCart = ReturnType<typeof useCart>