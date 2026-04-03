import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'


// Define a relationship registry
class RelationshipRegistry {
  private relationships: Map<string, RelationshipHandler> = new Map()
  private dependencyGraph: Map<string, string[]> = new Map()

  register(name: string, handler: RelationshipHandler, dependencies: string[] = []) {
    this.relationships.set(name, handler)
    this.dependencyGraph.set(name, dependencies)
  }

  getOrderedRelationships(): string[] {
    const visited = new Set<string>()
    const ordered: string[] = []

    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)

      const deps = this.dependencyGraph.get(name) || []
      for (const dep of deps) {
        visit(dep)
      }
      ordered.push(name)
    }

    for (const name of this.relationships.keys()) {
      visit(name)
    }

    return ordered
  }

  async processAll(
    context: RelationshipContext,
    ids: number[],
    isRestore: boolean
  ): Promise<Record<string, number[]>> {
    const results: Record<string, number[]> = {}
    const ordered = this.getOrderedRelationships()

    for (const name of ordered) {
      const handler = this.relationships.get(name)
      if (handler) {
        const affectedIds = await handler(context, ids, isRestore)
        results[name] = affectedIds
      }
    }

    return results
  }
}

// Define relationship handler type
type RelationshipHandler = (
  context: RelationshipContext,
  parentIds: number[],
  isRestore: boolean
) => number[]

export type RelationshipContext = {
  db: BetterSQLite3Database<any>
  tables: any
  helpers: {
    getChildIds: (table: any, foreignKey: string, parentIds: number[], isRestore: boolean) => number[]
    updateBulk: (table: any, ids: number[], isRestore: boolean) => void
  }
}

// Create the registry
export const relationshipRegistry = new RelationshipRegistry()

// Register all relationships
relationshipRegistry.register('product_images', (ctx, productIds, isRestore) => {
  const ids = ctx.helpers.getChildIds(ctx.tables.product_image, 'product_id', productIds, isRestore)
  if (ids.length > 0) {
    ctx.helpers.updateBulk(ctx.tables.product_image, ids, isRestore)
  }
  return ids
}, []) // No dependencies

relationshipRegistry.register('skus', (ctx, productIds, isRestore) => {
  const ids = ctx.helpers.getChildIds(ctx.tables.sku, 'product_id', productIds, isRestore)
  if (ids.length > 0) {
    ctx.helpers.updateBulk(ctx.tables.sku, ids, isRestore)
  }
  return ids
}, [])

relationshipRegistry.register('sku_images', (ctx, productIds, isRestore) => {
  // First get SKU IDs
  const skuIds = ctx.helpers.getChildIds(ctx.tables.sku, 'product_id', productIds, false)
  if (skuIds.length === 0) return []
  
  const ids = ctx.helpers.getChildIds(ctx.tables.sku_images, 'sku_id', skuIds, isRestore)
  if (ids.length > 0) {
    ctx.helpers.updateBulk(ctx.tables.sku_images, ids, isRestore)
  }
  return ids
}, ['skus'])

relationshipRegistry.register('sku_attributes', (ctx, productIds, isRestore) => {
  const skuIds = ctx.helpers.getChildIds(ctx.tables.sku, 'product_id', productIds, false)
  if (skuIds.length === 0) return []
  
  const ids = ctx.helpers.getChildIds(ctx.tables.sku_attributes, 'sku_id', skuIds, isRestore)
  if (ids.length > 0) {
    ctx.helpers.updateBulk(ctx.tables.sku_attributes, ids, isRestore)
  }
  return ids
}, ['skus'])

relationshipRegistry.register('stock_purchases', (ctx, productIds, isRestore) => {
  const skuIds = ctx.helpers.getChildIds(ctx.tables.sku, 'product_id', productIds, false)
  if (skuIds.length === 0) return []
  
  const ids = ctx.helpers.getChildIds(ctx.tables.stock_purchases, 'sku_id', skuIds, isRestore)
  if (ids.length > 0) {
    ctx.helpers.updateBulk(ctx.tables.stock_purchases, ids, isRestore)
  }
  return ids
}, ['skus'])