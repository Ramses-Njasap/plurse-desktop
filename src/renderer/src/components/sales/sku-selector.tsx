import React from 'react'

type StockPurchase = {
  id: number
  sku_id: number
  sku_name: string
  sku_code: string
  product_name: string
  quantity_remaining: number
  price_per_unit: number
  batch_number: string | null
}

type Props = {
  onSelect: (stockPurchaseId: number, skuId: number, skuName: string, unitPrice: number) => void
}

const SkuSelector = ({ onSelect }: Props) => {
  const [purchases, setPurchases] = React.useState<StockPurchase[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [filtered, setFiltered] = React.useState<StockPurchase[]>([])

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Get SKUs with available stock
        const res = await window.api.products.getAllSkus({
          has_stock_purchases: 'yes',
          with_stock_purchases: true,
          limit: 200,
        })
        if (res.success && res.data) {
          // Transform to flat list of stock purchases with remaining stock
          const items: StockPurchase[] = []
          res.data.items.forEach(sku => {
            if (sku.stock_purchases) {
              sku.stock_purchases.forEach((p: any) => {
                if (p.quantities?.remaining > 0) {
                  items.push({
                    id: p.id,
                    sku_id: sku.id,
                    sku_name: sku.sku_name,
                    sku_code: sku.code,
                    product_name: sku.product?.name || 'Unknown',
                    quantity_remaining: p.quantities.remaining,
                    price_per_unit: p.pricing?.price_per_unit || 0,
                    batch_number: p.batch_number,
                  })
                }
              })
            }
          })
          setPurchases(items)
          setFiltered(items)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  React.useEffect(() => {
    if (!search.trim()) {
      setFiltered(purchases)
      return
    }
    const term = search.toLowerCase()
    setFiltered(purchases.filter(p => 
      p.sku_name.toLowerCase().includes(term) ||
      p.sku_code.toLowerCase().includes(term) ||
      p.product_name.toLowerCase().includes(term) ||
      (p.batch_number && p.batch_number.toLowerCase().includes(term))
    ))
  }, [search, purchases])

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search SKUs, products, batches…"
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          autoFocus
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No SKUs with available stock found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id, p.sku_id, p.sku_name, p.price_per_unit)}
              className="w-full flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-xl transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{p.sku_name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 truncate">
                    {p.sku_name}
                  </h4>
                  <span className="text-xs font-mono text-gray-400">{p.sku_code}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{p.product_name}</p>
                {p.batch_number && (
                  <p className="text-xs text-gray-400 mt-0.5">Batch: {p.batch_number}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-emerald-600">${p.price_per_unit.toFixed(2)}</div>
                <div className="text-xs text-gray-400">{p.quantity_remaining} left</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SkuSelector