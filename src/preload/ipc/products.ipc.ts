import { getDB } from '@db/sqlite3'
import { and, asc, desc, eq, inArray, isNull, like, or, sql, SQL } from 'drizzle-orm'
import { app, ipcMain } from 'electron'

import { relationshipRegistry } from '../registries/relationship'

import type { RelationshipContext } from '../registries/relationship'

import {
  attributes,
  product_categories, product_category_image,
  product_image,
  products, sku,
  sku_attributes,
  sku_images,
  stock_purchases,
  suppliers
} from '@schema/sqlite3/products'
import { sales } from '@schema/sqlite3/sales'

// import { customers } from '@schema/sqlite3/customers'

import type {
  CreateAttributePayload,
  CreateProductCategoryPayload,
  CreateProductPayload,
  CreateSkuAttributePayload,
  CreateSkuPayload,
  CreateStockPurchasePayload,
  CreateSupplierPayload,
  DeleteAttributePayload,
  DeleteCategoryPayload,
  DeleteSkuAttributePayload,
  DeleteStockPurchasePayload,
  DeleteSupplierPayload,
  GetAllAttributesPayload,
  GetAllSkuAttributesPayload,
  GetAllSkusPayload,
  GetAllStockPurchasesPayload,
  GetAllSuppliersPayload,
  GetAttributeByIdPayload,
  GetCategoriesPayload,
  GetProductByIdPayload,
  GetProductsByCategoryPayload,
  GetProductsPayload,
  GetSkuAttributeByIdPayload,
  GetStockPurchaseByIdPayload,
  GetSupplierByIdPayload,
  ProductSearchPayload,
  TriState,
  UpdateAttributePayload,
  UpdateProductCategoryPayload,
  UpdateProductPayload,
  UpdateSkuAttributePayload,
  UpdateSkuPayload,
  UpdateStockPurchasePayload,
  UpdateSupplierPayload
} from './type'

import fs from 'fs'
import path from 'path'

import { randomUUID } from 'crypto'

const db = () => getDB()

const safeParse = (val: any) => {
  try {
    if (!val) return null
    return JSON.parse(val)
  } catch {
    return null
  }
}



ipcMain.handle(
  'products-categories:get-all',
  async (
    _event,
    payload: GetCategoriesPayload = {
      nested: true,
      include_deleted: false,
      include_inactive: false
    }
  ) => {
    try {
      const nested = payload.nested ?? true
      const include_deleted = payload.include_deleted ?? false
      const include_inactive = payload.include_inactive ?? false

      /* ============================
         BUILD WHERE CONDITIONS
      ============================ */
      // const conditions = []

      // const conditions: ReturnType<typeof eq>[] = [];
      
      // if (!include_deleted) {
      //   conditions.push(eq(product_categories.is_deleted, false))
      // }
      // if (!include_inactive) {
      //   conditions.push(eq(product_categories.is_active, true))
      // }
      
      // const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const whereClause = and(
        include_deleted ? undefined : eq(product_categories.is_deleted, false),
        include_inactive ? undefined : eq(product_categories.is_active, true),
        // Only include categories whose parents are not deleted (unless include_deleted is true)
        include_deleted ? undefined : or(
          isNull(product_categories.parent_category_id),
          sql`NOT EXISTS (
            SELECT 1 FROM product_categories parent 
            WHERE parent.id = product_categories.parent_category_id 
            AND parent.is_deleted = 1
          )`
        )
      )

      /* ============================
         FETCH ALL DATA IN PARALLEL
      ============================ */
      const [categories, categoryImages, productCounts] = await Promise.all([
        // Fetch categories
        db()
          .select({
            id: product_categories.id,
            category_name: product_categories.category_name,
            parent_category_id: product_categories.parent_category_id,
            description: product_categories.description,
            created_on: product_categories.created_on,
            updated_on: product_categories.updated_on,
            last_sync: product_categories.last_sync,
            is_deleted: product_categories.is_deleted,
            is_active: product_categories.is_active,
            is_sync_required: product_categories.is_sync_required
          })
          .from(product_categories)
          .where(whereClause)
          .all(),

        // Fetch category images (only non-deleted)
        db()
          .select({
            product_category_id: product_category_image.product_category_id,
            image: product_category_image.image
          })
          .from(product_category_image)
          .where(eq(product_category_image.is_deleted, false))
          .all(),

        // Fetch product counts (only active, non-deleted products)
        db()
          .select({
            category_id: products.category_id,
            total: sql<number>`COUNT(*)`
          })
          .from(products)
          .where(
            and(
              eq(products.is_deleted, false),
              eq(products.is_active, true)
            )
          )
          .groupBy(products.category_id)
          .all()
      ])

      /* ============================
         BUILD IMAGE MAP (with JSON parse optimization)
      ============================ */
      const imageMap = new Map<number, any>()
      
      // Pre-allocate map size for better performance
      for (const img of categoryImages) {
        if (img.image) {
          try {
            imageMap.set(img.product_category_id, JSON.parse(img.image))
          } catch {
            imageMap.set(img.product_category_id, null) // Handle invalid JSON
          }
        } else {
          imageMap.set(img.product_category_id, null)
        }
      }

      /* ============================
         BUILD PRODUCT COUNT MAP
      ============================ */
      const productCountMap = new Map<number, number>()
      
      for (const row of productCounts) {
        productCountMap.set(row.category_id, Number(row.total))
      }

      /* ============================
         EARLY RETURN FOR FLAT STRUCTURE
      ============================ */
      if (!nested) {
        const flatCategories = categories.map((cat) => ({
          ...cat,
          image: imageMap.get(cat.id) ?? null,
          product_count: productCountMap.get(cat.id) ?? 0,
          sub_category_count: 0
        }))

        return {
          success: true,
          data: {
            categories: flatCategories
          }
        }
      }

      /* ============================
         BUILD TREE STRUCTURE (OPTIMIZED)
      ============================ */
      // Create a map of all categories with their base data
      const categoryMap = new Map<number, any>()
      const roots: any[] = []

      // First pass: create nodes with basic structure
      for (const cat of categories) {
        categoryMap.set(cat.id, {
          ...cat,
          image: imageMap.get(cat.id) ?? null,
          direct_product_count: productCountMap.get(cat.id) ?? 0,
          product_count: 0, // Will be calculated
          sub_category_count: 0, // Will be calculated
          sub_categories: []
        })
      }

      // Second pass: build tree structure
      for (const cat of categories) {
        const node = categoryMap.get(cat.id)
        
        if (!cat.parent_category_id) {
          roots.push(node)
        } else {
          const parent = categoryMap.get(cat.parent_category_id)
          if (parent) {
            parent.sub_categories.push(node)
          } else {
            // Orphaned category - treat as root
            roots.push(node)
          }
        }
      }

      /* ============================
         COMPUTE COUNTS USING POST-ORDER TRAVERSAL
      ============================ */
      function computeNodeTotals(node: any): { products: number; subs: number } {
        let totalProducts = node.direct_product_count
        let totalSubs = 0

        for (const child of node.sub_categories) {
          const childTotals = computeNodeTotals(child)
          totalProducts += childTotals.products
          totalSubs += childTotals.subs
        }

        totalSubs += node.sub_categories.length

        node.product_count = totalProducts
        node.sub_category_count = totalSubs
        
        // Clean up temporary field
        delete node.direct_product_count

        return { products: totalProducts, subs: totalSubs }
      }

      // Process all root nodes
      for (const root of roots) {
        computeNodeTotals(root)
      }

      /* ============================
         RESPONSE
      ============================ */
      return {
        success: true,
        data: {
          categories: roots
        }
      }

    } catch (error) {
      console.error('Error fetching product categories:', error)
      return {
        success: false,
        message: 'Failed to fetch product categories.'
      }
    }
  }
)


// ipcMain.handle(
//   'products-categories:create',
//   async (_event, payload: CreateProductCategoryPayload) => {
//     try {
//       /* ============================
//          CONFIG
//       ============================ */
//       const MAX_SUB = 10
//       console.log('Creating product category with payload00:', payload)

//       /* ============================
//          BASIC VALIDATION
//       ============================ */
//       if (!payload.category_name?.trim()) {
//         return { success: false, message: 'Category name is required.' }
//       }

//       const categoryName = payload.category_name.trim()

//       /* ============================
//          SUBCATEGORY VALIDATION
//       ============================ */
//       const subcategories = payload.subcategories ?? []

//       if (subcategories.length > MAX_SUB) {
//         return {
//           success: false,
//           message: `Maximum of ${MAX_SUB} subcategories allowed.`
//         }
//       }

//       /* ============================
//          IMAGE VALIDATION (PARENT)
//       ============================ */
//       if (payload.with_image && !payload.image_data) {
//         return {
//           success: false,
//           message: 'Category image data is required.'
//         }
//       }

//       /* ============================
//          CHECK CATEGORY UNIQUENESS
//       ============================ */
//       const existingCategory = db()
//         .select({ id: product_categories.id })
//         .from(product_categories)
//         .where(
//           and(
//             eq(product_categories.category_name, categoryName),
//             sql`${product_categories.parent_category_id} IS NULL`,
//             eq(product_categories.is_deleted, false)
//           )
//         )
//         .get()

//       if (existingCategory) {
//         return { success: false, message: 'Category already exists.' }
//       }

//       /* ============================
//          INSERT PARENT CATEGORY
//       ============================ */
//       const result = db()
//         .insert(product_categories)
//         .values({
//           category_name: categoryName,
//           description: payload.description?.trim() ?? '',
//           is_active: payload.is_active ?? true,
//           parent_category_id: null
//         })
//         .run()

//       const categoryId = Number(result.lastInsertRowid)

//       /* ============================
//          HANDLE PARENT IMAGE
//       ============================ */
//       if (payload.with_image && payload.image_data) {
//         const [meta, base64] = payload.image_data.split(',')
//         const mime = meta.match(/data:(.*);base64/)?.[1]

//         if (!mime) {
//           throw new Error('Invalid image data')
//         }

//         const buffer = Buffer.from(base64, 'base64')
//         const ext = mime.split('/')[1]

//         const categoriesDir = path.join(app.getPath('userData'), 'product_categories')
//         fs.mkdirSync(categoriesDir, { recursive: true })

//         const fileName = `category_${categoryId}.${ext}`
//         const filePath = path.join(categoriesDir, fileName)

//         fs.writeFileSync(filePath, buffer)

//         db()
//           .insert(product_category_image)
//           .values({
//             product_category_id: categoryId,
//             image: JSON.stringify({
//               path: filePath,
//               mime_type: mime
//             })
//           })
//           .run()
//       }

//       /* ============================
//          INSERT SUBCATEGORIES
//       ============================ */
//       const createdSubcategories: any[] = []

//       for (const sub of subcategories) {
//         if (!sub.category_name?.trim()) continue

//         const subName = sub.category_name.trim()

//         /* ----------------------------
//            SUB IMAGE VALIDATION
//         ---------------------------- */
//         if (sub.with_image && !sub.image_data) {
//           return {
//             success: false,
//             message: `Image data is required for subcategory: ${subName}`
//           }
//         }

//         /* ----------------------------
//            CHECK DUPLICATE SUBCATEGORY
//         ---------------------------- */
//         const existingSub = db()
//           .select({ id: product_categories.id })
//           .from(product_categories)
//           .where(
//             and(
//               eq(product_categories.category_name, subName),
//               eq(product_categories.parent_category_id, categoryId),
//               eq(product_categories.is_deleted, false)
//             )
//           )
//           .get()

//         if (existingSub) continue

//         /* ----------------------------
//            INSERT SUBCATEGORY
//         ---------------------------- */
//         const subResult = db()
//           .insert(product_categories)
//           .values({
//             category_name: subName,
//             description: sub.description?.trim() ?? '',
//             is_active: sub.is_active ?? true,
//             parent_category_id: categoryId
//           })
//           .run()

//         const subId = Number(subResult.lastInsertRowid)

//         /* ----------------------------
//            HANDLE SUBCATEGORY IMAGE
//         ---------------------------- */
//         if (sub.with_image && sub.image_data) {
//           const [meta, base64] = sub.image_data.split(',')
//           const mime = meta.match(/data:(.*);base64/)?.[1]

//           if (!mime) {
//             throw new Error('Invalid image data')
//           }

//           const buffer = Buffer.from(base64, 'base64')
//           const ext = mime.split('/')[1]

//           const categoriesDir = path.join(app.getPath('userData'), 'product_categories')
//           fs.mkdirSync(categoriesDir, { recursive: true })

//           const fileName = `subcategory_${subId}.${ext}`
//           const filePath = path.join(categoriesDir, fileName)

//           fs.writeFileSync(filePath, buffer)

//           db()
//             .insert(product_category_image)
//             .values({
//               product_category_id: subId,
//               image: JSON.stringify({
//                 path: filePath,
//                 mime_type: mime
//               })
//             })
//             .run()
//         }

//         createdSubcategories.push({
//           id: subId,
//           category_name: subName
//         })
//       }

//       /* ============================
//          RESPONSE
//       ============================ */
//       return {
//         success: true,
//         message: 'Category created successfully.',
//         data: {
//           id: categoryId,
//           category_name: categoryName,
//           subcategories: createdSubcategories
//         }
//       }
//     } catch (error) {
//       console.error('Error creating product category:', error)
//       return {
//         success: false,
//         message: 'Failed to create category.'
//       }
//     }
//   }
// )


// ipcMain.handle(
//   'products-categories:get-by-id',
//   async (_event, payload: {
//     id: number;
//     include_children?: boolean;
//     include_deleted?: boolean;
// }) => {
//     try {
//       if (!payload.id) {
//         return { success: false, message: 'Category id is required.' }
//       }

//       const includeChildren = payload.include_children ?? true
//         const includeDeleted = payload.include_deleted ?? false

//       /* ============================
//          FETCH CATEGORY
//       ============================ */
//       const category = db()
//         .select({
//           id: product_categories.id,
//           category_name: product_categories.category_name,
//           description: product_categories.description,
//           parent_category_id: product_categories.parent_category_id,
//           is_active: product_categories.is_active,
//           is_deleted: product_categories.is_deleted,
//           created_on: product_categories.created_on,
//           updated_on: product_categories.updated_on,
//           last_sync: product_categories.last_sync,
//           is_sync_required: product_categories.is_sync_required
//         })
//         .from(product_categories)
//         .where(
//           and(
//             eq(product_categories.id, payload.id),
//             eq(product_categories.is_deleted, includeDeleted)
//           )
//         )
//         .get()

//       if (!category) {
//         return { success: false, message: 'Category not found.' }
//       }

//       /* ============================
//          FETCH CATEGORY IMAGE
//       ============================ */
//       const img = db()
//         .select({
//           image: product_category_image.image
//         })
//         .from(product_category_image)
//         .where(
//           and(
//             eq(product_category_image.product_category_id, category.id),
//             eq(product_category_image.is_deleted, includeDeleted)
//           )
//         )
//         .get()

//       const image = img?.image ? JSON.parse(img.image) : null

//       /* ============================
//          FETCH SUBCATEGORIES
//       ============================ */
//       let subcategories: any[] = []

//       if (includeChildren) {
//         const children = db()
//           .select({
//             id: product_categories.id,
//             category_name: product_categories.category_name,
//             description: product_categories.description,
//             parent_category_id: product_categories.parent_category_id,
//             is_active: product_categories.is_active,
//             created_on: product_categories.created_on,
//             updated_on: product_categories.updated_on,
//             last_sync: product_categories.last_sync,
//             is_sync_required: product_categories.is_sync_required
//           })
//           .from(product_categories)
//           .where(
//             and(
//               eq(product_categories.parent_category_id, category.id),
//               eq(product_categories.is_deleted, includeDeleted)
//             )
//           )
//           .all()

//         subcategories = children.map((c) => {
//           const childImg = db()
//             .select({ image: product_category_image.image })
//             .from(product_category_image)
//             .where(
//               and(
//                 eq(product_category_image.product_category_id, c.id),
//                 eq(product_category_image.is_deleted, includeDeleted)
//               )
//             )
//             .get()

//           return {
//             ...c,
//             image: childImg?.image ? JSON.parse(childImg.image) : null
//           }
//         })
//       }

//       return {
//         success: true,
//         data: {
//           ...category,
//           image,
//           subcategories
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching category:', error)
//       return { success: false, message: 'Failed to fetch category.' }
//     }
//   }
// )#

ipcMain.handle(
  'products-categories:create',
  async (_event, payload: CreateProductCategoryPayload) => {
    try {
      /* ============================
         CONFIG
      ============================ */
      const MAX_SUB = 10

      /* ============================
         BASIC VALIDATION
      ============================ */
      if (!payload.category_name?.trim()) {
        return { success: false, message: 'Category name is required.' }
      }

      const categoryName = payload.category_name.trim()

      /* ============================
         SUBCATEGORY VALIDATION
      ============================ */
      const subcategories = payload.subcategories ?? []

      if (subcategories.length > MAX_SUB) {
        return {
          success: false,
          message: `Maximum of ${MAX_SUB} subcategories allowed.`
        }
      }

      /* ============================
         IMAGE VALIDATION (PARENT)
      ============================ */
      if (payload.with_image && !payload.image_data) {
        return {
          success: false,
          message: 'Category image data is required.'
        }
      }

      /* ============================
         CHECK CATEGORY UNIQUENESS
      ============================ */
      const existingCategory = db()
        .select({ id: product_categories.id })
        .from(product_categories)
        .where(
          and(
            eq(product_categories.category_name, categoryName),
            sql`${product_categories.parent_category_id} IS NULL`,
            eq(product_categories.is_deleted, false)
          )
        )
        .get()

      if (existingCategory) {
        return { success: false, message: 'Category already exists.' }
      }

      /* ============================
         PREPARE IMAGE STORAGE (if needed)
      ============================ */
      let categoriesDir: string | null = null
      
      if (payload.with_image || subcategories.some(s => s.with_image)) {
        categoriesDir = path.join(app.getPath('userData'), 'product_categories')
        fs.mkdirSync(categoriesDir, { recursive: true })
      }

      /* ============================
         SYNC IMAGE PROCESSING FUNCTION
      ============================ */
      const processImageSync = (imageData: string, prefix: string): string | null => {
        try {
          const [meta, base64] = imageData.split(',')
          const mimeMatch = meta.match(/data:(.*);base64/)
          
          if (!mimeMatch) {
            throw new Error('Invalid image data format')
          }

          const mime = mimeMatch[1]
          const buffer = Buffer.from(base64, 'base64')
          const ext = mime.split('/')[1] || 'jpg'
          
          // Use timestamp + random for unique filename (sync-safe)
          const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
          const filePath = path.join(categoriesDir!, fileName)

          fs.writeFileSync(filePath, buffer)

          return JSON.stringify({
            path: filePath,
            mime_type: mime,
            filename: fileName
          })
        } catch (error) {
          console.error('Image processing error:', error)
          throw new Error('Failed to process image')
        }
      }

      /* ============================
         SYNC TRANSACTION
      ============================ */
      const transactionResult = db().transaction(() => {
        try {
          /* ============================
             INSERT PARENT CATEGORY
          ============================ */
          const result = db()
            .insert(product_categories)
            .values({
              category_name: categoryName,
              description: payload.description?.trim() ?? '',
              is_active: payload.is_active ?? true,
              parent_category_id: null,
              created_on: sql`(strftime('%s', 'now'))`,
              updated_on: sql`(strftime('%s', 'now'))`
            })
            .run()

          const categoryId = Number(result.lastInsertRowid)

          /* ============================
             HANDLE PARENT IMAGE
          ============================ */
          if (payload.with_image && payload.image_data && categoriesDir) {
            const imageJson = processImageSync(payload.image_data, `category_${categoryId}`)
            
            if (imageJson) {
              db()
                .insert(product_category_image)
                .values({
                  product_category_id: categoryId,
                  image: imageJson,
                  created_on: sql`(strftime('%s', 'now'))`
                })
                .run()
            }
          }

          /* ============================
             INSERT SUBCATEGORIES
          ============================ */
          const createdSubcategories: any[] = []
          
          // Filter valid subcategories first
          const validSubs = subcategories.filter(sub => sub.category_name?.trim())
          
          if (validSubs.length > 0) {
            // Batch check for existing subcategories
            const subNames = validSubs.map(s => s.category_name.trim())
            
            const existingSubs = db()
              .select({ 
                category_name: product_categories.category_name,
                id: product_categories.id 
              })
              .from(product_categories)
              .where(
                and(
                  inArray(product_categories.category_name, subNames),
                  eq(product_categories.parent_category_id, categoryId),
                  eq(product_categories.is_deleted, false)
                )
              )
              .all()
            
            const existingSubNames = new Set(existingSubs.map(s => s.category_name))

            // Process each valid subcategory
            for (const sub of validSubs) {
              const subName = sub.category_name.trim()
              
              // Skip if already exists
              if (existingSubNames.has(subName)) continue

              /* ----------------------------
                 SUB IMAGE VALIDATION
              ---------------------------- */
              if (sub.with_image && !sub.image_data) {
                throw new Error(`Image data is required for subcategory: ${subName}`)
              }

              /* ----------------------------
                 INSERT SUBCATEGORY
              ---------------------------- */
              const subResult = db()
                .insert(product_categories)
                .values({
                  category_name: subName,
                  description: sub.description?.trim() ?? '',
                  is_active: sub.is_active ?? true,
                  parent_category_id: categoryId,
                  created_on: sql`(strftime('%s', 'now'))`,
                  updated_on: sql`(strftime('%s', 'now'))`
                })
                .run()

              const subId = Number(subResult.lastInsertRowid)

              /* ----------------------------
                 HANDLE SUBCATEGORY IMAGE
              ---------------------------- */
              if (sub.with_image && sub.image_data && categoriesDir) {
                const imageJson = processImageSync(sub.image_data, `subcategory_${subId}`)
                
                if (imageJson) {
                  db()
                    .insert(product_category_image)
                    .values({
                      product_category_id: subId,
                      image: imageJson,
                      created_on: sql`(strftime('%s', 'now'))`
                    })
                    .run()
                }
              }

              createdSubcategories.push({
                id: subId,
                category_name: subName
              })
            }
          }

          /* ============================
             RETURN SUCCESS
          ============================ */
          return {
            success: true,
            message: 'Category created successfully.',
            data: {
              id: categoryId,
              category_name: categoryName,
              subcategories: createdSubcategories
            }
          }

        } catch (error) {
          console.error('Transaction error:', error)
          // Re-throw to trigger rollback
          throw error
        }
      })

      return transactionResult

    } catch (error) {
      console.error('Error creating product category:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create category.'
      }
    }
  }
)

// ipcMain.handle(
//   'products-categories:get-by-id',
//   async (
//     _event,
//     payload: {
//       id: number
//       include_children?: boolean
//       include_deleted?: boolean
//     }
//   ) => {
//     try {
//       if (!payload.id) {
//         return { success: false, message: 'Category id is required.' }
//       }

//       const includeChildren = payload.include_children ?? true
//       const includeDeleted = payload.include_deleted ?? false

//       /* ============================
//          FETCH CATEGORY
//       ============================ */
//       const category = db()
//         .select({
//           id: product_categories.id,
//           category_name: product_categories.category_name,
//           description: product_categories.description,
//           parent_category_id: product_categories.parent_category_id,
//           is_active: product_categories.is_active,
//           is_deleted: product_categories.is_deleted,
//           created_on: product_categories.created_on,
//           updated_on: product_categories.updated_on,
//           last_sync: product_categories.last_sync,
//           is_sync_required: product_categories.is_sync_required
//         })
//         .from(product_categories)
//         .where(
//           and(
//             eq(product_categories.id, payload.id),
//             eq(product_categories.is_deleted, includeDeleted)
//           )
//         )
//         .get()

//       if (!category) {
//         return { success: false, message: 'Category not found.' }
//       }

//       /* ============================
//          FETCH CATEGORY IMAGE
//       ============================ */
//       const img = db()
//         .select({
//           image: product_category_image.image
//         })
//         .from(product_category_image)
//         .where(
//           and(
//             eq(product_category_image.product_category_id, category.id),
//             eq(product_category_image.is_deleted, includeDeleted)
//           )
//         )
//         .get()

//       const image = img?.image ? JSON.parse(img.image) : null

//       /* ============================
//          FETCH SUBCATEGORIES (IF NEEDED)
//       ============================ */
//       let subcategories: any[] = []

//       if (includeChildren) {
//         const children = db()
//           .select({
//             id: product_categories.id,
//             category_name: product_categories.category_name,
//             description: product_categories.description,
//             parent_category_id: product_categories.parent_category_id,
//             is_active: product_categories.is_active,
//             is_deleted: product_categories.is_deleted,
//             created_on: product_categories.created_on,
//             updated_on: product_categories.updated_on,
//             last_sync: product_categories.last_sync,
//             is_sync_required: product_categories.is_sync_required
//           })
//           .from(product_categories)
//           .where(
//             and(
//               eq(product_categories.parent_category_id, category.id),
//               eq(product_categories.is_deleted, includeDeleted)
//             )
//           )
//           .all()

//         /* ============================
//            FETCH ALL CHILD IMAGES IN ONE QUERY
//         ============================ */
//         const childImages = db()
//           .select({
//             product_category_id: product_category_image.product_category_id,
//             image: product_category_image.image
//           })
//           .from(product_category_image)
//           .where(eq(product_category_image.is_deleted, includeDeleted))
//           .all()

//         const imageMap = new Map<number, any>()

//         childImages.forEach((img) => {
//           imageMap.set(
//             img.product_category_id,
//             img.image ? JSON.parse(img.image) : null
//           )
//         })

//         /* ============================
//            FETCH PRODUCT COUNTS
//         ============================ */
//         const productCounts = db()
//           .select({
//             category_id: products.category_id,
//             count: sql<number>`count(*)`.as('count')
//           })
//           .from(products)
//           .where(eq(products.is_deleted, includeDeleted))
//           .groupBy(products.category_id)
//           .all()

//         const productCountMap = new Map<number, number>()

//         productCounts.forEach((p) => {
//           productCountMap.set(p.category_id, Number(p.count))
//         })

//         /* ============================
//            BUILD SUBCATEGORY RESPONSE
//         ============================ */
//         subcategories = children.map((c) => ({
//           ...c,
//           image: imageMap.get(c.id) ?? null,
//           product_count: productCountMap.get(c.id) ?? 0,
//           sub_category_count: 0,
//           sub_categories: []
//         }))
//       }

//       /* ============================
//          CATEGORY PRODUCT COUNT
//          (includes children if includeChildren=true)
//       ============================ */
//       const directProductCountRow = db()
//         .select({
//           count: sql<number>`count(*)`.as('count')
//         })
//         .from(products)
//         .where(
//           and(
//             eq(products.category_id, category.id),
//             eq(products.is_deleted, includeDeleted)
//           )
//         )
//         .get()

//       const directProductCount = Number(directProductCountRow?.count ?? 0)

//       const childrenProductCount = subcategories.reduce(
//         (sum, c) => sum + (c.product_count ?? 0),
//         0
//       )

//       const totalProductCount = includeChildren
//         ? directProductCount + childrenProductCount
//         : directProductCount

//       /* ============================
//          SUB CATEGORY COUNT
//       ============================ */
//       const subCategoryCount = subcategories.length

//       return {
//         success: true,
//         data: {
//           ...category,
//           image,

//           product_count: totalProductCount,
//           sub_category_count: subCategoryCount,

//           subcategories
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching category:', error)
//       return { success: false, message: 'Failed to fetch category.' }
//     }
//   }
// )

ipcMain.handle(
  'products-categories:get-by-id',
  async (
    _event,
    payload: {
      id: number
      include_children?: boolean
      include_deleted?: boolean
    }
  ) => {
    try {
      if (!payload.id) {
        return { success: false, message: 'Category id is required.' }
      }

      const includeChildren = payload.include_children ?? true
      const includeDeleted = payload.include_deleted ?? false

      /* ============================
         BUILD WHERE CONDITIONS
      ============================ */
      const categoryConditions = [
        eq(product_categories.id, payload.id)
      ]
      
      if (!includeDeleted) {
        categoryConditions.push(eq(product_categories.is_deleted, false))
      }

      /* ============================
         FETCH CATEGORY AND IMAGE IN PARALLEL
      ============================ */
      const [category, img] = await Promise.all([
        // Fetch category
        db()
          .select({
            id: product_categories.id,
            category_name: product_categories.category_name,
            description: product_categories.description,
            parent_category_id: product_categories.parent_category_id,
            is_active: product_categories.is_active,
            is_deleted: product_categories.is_deleted,
            created_on: product_categories.created_on,
            updated_on: product_categories.updated_on,
            last_sync: product_categories.last_sync,
            is_sync_required: product_categories.is_sync_required
          })
          .from(product_categories)
          .where(and(...categoryConditions))
          .get(),

        // Fetch category image
        db()
          .select({
            image: product_category_image.image
          })
          .from(product_category_image)
          .where(
            and(
              eq(product_category_image.product_category_id, payload.id),
              eq(product_category_image.is_deleted, includeDeleted)
            )
          )
          .get()
      ])

      if (!category) {
        return { success: false, message: 'Category not found.' }
      }

      // Parse image JSON
      const image = img?.image ? (() => {
        try {
          return JSON.parse(img.image)
        } catch {
          return null
        }
      })() : null

      /* ============================
         PREPARE DATA STRUCTURE
      ============================ */
      let subcategories: any[] = []
      let directProductCount = 0
      let childrenProductCount = 0
      let subCategoryCount = 0

      /* ============================
         FETCH CHILDREN AND RELATED DATA IN PARALLEL
      ============================ */
      if (includeChildren) {
        const [children, childImages, directCountResult, allProductCounts] = await Promise.all([
          // Fetch subcategories
          db()
            .select({
              id: product_categories.id,
              category_name: product_categories.category_name,
              description: product_categories.description,
              parent_category_id: product_categories.parent_category_id,
              is_active: product_categories.is_active,
              is_deleted: product_categories.is_deleted,
              created_on: product_categories.created_on,
              updated_on: product_categories.updated_on,
              last_sync: product_categories.last_sync,
              is_sync_required: product_categories.is_sync_required
            })
            .from(product_categories)
            .where(
              and(
                eq(product_categories.parent_category_id, category.id),
                !includeDeleted ? eq(product_categories.is_deleted, false) : undefined
              )
            )
            .all(),

          // Fetch ALL child images in one query
          db()
            .select({
              product_category_id: product_category_image.product_category_id,
              image: product_category_image.image
            })
            .from(product_category_image)
            .where(eq(product_category_image.is_deleted, includeDeleted))
            .all(),

          // Fetch direct product count for this category
          db()
            .select({
              count: sql<number>`count(*)`.as('count')
            })
            .from(products)
            .where(
              and(
                eq(products.category_id, category.id),
                !includeDeleted ? eq(products.is_deleted, false) : undefined
              )
            )
            .get(),

          // Fetch ALL product counts in one query
          db()
            .select({
              category_id: products.category_id,
              count: sql<number>`count(*)`.as('count')
            })
            .from(products)
            .where(!includeDeleted ? eq(products.is_deleted, false) : undefined)
            .groupBy(products.category_id)
            .all()
        ])

        // Build image map
        const imageMap = new Map<number, any>()
        for (const img of childImages) {
          if (img.image) {
            try {
              imageMap.set(img.product_category_id, JSON.parse(img.image))
            } catch {
              imageMap.set(img.product_category_id, null)
            }
          } else {
            imageMap.set(img.product_category_id, null)
          }
        }

        // Build product count map
        const productCountMap = new Map<number, number>()
        for (const p of allProductCounts) {
          productCountMap.set(p.category_id, Number(p.count))
        }

        // Build subcategories with their data
        subcategories = children.map((c) => ({
          ...c,
          image: imageMap.get(c.id) ?? null,
          product_count: productCountMap.get(c.id) ?? 0,
          sub_category_count: 0, // These are leaf nodes, so 0
          sub_categories: []
        }))

        // Calculate children product count
        childrenProductCount = subcategories.reduce(
          (sum, c) => sum + (c.product_count ?? 0),
          0
        )

        subCategoryCount = subcategories.length
        directProductCount = Number(directCountResult?.count ?? 0)
      } else {
        // If not including children, just get direct product count
        const directCountResult = db()
          .select({
            count: sql<number>`count(*)`.as('count')
          })
          .from(products)
          .where(
            and(
              eq(products.category_id, category.id),
              !includeDeleted ? eq(products.is_deleted, false) : undefined
            )
          )
          .get()

        directProductCount = Number(directCountResult?.count ?? 0)
      }

      /* ============================
         CALCULATE TOTAL PRODUCT COUNT
      ============================ */
      const totalProductCount = includeChildren
        ? directProductCount + childrenProductCount
        : directProductCount

      /* ============================
         RETURN RESPONSE
      ============================ */
      return {
        success: true,
        data: {
          ...category,
          image,
          product_count: totalProductCount,
          sub_category_count: subCategoryCount,
          subcategories
        }
      }

    } catch (error) {
      console.error('Error fetching category:', error)
      return { success: false, message: 'Failed to fetch category.' }
    }
  }
)


// ipcMain.handle(
//   'products-categories:update',
//   async (_event, payload: UpdateProductCategoryPayload) => {
//     try {
//       if (!payload.id) {
//         return { success: false, message: 'Category id is required.' }
//       }

//       /* ============================
//          CHECK CATEGORY EXISTS
//       ============================ */
//       const existing = db()
//         .select({ id: product_categories.id })
//         .from(product_categories)
//         .where(
//           and(
//             eq(product_categories.id, payload.id),
//             eq(product_categories.is_deleted, false)
//           )
//         )
//         .get()

//       if (!existing) {
//         return { success: false, message: 'Category not found.' }
//       }

//       /* ============================
//          BUILD UPDATE OBJECT DYNAMICALLY
//       ============================ */
//       const updateData: any = {}

//       if (payload.category_name !== undefined) {
//         if (!payload.category_name.trim()) {
//           return { success: false, message: 'Category name cannot be empty.' }
//         }
//         updateData.category_name = payload.category_name.trim()
//       }

//       if (payload.description !== undefined) {
//         updateData.description = payload.description.trim()
//       }

//       if (payload.is_active !== undefined) {
//         updateData.is_active = payload.is_active
//       }

//       if (payload.parent_category_id !== undefined) {
//         updateData.parent_category_id = payload.parent_category_id
//       }

//       updateData.updated_on = sql`(CURRENT_TIMESTAMP)`
//       updateData.is_sync_required = true

//       /* ============================
//          UPDATE CATEGORY TABLE
//       ============================ */
//       if (Object.keys(updateData).length > 0) {
//         db()
//           .update(product_categories)
//           .set(updateData)
//           .where(eq(product_categories.id, payload.id))
//           .run()
//       }

//       /* ============================
//          UPDATE IMAGE (OPTIONAL)
//       ============================ */
//       if (payload.update_image) {
//         if (!payload.image_data) {
//           return {
//             success: false,
//             message: 'Image data is required when update_image is true.'
//           }
//         }

//         const [meta, base64] = payload.image_data.split(',')
//         const mime = meta.match(/data:(.*);base64/)?.[1]

//         if (!mime) {
//           throw new Error('Invalid image data')
//         }

//         const buffer = Buffer.from(base64, 'base64')
//         const ext = mime.split('/')[1]

//         const categoriesDir = path.join(app.getPath('userData'), 'product_categories')
//         fs.mkdirSync(categoriesDir, { recursive: true })

//         const fileName = `category_${payload.id}.${ext}`
//         const filePath = path.join(categoriesDir, fileName)

//         fs.writeFileSync(filePath, buffer)

//         const existingImg = db()
//           .select({ id: product_category_image.id })
//           .from(product_category_image)
//           .where(
//             and(
//               eq(product_category_image.product_category_id, payload.id),
//               eq(product_category_image.is_deleted, false)
//             )
//           )
//           .get()

//         if (existingImg) {
//           db()
//             .update(product_category_image)
//             .set({
//               image: JSON.stringify({ path: filePath, mime_type: mime }),
//               updated_on: sql`(CURRENT_TIMESTAMP)`,
//               is_sync_required: true
//             })
//             .where(eq(product_category_image.id, existingImg.id))
//             .run()
//         } else {
//           db()
//             .insert(product_category_image)
//             .values({
//               product_category_id: payload.id,
//               image: JSON.stringify({ path: filePath, mime_type: mime })
//             })
//             .run()
//         }
//       }

//       return {
//         success: true,
//         message: 'Category updated successfully.'
//       }
//     } catch (error) {
//       console.error('Error updating category:', error)
//       return { success: false, message: 'Failed to update category.' }
//     }
//   }
// )


ipcMain.handle(
  'products-categories:update',
  async (_event, payload: UpdateProductCategoryPayload) => {
    try {
      if (!payload.id) {
        return { success: false, message: 'Category id is required.' }
      }

      /* ============================
         VALIDATE CATEGORY NAME IF PROVIDED
      ============================ */
      if (payload.category_name !== undefined && !payload.category_name.trim()) {
        return { success: false, message: 'Category name cannot be empty.' }
      }

      /* ============================
         CHECK CATEGORY EXISTS AND FETCH CURRENT DATA
      ============================ */
      const existing = db()
        .select({ 
          id: product_categories.id,
          category_name: product_categories.category_name,
          description: product_categories.description,
          is_active: product_categories.is_active,
          parent_category_id: product_categories.parent_category_id
        })
        .from(product_categories)
        .where(
          and(
            eq(product_categories.id, payload.id),
            eq(product_categories.is_deleted, false)
          )
        )
        .get()

      if (!existing) {
        return { success: false, message: 'Category not found.' }
      }

      /* ============================
         CHECK FOR DUPLICATE CATEGORY NAME (IF CHANGED)
      ============================ */
      if (payload.category_name && payload.category_name.trim() !== existing.category_name) {
        const parentId = payload.parent_category_id ?? existing.parent_category_id
        
        const parentCondition = parentId === null 
          ? sql`${product_categories.parent_category_id} IS NULL`
          : eq(product_categories.parent_category_id, parentId)
        
        const duplicate = db()
          .select({ id: product_categories.id })
          .from(product_categories)
          .where(
            and(
              eq(product_categories.category_name, payload.category_name.trim()),
              parentCondition,
              eq(product_categories.is_deleted, false),
              sql`${product_categories.id} != ${payload.id}`
            )
          )
          .get()

        if (duplicate) {
          return { 
            success: false, 
            message: 'Another category with this name already exists at the same level.' 
          }
        }
      }

      /* ============================
         PREPARE UPDATE OBJECT
      ============================ */
      const updateData: any = {
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      }

      if (payload.category_name !== undefined) {
        updateData.category_name = payload.category_name.trim()
      }

      if (payload.description !== undefined) {
        updateData.description = payload.description.trim() || ''
      }

      if (payload.is_active !== undefined) {
        updateData.is_active = payload.is_active
      }

      if (payload.parent_category_id !== undefined) {
        // Prevent setting parent to itself
        if (payload.parent_category_id === payload.id) {
          return { success: false, message: 'Category cannot be its own parent.' }
        }
        updateData.parent_category_id = payload.parent_category_id
      }

      /* ============================
         HANDLE IMAGE UPDATE (IF NEEDED)
      ============================ */
      // let imageUpdatePromise = Promise.resolve()

      if (payload.update_image) {
        if (!payload.image_data) {
          return {
            success: false,
            message: 'Image data is required when update_image is true.'
          }
        }

        // Process image synchronously for transaction
        const processImageSync = (): { imageJson: string, filePath: string } => {
          const [meta, base64] = payload.image_data!.split(',')
          const mimeMatch = meta.match(/data:(.*);base64/)
          
          if (!mimeMatch) {
            throw new Error('Invalid image data format')
          }

          const mime = mimeMatch[1]
          const buffer = Buffer.from(base64, 'base64')
          const ext = mime.split('/')[1] || 'jpg'
          
          const categoriesDir = path.join(app.getPath('userData'), 'product_categories')
          fs.mkdirSync(categoriesDir, { recursive: true })

          // Use timestamp for unique filename
          const fileName = `category_${payload.id}_${Date.now()}.${ext}`
          const filePath = path.join(categoriesDir, fileName)

          fs.writeFileSync(filePath, buffer)

          const imageJson = JSON.stringify({
            path: filePath,
            mime_type: mime,
            filename: fileName,
            updated_at: Date.now()
          })

          return { imageJson, filePath }
        }

        /* ============================
           UPDATE IMAGE IN TRANSACTION
        ============================ */
        db().transaction(() => {
          try {
            const { imageJson } = processImageSync()

            const existingImg = db()
              .select({ id: product_category_image.id })
              .from(product_category_image)
              .where(
                and(
                  eq(product_category_image.product_category_id, payload.id),
                  eq(product_category_image.is_deleted, false)
                )
              )
              .get()

            if (existingImg) {
              // Get old image path for cleanup (optional)
              const oldImage = db()
                .select({ image: product_category_image.image })
                .from(product_category_image)
                .where(eq(product_category_image.id, existingImg.id))
                .get()

              // Update existing image
              db()
                .update(product_category_image)
                .set({
                  image: imageJson,
                  updated_on: sql`(strftime('%s', 'now'))`,
                  is_sync_required: true
                })
                .where(eq(product_category_image.id, existingImg.id))
                .run()

              // Optionally delete old image file
              if (oldImage?.image) {
                try {
                  const oldImageData = JSON.parse(oldImage.image)
                  if (oldImageData.path && fs.existsSync(oldImageData.path)) {
                    fs.unlinkSync(oldImageData.path) // Delete old file
                  }
                } catch (e) {
                  console.warn('Could not delete old image file:', e)
                }
              }
            } else {
              // Insert new image
              db()
                .insert(product_category_image)
                .values({
                  product_category_id: payload.id,
                  image: imageJson,
                  created_on: sql`(strftime('%s', 'now'))`,
                  is_sync_required: true
                })
                .run()
            }
          } catch (error) {
            console.error('Image update transaction error:', error)
            throw error // Rollback transaction
          }
        })
      }

      /* ============================
         UPDATE CATEGORY TABLE (IF NEEDED)
      ============================ */
      if (Object.keys(updateData).length > 1) { // >1 because we always have updated_on
        db().transaction(() => {
          try {
            db()
              .update(product_categories)
              .set(updateData)
              .where(eq(product_categories.id, payload.id))
              .run()

            // If parent_category_id changed, update children's sync status
            if (payload.parent_category_id !== undefined) {
              db()
                .update(product_categories)
                .set({ 
                  is_sync_required: true,
                  updated_on: sql`(strftime('%s', 'now'))`
                })
                .where(eq(product_categories.parent_category_id, payload.id))
                .run()
            }
          } catch (error) {
            console.error('Category update transaction error:', error)
            throw error
          }
        })
      }

      /* ============================
         FETCH UPDATED CATEGORY FOR RESPONSE
      ============================ */
      const updated = db()
        .select({
          id: product_categories.id,
          category_name: product_categories.category_name,
          description: product_categories.description,
          parent_category_id: product_categories.parent_category_id,
          is_active: product_categories.is_active,
          updated_on: product_categories.updated_on
        })
        .from(product_categories)
        .where(eq(product_categories.id, payload.id))
        .get()

      return {
        success: true,
        message: 'Category updated successfully.',
        data: updated
      }

    } catch (error) {
      console.error('Error updating category:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update category.' 
      }
    }
  }
)


// ipcMain.handle(
//   'products-categories:soft-delete',
//   async (_event, payload: DeleteCategoryPayload) => {
//     try {
//       if (!payload.id) {
//         return { success: false, message: 'Category ID is required.' }
//       }

//       const cascade = payload.cascade ?? true

//       const existing = db()
//         .select({ id: product_categories.id })
//         .from(product_categories)
//         .where(
//           and(
//             eq(product_categories.id, payload.id),
//             eq(product_categories.is_deleted, false)
//           )
//         )
//         .get()

//       if (!existing) {
//         return { success: false, message: 'Category not found.' }
//       }

//       /* ============================
//          DELETE MAIN CATEGORY
//       ============================ */
//       db()
//         .update(product_categories)
//         .set({
//           is_deleted: true,
//           updated_on: sql`(CURRENT_TIMESTAMP)`,
//           is_sync_required: true
//         })
//         .where(eq(product_categories.id, payload.id))
//         .run()

//       db()
//         .update(product_category_image)
//         .set({
//           is_deleted: true,
//           updated_on: sql`(CURRENT_TIMESTAMP)`,
//           is_sync_required: true
//         })
//         .where(eq(product_category_image.product_category_id, payload.id))
//         .run()

//       /* ============================
//          CASCADE CHILDREN
//       ============================ */
//       if (cascade) {
//         const children = db()
//           .select({ id: product_categories.id })
//           .from(product_categories)
//           .where(
//             and(
//               eq(product_categories.parent_category_id, payload.id),
//               eq(product_categories.is_deleted, false)
//             )
//           )
//           .all()

//         for (const child of children) {
//           db()
//             .update(product_categories)
//             .set({
//               is_deleted: true,
//               updated_on: sql`(CURRENT_TIMESTAMP)`,
//               is_sync_required: true
//             })
//             .where(eq(product_categories.id, child.id))
//             .run()

//           db()
//             .update(product_category_image)
//             .set({
//               is_deleted: true,
//               updated_on: sql`(CURRENT_TIMESTAMP)`,
//               is_sync_required: true
//             })
//             .where(eq(product_category_image.product_category_id, child.id))
//             .run()
//         }
//       }

//       return {
//         success: true,
//         message: cascade
//           ? 'Category and subcategories deleted successfully.'
//           : 'Category deleted successfully.'
//       }
//     } catch (error) {
//       console.error(error)
//       return { success: false, message: 'Failed to delete category.' }
//     }
//   }
// )


ipcMain.handle(
  'products-categories:soft-delete',
  async (_event, payload: DeleteCategoryPayload) => {
    try {
      const cascade = payload.cascade ?? true

      if (!payload.id) {
        return { success: false, message: 'Category ID is required.' }
      }

      /* ============================
         CHECK IF CATEGORY EXISTS
      ============================ */
      const category = db()
        .select({ 
          id: product_categories.id,
          category_name: product_categories.category_name,
          is_deleted: product_categories.is_deleted 
        })
        .from(product_categories)
        .where(eq(product_categories.id, payload.id))
        .get()

      if (!category) {
        return { success: false, message: 'Category not found.' }
      }

      if (category.is_deleted) {
        return { success: false, message: 'Category is already deleted.' }
      }

      /* ============================
         HELPER FUNCTION: GET ALL DESCENDANT CATEGORY IDs
      ============================ */
      const getAllDescendantIds = (parentId: number): number[] => {
        const descendants: number[] = []
        
        const directChildren = db()
          .select({ id: product_categories.id })
          .from(product_categories)
          .where(
            and(
              eq(product_categories.parent_category_id, parentId),
              eq(product_categories.is_deleted, false)
            )
          )
          .all()
        
        for (const child of directChildren) {
          descendants.push(child.id)
          // Recursively get grandchildren
          const grandChildren = getAllDescendantIds(child.id)
          descendants.push(...grandChildren)
        }
        
        return descendants
      }

      /* ============================
         HELPER FUNCTION: GET ALL PRODUCT IDs IN CATEGORIES
      ============================ */
      const getProductIdsInCategories = (categoryIds: number[]): number[] => {
        if (categoryIds.length === 0) return []
        
        const products_result = db()
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              inArray(products.category_id, categoryIds),
              eq(products.is_deleted, false)
            )
          )
          .all()
        
        return products_result.map(p => p.id)
      }

      /* ============================
         HELPER FUNCTION: GET ALL SKU IDs IN PRODUCTS
      ============================ */
      const getSkuIdsInProducts = (productIds: number[]): number[] => {
        if (productIds.length === 0) return []
        
        const skus_result = db()
          .select({ id: sku.id })
          .from(sku)
          .where(
            and(
              inArray(sku.product_id, productIds),
              eq(sku.is_deleted, false)
            )
          )
          .all()
        
        return skus_result.map(s => s.id)
      }

      /* ============================
         PERFORM SOFT DELETE IN TRANSACTION
      ============================ */
      const result = db().transaction(() => {
        try {
          // Get all descendant category IDs if cascading
          const descendantIds = cascade ? getAllDescendantIds(payload.id) : []
          const allCategoryIds = [payload.id, ...descendantIds]

          // Get all product IDs in these categories
          const productIds = getProductIdsInCategories(allCategoryIds)

          // Get all SKU IDs for these products
          const skuIds = getSkuIdsInProducts(productIds)

          /* ============================
             STAGE 1: SOFT DELETE CATEGORIES
          ============================ */
          // Delete main category
          db()
            .update(product_categories)
            .set({
              is_deleted: true,
              updated_on: sql`(strftime('%s', 'now'))`,
              is_sync_required: true
            })
            .where(eq(product_categories.id, payload.id))
            .run()

          // Delete category images
          db()
            .update(product_category_image)
            .set({
              is_deleted: true,
              updated_on: sql`(strftime('%s', 'now'))`,
              is_sync_required: true
            })
            .where(eq(product_category_image.product_category_id, payload.id))
            .run()

          // Delete descendant categories (if cascading)
          if (descendantIds.length > 0) {
            db()
              .update(product_categories)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(product_categories.id, descendantIds))
              .run()

            // Delete descendant category images
            db()
              .update(product_category_image)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(product_category_image.product_category_id, descendantIds))
              .run()
          }

          /* ============================
             STAGE 2: SOFT DELETE PRODUCTS (if cascading)
          ============================ */
          if (cascade && productIds.length > 0) {
            // Delete products
            db()
              .update(products)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(products.id, productIds))
              .run()

            // Delete product images
            db()
              .update(product_image)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(product_image.product_id, productIds))
              .run()
          }

          /* ============================
             STAGE 3: SOFT DELETE SKUS (if cascading)
          ============================ */
          if (cascade && skuIds.length > 0) {
            // Delete SKUs
            db()
              .update(sku)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(sku.id, skuIds))
              .run()

            // Delete SKU images
            db()
              .update(sku_images)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(sku_images.sku_id, skuIds))
              .run()

            // Delete SKU attributes
            db()
              .update(sku_attributes)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(sku_attributes.sku_id, skuIds))
              .run()

            /* ============================
               STAGE 4: SOFT DELETE STOCK PURCHASES
            ============================ */
            // Get stock purchases for these SKUs
            const stockPurchaseIds = db()
              .select({ id: stock_purchases.id })
              .from(stock_purchases)
              .where(
                and(
                  inArray(stock_purchases.sku_id, skuIds),
                  eq(stock_purchases.is_deleted, false)
                )
              )
              .all()

            if (stockPurchaseIds.length > 0) {
              db()
                .update(stock_purchases)
                .set({
                  is_deleted: true,
                  updated_on: sql`(strftime('%s', 'now'))`,
                  is_sync_required: true
                })
                .where(inArray(stock_purchases.id, stockPurchaseIds.map(sp => sp.id)))
                .run()
            }
          }

          /* ============================
             CHECK FOR ORPHANED DATA (if not cascading)
          ============================ */
          if (!cascade) {
            // Check if there are products in this category
            const productsInCategory = db()
              .select({ id: products.id })
              .from(products)
              .where(
                and(
                  eq(products.category_id, payload.id),
                  eq(products.is_deleted, false)
                )
              )
              .get()

            if (productsInCategory) {
              throw new Error('Cannot delete category with existing products. Use cascade=true to delete all.')
            }

            // Check if there are subcategories
            const subcategories = db()
              .select({ id: product_categories.id })
              .from(product_categories)
              .where(
                and(
                  eq(product_categories.parent_category_id, payload.id),
                  eq(product_categories.is_deleted, false)
                )
              )
              .get()

            if (subcategories) {
              throw new Error('Cannot delete category with existing subcategories. Use cascade=true to delete all.')
            }
          }

          return {
            success: true,
            message: cascade 
              ? 'Category and all related data deleted successfully.' 
              : 'Category deleted successfully.',
            data: {
              id: payload.id,
              category_name: category.category_name,
              deleted_categories: allCategoryIds.length,
              deleted_products: productIds.length,
              deleted_skus: skuIds.length,
              cascaded: cascade
            }
          }

        } catch (error) {
          console.error('Transaction error:', error)
          throw error // Rollback transaction
        }
      })

      return result

    } catch (error) {
      console.error('Error soft deleting category:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete category.' 
      }
    }
  }
)

 
ipcMain.handle(
  'products-categories:restore',
  async (_event, payload: { id: number; cascade?: boolean }) => {
    try {
      const cascade = payload.cascade ?? true

      const category = db()
        .select({ id: product_categories.id })
        .from(product_categories)
        .where(
          and(
            eq(product_categories.id, payload.id),
            eq(product_categories.is_deleted, true)
          )
        )
        .get()

      if (!category) {
        return { success: false, message: 'Deleted category not found.' }
      }

      return db().transaction(() => {
        // Restore category
        db()
          .update(product_categories)
          .set({
            is_deleted: false,
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          })
          .where(eq(product_categories.id, payload.id))
          .run()

        // Restore category image
        db()
          .update(product_category_image)
          .set({
            is_deleted: false,
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          })
          .where(eq(product_category_image.product_category_id, payload.id))
          .run()

        if (cascade) {
          // Restore all descendant categories
          db()
            .update(product_categories)
            .set({
              is_deleted: false,
              updated_on: sql`(strftime('%s', 'now'))`,
              is_sync_required: true
            })
            .where(eq(product_categories.parent_category_id, payload.id))
            .run()

          // Restore products in this category
          db()
            .update(products)
            .set({
              is_deleted: false,
              updated_on: sql`(strftime('%s', 'now'))`,
              is_sync_required: true
            })
            .where(eq(products.category_id, payload.id))
            .run()
        }

        return { 
          success: true, 
          message: cascade ? 'Category and related items restored.' : 'Category restored.' 
        }
      })

    } catch (error) {
      console.error('Error restoring category:', error)
      return { success: false, message: 'Failed to restore category.' }
    }
  }
)


// ipcMain.handle(
//   'products:create',
//   async (_event, payload: CreateProductPayload) => {
//     try {
//       const MAX_IMAGES = 3

//       /* ============================
//          VALIDATION
//       ============================ */
//       if (!payload.product_name?.trim()) {
//         return { success: false, message: 'Product name is required.' }
//       }

//       if (!payload.category_id) {
//         return { success: false, message: 'Category id is required.' }
//       }

//       const images = payload.images ?? []

//       if (images.length > MAX_IMAGES) {
//         return {
//           success: false,
//           message: `Maximum of ${MAX_IMAGES} images allowed.`
//         }
//       }

//       /* ============================
//          CHECK CATEGORY EXISTS
//       ============================ */
//       const categoryExists = db()
//         .select({ id: product_categories.id })
//         .from(product_categories)
//         .where(
//           and(
//             eq(product_categories.id, payload.category_id),
//             eq(product_categories.is_deleted, false)
//           )
//         )
//         .get()

//       if (!categoryExists) {
//         return { success: false, message: 'Category not found.' }
//       }

//       /* ============================
//          INSERT PRODUCT
//       ============================ */
//       const result = db()
//         .insert(products)
//         .values({
//           product_name: payload.product_name.trim(),
//           category_id: payload.category_id,
//           description: payload.description?.trim() ?? '',
//           is_active: payload.is_active ?? true
//         })
//         .run()

//       const productId = Number(result.lastInsertRowid)

//       /* ============================
//          HANDLE PRODUCT IMAGES (0-3)
//       ============================ */
//       const createdImages: any[] = []

//       for (const img of images) {
//         if (!img.image_data?.trim()) continue

//         const [meta, base64] = img.image_data.split(',')
//         const mime = meta.match(/data:(.*);base64/)?.[1]

//         if (!mime) {
//           return { success: false, message: 'Invalid image data format.' }
//         }

//         const buffer = Buffer.from(base64, 'base64')
//         const ext = mime.split('/')[1]

//         const productsDir = path.join(app.getPath('userData'), 'products')
//         fs.mkdirSync(productsDir, { recursive: true })

//         const fileName = `product_${productId}_${Date.now()}.${ext}`
//         const filePath = path.join(productsDir, fileName)

//         fs.writeFileSync(filePath, buffer)

//         const insertImg = db()
//           .insert(product_image)
//           .values({
//             product_id: productId,
//             image: JSON.stringify({
//               path: filePath,
//               filename: fileName,
//               original_filename: img.original_filename ?? '',
//               mime_type: mime,
//               file_size: buffer.length,
//               uploaded_at: new Date().toISOString()
//             })
//           })
//           .run()

//         createdImages.push({
//           id: Number(insertImg.lastInsertRowid),
//           path: filePath,
//           filename: fileName
//         })
//       }

//       return {
//         success: true,
//         message: 'Product created successfully.',
//         data: {
//           id: productId,
//           images: createdImages
//         }
//       }
//     } catch (error) {
//       console.error('Error creating product:', error)
//       return { success: false, message: 'Failed to create product.' }
//     }
//   }
// )


/* Product creation with improved image handling and transaction support*/ 
ipcMain.handle(
  'products:create',
  async (_event, payload: CreateProductPayload) => {
    try {
      const MAX_IMAGES = 3

      /* ============================
         VALIDATION
      ============================ */
      if (!payload.product_name?.trim()) {
        return { success: false, message: 'Product name is required.' }
      }

      if (!payload.category_id) {
        return { success: false, message: 'Category id is required.' }
      }

      const images = payload.images ?? []

      if (images.length > MAX_IMAGES) {
        return {
          success: false,
          message: `Maximum of ${MAX_IMAGES} images allowed.`
        }
      }

      /* ============================
         CHECK CATEGORY EXISTS
      ============================ */
      const categoryExists = db()
        .select({ 
          id: product_categories.id,
          is_active: product_categories.is_active,
          category_name: product_categories.category_name 
        })
        .from(product_categories)
        .where(
          and(
            eq(product_categories.id, payload.category_id),
            eq(product_categories.is_deleted, false)
          )
        )
        .get()

      if (!categoryExists) {
        return { success: false, message: 'Category not found.' }
      }

      if (!categoryExists.is_active) {
        return { success: false, message: 'Cannot add product to inactive category.' }
      }

      /* ============================
         PREPARE IMAGE STORAGE
      ============================ */
      const productsDir = path.join(app.getPath('userData'), 'products')
      fs.mkdirSync(productsDir, { recursive: true })

      /* ============================
         PROCESS IMAGES SYNCHRONOUSLY (for transaction)
      ============================ */
      const processImageSync = (imageData: string, index: number): {
        imageJson: string;
        filePath: string;
        fileName: string;
      } => {
        try {
          const [meta, base64] = imageData.split(',')
          const mimeMatch = meta.match(/data:(.*);base64/)
          
          if (!mimeMatch) {
            throw new Error('Invalid image data format')
          }

          const mime = mimeMatch[1]
          const buffer = Buffer.from(base64, 'base64')
          const ext = mime.split('/')[1] || 'jpg'
          
          // Validate file size (e.g., max 5MB)
          const MAX_SIZE = 5 * 1024 * 1024 // 5MB
          if (buffer.length > MAX_SIZE) {
            throw new Error(`Image size exceeds ${MAX_SIZE / (1024 * 1024)}MB limit`)
          }

          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          if (!allowedTypes.includes(mime)) {
            throw new Error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.')
          }

          const fileName = `product_${Date.now()}_${randomUUID().slice(0,8)}_${index}.${ext}`
          const filePath = path.join(productsDir, fileName)

          fs.writeFileSync(filePath, buffer)

          const imageJson = JSON.stringify({
            path: filePath,
            filename: fileName,
            original_filename: payload.images?.[index]?.original_filename ?? fileName,
            mime_type: mime,
            file_size: buffer.length,
            uploaded_at: new Date().toISOString(),
            is_primary: index === 0 // First image is primary
          })

          return { imageJson, filePath, fileName }
        } catch (error) {
          console.error('Image processing error:', error)
          throw error
        }
      }

      /* ============================
         PERFORM DATABASE OPERATIONS IN TRANSACTION
      ============================ */
      const result = db().transaction(() => {
        try {
          /* ============================
             INSERT PRODUCT
          ============================ */
          const insertResult = db()
            .insert(products)
            .values({
              product_name: payload.product_name.trim(),
              category_id: payload.category_id,
              description: payload.description?.trim() ?? '',
              is_active: payload.is_active ?? true,
              created_on: sql`(strftime('%s', 'now'))`,
              updated_on: sql`(strftime('%s', 'now'))`
            })
            .run()

          const productId = Number(insertResult.lastInsertRowid)

          /* ============================
             HANDLE PRODUCT IMAGES (0-3)
          ============================ */
          const createdImages: any[] = []

          // Process only valid images
          const validImages = images.filter(img => img.image_data?.trim())

          for (let i = 0; i < validImages.length; i++) {
            const img = validImages[i]
            
            try {
              const { imageJson, filePath, fileName } = processImageSync(img.image_data!, i)

              const imageInsert = db()
                .insert(product_image)
                .values({
                  product_id: productId,
                  image: imageJson,
                  created_on: sql`(strftime('%s', 'now'))`
                })
                .run()

              createdImages.push({
                id: Number(imageInsert.lastInsertRowid),
                path: filePath,
                filename: fileName,
                is_primary: i === 0
              })

            } catch (imgError) {
              console.error(`Error processing image ${i}:`, imgError)
              throw new Error(`Failed to process image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`)
            }
          }

          /* ============================
             UPDATE CATEGORY SYNC STATUS
          ============================ */
          db()
            .update(product_categories)
            .set({ 
              is_sync_required: true,
              updated_on: sql`(strftime('%s', 'now'))`
            })
            .where(eq(product_categories.id, payload.category_id))
            .run()

          return {
            success: true,
            message: 'Product created successfully.',
            data: {
              id: productId,
              product_name: payload.product_name.trim(),
              category_id: payload.category_id,
              category_name: categoryExists.category_name,
              images: createdImages,
              image_count: createdImages.length
            }
          }

        } catch (error) {
          console.error('Transaction error:', error)
          throw error // Rollback transaction
        }
      })

      return result

    } catch (error) {
      console.error('Error creating product:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to create product.' 
      }
    }
  }
)


ipcMain.handle(
  'products:update',
  async (_event, payload: UpdateProductPayload) => {
    try {
      const MAX_IMAGES = 3

      if (!payload.id) {
        return { success: false, message: 'Product id is required.' }
      }

      /* ============================
         CHECK PRODUCT EXISTS
      ============================ */
      const existingProduct = db()
        .select({ 
          id: products.id,
          product_name: products.product_name,
          category_id: products.category_id,
          is_active: products.is_active 
        })
        .from(products)
        .where(and(eq(products.id, payload.id), eq(products.is_deleted, false)))
        .get()

      if (!existingProduct) {
        return { success: false, message: 'Product not found.' }
      }

      /* ============================
         VALIDATE CATEGORY IF PROVIDED
      ============================ */
      if (payload.category_id !== undefined) {
        const categoryExists = db()
          .select({ 
            id: product_categories.id,
            is_active: product_categories.is_active 
          })
          .from(product_categories)
          .where(
            and(
              eq(product_categories.id, payload.category_id),
              eq(product_categories.is_deleted, false)
            )
          )
          .get()

        if (!categoryExists) {
          return { success: false, message: 'Category not found.' }
        }

        if (!categoryExists.is_active) {
          return { success: false, message: 'Cannot move product to inactive category.' }
        }
      }

      /* ============================
         PREPARE IMAGE PROCESSING
      ============================ */
      const productsDir = path.join(app.getPath('userData'), 'products')
      fs.mkdirSync(productsDir, { recursive: true })

      const processImageSync = (imageData: string, suffix: string): {
        imageJson: string;
        filePath: string;
        fileName: string;
        mime: string;
        buffer: Buffer;
      } => {
        const [meta, base64] = imageData.split(',')
        const mimeMatch = meta.match(/data:(.*);base64/)
        
        if (!mimeMatch) {
          throw new Error('Invalid image data format')
        }

        const mime = mimeMatch[1]
        const buffer = Buffer.from(base64, 'base64')
        const ext = mime.split('/')[1] || 'jpg'
        
        // Validate file size (5MB max)
        const MAX_SIZE = 5 * 1024 * 1024
        if (buffer.length > MAX_SIZE) {
          throw new Error(`Image size exceeds 5MB limit`)
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(mime)) {
          throw new Error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.')
        }

        const fileName = `product_${payload.id}_${suffix}_${Date.now()}.${ext}`
        const filePath = path.join(productsDir, fileName)

        fs.writeFileSync(filePath, buffer)

        const imageJson = JSON.stringify({
          path: filePath,
          filename: fileName,
          mime_type: mime,
          file_size: buffer.length,
          uploaded_at: new Date().toISOString()
        })

        return { imageJson, filePath, fileName, mime, buffer }
      }

      /* ============================
         PERFORM ALL UPDATES IN TRANSACTION
      ============================ */
      const result = db().transaction(() => {
        try {
          /* ============================
             UPDATE PRODUCT DETAILS
          ============================ */
          const updateData: any = {
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          }

          if (payload.product_name !== undefined) {
            if (!payload.product_name.trim()) {
              throw new Error('Product name cannot be empty.')
            }
            updateData.product_name = payload.product_name.trim()
          }

          if (payload.description !== undefined) {
            updateData.description = payload.description.trim()
          }

          if (payload.is_active !== undefined) {
            updateData.is_active = payload.is_active
          }

          if (payload.category_id !== undefined) {
            updateData.category_id = payload.category_id
          }

          // Only update if there are changes beyond updated_on
          if (Object.keys(updateData).length > 1) {
            db()
              .update(products)
              .set(updateData)
              .where(eq(products.id, payload.id))
              .run()
          }

          /* ============================
             IMAGES HANDLING
          ============================ */
          const imagesPayload = payload.images ?? []
          const deletedImageIds: number[] = []
          const updatedImages: any[] = []
          const newImages: any[] = []

          if (imagesPayload.length > 0) {
            // Get current active images
            const existingImages = db()
              .select({
                id: product_image.id,
                image: product_image.image
              })
              .from(product_image)
              .where(
                and(
                  eq(product_image.product_id, payload.id),
                  eq(product_image.is_deleted, false)
                )
              )
              .all()

            let activeCount = existingImages.length

            for (const img of imagesPayload) {
              /**
               * CASE 1: DELETE IMAGE
               */
              if (img.id && img.image_data === null) {
                deletedImageIds.push(img.id)
                activeCount = Math.max(0, activeCount - 1)
                continue
              }

              /**
               * CASE 2: UPDATE EXISTING IMAGE
               */
              if (img.id && img.image_data?.trim()) {
                try {
                  const suffix = `update_${img.id}`
                  const { imageJson, filePath } = processImageSync(img.image_data, suffix)

                  db()
                    .update(product_image)
                    .set({
                      image: imageJson,
                      updated_on: sql`(strftime('%s', 'now'))`,
                      is_sync_required: true
                    })
                    .where(
                      and(
                        eq(product_image.id, img.id),
                        eq(product_image.product_id, payload.id),
                        eq(product_image.is_deleted, false)
                      )
                    )
                    .run()

                  updatedImages.push({
                    id: img.id,
                    path: filePath
                  })

                } catch (imgError) {
                  throw new Error(`Failed to update image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`)
                }
                continue
              }

              /**
               * CASE 3: ADD NEW IMAGE
               */
              if (!img.id && img.image_data?.trim()) {
                if (activeCount >= MAX_IMAGES) {
                  throw new Error(`Maximum of ${MAX_IMAGES} images allowed per product.`)
                }

                try {
                  const suffix = `new_${Date.now()}_${Math.random().toString(36).substring(7)}`
                  const { imageJson, filePath, fileName } = processImageSync(img.image_data, suffix)

                  const insertResult = db()
                    .insert(product_image)
                    .values({
                      product_id: payload.id,
                      image: imageJson,
                      created_on: sql`(strftime('%s', 'now'))`
                    })
                    .run()

                  newImages.push({
                    id: Number(insertResult.lastInsertRowid),
                    path: filePath,
                    filename: fileName
                  })

                  activeCount++

                } catch (imgError) {
                  throw new Error(`Failed to add new image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`)
                }
              }
            }

            /* ============================
               BATCH DELETE MARKED IMAGES
            ============================ */
            if (deletedImageIds.length > 0) {
              db()
                .update(product_image)
                .set({
                  is_deleted: true,
                  updated_on: sql`(strftime('%s', 'now'))`,
                  is_sync_required: true
                })
                .where(
                  and(
                    inArray(product_image.id, deletedImageIds),
                    eq(product_image.product_id, payload.id)
                  )
                )
                .run()

              // Optionally delete physical files (can be done asynchronously)
              setImmediate(() => {
                try {
                  const imagesToDelete = existingImages.filter(img => 
                    deletedImageIds.includes(img.id)
                  )
                  
                  for (const img of imagesToDelete) {
                    if (img.image) {
                      try {
                        const imgData = JSON.parse(img.image)
                        if (imgData.path && fs.existsSync(imgData.path)) {
                          fs.unlinkSync(imgData.path)
                        }
                      } catch (e) {
                        console.warn('Could not delete image file:', e)
                      }
                    }
                  }
                } catch (e) {
                  console.error('Error cleaning up deleted images:', e)
                }
              })
            }
          }

          /* ============================
             UPDATE CATEGORY SYNC STATUS
          ============================ */
          if (payload.category_id !== undefined || payload.is_active !== undefined) {
            db()
              .update(product_categories)
              .set({ 
                is_sync_required: true,
                updated_on: sql`(strftime('%s', 'now'))`
              })
              .where(eq(product_categories.id, payload.category_id ?? existingProduct.category_id))
              .run()
          }

          /* ============================
             RETURN SUCCESS WITH DETAILS
          ============================ */
          return {
            success: true,
            message: 'Product updated successfully.',
            data: {
              id: payload.id,
              updated_fields: Object.keys(updateData).filter(k => k !== 'updated_on'),
              images: {
                deleted: deletedImageIds.length,
                updated: updatedImages.length,
                added: newImages.length,
                new_images: newImages,
                updated_images: updatedImages
              }
            }
          }

        } catch (error) {
          console.error('Transaction error:', error)
          throw error // Rollback transaction
        }
      })

      return result

    } catch (error) {
      console.error('Error updating product:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update product.' 
      }
    }
  }
)


/* ============================
   PLACEHOLDER CALCULATION FUNCTIONS
   These will be replaced with actual DB queries later
============================ */

/**
 * Calculates total number of items sold for a product
 * For now returns random realistic values
 */
// function calculateTotalItemsSold(productId: number = 1): number {
//   // TODO: Implement actual calculation
//   // This should sum quantities from stock_purchases that have been sold
//   // For now, return random realistic values (0-1000)
//   return Math.floor(Math.random() * 1000 * productId)
// }

// /**
//  * Calculates profit margin percentage for a product
//  * Can be positive or negative
//  * Formula: ((revenue - cost) / cost) * 100
//  */
// function calculateProfitMargin(productId: number = 1): number {
//   // TODO: Implement actual calculation
//   // This should calculate based on:
//   // - Total revenue from sold items
//   // - Total cost of goods (including shipping)
//   // - Return random realistic values between -20% and +50%
//   return Number((Math.random() * 70 - 20).toFixed(productId * 2)) // -20% to +50%
// }

// /**
//  * Calculates average profit margin across all SKUs
//  */
// function calculateAverageSkuProfitMargin(productId: number = 1): number {
//   // TODO: Implement actual calculation
//   // Average of all SKU profit margins
//   return Number((Math.random() * 50 - 10).toFixed(productId * 2)) // -10% to +40%
// }

// /**
//  * Calculates total inventory value
//  */
// function calculateTotalInventoryValue(productId: number = 1): number {
//   // TODO: Implement actual calculation
//   // Sum of (quantity_on_hand * cost_per_unit) for all SKUs
//   return Number((Math.random() * 50000).toFixed(productId * 2))
// }

// /**
//  * Calculates sell-through rate
//  */
// function calculateSellThroughRate(productId: number = 1): number {
//   // TODO: Implement actual calculation
//   // (units_sold / total_units_received) * 100
//   return Number((Math.random() * 100).toFixed(productId))
// }

// /**
//  * Calculates days of inventory remaining
//  */
// function calculateDaysOfInventory(productId: number = 1): number {
//   // TODO: Implement actual calculation
//   // inventory_quantity / average_daily_sales
//   return Math.floor(Math.random() * 180) + productId // 1-180 days
// }

/**
 * Calculates total number of items sold for a product
 */
export function calculateTotalItemsSold(productId: number): number {
  try {
    const result = db()
      .select({
        total: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .where(
        and(
          eq(sku.product_id, productId),
          // eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          sql`${sales.status} IN ('completed', 'pending')`
        )
      )
      .get()

    return Number(result?.total || 0)
  } catch (error) {
    console.error(`Error calculating items sold for product ${productId}:`, error)
    return 0
  }
}

/**
 * Calculates profit margin percentage for a product
 * Formula: ((total_revenue - total_cost) / total_cost) * 100
 * Uses stock_purchases for cost data
 */

export interface SalePerformanceItem {
  saleId: number
  quantity: number
  actualRevenue: number
  expectedRevenue: number
  actualProfit: number
  expectedProfit: number
  variance: number
  varianceReason?: 'Price' | 'Shipping' | 'Both'
}

export interface ProductProfitAnalysis {
  // Actual profit metrics
  actualProfitMargin: number
  actualTotalRevenue: number
  actualTotalCost: number
  actualShippingCost: number
  actualNetProfit: number
  
  // Expected vs Actual analysis
  expectedRevenue: number
  expectedProfit: number
  varianceAmount: number
  variancePercentage: number
  performanceRating: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  
  // Breakdown by sale
  salePerformance: SalePerformanceItem[]
}

export function calculateProductProfit(productId: number): ProductProfitAnalysis {
  try {
    // STEP 1: Get all SKUs for this product
    const skus = db()
      .select({ id: sku.id })
      .from(sku)
      .where(
        and(
          eq(sku.product_id, productId),
          eq(sku.is_deleted, false)
        )
      )
      .all()

    if (skus.length === 0) {
      return createEmptyAnalysis()
    }

    const skuIds = skus.map(s => s.id)

    // STEP 2: Get ALL stock purchases with their TRUE landed costs
    // We need this FIRST because sales depend on it
    const purchaseData = db()
      .select({
        id: stock_purchases.id,
        skuId: stock_purchases.sku_id,
        quantityBought: stock_purchases.quantity_bought,
        totalPriceBought: stock_purchases.total_price_bought,
        shippingCost: stock_purchases.shipping_cost,
        minSellingPrice: stock_purchases.min_selling_price,
        maxSellingPrice: stock_purchases.max_selling_price
      })
      .from(stock_purchases)
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    // STEP 3: Create lookup maps for purchase data
    const costPerUnitMap = new Map<number, number>()  // TRUE cost per unit
    const expectedPriceRangeMap = new Map<number, { min: number, max: number, avg: number }>()
    
    for (const purchase of purchaseData) {
      // TRUE landed cost (what you actually paid)
      const trueTotalCost = Number(purchase.totalPriceBought) + Number(purchase.shippingCost || 0)
      const trueCostPerUnit = trueTotalCost / Number(purchase.quantityBought)
      costPerUnitMap.set(purchase.id, trueCostPerUnit)
      
      // Expected selling price range (your target)
      const minPrice = Number(purchase.minSellingPrice || 0)
      const maxPrice = Number(purchase.maxSellingPrice || 0)
      const avgPrice = (minPrice + maxPrice) / 2
      expectedPriceRangeMap.set(purchase.id, { min: minPrice, max: maxPrice, avg: avgPrice })
    }

    // STEP 4: Get ALL completed sales with their details
    // THIS NOW INCLUDES cost_price_snapshot!
    const salesData = db()
      .select({
        saleId: sales.id,
        quantity: sales.quantity,
        totalPrice: sales.total_price,
        shippingCost: sales.shipping_cost,
        costPriceSnapshot: sales.cost_price_snapshot,  // CRITICAL: Your expected revenue!
        stockPurchasedId: sales.stock_purchased_id,
        status: sales.status,
        hasBeenOverwritten: sales.has_been_overwritten
      })
      .from(sales)
      .where(
        and(
          inArray(sales.stock_purchased_id, skuIds),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          // eq(sales.status, 'completed')
          sql`${sales.status} IN ('completed', 'pending')`
        )
      )
      .all()

    if (salesData.length === 0) {
      return createEmptyAnalysis()
    }

    // STEP 5: Calculate per-sale and total metrics
    let actualTotalRevenue = 0
    let actualTotalCOGS = 0
    let actualTotalShipping = 0
    let expectedTotalRevenue = 0
    
    const salePerformance: SalePerformanceItem[] = []

    for (const sale of salesData) {
      // Get the TRUE cost per unit for this specific batch
      const trueCostPerUnit = costPerUnitMap.get(sale.stockPurchasedId ? sale.stockPurchasedId : 0) || 0
      const expectedRange = expectedPriceRangeMap.get(sale.stockPurchasedId ? sale.stockPurchasedId : 0)
      
      // ACTUAL calculations
      const saleRevenue = Number(sale.totalPrice)
      const saleShipping = Number(sale.shippingCost || 0)
      const saleCOGS = trueCostPerUnit * sale.quantity
      
      actualTotalRevenue += saleRevenue
      actualTotalCOGS += saleCOGS
      actualTotalShipping += saleShipping
      
      // EXPECTED calculations using the snapshot
      // The snapshot is your anticipated revenue at time of stock purchase
      const expectedRevenue = Number(sale.costPriceSnapshot || 0)
      expectedTotalRevenue += expectedRevenue
      
      // Expected profit = expected revenue - actual COGS
      // (because COGS is real, revenue is what you hoped for)
      const expectedProfit = expectedRevenue - saleCOGS - saleShipping
      
      // Actual profit
      const actualProfit = saleRevenue - saleCOGS - saleShipping
      
      // Variance analysis
      const variance = actualProfit - expectedProfit
      // const variancePercent = expectedProfit !== 0 
      //   ? (variance / Math.abs(expectedProfit)) * 100 
      //   : 0
      
      // Determine why variance occurred
      let varianceReason: 'Price' | 'Shipping' | 'Both' | undefined
      const priceVariance = saleRevenue - (sale.quantity * (expectedRange?.avg || 0))
      const shippingVariance = saleShipping - 0 // Compare to expected shipping (usually 0)
      
      if (Math.abs(priceVariance) > 0.01 && Math.abs(shippingVariance) > 0.01) {
        varianceReason = 'Both'
      } else if (Math.abs(priceVariance) > 0.01) {
        varianceReason = 'Price'
      } else if (Math.abs(shippingVariance) > 0.01) {
        varianceReason = 'Shipping'
      }
      
      salePerformance.push({
        saleId: Number(sale.saleId),
        quantity: sale.quantity,
        actualRevenue: saleRevenue,
        expectedRevenue,
        actualProfit,
        expectedProfit,
        variance,
        varianceReason
      })
    }

    // STEP 6: Calculate final metrics
    const actualNetProfit = actualTotalRevenue - actualTotalCOGS - actualTotalShipping
    const expectedNetProfit = expectedTotalRevenue - actualTotalCOGS - actualTotalShipping
    const totalVariance = actualNetProfit - expectedNetProfit
    const variancePercentage = expectedNetProfit !== 0 
      ? (totalVariance / Math.abs(expectedNetProfit)) * 100 
      : 0
    
    const actualProfitMargin = actualTotalRevenue > 0 
      ? (actualNetProfit / actualTotalRevenue) * 100 
      : 0
    
    // Performance rating based on variance
    let performanceRating: 'Excellent' | 'Good' | 'Fair' | 'Poor'
    if (variancePercentage >= 10) {
      performanceRating = 'Excellent'  // Beat expectations by 10%+
    } else if (variancePercentage >= 0) {
      performanceRating = 'Good'       // Met or slightly beat expectations
    } else if (variancePercentage >= -10) {
      performanceRating = 'Fair'       // Slightly below expectations
    } else {
      performanceRating = 'Poor'       // Missed expectations by >10%
    }

    return {
      actualProfitMargin,
      actualTotalRevenue,
      actualTotalCost: actualTotalCOGS,
      actualShippingCost: actualTotalShipping,
      actualNetProfit,
      expectedRevenue: expectedTotalRevenue,
      expectedProfit: expectedNetProfit,
      varianceAmount: totalVariance,
      variancePercentage,
      performanceRating,
      salePerformance
    }
    
  } catch (error) {
    console.error(`Error calculating profit for product ${productId}:`, error)
    return createEmptyAnalysis()
  }
}

function createEmptyAnalysis(): ProductProfitAnalysis {
  return {
    actualProfitMargin: 0,
    actualTotalRevenue: 0,
    actualTotalCost: 0,
    actualShippingCost: 0,
    actualNetProfit: 0,
    expectedRevenue: 0,
    expectedProfit: 0,
    varianceAmount: 0,
    variancePercentage: 0,
    performanceRating: 'Fair',
    salePerformance: []
  }
}

/**
 * Calculates average profit margin across all SKUs
 */
export function calculateAverageSkuProfitMargin(productId: number): number {
  try {
    // STEP 1: Get all SKUs for this product
    const skus = db()
      .select({ id: sku.id })
      .from(sku)
      .where(
        and(
          eq(sku.product_id, productId),
          eq(sku.is_deleted, false)
        )
      )
      .all()

    if (skus.length === 0) return 0

    const skuIds = skus.map(s => s.id)

    // STEP 2: Get ALL stock purchases with their TRUE landed costs
    const purchaseData = db()
      .select({
        id: stock_purchases.id,
        skuId: stock_purchases.sku_id,
        quantityBought: stock_purchases.quantity_bought,
        totalPriceBought: stock_purchases.total_price_bought,
        shippingCost: stock_purchases.shipping_cost
      })
      .from(stock_purchases)
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    // STEP 3: Create lookup map for TRUE cost per unit for each purchase
    const costPerUnitMap = new Map<number, number>()
  
    for (const purchase of purchaseData) {
      const trueTotalCost = Number(purchase.totalPriceBought) + Number(purchase.shippingCost || 0)
      const trueCostPerUnit = trueTotalCost / Number(purchase.quantityBought)
      costPerUnitMap.set(purchase.id, trueCostPerUnit)
    }

    // STEP 4: Get ALL completed sales with their details
    const salesData = db()
      .select({
        skuId: sku.id,  // We need to know which SKU each sale belongs to
        quantity: sales.quantity,
        totalPrice: sales.total_price,
        shippingCost: sales.shipping_cost,
        stockPurchasedId: sales.stock_purchased_id
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .where(
        and(
          inArray(sku.id, skuIds),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          // eq(sales.status, 'completed')
          sql`${sales.status} IN ('completed', 'pending')`
        )
      )
      .all()

    if (salesData.length === 0) return 0

    // STEP 5: Calculate weighted metrics by SKU
    const skuMetrics = new Map<number, { revenue: number; profit: number }>()

    for (const sale of salesData) {
      const trueCostPerUnit = costPerUnitMap.get(sale.stockPurchasedId ? sale.stockPurchasedId : 0) || 0
      
      if (trueCostPerUnit === 0) continue
      
      // Calculate profit for this sale
      const saleRevenue = Number(sale.totalPrice)
      const saleCOGS = trueCostPerUnit * sale.quantity
      const saleShipping = Number(sale.shippingCost || 0)
      const saleProfit = saleRevenue - saleCOGS - saleShipping
      
      // Aggregate by SKU
      const current = skuMetrics.get(sale.skuId) || { revenue: 0, profit: 0 }
      skuMetrics.set(sale.skuId, {
        revenue: current.revenue + saleRevenue,
        profit: current.profit + saleProfit
      })
    }

    if (skuMetrics.size === 0) return 0

    // STEP 6: Calculate weighted average margin
    let totalRevenueAllSkus = 0
    let totalProfitAllSkus = 0

    for (const [_, metrics] of skuMetrics) {
      totalRevenueAllSkus += metrics.revenue
      totalProfitAllSkus += metrics.profit
    }

    // Weighted average margin = (Total Profit across all SKUs) / (Total Revenue across all SKUs) * 100
    const weightedAverageMargin = (totalProfitAllSkus / totalRevenueAllSkus) * 100

    return Number(weightedAverageMargin.toFixed(2))
    
  } catch (error) {
    console.error(`Error calculating avg sku margin for product ${productId}:`, error)
    return 0
  }
}

/**
 * Calculates total inventory value
 */

export interface BatchBreakdownItem {
  batchId: number
  skuId: number
  skuName: string
  originalQuantity: number
  soldQuantity: number
  remainingQuantity: number
  costPerUnit: number
  retailPricePerUnit: number
  inventoryValueAtCost: number
  retailValue: number
  estimatedShippingCost: number
  netRealizableValue: number
  daysInInventory: number
  sellThroughRate: number
  healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
}

export interface SkuBreakdownItem {
  skuId: number
  skuName: string
  unitsOnHand: number
  inventoryValue: number
  retailValue: number
  potentialProfit: number
  percentageOfTotal: number
  healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
}


export interface InventoryValueAnalysis {
  // Summary metrics
  totalInventoryValue: number
  totalRetailValue: number
  totalNetRealizableValue: number
  totalPotentialProfit: number
  
  // Cost breakdown
  totalUnitsOnHand: number
  totalCostBasis: number
  averageCostPerUnit: number
  averageRetailPricePerUnit: number
  
  // Batch-level details
  batchBreakdown: Array<BatchBreakdownItem>
  
  // SKU-level aggregation
  skuBreakdown: Array<SkuBreakdownItem>
  
  // Health metrics
  inventoryHealth: {
    averageSellThroughRate: number
    averageDaysInInventory: number
    slowMovingPercentage: number
    criticalItemsPercentage: number
    totalAtRiskValue: number
    recommendedActions: string[]
  }
  
  // Cash flow insights
  cashFlowInsights: {
    cashTiedUp: number
    expectedCashInflow: number
    expectedProfit: number
    monthsOfInventory: number
    reorderRecommendation: 'Urgent' | 'Soon' | 'Normal' | 'Hold'
  }
  
  // Performance vs expectations
  performanceVsExpected: {
    expectedValueAtSnapshot: number
    actualValueAtCost: number
    variance: number
    variancePercentage: number
  }
}


export function calculateTotalInventoryValue(productId: number): InventoryValueAnalysis {
  try {
    // STEP 1: Get all SKUs for this product
    const skus = db()
      .select({ 
        id: sku.id,
        name: sku.sku_name 
      })
      .from(sku)
      .where(
        and(
          eq(sku.product_id, productId),
          eq(sku.is_deleted, false)
        )
      )
      .all()

    if (skus.length === 0) {
      return createEmptyInventoryAnalysis()
    }

    const skuIds = skus.map(s => s.id)

    // STEP 2: Get ALL stock purchases with complete details
    const purchases = db()
      .select({
        id: stock_purchases.id,
        skuId: stock_purchases.sku_id,
        quantityBought: stock_purchases.quantity_bought,
        totalPriceBought: stock_purchases.total_price_bought,
        shippingCost: stock_purchases.shipping_cost,
        minSellingPrice: stock_purchases.min_selling_price,
        maxSellingPrice: stock_purchases.max_selling_price,
        purchasedOn: stock_purchases.purchased_on
      })
      .from(stock_purchases)
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    if (purchases.length === 0) {
      return createEmptyInventoryAnalysis()
    }

    // STEP 3: Get ALL sales to calculate what's been sold from each batch
    const salesData = db()
      .select({
        stockPurchasedId: sales.stock_purchased_id,
        quantity: sales.quantity,
        totalPrice: sales.total_price,
        shippingCost: sales.shipping_cost,
        soldOn: sales.sold_on,
        status: sales.status
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          // eq(sales.status, 'completed')
          sql`${sales.status} IN ('completed', 'pending')`
        )
      )
      .all()

    // STEP 4: Calculate sold quantities per batch
    const soldPerBatch = new Map<number, number>()
    for (const sale of salesData) {
      const current = soldPerBatch.get(sale.stockPurchasedId ? sale.stockPurchasedId : 0) || 0
      soldPerBatch.set(sale.stockPurchasedId ? sale.stockPurchasedId : 0, current + sale.quantity)
    }

    // STEP 5: Calculate average retail price per SKU
    const avgRetailPricePerSku = new Map<number, number>()
    const skuRevenue = new Map<number, { revenue: number; quantity: number }>()
    
    for (const sale of salesData) {
      const purchase = purchases.find(p => p.id === sale.stockPurchasedId)
      if (!purchase) continue
      
      const skuId = purchase.skuId
      const current = skuRevenue.get(skuId) || { revenue: 0, quantity: 0 }
      skuRevenue.set(skuId, {
        revenue: current.revenue + sale.totalPrice,
        quantity: current.quantity + sale.quantity
      })
    }
    
    for (const [skuId, data] of skuRevenue) {
      if (data.quantity > 0) {
        avgRetailPricePerSku.set(skuId, data.revenue / data.quantity)
      }
    }

    // STEP 6: Calculate current date for age calculations
    const now = Math.floor(Date.now() / 1000) // Current Unix timestamp

    // STEP 7: Build batch-level breakdown
    let totalUnitsOnHand = 0
    let totalCostBasis = 0
    let totalRetailValue = 0
    let totalNetRealizableValue = 0
    let totalExpectedSnapshotValue = 0
    
    // FIXED: Explicitly type these arrays
    const batchBreakdown: BatchBreakdownItem[] = []
    const skuAggregator = new Map<number, {
      skuId: number
      skuName: string
      unitsOnHand: number
      inventoryValue: number
      retailValue: number
      potentialProfit: number
    }>()

    for (const purchase of purchases) {
      const skuInfo = skus.find(s => s.id === purchase.skuId)
      const soldQuantity = soldPerBatch.get(purchase.id) || 0
      const remainingQuantity = Math.max(0, purchase.quantityBought - soldQuantity)
      
      if (remainingQuantity === 0) continue
      
      // Calculate TRUE landed cost per unit
      const trueTotalCost = Number(purchase.totalPriceBought) + Number(purchase.shippingCost || 0)
      const costPerUnit = trueTotalCost / purchase.quantityBought
      
      // Calculate retail price (use actual average if available, otherwise use min/max average)
      const avgRetailPrice = avgRetailPricePerSku.get(purchase.skuId) || 
                            ((Number(purchase.minSellingPrice || 0) + Number(purchase.maxSellingPrice || 0)) / 2)
      
      // Calculate estimated shipping cost per unit for remaining inventory
      // Use average shipping cost from sales of this SKU
      const skuSales = salesData.filter(s => {
        const p = purchases.find(pur => pur.id === s.stockPurchasedId)
        return p && p.skuId === purchase.skuId
      })
      const avgShippingCost = skuSales.length > 0 
        ? skuSales.reduce((sum, s) => sum + Number(s.shippingCost || 0), 0) / skuSales.length
        : 2.00 // Default estimate if no sales yet
      
      // Calculate values
      const inventoryValueAtCost = remainingQuantity * costPerUnit
      const retailValue = remainingQuantity * avgRetailPrice
      const netRealizableValue = retailValue - (remainingQuantity * avgShippingCost)
      
      // Calculate days in inventory
      const daysInInventory = (now - Number(purchase.purchasedOn)) / (24 * 60 * 60)
      
      // Calculate sell-through rate
      const sellThroughRate = purchase.quantityBought > 0 
        ? (soldQuantity / purchase.quantityBought) * 100 
        : 0
      
      // Determine health status
      let healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
      if (sellThroughRate > 70) {
        healthStatus = 'Excellent'
      } else if (sellThroughRate > 40) {
        healthStatus = 'Good'
      } else if (sellThroughRate > 20) {
        healthStatus = 'Slow'
      } else {
        healthStatus = 'Critical'
      }

      // Calculate expected value from snapshot
      const expectedRetailPrice = (Number(purchase.minSellingPrice || 0) + Number(purchase.maxSellingPrice || 0)) / 2
      const expectedSnapshotValue = remainingQuantity * expectedRetailPrice
      totalExpectedSnapshotValue += expectedSnapshotValue
      
      // Add to batch breakdown - FIXED: Now TypeScript knows the type
      batchBreakdown.push({
        batchId: purchase.id,
        skuId: purchase.skuId,
        skuName: skuInfo?.name || `SKU ${purchase.skuId}`,
        originalQuantity: purchase.quantityBought,
        soldQuantity,
        remainingQuantity,
        costPerUnit,
        retailPricePerUnit: avgRetailPrice,
        inventoryValueAtCost,
        retailValue,
        estimatedShippingCost: avgShippingCost,
        netRealizableValue,
        daysInInventory,
        sellThroughRate,
        healthStatus
      })
      
      // Update totals
      totalUnitsOnHand += remainingQuantity
      totalCostBasis += inventoryValueAtCost
      totalRetailValue += retailValue
      totalNetRealizableValue += netRealizableValue
      
      // Update SKU aggregator
      const currentSku = skuAggregator.get(purchase.skuId) || {
        skuId: purchase.skuId,
        skuName: skuInfo?.name || `SKU ${purchase.skuId}`,
        unitsOnHand: 0,
        inventoryValue: 0,
        retailValue: 0,
        potentialProfit: 0
      }
      
      currentSku.unitsOnHand += remainingQuantity
      currentSku.inventoryValue += inventoryValueAtCost
      currentSku.retailValue += retailValue
      currentSku.potentialProfit += (retailValue - inventoryValueAtCost - (remainingQuantity * avgShippingCost))
      
      skuAggregator.set(purchase.skuId, currentSku)
    }

    if (totalUnitsOnHand === 0) {
      return createEmptyInventoryAnalysis()
    }

    // STEP 8: Build SKU breakdown
    const skuBreakdown: SkuBreakdownItem[] = Array.from(skuAggregator.values()).map(sku => {
      const percentageOfTotal = totalCostBasis > 0 ? (sku.inventoryValue / totalCostBasis) * 100 : 0
      
      // Determine SKU health status
      let healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
      const skuBatches = batchBreakdown.filter(b => b.skuId === sku.skuId)
      const avgSellThrough = skuBatches.length > 0 
        ? skuBatches.reduce((sum, b) => sum + b.sellThroughRate, 0) / skuBatches.length
        : 0
      
      if (avgSellThrough > 70) {
        healthStatus = 'Excellent'
      } else if (avgSellThrough > 40) {
        healthStatus = 'Good'
      } else if (avgSellThrough > 20) {
        healthStatus = 'Slow'
      } else {
        healthStatus = 'Critical'
      }
      
      return {
        skuId: sku.skuId,
        skuName: sku.skuName,
        unitsOnHand: sku.unitsOnHand,
        inventoryValue: Number(sku.inventoryValue.toFixed(2)),
        retailValue: Number(sku.retailValue.toFixed(2)),
        potentialProfit: Number(sku.potentialProfit.toFixed(2)),
        percentageOfTotal: Number(percentageOfTotal.toFixed(1)),
        healthStatus
      }
    })

    // STEP 9: Calculate inventory health metrics
    const slowMovingItems = batchBreakdown.filter(b => b.healthStatus === 'Slow' || b.healthStatus === 'Critical')
    const criticalItems = batchBreakdown.filter(b => b.healthStatus === 'Critical')
    const atRiskValue = slowMovingItems.reduce((sum, b) => sum + b.inventoryValueAtCost, 0)
    
    const avgSellThroughRate = batchBreakdown.length > 0 
      ? batchBreakdown.reduce((sum, b) => sum + b.sellThroughRate, 0) / batchBreakdown.length
      : 0
    
    const avgDaysInInventory = batchBreakdown.length > 0
      ? batchBreakdown.reduce((sum, b) => sum + b.daysInInventory, 0) / batchBreakdown.length
      : 0
    
    // Generate recommended actions
    const recommendedActions: string[] = []
    if (criticalItems.length > 0) {
      recommendedActions.push(`URGENT: ${criticalItems.length} batches are critically slow - consider deep discounts to recover cash`)
    }
    if (slowMovingItems.length > 3) {
      recommendedActions.push(`${slowMovingItems.length} slow-moving batches tying up $${atRiskValue.toFixed(2)} - review pricing strategy`)
    }
    if (avgDaysInInventory > 180) {
      recommendedActions.push(`Average inventory age is ${avgDaysInInventory.toFixed(0)} days - consider smaller, more frequent orders`)
    }
    if (totalNetRealizableValue < totalCostBasis * 1.2) {
      recommendedActions.push(`Margins are thin - expected profit only ${((totalNetRealizableValue - totalCostBasis) / totalCostBasis * 100).toFixed(1)}% above cost`)
    }

    // STEP 10: Calculate cash flow insights
    const monthlySalesValue = salesData.length > 0 
      ? salesData.reduce((sum, s) => sum + s.totalPrice, 0) / 3 // Last 3 months
      : 0
    
    const monthsOfInventory = monthlySalesValue > 0 ? totalRetailValue / monthlySalesValue : 99
    
    let reorderRecommendation: 'Urgent' | 'Soon' | 'Normal' | 'Hold'
    if (monthsOfInventory < 1) {
      reorderRecommendation = 'Urgent'
    } else if (monthsOfInventory < 2) {
      reorderRecommendation = 'Soon'
    } else if (monthsOfInventory < 4) {
      reorderRecommendation = 'Normal'
    } else {
      reorderRecommendation = 'Hold'
    }

    // STEP 11: Performance vs expectations
    const variance = totalRetailValue - totalExpectedSnapshotValue
    const variancePercentage = totalExpectedSnapshotValue > 0 
      ? (variance / totalExpectedSnapshotValue) * 100 
      : 0

    // STEP 12: Return complete analysis
    return {
      totalInventoryValue: Number(totalCostBasis.toFixed(2)),
      totalRetailValue: Number(totalRetailValue.toFixed(2)),
      totalNetRealizableValue: Number(totalNetRealizableValue.toFixed(2)),
      totalPotentialProfit: Number((totalNetRealizableValue - totalCostBasis).toFixed(2)),
      
      totalUnitsOnHand,
      totalCostBasis: Number(totalCostBasis.toFixed(2)),
      averageCostPerUnit: totalUnitsOnHand > 0 ? Number((totalCostBasis / totalUnitsOnHand).toFixed(2)) : 0,
      averageRetailPricePerUnit: totalUnitsOnHand > 0 ? Number((totalRetailValue / totalUnitsOnHand).toFixed(2)) : 0,
      
      batchBreakdown,
      skuBreakdown,
      
      inventoryHealth: {
        averageSellThroughRate: Number(avgSellThroughRate.toFixed(1)),
        averageDaysInInventory: Number(avgDaysInInventory.toFixed(0)),
        slowMovingPercentage: batchBreakdown.length > 0 ? Number(((slowMovingItems.length / batchBreakdown.length) * 100).toFixed(1)) : 0,
        criticalItemsPercentage: batchBreakdown.length > 0 ? Number(((criticalItems.length / batchBreakdown.length) * 100).toFixed(1)) : 0,
        totalAtRiskValue: Number(atRiskValue.toFixed(2)),
        recommendedActions
      },
      
      cashFlowInsights: {
        cashTiedUp: Number(totalCostBasis.toFixed(2)),
        expectedCashInflow: Number(totalNetRealizableValue.toFixed(2)),
        expectedProfit: Number((totalNetRealizableValue - totalCostBasis).toFixed(2)),
        monthsOfInventory: Number(monthsOfInventory.toFixed(1)),
        reorderRecommendation
      },
      
      performanceVsExpected: {
        expectedValueAtSnapshot: Number(totalExpectedSnapshotValue.toFixed(2)),
        actualValueAtCost: Number(totalCostBasis.toFixed(2)),
        variance: Number(variance.toFixed(2)),
        variancePercentage: Number(variancePercentage.toFixed(1))
      }
    }
    
  } catch (error) {
    console.error(`Error calculating inventory value for product ${productId}:`, error)
    return createEmptyInventoryAnalysis()
  }
}

function createEmptyInventoryAnalysis(): InventoryValueAnalysis {
  return {
    totalInventoryValue: 0,
    totalRetailValue: 0,
    totalNetRealizableValue: 0,
    totalPotentialProfit: 0,
    totalUnitsOnHand: 0,
    totalCostBasis: 0,
    averageCostPerUnit: 0,
    averageRetailPricePerUnit: 0,
    batchBreakdown: [],
    skuBreakdown: [],
    inventoryHealth: {
      averageSellThroughRate: 0,
      averageDaysInInventory: 0,
      slowMovingPercentage: 0,
      criticalItemsPercentage: 0,
      totalAtRiskValue: 0,
      recommendedActions: ['No inventory data available']
    },
    cashFlowInsights: {
      cashTiedUp: 0,
      expectedCashInflow: 0,
      expectedProfit: 0,
      monthsOfInventory: 0,
      reorderRecommendation: 'Hold'
    },
    performanceVsExpected: {
      expectedValueAtSnapshot: 0,
      actualValueAtCost: 0,
      variance: 0,
      variancePercentage: 0
    }
  }
}

/**
 * Calculates sell-through rate
 */
export interface SellThroughAnalysis {
  // Overall metrics
  overallSellThroughRate: number
  totalUnitsReceived: number
  totalUnitsSold: number
  totalUnitsRemaining: number
  inventoryValueAtRisk: number
  
  // Time-based analysis
  sellThroughByPeriod: {
    last30Days: number
    last60Days: number
    last90Days: number
    averageMonthlyRate: number
    projectedDaysToSellRemaining: number
  }
  
  // Batch-level breakdown
  batchBreakdown: Array<{
    batchId: number
    skuId: number
    skuName: string
    receivedDate: string
    daysInInventory: number
    quantityReceived: number
    quantitySold: number
    quantityRemaining: number
    sellThroughRate: number
    monthlySellThroughRate: number
    healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
    estimatedWeeksRemaining: number
    recommendedAction: string
  }>
  
  // SKU-level breakdown
  skuBreakdown: Array<{
    skuId: number
    skuName: string
    quantityReceived: number
    quantitySold: number
    quantityRemaining: number
    sellThroughRate: number
    contributionToTotal: number
    healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
    recommendedAction: string
  }>
  
  // Trend analysis
  trendAnalysis: {
    isAccelerating: boolean
    isDecelerating: boolean
    isStable: boolean
    threeMonthTrend: Array<{
      month: string
      sellThroughRate: number
    }>
    velocityChange: number // percentage point change
  }
  
  // Health assessment
  healthAssessment: {
    overallHealth: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'
    slowMovingPercentage: number
    criticalItemsPercentage: number
    atRiskValue: number
    riskLevel: 'Low' | 'Medium' | 'High' | 'Severe'
    warnings: string[]
    recommendations: string[]
  }
  
  // Cash flow impact
  cashFlowImpact: {
    cashTiedUpInSlowMovers: number
    estimatedRecoveryIfDiscounted: number
    potentialLossIfWrittenOff: number
    monthsToSellAtCurrentRate: number
    reorderUrgency: 'Immediate' | 'Soon' | 'Normal' | 'Hold' | 'Stop'
  }
}

export function calculateSellThroughRate(productId: number): SellThroughAnalysis {
  try {
    
    // STEP 1: Get all SKUs for this product
    const skus = db()
      .select({ 
        id: sku.id,
        name: sku.sku_name 
      })
      .from(sku)
      .where(
        and(
          eq(sku.product_id, productId),
          eq(sku.is_deleted, false)
        )
      )
      .all()

    if (skus.length === 0) {
      return createEmptySellThroughAnalysis()
    }

    const skuIds = skus.map(s => s.id)

    // STEP 2: Get ALL stock purchases with dates
    const purchases = db()
      .select({
        id: stock_purchases.id,
        skuId: stock_purchases.sku_id,
        quantityBought: stock_purchases.quantity_bought,
        totalPriceBought: stock_purchases.total_price_bought,
        purchasedOn: stock_purchases.purchased_on
      })
      .from(stock_purchases)
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    if (purchases.length === 0) {
      return createEmptySellThroughAnalysis()
    }

    // STEP 3: Get ALL sales with dates
    const salesData = db()
      .select({
        stockPurchasedId: sales.stock_purchased_id,
        quantity: sales.quantity,
        totalPrice: sales.total_price,
        soldOn: sales.sold_on
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          sql`${sales.status} IN ('completed', 'pending')`
        )
      )
      .all()

    // STEP 4: Calculate sold quantities per batch
    const soldPerBatch = new Map<number, number>()
    const salesByMonth = new Map<string, number>()
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60)

    // Track sales by date for trend analysis
    let salesLast30Days = 0
    let salesLast60Days = 0
    let salesLast90Days = 0

    for (const sale of salesData) {
      // Update batch sales
      const current = soldPerBatch.get(sale.stockPurchasedId ? sale.stockPurchasedId : 0) || 0
      soldPerBatch.set(sale.stockPurchasedId ? sale.stockPurchasedId : 0, current + sale.quantity)

      // FIXED: Safe timestamp conversion
      let soldOnTimestamp: number = now // Default to now
      
      if (sale.soldOn) {
        if (sale.soldOn instanceof Date) {
          // It's a Date object
          if (!isNaN(sale.soldOn.getTime())) {
            soldOnTimestamp = Math.floor(sale.soldOn.getTime() / 1000)
          }
        } else {
          // Try to convert to number
          const numTimestamp = Number(sale.soldOn)
          if (!isNaN(numTimestamp) && numTimestamp > 0) {
            soldOnTimestamp = numTimestamp
          }
        }
      }

      // Update time-based sales
      if (soldOnTimestamp >= thirtyDaysAgo) {
        salesLast30Days += sale.quantity
      }
      if (soldOnTimestamp >= sixtyDaysAgo) {
        salesLast60Days += sale.quantity
      }
      if (soldOnTimestamp >= ninetyDaysAgo) {
        salesLast90Days += sale.quantity
      }

      // Track monthly sales for trend
      const date = new Date(soldOnTimestamp * 1000)
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const monthSales = salesByMonth.get(monthKey) || 0
        salesByMonth.set(monthKey, monthSales + sale.quantity)
      }
    }

    // STEP 5: Calculate overall metrics
    let totalReceived = 0
    let totalSold = 0
    let totalInventoryValue = 0
    let slowMovingValue = 0
    let criticalValue = 0

    const batchBreakdown: SellThroughAnalysis['batchBreakdown'] = []
    const skuAggregator = new Map<number, {
      skuId: number
      skuName: string
      received: number
      sold: number
    }>()

    for (const purchase of purchases) {
      const skuInfo = skus.find(s => s.id === purchase.skuId)
      const soldQuantity = soldPerBatch.get(purchase.id) || 0
      const remainingQuantity = Math.max(0, purchase.quantityBought - soldQuantity)
      
      totalReceived += purchase.quantityBought
      totalSold += soldQuantity

      // FIXED: Safe purchase date handling
      let purchasedOnTimestamp: number = now
      if (purchase.purchasedOn) {
        if (purchase.purchasedOn instanceof Date) {
          if (!isNaN(purchase.purchasedOn.getTime())) {
            purchasedOnTimestamp = Math.floor(purchase.purchasedOn.getTime() / 1000)
          }
        } else {
          const numTimestamp = Number(purchase.purchasedOn)
          if (!isNaN(numTimestamp) && numTimestamp > 0) {
            purchasedOnTimestamp = numTimestamp
          }
        }
      }

      // Calculate days in inventory
      const daysInInventory = Math.max(0, (now - purchasedOnTimestamp) / (24 * 60 * 60))
      
      // Calculate sell-through rate for this batch
      const batchSellThrough = purchase.quantityBought > 0 
        ? (soldQuantity / purchase.quantityBought) * 100 
        : 0

      // Calculate monthly sell-through rate
      const monthlySellThrough = daysInInventory > 30 
        ? (soldQuantity / purchase.quantityBought) * (30 / daysInInventory) * 100 
        : batchSellThrough

      // Determine health status
      let healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
      let recommendedAction: string

      if (batchSellThrough > 70) {
        healthStatus = 'Excellent'
        recommendedAction = 'Reorder immediately - top performer'
      } else if (batchSellThrough > 40) {
        healthStatus = 'Good'
        recommendedAction = 'Monitor stock levels, reorder soon'
      } else if (batchSellThrough > 20) {
        healthStatus = 'Slow'
        recommendedAction = 'Consider promotion to increase velocity'
      } else {
        healthStatus = 'Critical'
        recommendedAction = 'URGENT: Deep discount or write off'
      }

      // Calculate estimated weeks remaining
      const weeklySellRate = daysInInventory > 0 ? soldQuantity / (daysInInventory / 7) : 0
      const estimatedWeeksRemaining = weeklySellRate > 0 
        ? remainingQuantity / weeklySellRate 
        : 999

      // Calculate inventory value (estimate using $10 per unit for now)
      const batchInventoryValue = remainingQuantity * 10
      totalInventoryValue += batchInventoryValue
      
      // Track slow moving and critical inventory value
      if (healthStatus === 'Slow' || healthStatus === 'Critical') {
        slowMovingValue += batchInventoryValue
      }
      if (healthStatus === 'Critical') {
        criticalValue += batchInventoryValue
      }

      // FIXED: Safe date string creation
      let receivedDateStr = 'Unknown'
      if (purchase.purchasedOn) {
        if (purchase.purchasedOn instanceof Date && !isNaN(purchase.purchasedOn.getTime())) {
          receivedDateStr = purchase.purchasedOn.toISOString().split('T')[0]
        } else {
          const timestamp = Number(purchase.purchasedOn)
          if (!isNaN(timestamp) && timestamp > 0) {
            const date = new Date(timestamp * 1000)
            if (!isNaN(date.getTime())) {
              receivedDateStr = date.toISOString().split('T')[0]
            }
          }
        }
      }

      batchBreakdown.push({
        batchId: purchase.id,
        skuId: purchase.skuId,
        skuName: skuInfo?.name || `SKU ${purchase.skuId}`,
        receivedDate: receivedDateStr,
        daysInInventory: Math.round(daysInInventory),
        quantityReceived: purchase.quantityBought,
        quantitySold: soldQuantity,
        quantityRemaining: remainingQuantity,
        sellThroughRate: Number(batchSellThrough.toFixed(1)),
        monthlySellThroughRate: Number(monthlySellThrough.toFixed(1)),
        healthStatus,
        estimatedWeeksRemaining: Math.round(estimatedWeeksRemaining * 10) / 10,
        recommendedAction
      })

      // Update SKU aggregator
      const currentSku = skuAggregator.get(purchase.skuId) || {
        skuId: purchase.skuId,
        skuName: skuInfo?.name || `SKU ${purchase.skuId}`,
        received: 0,
        sold: 0
      }
      currentSku.received += purchase.quantityBought
      currentSku.sold += soldQuantity
      skuAggregator.set(purchase.skuId, currentSku)
    }

    // STEP 6: Calculate SKU breakdown
    const skuBreakdown: SellThroughAnalysis['skuBreakdown'] = Array.from(skuAggregator.values()).map(sku => {
      const skuSellThrough = sku.received > 0 ? (sku.sold / sku.received) * 100 : 0
      const remaining = sku.received - sku.sold
      
      let healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
      let recommendedAction: string

      if (skuSellThrough > 70) {
        healthStatus = 'Excellent'
        recommendedAction = 'Star performer - maintain inventory'
      } else if (skuSellThrough > 40) {
        healthStatus = 'Good'
        recommendedAction = 'Reliable seller - monitor trends'
      } else if (skuSellThrough > 20) {
        healthStatus = 'Slow'
        recommendedAction = 'Consider bundling or promotion'
      } else {
        healthStatus = 'Critical'
        recommendedAction = 'URGENT: Review pricing or discontinue'
      }

      return {
        skuId: sku.skuId,
        skuName: sku.skuName,
        quantityReceived: sku.received,
        quantitySold: sku.sold,
        quantityRemaining: remaining,
        sellThroughRate: Number(skuSellThrough.toFixed(1)),
        contributionToTotal: totalReceived > 0 ? Number(((sku.received / totalReceived) * 100).toFixed(1)) : 0,
        healthStatus,
        recommendedAction
      }
    })

    // STEP 7: Calculate overall sell-through rate
    const overallSellThroughRate = totalReceived > 0 ? (totalSold / totalReceived) * 100 : 0
    const totalRemaining = totalReceived - totalSold

    // STEP 8: Calculate time-based metrics
    const monthlySalesArray = Array.from(salesByMonth.values())
    const averageMonthlyRate = monthlySalesArray.length > 0 
      ? monthlySalesArray.reduce((sum, val) => sum + val, 0) / monthlySalesArray.length
      : 0

    const projectedDaysToSellRemaining = averageMonthlyRate > 0 
      ? (totalRemaining / (averageMonthlyRate / 30)) 
      : 999

    // STEP 9: Calculate trend analysis
    const sortedMonths = Array.from(salesByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3)

    const threeMonthTrend = sortedMonths.map(([month, sales]) => ({
      month,
      sellThroughRate: totalReceived > 0 ? Number(((sales / totalReceived) * 100).toFixed(1)) : 0
    }))

    // Determine if accelerating or decelerating
    let isAccelerating = false
    let isDecelerating = false
    let isStable = true
    let velocityChange = 0

    if (sortedMonths.length >= 3) {
      const [month1, month2, month3] = sortedMonths.map(([_, sales]) => sales)
      const change1to2 = month2 - month1
      const change2to3 = month3 - month2
      
      if (change2to3 > change1to2 + 5) {
        isAccelerating = true
        isStable = false
      } else if (change2to3 < change1to2 - 5) {
        isDecelerating = true
        isStable = false
      }
      
      velocityChange = change2to3 - change1to2
    }

    // STEP 10: Calculate health assessment
    const slowMovingItems = batchBreakdown.filter(b => b.healthStatus === 'Slow' || b.healthStatus === 'Critical')
    const criticalItems = batchBreakdown.filter(b => b.healthStatus === 'Critical')
    
    const slowMovingPercentage = batchBreakdown.length > 0 
      ? (slowMovingItems.length / batchBreakdown.length) * 100 
      : 0
    
    const criticalItemsPercentage = batchBreakdown.length > 0 
      ? (criticalItems.length / batchBreakdown.length) * 100 
      : 0

    let overallHealth: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'
    let riskLevel: 'Low' | 'Medium' | 'High' | 'Severe'

    if (overallSellThroughRate > 70 && criticalItemsPercentage < 5) {
      overallHealth = 'Excellent'
      riskLevel = 'Low'
    } else if (overallSellThroughRate > 50 && criticalItemsPercentage < 10) {
      overallHealth = 'Good'
      riskLevel = 'Low'
    } else if (overallSellThroughRate > 30 && criticalItemsPercentage < 20) {
      overallHealth = 'Fair'
      riskLevel = 'Medium'
    } else if (overallSellThroughRate > 15 && criticalItemsPercentage < 30) {
      overallHealth = 'Poor'
      riskLevel = 'High'
    } else {
      overallHealth = 'Critical'
      riskLevel = 'Severe'
    }

    // Generate warnings and recommendations
    const warnings: string[] = []
    const recommendations: string[] = []

    if (criticalItems.length > 0) {
      warnings.push(`${criticalItems.length} batches are critically slow - cash tied up!`)
      recommendations.push('Immediate deep discounts on critical items')
    }

    if (slowMovingItems.length > 3) {
      warnings.push(`${slowMovingItems.length} slow-moving batches need attention`)
      recommendations.push('Run bundle promotions on slow movers')
    }

    if (projectedDaysToSellRemaining > 180) {
      warnings.push(`At current rate, inventory will last ${Math.round(projectedDaysToSellRemaining)} days`)
      recommendations.push('Increase marketing or reduce reorder quantities')
    }

    if (isDecelerating) {
      warnings.push('Sell-through rate is declining - investigate cause')
      recommendations.push('Review pricing and competitive landscape')
    }

    // STEP 11: Calculate cash flow impact
    const estimatedRecoveryIfDiscounted = slowMovingValue * 0.7 // Assume 30% discount
    const potentialLossIfWrittenOff = criticalValue
    const monthsToSellAtCurrentRate = averageMonthlyRate > 0 
      ? totalRemaining / averageMonthlyRate 
      : 99

    let reorderUrgency: 'Immediate' | 'Soon' | 'Normal' | 'Hold' | 'Stop'
    if (overallSellThroughRate > 80 && totalRemaining < totalReceived * 0.2) {
      reorderUrgency = 'Immediate'
    } else if (overallSellThroughRate > 60) {
      reorderUrgency = 'Soon'
    } else if (overallSellThroughRate > 40) {
      reorderUrgency = 'Normal'
    } else if (overallSellThroughRate > 20) {
      reorderUrgency = 'Hold'
    } else {
      reorderUrgency = 'Stop'
    }

    // STEP 12: Return complete analysis
    return {
      overallSellThroughRate: Number(overallSellThroughRate.toFixed(1)),
      totalUnitsReceived: totalReceived,
      totalUnitsSold: totalSold,
      totalUnitsRemaining: totalRemaining,
      inventoryValueAtRisk: Number((slowMovingValue + criticalValue).toFixed(2)),
      
      sellThroughByPeriod: {
        last30Days: salesLast30Days,
        last60Days: salesLast60Days,
        last90Days: salesLast90Days,
        averageMonthlyRate: Number(averageMonthlyRate.toFixed(1)),
        projectedDaysToSellRemaining: Math.round(projectedDaysToSellRemaining)
      },
      
      batchBreakdown,
      skuBreakdown,
      
      trendAnalysis: {
        isAccelerating,
        isDecelerating,
        isStable,
        threeMonthTrend,
        velocityChange: Number(velocityChange.toFixed(1))
      },
      
      healthAssessment: {
        overallHealth,
        slowMovingPercentage: Number(slowMovingPercentage.toFixed(1)),
        criticalItemsPercentage: Number(criticalItemsPercentage.toFixed(1)),
        atRiskValue: Number((slowMovingValue + criticalValue).toFixed(2)),
        riskLevel,
        warnings,
        recommendations
      },
      
      cashFlowImpact: {
        cashTiedUpInSlowMovers: Number(slowMovingValue.toFixed(2)),
        estimatedRecoveryIfDiscounted: Number(estimatedRecoveryIfDiscounted.toFixed(2)),
        potentialLossIfWrittenOff: Number(potentialLossIfWrittenOff.toFixed(2)),
        monthsToSellAtCurrentRate: Number(monthsToSellAtCurrentRate.toFixed(1)),
        reorderUrgency
      }
    }
    
  } catch (error) {
    console.error(`Error calculating sell-through rate for product ${productId}:`, error)
    return createEmptySellThroughAnalysis()
  }
}

function createEmptySellThroughAnalysis(): SellThroughAnalysis {
  return {
    overallSellThroughRate: 0,
    totalUnitsReceived: 0,
    totalUnitsSold: 0,
    totalUnitsRemaining: 0,
    inventoryValueAtRisk: 0,
    
    sellThroughByPeriod: {
      last30Days: 0,
      last60Days: 0,
      last90Days: 0,
      averageMonthlyRate: 0,
      projectedDaysToSellRemaining: 0
    },
    
    batchBreakdown: [],
    skuBreakdown: [],
    
    trendAnalysis: {
      isAccelerating: false,
      isDecelerating: false,
      isStable: true,
      threeMonthTrend: [],
      velocityChange: 0
    },
    
    healthAssessment: {
      overallHealth: 'Fair',
      slowMovingPercentage: 0,
      criticalItemsPercentage: 0,
      atRiskValue: 0,
      riskLevel: 'Low',
      warnings: ['No data available'],
      recommendations: ['Add inventory to analyze sell-through']
    },
    
    cashFlowImpact: {
      cashTiedUpInSlowMovers: 0,
      estimatedRecoveryIfDiscounted: 0,
      potentialLossIfWrittenOff: 0,
      monthsToSellAtCurrentRate: 0,
      reorderUrgency: 'Hold'
    }
  }
}

/**
 * Calculates days of inventory remaining
 */
export interface DaysOfInventoryAnalysis {
  // Overall metrics
  overallDaysOfInventory: number
  currentInventoryUnits: number
  averageDailySalesRate: number
  salesTrend: 'Increasing' | 'Decreasing' | 'Stable'
  
  // Level 1: Product-level breakdown
  productLevel: {
    daysOfInventory: number
    inventoryValue: number
    reorderPoint: number
    safetyStockLevel: number
    status: 'Critical Low' | 'Low' | 'Optimal' | 'High' | 'Critical High'
    recommendation: string
  }
  
  // Level 2: Batch-level breakdown
  batchBreakdown: Array<{
    batchId: number
    skuId: number
    skuName: string
    receivedDate: string
    daysInInventory: number
    remainingUnits: number
    dailySalesRate: number
    daysRemaining: number
    percentRemaining: number
    contributionToTotal: number
    healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
    estimatedRunoutDate: string
    recommendedAction: string
  }>
  
  // Level 3: SKU-level breakdown
  skuBreakdown: Array<{
    skuId: number
    skuName: string
    remainingUnits: number
    dailySalesRate: number
    daysRemaining: number
    percentOfTotalInventory: number
    inventoryValue: number
    healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
    reorderPriority: 'Immediate' | 'Soon' | 'Normal' | 'Hold' | 'Stop'
    recommendedAction: string
  }>
  
  // Time-based analysis
  timeAnalysis: {
    by30Days: number
    by60Days: number
    by90Days: number
    trendDirection: 'Accelerating' | 'Decelerating' | 'Stable'
    seasonalAdjustedDays: number
    projectedStockoutDate: string
  }
  
  // Cash flow impact
  cashFlowImpact: {
    cashTiedUp: number
    optimalCashTarget: number
    excessCashTiedUp: number
    annualCarryingCost: number
    opportunityCost: number
  }
  
  // Risk assessment
  riskAssessment: {
    stockoutRisk: 'None' | 'Low' | 'Medium' | 'High' | 'Critical'
    overstockRisk: 'None' | 'Low' | 'Medium' | 'High' | 'Critical'
    riskFactors: string[]
    mitigationSteps: string[]
  }
  
  // Supplier insights
  supplierInsights: {
    leadTimeDays: number
    reorderTrigger: number
    orderFrequency: 'Weekly' | 'Monthly' | 'Quarterly' | 'As Needed'
    nextOrderRecommendedDate: string
    orderQuantitySuggestion: number
  }
}

export function calculateDaysOfInventory(productId: number): DaysOfInventoryAnalysis {
  try {
    
    // STEP 1: Get all SKUs for this product
    const skus = db()
      .select({ 
        id: sku.id,
        name: sku.sku_name 
      })
      .from(sku)
      .where(
        and(
          eq(sku.product_id, productId),
          eq(sku.is_deleted, false)
        )
      )
      .all()

    if (skus.length === 0) {
      return createEmptyDaysOfInventoryAnalysis()
    }

    const skuIds = skus.map(s => s.id)

    // STEP 2: Get ALL stock purchases
    const purchases = db()
      .select({
        id: stock_purchases.id,
        skuId: stock_purchases.sku_id,
        quantityBought: stock_purchases.quantity_bought,
        totalPriceBought: stock_purchases.total_price_bought,
        purchasedOn: stock_purchases.purchased_on
      })
      .from(stock_purchases)
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    if (purchases.length === 0) {
      return createEmptyDaysOfInventoryAnalysis()
    }

    // STEP 3: Get ALL sales with dates
    const salesData = db()
      .select({
        stockPurchasedId: sales.stock_purchased_id,
        quantity: sales.quantity,
        totalPrice: sales.total_price,
        soldOn: sales.sold_on
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          inArray(stock_purchases.sku_id, skuIds),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          sql`${sales.status} IN ('completed', 'pending')`
        )
      )
      .all()

    // STEP 4: Calculate current date and time periods
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60)

    // STEP 5: Calculate sold quantities per batch
    const soldPerBatch = new Map<number, number>()
    const salesByDay = new Map<string, number>()
    
    for (const sale of salesData) {
      const current = soldPerBatch.get(sale.stockPurchasedId ? sale.stockPurchasedId : 0) || 0
      soldPerBatch.set(sale.stockPurchasedId ? sale.stockPurchasedId : 0, current + sale.quantity)

      // FIXED: Safe date handling for daily tracking
      if (sale.soldOn) {
        let date: Date | null = null
        
        if (sale.soldOn instanceof Date && !isNaN(sale.soldOn.getTime())) {
          date = sale.soldOn
        } else {
          const timestamp = Number(sale.soldOn)
          if (!isNaN(timestamp) && timestamp > 0) {
            const d = new Date(timestamp * 1000)
            if (!isNaN(d.getTime())) {
              date = d
            }
          }
        }
        
        if (date) {
          const dateKey = date.toISOString().split('T')[0]
          const daySales = salesByDay.get(dateKey) || 0
          salesByDay.set(dateKey, daySales + sale.quantity)
        }
      }
    }

    // STEP 6: Calculate sales rates by period
    let salesLast30Days = 0
    let salesLast60Days = 0
    let salesLast90Days = 0
    let salesByMonth: { [key: string]: number } = {}

    for (const sale of salesData) {
      // FIXED: Safe timestamp conversion
      let soldOnTimestamp: number | null = null
      
      if (sale.soldOn) {
        if (sale.soldOn instanceof Date && !isNaN(sale.soldOn.getTime())) {
          soldOnTimestamp = Math.floor(sale.soldOn.getTime() / 1000)
        } else {
          const numTimestamp = Number(sale.soldOn)
          if (!isNaN(numTimestamp) && numTimestamp > 0) {
            soldOnTimestamp = numTimestamp
          }
        }
      }

      if (soldOnTimestamp) {
        if (soldOnTimestamp >= thirtyDaysAgo) salesLast30Days += sale.quantity
        if (soldOnTimestamp >= sixtyDaysAgo) salesLast60Days += sale.quantity
        if (soldOnTimestamp >= ninetyDaysAgo) salesLast90Days += sale.quantity

        const date = new Date(soldOnTimestamp * 1000)
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + sale.quantity
        }
      }
    }

    // Determine sales trend
    const monthlySalesArray = Object.entries(salesByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3)
    
    let salesTrend: 'Increasing' | 'Decreasing' | 'Stable' = 'Stable'
    if (monthlySalesArray.length >= 3) {
      const [_, first] = monthlySalesArray[0]
      const [__, second] = monthlySalesArray[1]
      const [___, third] = monthlySalesArray[2]
      
      if (third > second && second > first) salesTrend = 'Increasing'
      else if (third < second && second < first) salesTrend = 'Decreasing'
    }

    // STEP 7: Calculate current inventory by batch and SKU
    let totalCurrentInventory = 0
    let totalInventoryValue = 0
    const batchBreakdown: DaysOfInventoryAnalysis['batchBreakdown'] = []
    const skuAggregator = new Map<number, {
      skuId: number
      skuName: string
      remaining: number
      value: number
      dailyRate: number
      daysRemaining: number
    }>()

    // Calculate average daily rate from last 30 days (or use longer period if no recent sales)
    let averageDailyRate = salesLast30Days / 30

    if (averageDailyRate === 0) {
      // Try 60 dayss
      averageDailyRate = salesLast60Days / 60
    }
    if (averageDailyRate === 0) {
      // Try 90 days
      averageDailyRate = salesLast90Days / 90
    }
    if (averageDailyRate === 0 && salesData.length > 0) {
      // Use lifetime average
      let firstSaleTimestamp: number | null = null
      
      // Find first sale date safely
      for (const sale of salesData) {
        if (sale.soldOn) {
          let timestamp: number | null = null
          if (sale.soldOn instanceof Date && !isNaN(sale.soldOn.getTime())) {
            timestamp = Math.floor(sale.soldOn.getTime() / 1000)
          } else {
            const numTimestamp = Number(sale.soldOn)
            if (!isNaN(numTimestamp) && numTimestamp > 0) {
              timestamp = numTimestamp
            }
          }
          
          if (timestamp && (!firstSaleTimestamp || timestamp < firstSaleTimestamp)) {
            firstSaleTimestamp = timestamp
          }
        }
      }
      
      if (firstSaleTimestamp) {
        const daysSinceFirstSale = (now - firstSaleTimestamp) / (24 * 60 * 60)
        const totalLifetimeSales = salesData.reduce((sum, s) => sum + s.quantity, 0)
        averageDailyRate = totalLifetimeSales / Math.max(1, daysSinceFirstSale)
      }
    }

    for (const purchase of purchases) {
      const skuInfo = skus.find(s => s.id === purchase.skuId)
      const soldQuantity = soldPerBatch.get(purchase.id) || 0
      const remainingQuantity = Math.max(0, purchase.quantityBought - soldQuantity)
      
      if (remainingQuantity === 0) continue

      // FIXED: Safe purchase date handling
      let purchasedOnTimestamp: number | null = null
      if (purchase.purchasedOn) {
        if (purchase.purchasedOn instanceof Date && !isNaN(purchase.purchasedOn.getTime())) {
          purchasedOnTimestamp = Math.floor(purchase.purchasedOn.getTime() / 1000)
        } else {
          const numTimestamp = Number(purchase.purchasedOn)
          if (!isNaN(numTimestamp) && numTimestamp > 0) {
            purchasedOnTimestamp = numTimestamp
          }
        }
      }

      // Calculate days in inventory
      const daysInInventory = purchasedOnTimestamp 
        ? Math.max(0, (now - purchasedOnTimestamp) / (24 * 60 * 60))
        : 0
      
      // Calculate this batch's contribution to daily sales
      const batchDailyRate = averageDailyRate * (remainingQuantity / Math.max(1, totalCurrentInventory))
      
      // Calculate days remaining for this batch
      const daysRemaining = batchDailyRate > 0 ? remainingQuantity / batchDailyRate : 999

      // Calculate estimated runout date
      let estimatedRunoutDate = 'Unknown'
      if (daysRemaining < 999) {
        const runoutDate = new Date(now * 1000)
        runoutDate.setDate(runoutDate.getDate() + daysRemaining)
        if (!isNaN(runoutDate.getTime())) {
          estimatedRunoutDate = runoutDate.toISOString().split('T')[0]
        }
      }

      // Calculate percent remaining
      const percentRemaining = (remainingQuantity / purchase.quantityBought) * 100

      // Determine health status
      let healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
      if (percentRemaining < 20) {
        healthStatus = 'Excellent' // almost sold through
      } else if (percentRemaining < 40) {
        healthStatus = 'Good'
      } else if (percentRemaining < 60) {
        healthStatus = 'Slow'
      } else {
        healthStatus = 'Critical' // over 60% still remaining
      }

      // Calculate contribution to total inventory
      const contributionToTotal = totalCurrentInventory > 0 
        ? (remainingQuantity / totalCurrentInventory) * 100 
        : 0

      // Determine recommended action
      let recommendedAction: string
      if (daysRemaining < 30) {
        recommendedAction = 'Reorder soon - running low'
      } else if (daysRemaining < 60) {
        recommendedAction = 'Monitor levels - healthy'
      } else if (daysRemaining < 90) {
        recommendedAction = 'Consider promotion to increase velocity'
      } else {
        recommendedAction = 'URGENT: Excess inventory - discount immediately'
      }

      // Calculate inventory value
      const unitCost = purchase.totalPriceBought / purchase.quantityBought
      const batchValue = remainingQuantity * unitCost

      // FIXED: Safe date string creation
      let receivedDateStr = 'Unknown'
      if (purchase.purchasedOn) {
        if (purchase.purchasedOn instanceof Date && !isNaN(purchase.purchasedOn.getTime())) {
          receivedDateStr = purchase.purchasedOn.toISOString().split('T')[0]
        } else {
          const timestamp = Number(purchase.purchasedOn)
          if (!isNaN(timestamp) && timestamp > 0) {
            const date = new Date(timestamp * 1000)
            if (!isNaN(date.getTime())) {
              receivedDateStr = date.toISOString().split('T')[0]
            }
          }
        }
      }

      batchBreakdown.push({
        batchId: purchase.id,
        skuId: purchase.skuId,
        skuName: skuInfo?.name || `SKU ${purchase.skuId}`,
        receivedDate: receivedDateStr,
        daysInInventory: Math.round(daysInInventory),
        remainingUnits: remainingQuantity,
        dailySalesRate: Number(batchDailyRate.toFixed(2)),
        daysRemaining: Math.round(daysRemaining * 10) / 10,
        percentRemaining: Number(percentRemaining.toFixed(1)),
        contributionToTotal: Number(contributionToTotal.toFixed(1)),
        healthStatus,
        estimatedRunoutDate,
        recommendedAction
      })

      // Update totals
      totalCurrentInventory += remainingQuantity
      totalInventoryValue += batchValue

      // Update SKU aggregator
      const currentSku = skuAggregator.get(purchase.skuId) || {
        skuId: purchase.skuId,
        skuName: skuInfo?.name || `SKU ${purchase.skuId}`,
        remaining: 0,
        value: 0,
        dailyRate: 0,
        daysRemaining: 0
      }
      currentSku.remaining += remainingQuantity
      currentSku.value += batchValue
      skuAggregator.set(purchase.skuId, currentSku)
    }

    // STEP 8: Calculate SKU breakdown
    const skuBreakdown: DaysOfInventoryAnalysis['skuBreakdown'] = Array.from(skuAggregator.values()).map(sku => {
      // Calculate this SKU's daily rate (weighted by its contribution)
      const skuDailyRate = averageDailyRate * (sku.remaining / Math.max(1, totalCurrentInventory))
      const daysRemaining = skuDailyRate > 0 ? sku.remaining / skuDailyRate : 999
      const percentOfTotal = (sku.remaining / Math.max(1, totalCurrentInventory)) * 100

      // Determine health status
      let healthStatus: 'Excellent' | 'Good' | 'Slow' | 'Critical'
      if (daysRemaining < 30) {
        healthStatus = 'Excellent'
      } else if (daysRemaining < 60) {
        healthStatus = 'Good'
      } else if (daysRemaining < 90) {
        healthStatus = 'Slow'
      } else {
        healthStatus = 'Critical'
      }

      // Determine reorder priority
      let reorderPriority: 'Immediate' | 'Soon' | 'Normal' | 'Hold' | 'Stop'
      if (daysRemaining < 20) {
        reorderPriority = 'Immediate'
      } else if (daysRemaining < 40) {
        reorderPriority = 'Soon'
      } else if (daysRemaining < 70) {
        reorderPriority = 'Normal'
      } else if (daysRemaining < 100) {
        reorderPriority = 'Hold'
      } else {
        reorderPriority = 'Stop'
      }

      // Determine recommended action
      let recommendedAction: string
      if (daysRemaining < 30) {
        recommendedAction = `Reorder within 2 weeks - only ${Math.round(daysRemaining)} days left`
      } else if (daysRemaining < 60) {
        recommendedAction = 'Monitor sales velocity'
      } else if (daysRemaining < 90) {
        recommendedAction = 'Consider bundling with faster SKUs'
      } else {
        recommendedAction = `URGENT: ${Math.round(daysRemaining)} days inventory - discount now!`
      }

      return {
        skuId: sku.skuId,
        skuName: sku.skuName,
        remainingUnits: sku.remaining,
        dailySalesRate: Number(skuDailyRate.toFixed(2)),
        daysRemaining: Math.round(daysRemaining * 10) / 10,
        percentOfTotalInventory: Number(percentOfTotal.toFixed(1)),
        inventoryValue: Number(sku.value.toFixed(2)),
        healthStatus,
        reorderPriority,
        recommendedAction
      }
    })

    // STEP 9: Calculate overall days of inventory
    const overallDaysOfInventory = averageDailyRate > 0 
      ? totalCurrentInventory / averageDailyRate 
      : 999

    // STEP 10: Product-level analysis
    const leadTimeDays = 30
    const safetyStockDays = 15
    const reorderPoint = (leadTimeDays + safetyStockDays) * averageDailyRate
    const safetyStockLevel = safetyStockDays * averageDailyRate

    let productStatus: 'Critical Low' | 'Low' | 'Optimal' | 'High' | 'Critical High'
    let productRecommendation: string

    if (overallDaysOfInventory < safetyStockDays) {
      productStatus = 'Critical Low'
      productRecommendation = 'URGENT: Stockout imminent - emergency reorder needed!'
    } else if (overallDaysOfInventory < leadTimeDays) {
      productStatus = 'Low'
      productRecommendation = 'Reorder immediately to avoid stockout'
    } else if (overallDaysOfInventory < leadTimeDays + 30) {
      productStatus = 'Optimal'
      productRecommendation = 'Inventory levels healthy - reorder on schedule'
    } else if (overallDaysOfInventory < leadTimeDays + 60) {
      productStatus = 'High'
      productRecommendation = 'Inventory slightly high - consider promotion'
    } else {
      productStatus = 'Critical High'
      productRecommendation = 'URGENT: Excess inventory - discount heavily'
    }

    // STEP 11: Time-based analysis
    const daysBy30DayRate = salesLast30Days > 0 ? totalCurrentInventory / (salesLast30Days / 30) : 999
    const daysBy60DayRate = salesLast60Days > 0 ? totalCurrentInventory / (salesLast60Days / 60) : 999
    const daysBy90DayRate = salesLast90Days > 0 ? totalCurrentInventory / (salesLast90Days / 90) : 999

    // Determine trend direction
    let trendDirection: 'Accelerating' | 'Decelerating' | 'Stable'
    if (daysBy30DayRate < daysBy60DayRate && daysBy60DayRate < daysBy90DayRate) {
      trendDirection = 'Accelerating' // sales increasing, days decreasing
    } else if (daysBy30DayRate > daysBy60DayRate && daysBy60DayRate > daysBy90DayRate) {
      trendDirection = 'Decelerating' // sales decreasing, days increasing
    } else {
      trendDirection = 'Stable'
    }

    // Projected stockout date
    let projectedStockoutDate = 'Unknown'
    if (overallDaysOfInventory < 999) {
      const stockoutDate = new Date(now * 1000)
      stockoutDate.setDate(stockoutDate.getDate() + overallDaysOfInventory)
      if (!isNaN(stockoutDate.getTime())) {
        projectedStockoutDate = stockoutDate.toISOString().split('T')[0]
      }
    }

    // STEP 12: Cash flow impact
    const cashTiedUp = totalInventoryValue
    const optimalInventoryValue = (leadTimeDays + 30) * averageDailyRate * 
      (totalInventoryValue / Math.max(1, totalCurrentInventory))
    const excessCashTiedUp = Math.max(0, cashTiedUp - optimalInventoryValue)
    const annualCarryingCost = cashTiedUp * 0.20 // 20% annual carrying cost
    const opportunityCost = excessCashTiedUp * 0.20 // 20% opportunity cost

    // STEP 13: Risk assessment
    let stockoutRisk: 'None' | 'Low' | 'Medium' | 'High' | 'Critical'
    if (overallDaysOfInventory < safetyStockDays) {
      stockoutRisk = 'Critical'
    } else if (overallDaysOfInventory < leadTimeDays) {
      stockoutRisk = 'High'
    } else if (overallDaysOfInventory < leadTimeDays + 15) {
      stockoutRisk = 'Medium'
    } else if (overallDaysOfInventory < leadTimeDays + 30) {
      stockoutRisk = 'Low'
    } else {
      stockoutRisk = 'None'
    }

    let overstockRisk: 'None' | 'Low' | 'Medium' | 'High' | 'Critical'
    if (overallDaysOfInventory > leadTimeDays + 90) {
      overstockRisk = 'Critical'
    } else if (overallDaysOfInventory > leadTimeDays + 60) {
      overstockRisk = 'High'
    } else if (overallDaysOfInventory > leadTimeDays + 45) {
      overstockRisk = 'Medium'
    } else if (overallDaysOfInventory > leadTimeDays + 30) {
      overstockRisk = 'Low'
    } else {
      overstockRisk = 'None'
    }

    const riskFactors: string[] = []
    const mitigationSteps: string[] = []

    if (stockoutRisk === 'Critical' || stockoutRisk === 'High') {
      riskFactors.push('Stockout risk - potential lost sales')
      mitigationSteps.push('Place emergency order immediately')
      mitigationSteps.push('Consider split shipments to get partial stock faster')
    }

    if (overstockRisk === 'Critical' || overstockRisk === 'High') {
      riskFactors.push('Excess inventory - cash tied up')
      mitigationSteps.push('Run discount promotion immediately')
      mitigationSteps.push('Stop all reorders until inventory normalizes')
    }

    if (salesTrend === 'Decreasing') {
      riskFactors.push('Sales declining - may have more inventory than calculated')
      mitigationSteps.push('Review pricing and marketing strategy')
    }

    const slowMovingSkus = skuBreakdown.filter(s => s.healthStatus === 'Slow' || s.healthStatus === 'Critical')
    if (slowMovingSkus.length > 0) {
      riskFactors.push(`${slowMovingSkus.length} SKUs are slow-moving`)
      mitigationSteps.push('Consider bundling slow SKUs with fast movers')
    }

    // STEP 14: Supplier insights
    const supplierLeadTimeDays = 30
    const reorderTrigger = Math.ceil((supplierLeadTimeDays + safetyStockDays) * averageDailyRate)
    
    let orderFrequency: 'Weekly' | 'Monthly' | 'Quarterly' | 'As Needed'
    if (averageDailyRate > 20) {
      orderFrequency = 'Weekly'
    } else if (averageDailyRate > 5) {
      orderFrequency = 'Monthly'
    } else if (averageDailyRate > 1) {
      orderFrequency = 'Quarterly'
    } else {
      orderFrequency = 'As Needed'
    }

    let nextOrderRecommendedDate = 'Unknown'
    const nextOrderDate = new Date(now * 1000)
    if (overallDaysOfInventory < supplierLeadTimeDays + 15) {
      nextOrderDate.setDate(nextOrderDate.getDate() + 0) // Order now
    } else {
      nextOrderDate.setDate(nextOrderDate.getDate() + (overallDaysOfInventory - supplierLeadTimeDays - 15))
    }
    if (!isNaN(nextOrderDate.getTime())) {
      nextOrderRecommendedDate = nextOrderDate.toISOString().split('T')[0]
    }

    // Suggested order quantity (30-60 days worth)
    const orderQuantitySuggestion = Math.ceil(averageDailyRate * 45)

    // STEP 15: Return complete analysis
    return {
      overallDaysOfInventory: Math.round(overallDaysOfInventory * 10) / 10,
      currentInventoryUnits: totalCurrentInventory,
      averageDailySalesRate: Number(averageDailyRate.toFixed(2)),
      salesTrend,
      
      productLevel: {
        daysOfInventory: Math.round(overallDaysOfInventory * 10) / 10,
        inventoryValue: Number(totalInventoryValue.toFixed(2)),
        reorderPoint: Math.ceil(reorderPoint),
        safetyStockLevel: Math.ceil(safetyStockLevel),
        status: productStatus,
        recommendation: productRecommendation
      },
      
      batchBreakdown,
      skuBreakdown,
      
      timeAnalysis: {
        by30Days: Math.round(daysBy30DayRate * 10) / 10,
        by60Days: Math.round(daysBy60DayRate * 10) / 10,
        by90Days: Math.round(daysBy90DayRate * 10) / 10,
        trendDirection,
        seasonalAdjustedDays: Math.round(overallDaysOfInventory * 10) / 10,
        projectedStockoutDate
      },
      
      cashFlowImpact: {
        cashTiedUp: Number(cashTiedUp.toFixed(2)),
        optimalCashTarget: Number(optimalInventoryValue.toFixed(2)),
        excessCashTiedUp: Number(excessCashTiedUp.toFixed(2)),
        annualCarryingCost: Number(annualCarryingCost.toFixed(2)),
        opportunityCost: Number(opportunityCost.toFixed(2))
      },
      
      riskAssessment: {
        stockoutRisk,
        overstockRisk,
        riskFactors,
        mitigationSteps
      },
      
      supplierInsights: {
        leadTimeDays: supplierLeadTimeDays,
        reorderTrigger,
        orderFrequency,
        nextOrderRecommendedDate,
        orderQuantitySuggestion
      }
    }
    
  } catch (error) {
    console.error(`Error calculating days of inventory for product ${productId}:`, error)
    return createEmptyDaysOfInventoryAnalysis()
  }
}

function createEmptyDaysOfInventoryAnalysis(): DaysOfInventoryAnalysis {
  const today = new Date()
  const nextMonth = new Date()
  nextMonth.setDate(nextMonth.getDate() + 30)
  
  return {
    overallDaysOfInventory: 0,
    currentInventoryUnits: 0,
    averageDailySalesRate: 0,
    salesTrend: 'Stable',
    
    productLevel: {
      daysOfInventory: 0,
      inventoryValue: 0,
      reorderPoint: 0,
      safetyStockLevel: 0,
      status: 'Optimal',
      recommendation: 'No inventory data available'
    },
    
    batchBreakdown: [],
    skuBreakdown: [],
    
    timeAnalysis: {
      by30Days: 0,
      by60Days: 0,
      by90Days: 0,
      trendDirection: 'Stable',
      seasonalAdjustedDays: 0,
      projectedStockoutDate: nextMonth.toISOString().split('T')[0]
    },
    
    cashFlowImpact: {
      cashTiedUp: 0,
      optimalCashTarget: 0,
      excessCashTiedUp: 0,
      annualCarryingCost: 0,
      opportunityCost: 0
    },
    
    riskAssessment: {
      stockoutRisk: 'None',
      overstockRisk: 'None',
      riskFactors: ['No data available'],
      mitigationSteps: ['Add inventory to analyze']
    },
    
    supplierInsights: {
      leadTimeDays: 30,
      reorderTrigger: 0,
      orderFrequency: 'As Needed',
      nextOrderRecommendedDate: today.toISOString().split('T')[0],
      orderQuantitySuggestion: 0
    }
  }
}


ipcMain.handle(
  'products:get-all',
  async (_event, payload: GetProductsPayload = {}) => {
    try {
      const {
        page = 1,
        limit = 30,
        include_deleted = false,
        include_inactive = false,
        include_unsynced = true,
        has_sku = 'both',
        sort_by = 'created_on',
        sort_order = 'desc',
        category_id,
        search,
        created_after,
        created_before,
        updated_after,
        updated_before,
        min_profit_margin,
        max_profit_margin,
        min_items_sold,
        max_items_sold,
        low_stock_only = false,
        best_seller_only = false,
        loss_making_only = false,
        min_sell_through_rate,
        max_sell_through_rate,
        include_images = true,
        include_skus = true,
        max_skus_return = 10,
        // fields
      } = payload

      const offset = (page - 1) * limit

      /* ============================
         BUILD WHERE CLAUSE
      ============================ */
      const conditions: SQL[] = []
      
      if (!include_deleted) {
        conditions.push(eq(products.is_deleted, false))
      }
      if (!include_inactive) {
        conditions.push(eq(products.is_active, true))
      }
      if (!include_unsynced) {
        conditions.push(eq(products.is_sync_required, false))
      }

      // Category filter
      if (category_id) {
        if (Array.isArray(category_id)) {
          conditions.push(inArray(products.category_id, category_id))
        } else {
          conditions.push(eq(products.category_id, category_id))
        }
      }

      // Search filter
      if (search) {
        const searchPattern = `%${search}%`
        const searchCondition = or(
          like(products.product_name, searchPattern),
          like(products.description, searchPattern)
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // Date filters
      if (created_after) {
        conditions.push(sql`${products.created_on} >= ${created_after}`)
      }
      if (created_before) {
        conditions.push(sql`${products.created_on} <= ${created_before}`)
      }
      if (updated_after) {
        conditions.push(sql`${products.updated_on} >= ${updated_after}`)
      }
      if (updated_before) {
        conditions.push(sql`${products.updated_on} <= ${updated_before}`)
      }

      /* ============================
         BUILD SKU FILTER
      ============================ */
      if (has_sku === 'yes') {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM sku 
          WHERE sku.product_id = ${products.id} 
          AND sku.is_deleted = 0
        )`)
      } else if (has_sku === 'no') {
        conditions.push(sql`NOT EXISTS (
          SELECT 1 FROM sku 
          WHERE sku.product_id = ${products.id} 
          AND sku.is_deleted = 0
        )`)
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      /* ============================
         GET TOTAL COUNT
      ============================ */
      const countResult = db()
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(whereClause)
        .get()
      
      const totalCount = Number(countResult?.count ?? 0)

      if (totalCount === 0) {
        return {
          success: true,
          data: {
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_next: false,
              has_prev: false,
              returned: 0,
              from: 0,
              to: 0
            },
            products: [],
            summary: createEmptySummary()
          }
        }
      }

      /* ============================
         FETCH BASIC PRODUCTS
      ============================ */
      const baseQuery = db()
        .select({
          id: products.id,
          sync_id: products.sync_id,
          product_name: products.product_name,
          category_id: products.category_id,
          description: products.description,
          created_on: products.created_on,
          updated_on: products.updated_on,
          last_sync: products.last_sync,
          is_deleted: products.is_deleted,
          is_active: products.is_active,
          is_sync_required: products.is_sync_required
        })
        .from(products)
        .where(whereClause)

      // Apply sorting
      let queryWithOrder
      if (sort_by === 'product_name') {
        queryWithOrder = sort_order === 'asc' 
          ? baseQuery.orderBy(asc(products.product_name))
          : baseQuery.orderBy(desc(products.product_name))
      } else if (sort_by === 'created_on') {
        queryWithOrder = sort_order === 'asc'
          ? baseQuery.orderBy(asc(products.created_on))
          : baseQuery.orderBy(desc(products.created_on))
      } else if (sort_by === 'updated_on') {
        queryWithOrder = sort_order === 'asc'
          ? baseQuery.orderBy(asc(products.updated_on))
          : baseQuery.orderBy(desc(products.updated_on))
      } else {
        queryWithOrder = baseQuery.orderBy(desc(products.created_on))
      }

      // Apply pagination
      const productList = await queryWithOrder
        .limit(limit)
        .offset(offset)
        .all()

      const productIds = productList.map(p => p.id)

      /* ============================
         FETCH RELATED DATA
      ============================ */
      const [images, skus, categories] = await Promise.all([
        include_images ? db()
          .select({
            id: product_image.id,
            product_id: product_image.product_id,
            image: product_image.image
          })
          .from(product_image)
          .where(
            and(
              eq(product_image.is_deleted, false),
              inArray(product_image.product_id, productIds)
            )
          )
          .all() : Promise.resolve([]),

        include_skus ? db()
          .select({
            id: sku.id,
            product_id: sku.product_id,
            sku_name: sku.sku_name,
            code: sku.code,
            created_on: sku.created_on,
            updated_on: sku.updated_on,
            is_active: sku.is_active
          })
          .from(sku)
          .where(
            and(
              eq(sku.is_deleted, false),
              inArray(sku.product_id, productIds)
            )
          )
          .limit(max_skus_return * productIds.length)
          .all() : Promise.resolve([]),

        db()
          .select({
            id: product_categories.id,
            name: product_categories.category_name
          })
          .from(product_categories)
          .where(eq(product_categories.is_deleted, false))
          .all()
      ])

      /* ============================
         BUILD DATA MAPS
      ============================ */
      const imageMap = new Map<number, any[]>()
      for (const img of images) {
        if (!imageMap.has(img.product_id)) {
          imageMap.set(img.product_id, [])
        }
        try {
          const parsedImage = img.image ? JSON.parse(img.image) : {}
          imageMap.get(img.product_id)?.push({
            id: img.id,
            ...parsedImage
          })
        } catch {
          imageMap.get(img.product_id)?.push({
            id: img.id,
            path: null,
            error: 'Invalid image data'
          })
        }
      }

      const skuMap = new Map<number, any[]>()
      const skuCountMap = new Map<number, number>()
      for (const s of skus) {
        skuCountMap.set(s.product_id, (skuCountMap.get(s.product_id) ?? 0) + 1)
        if (!skuMap.has(s.product_id)) {
          skuMap.set(s.product_id, [])
        }
        if ((skuMap.get(s.product_id)?.length ?? 0) < max_skus_return) {
          skuMap.get(s.product_id)?.push(s)
        }
      }

      const categoryMap = new Map<number, string>()
      for (const cat of categories) {
        categoryMap.set(cat.id, cat.name)
      }

      /* ============================
         BUILD FINAL PRODUCTS WITH YOUR FUNCTIONS
      ============================ */
      let totalProductsWithImages = 0
      let totalProductsWithSkus = 0
      let totalProductsWithStock = 0
      let totalOutOfStock = 0
      let totalLowStock = 0
      let totalOverstocked = 0
      
      let grandTotalBought = 0
      let grandTotalSold = 0
      let grandTotalRemaining = 0
      let grandTotalRevenue = 0
      let grandTotalCost = 0
      let grandTotalProfit = 0
      let grandTotalInventoryValue = 0

      const finalProducts = await Promise.all(productList.map(async row => {
        // Run your functions
        const itemsSold = calculateTotalItemsSold(row.id)
        const profitAnalysis = calculateProductProfit(row.id)
        const avgSkuMargin = calculateAverageSkuProfitMargin(row.id)
        const inventoryAnalysis = calculateTotalInventoryValue(row.id)
        const sellThroughAnalysis = calculateSellThroughRate(row.id)
        const daysAnalysis = calculateDaysOfInventory(row.id)
        
        // Extract metrics
        const total_items_bought = inventoryAnalysis.totalCostBasis > 0 ? 
          inventoryAnalysis.totalUnitsOnHand + itemsSold : 0
        const total_items_sold = itemsSold
        const total_items_remaining = inventoryAnalysis.totalUnitsOnHand
        const inventory_value = inventoryAnalysis.totalInventoryValue
        const profit_margin = profitAnalysis.actualProfitMargin
        const sell_through_rate = sellThroughAnalysis.overallSellThroughRate
        const days_of_inventory = daysAnalysis.overallDaysOfInventory
        const sku_count = skuCountMap.get(row.id) ?? 0
        
        // Determine stock status
        let stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
        if (total_items_remaining <= 0) {
          stock_status = 'Out of Stock'
          totalOutOfStock++
        } else if (days_of_inventory < 30) {
          stock_status = 'Low Stock'
          totalLowStock++
        } else if (days_of_inventory > 180) {
          stock_status = 'Overstocked'
          totalOverstocked++
        } else {
          stock_status = 'In Stock'
        }

        // Status flags (using boolean, not 0/1)
        const is_low_stock = stock_status === 'Low Stock'
        const is_high_margin = profit_margin > 30
        const is_loss_making = profit_margin < 0
        const is_best_seller = total_items_sold > 500

        // Update grand totals
        grandTotalBought += total_items_bought
        grandTotalSold += total_items_sold
        grandTotalRemaining += total_items_remaining
        grandTotalRevenue += profitAnalysis.actualTotalRevenue
        grandTotalCost += profitAnalysis.actualTotalCost
        grandTotalProfit += profitAnalysis.actualNetProfit
        grandTotalInventoryValue += inventory_value

        if (sku_count > 0) totalProductsWithSkus++
        if (imageMap.has(row.id) && imageMap.get(row.id)!.length > 0) totalProductsWithImages++
        if (total_items_remaining > 0) totalProductsWithStock++

        // Build product object
        const product = {
          id: row.id,
          sync_id: row.sync_id,
          product_name: row.product_name,
          category_id: row.category_id,
          category_name: categoryMap.get(row.category_id) ?? 'Unknown',
          description: row.description,
          created_on: Number(row.created_on),
          updated_on: Number(row.updated_on),
          is_active: row.is_active === true,
          is_deleted: row.is_deleted === true,
          sku_count,
          images: imageMap.get(row.id) ?? [],
          skus: skuMap.get(row.id) ?? [],
          metrics: {
            // Core inventory metrics
            total_items_bought,
            total_items_sold,
            total_items_remaining,
            inventory_value: Number(inventory_value.toFixed(2)),
            
            // Financial metrics
            total_revenue: Number(profitAnalysis.actualTotalRevenue.toFixed(2)),
            total_cost: Number(profitAnalysis.actualTotalCost.toFixed(2)),
            total_profit: Number(profitAnalysis.actualNetProfit.toFixed(2)),
            profit_margin: Number(profit_margin.toFixed(2)),
            
            // SKU metrics
            sku_count,
            avg_sku_profit_margin: Number(avgSkuMargin.toFixed(2)),
            
            // Performance metrics
            sell_through_rate: Number(sell_through_rate.toFixed(1)),
            days_of_inventory: Math.round(days_of_inventory),
            
            // Status flags (all boolean)
            is_low_stock,
            is_high_margin,
            is_loss_making,
            is_best_seller,
            stock_status
          }
        }

        return product
      }))

      /* ============================
         APPLY METRIC-BASED FILTERS
      ============================ */
      let filteredProducts = [...finalProducts]

      if (min_items_sold !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.metrics.total_items_sold >= min_items_sold)
      }
      if (max_items_sold !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.metrics.total_items_sold <= max_items_sold)
      }
      if (min_profit_margin !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.metrics.profit_margin >= min_profit_margin)
      }
      if (max_profit_margin !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.metrics.profit_margin <= max_profit_margin)
      }
      if (min_sell_through_rate !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.metrics.sell_through_rate >= min_sell_through_rate)
      }
      if (max_sell_through_rate !== undefined) {
        filteredProducts = filteredProducts.filter(p => p.metrics.sell_through_rate <= max_sell_through_rate)
      }
      if (low_stock_only) {
        filteredProducts = filteredProducts.filter(p => p.metrics.is_low_stock)
      }
      if (best_seller_only) {
        filteredProducts = filteredProducts.filter(p => p.metrics.is_best_seller)
      }
      if (loss_making_only) {
        filteredProducts = filteredProducts.filter(p => p.metrics.is_loss_making)
      }

      /* ============================
         APPLY METRIC-BASED SORTING
      ============================ */
      if (sort_by === 'items_sold') {
        filteredProducts.sort((a, b) => 
          sort_order === 'asc' 
            ? a.metrics.total_items_sold - b.metrics.total_items_sold
            : b.metrics.total_items_sold - a.metrics.total_items_sold
        )
      } else if (sort_by === 'profit_margin') {
        filteredProducts.sort((a, b) => 
          sort_order === 'asc' 
            ? a.metrics.profit_margin - b.metrics.profit_margin
            : b.metrics.profit_margin - a.metrics.profit_margin
        )
      } else if (sort_by === 'inventory_value') {
        filteredProducts.sort((a, b) => 
          sort_order === 'asc' 
            ? a.metrics.inventory_value - b.metrics.inventory_value
            : b.metrics.inventory_value - a.metrics.inventory_value
        )
      } else if (sort_by === 'sell_through_rate') {
        filteredProducts.sort((a, b) => 
          sort_order === 'asc' 
            ? a.metrics.sell_through_rate - b.metrics.sell_through_rate
            : b.metrics.sell_through_rate - a.metrics.sell_through_rate
        )
      }

      /* ============================
         BUILD SUMMARY
      ============================ */
      const summary = {
        total_products: filteredProducts.length,
        total_items_bought: grandTotalBought,
        total_items_sold: grandTotalSold,
        total_items_remaining: grandTotalRemaining,
        total_inventory_value: Number(grandTotalInventoryValue.toFixed(2)),
        total_revenue: Number(grandTotalRevenue.toFixed(2)),
        total_profit: Number(grandTotalProfit.toFixed(2)),
        avg_profit_margin: grandTotalRevenue > 0 
          ? Number(((grandTotalProfit / grandTotalRevenue) * 100).toFixed(2)) 
          : 0,
        with_images: totalProductsWithImages,
        with_skus: totalProductsWithSkus,
        with_stock: totalProductsWithStock,
        out_of_stock: totalOutOfStock,
        low_stock: totalLowStock,
        overstocked: totalOverstocked
      }

      /* ============================
         PAGINATION
      ============================ */
      const totalPages = Math.ceil(totalCount / limit)
      const from = offset + 1
      const to = Math.min(offset + limit, totalCount)

      return {
        success: true,
        data: {
          pagination: {
            page,
            limit,
            total: totalCount,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
            returned: filteredProducts.length,
            from: totalCount > 0 ? from : 0,
            to: totalCount > 0 ? to : 0
          },
          products: filteredProducts,
          summary
        }
      }

    } catch (error) {
      console.error('Error fetching products:', error)
      return {
        success: false,
        message: 'Failed to fetch products.'
      }
    }
  }
)

function createEmptySummary() {
  return {
    total_products: 0,
    total_items_bought: 0,
    total_items_sold: 0,
    total_items_remaining: 0,
    total_inventory_value: 0,
    total_revenue: 0,
    total_profit: 0,
    avg_profit_margin: 0,
    with_images: 0,
    with_skus: 0,
    with_stock: 0,
    out_of_stock: 0,
    low_stock: 0,
    overstocked: 0
  }
}


ipcMain.handle(
  'products:get-by-category',
  async (_event, payload: GetProductsByCategoryPayload) => {
    try {
      if (!payload.category_id) {
        return { success: false, message: 'Category id is required.' }
      }

      const {
        category_id,
        page = 1,
        limit = 30,
        include_deleted = false,
        include_inactive = false,
        include_unsynced = true,
        has_sku = 'both',
        sort_by = 'created_on',
        sort_order = 'desc',
        include_images = true,
        include_skus = true,
        max_skus_return = 10,
        search,
        min_profit_margin,
        max_profit_margin,
        min_items_sold,
        max_items_sold,
        low_stock_only = false,
        best_seller_only = false,
        loss_making_only = false,
        min_sell_through_rate,
        max_sell_through_rate,
        fields
      } = payload

      const offset = (page - 1) * limit

      /* ============================
         BUILD WHERE CLAUSE
      ============================ */
      const conditions: SQL[] = [
        eq(products.category_id, category_id) // Always filter by category
      ]

      if (!include_deleted) {
        conditions.push(eq(products.is_deleted, false))
      }
      if (!include_inactive) {
        conditions.push(eq(products.is_active, true))
      }
      if (!include_unsynced) {
        conditions.push(eq(products.is_sync_required, false))
      }

      // Search filter - using the pattern that worked
      if (search) {
        const searchPattern = `%${search}%`
        const searchCondition = or(
          like(products.product_name, searchPattern),
          like(products.description, searchPattern)
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // SKU filter
      if (has_sku === 'yes') {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM ${sku}
          WHERE ${sku.product_id} = ${products.id}
          AND ${sku.is_deleted} = 0
        )`)
      } else if (has_sku === 'no') {
        conditions.push(sql`NOT EXISTS (
          SELECT 1 FROM ${sku}
          WHERE ${sku.product_id} = ${products.id}
          AND ${sku.is_deleted} = 0
        )`)
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      /* ============================
         GET CATEGORY INFO FIRST
      ============================ */
      const categoryInfo = await db()
        .select({
          id: product_categories.id,
          name: product_categories.category_name,
          description: product_categories.description,
          parent_category_id: product_categories.parent_category_id,
          is_active: product_categories.is_active,
          is_deleted: product_categories.is_deleted,
          created_on: product_categories.created_on,
          updated_on: product_categories.updated_on
        })
        .from(product_categories)
        .where(
          and(
            eq(product_categories.id, category_id),
            eq(product_categories.is_deleted, false)
          )
        )
        .get()

      /* ============================
         GET TOTAL COUNT FOR PAGINATION
      ============================ */
      const countResult = db()
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(whereClause)
        .get()
      
      const totalCount = Number(countResult?.count ?? 0)

      if (totalCount === 0) {
        return {
          success: true,
          data: {
            category: categoryInfo || null,
            products: [],
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_next: false,
              has_prev: false,
              returned: 0,
              from: 0,
              to: 0
            },
            summary: createEmptyCategorySummary()
          }
        }
      }

      /* ============================
         MAIN QUERY WITH METRICS SUBQUERIES
      ============================ */
      const query = db()
        .select({
          // Product fields
          id: products.id,
          sync_id: products.sync_id,
          product_name: products.product_name,
          category_id: products.category_id,
          description: products.description,
          created_on: products.created_on,
          updated_on: products.updated_on,
          last_sync: products.last_sync,
          is_deleted: products.is_deleted,
          is_active: products.is_active,
          is_sync_required: products.is_sync_required,
          
          // Category name
          category_name: sql<string>`${categoryInfo?.name ?? 'Unknown'}`,
          
          // SKU count
          sku_count: sql<number>`(
            SELECT COUNT(*) 
            FROM ${sku} 
            WHERE ${sku.product_id} = ${products.id}
            AND ${sku.is_deleted} = 0
          )`,
          
          // Core inventory metrics
          total_items_bought: sql<number>`COALESCE((
            SELECT SUM(${stock_purchases.quantity_bought})
            FROM ${stock_purchases}
            INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
            WHERE ${sku.product_id} = ${products.id}
            AND ${stock_purchases.is_deleted} = 0
          ), 0)`,
          
          total_items_sold: sql<number>`COALESCE((
            SELECT SUM(${sales.quantity})
            FROM ${sales}
            INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
            INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
            WHERE ${sku.product_id} = ${products.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`,
          
          total_revenue: sql<number>`COALESCE((
            SELECT SUM(${sales.total_price})
            FROM ${sales}
            INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
            INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
            WHERE ${sku.product_id} = ${products.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`,
          
          total_cost: sql<number>`COALESCE((
            SELECT SUM((${stock_purchases.total_price_bought} + COALESCE(${stock_purchases.shipping_cost}, 0)) * 
              (${sales.quantity} / NULLIF(${stock_purchases.quantity_bought}, 1)))
            FROM ${sales}
            INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
            INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
            WHERE ${sku.product_id} = ${products.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`,
          
          total_shipping_cost: sql<number>`COALESCE((
            SELECT SUM(${sales.shipping_cost})
            FROM ${sales}
            INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
            INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
            WHERE ${sku.product_id} = ${products.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`,
          
          inventory_value: sql<number>`COALESCE((
            SELECT SUM(
              (${stock_purchases.quantity_bought} - COALESCE((
                SELECT SUM(${sales.quantity})
                FROM ${sales}
                WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)) * 
              (${stock_purchases.total_price_bought} / NULLIF(${stock_purchases.quantity_bought}, 1))
            )
            FROM ${stock_purchases}
            INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
            WHERE ${sku.product_id} = ${products.id}
            AND ${stock_purchases.is_deleted} = 0
          ), 0)`,
          
          sell_through_rate: sql<number>`CASE
            WHEN COALESCE((
              SELECT SUM(${stock_purchases.quantity_bought})
              FROM ${stock_purchases}
              INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
              WHERE ${sku.product_id} = ${products.id}
              AND ${stock_purchases.is_deleted} = 0
            ), 0) > 0 
            THEN (
              COALESCE((
                SELECT SUM(${sales.quantity})
                FROM ${sales}
                INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
                INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
                WHERE ${sku.product_id} = ${products.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0) * 100.0 / NULLIF((
                SELECT SUM(${stock_purchases.quantity_bought})
                FROM ${stock_purchases}
                INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
                WHERE ${sku.product_id} = ${products.id}
                AND ${stock_purchases.is_deleted} = 0
              ), 0)
            )
            ELSE 0
          END`,
          
          days_of_inventory: sql<number>`CASE
            WHEN COALESCE((
              SELECT SUM(${sales.quantity})
              FROM ${sales}
              INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
              INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
              WHERE ${sku.product_id} = ${products.id}
              AND ${sales.sold_on} >= ${Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)}
              AND ${sales.is_deleted} = 0
              AND ${sales.has_been_canceled} = 0
              AND ${sales.status} = 'completed'
            ), 0) > 0
            THEN (
              COALESCE((
                SELECT SUM(${stock_purchases.quantity_bought} - COALESCE((
                  SELECT SUM(${sales.quantity})
                  FROM ${sales}
                  WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
                  AND ${sales.is_deleted} = 0
                  AND ${sales.has_been_canceled} = 0
                  AND ${sales.status} = 'completed'
                ), 0))
                FROM ${stock_purchases}
                INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
                WHERE ${sku.product_id} = ${products.id}
                AND ${stock_purchases.is_deleted} = 0
              ), 0) * 30.0 / NULLIF((
                SELECT SUM(${sales.quantity})
                FROM ${sales}
                INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
                INNER JOIN ${sku} ON ${sku.id} = ${stock_purchases.sku_id}
                WHERE ${sku.product_id} = ${products.id}
                AND ${sales.sold_on} >= ${Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)
            )
            ELSE 999
          END`
        })
        .from(products)
        .where(whereClause)

      // Apply sorting
      let sortedQuery = query as any
      
      if (sort_by === 'product_name') {
        sortedQuery = sort_order === 'asc' 
          ? query.orderBy(asc(products.product_name))
          : query.orderBy(desc(products.product_name))
      } else if (sort_by === 'created_on') {
        sortedQuery = sort_order === 'asc'
          ? query.orderBy(asc(products.created_on))
          : query.orderBy(desc(products.created_on))
      } else if (sort_by === 'updated_on') {
        sortedQuery = sort_order === 'asc'
          ? query.orderBy(asc(products.updated_on))
          : query.orderBy(desc(products.updated_on))
      } else if (sort_by === 'items_sold') {
        sortedQuery = sort_order === 'asc'
          ? query.orderBy(asc(sql`total_items_sold`))
          : query.orderBy(desc(sql`total_items_sold`))
      } else if (sort_by === 'profit_margin') {
        sortedQuery = sort_order === 'asc'
          ? query.orderBy(asc(sql`CASE WHEN total_revenue > 0 THEN (total_revenue - total_cost - total_shipping_cost) * 100.0 / total_revenue ELSE 0 END`))
          : query.orderBy(desc(sql`CASE WHEN total_revenue > 0 THEN (total_revenue - total_cost - total_shipping_cost) * 100.0 / total_revenue ELSE 0 END`))
      } else if (sort_by === 'inventory_value') {
        sortedQuery = sort_order === 'asc'
          ? query.orderBy(asc(sql`inventory_value`))
          : query.orderBy(desc(sql`inventory_value`))
      } else if (sort_by === 'sell_through_rate') {
        sortedQuery = sort_order === 'asc'
          ? query.orderBy(asc(sql`sell_through_rate`))
          : query.orderBy(desc(sql`sell_through_rate`))
      }

      // Apply metric filters at SQL level
      const havingConditions: SQL[] = []
      
      if (min_items_sold !== undefined) {
        havingConditions.push(sql`total_items_sold >= ${min_items_sold}`)
      }
      if (max_items_sold !== undefined) {
        havingConditions.push(sql`total_items_sold <= ${max_items_sold}`)
      }
      
      if (min_profit_margin !== undefined || max_profit_margin !== undefined || loss_making_only) {
        const profitMarginSql = sql`CASE WHEN total_revenue > 0 THEN (total_revenue - total_cost - total_shipping_cost) * 100.0 / total_revenue ELSE 0 END`
        
        if (min_profit_margin !== undefined) {
          havingConditions.push(sql`${profitMarginSql} >= ${min_profit_margin}`)
        }
        if (max_profit_margin !== undefined) {
          havingConditions.push(sql`${profitMarginSql} <= ${max_profit_margin}`)
        }
        if (loss_making_only) {
          havingConditions.push(sql`${profitMarginSql} < 0`)
        }
      }
      
      if (min_sell_through_rate !== undefined) {
        havingConditions.push(sql`sell_through_rate >= ${min_sell_through_rate}`)
      }
      if (max_sell_through_rate !== undefined) {
        havingConditions.push(sql`sell_through_rate <= ${max_sell_through_rate}`)
      }
      
      if (low_stock_only) {
        havingConditions.push(sql`days_of_inventory < 30 AND days_of_inventory > 0`)
      }
      
      if (best_seller_only) {
        havingConditions.push(sql`total_items_sold > 500`)
      }

      if (havingConditions.length > 0) {
        sortedQuery = sortedQuery.having(and(...havingConditions))
      }

      // Apply pagination
      const productRows = await sortedQuery
        .limit(limit)
        .offset(offset)
        .all()

      const productIds = productRows.map(p => p.id)

      /* ============================
         FETCH RELATED DATA IN PARALLEL
      ============================ */
      const [images, skus] = await Promise.all([
        // Fetch images if requested
        include_images ? db()
          .select({
            id: product_image.id,
            product_id: product_image.product_id,
            image: product_image.image
          })
          .from(product_image)
          .where(
            and(
              eq(product_image.is_deleted, false),
              inArray(product_image.product_id, productIds)
            )
          )
          .all() : Promise.resolve([]),

        // Fetch SKUs if requested
        include_skus ? db()
          .select({
            id: sku.id,
            product_id: sku.product_id,
            sku_name: sku.sku_name,
            code: sku.code,
            created_on: sku.created_on,
            updated_on: sku.updated_on,
            is_active: sku.is_active,
            total_bought: sql<number>`COALESCE((
              SELECT SUM(${stock_purchases.quantity_bought})
              FROM ${stock_purchases}
              WHERE ${stock_purchases.sku_id} = ${sku.id}
              AND ${stock_purchases.is_deleted} = 0
            ), 0)`,
            total_sold: sql<number>`COALESCE((
              SELECT SUM(${sales.quantity})
              FROM ${sales}
              INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
              WHERE ${stock_purchases.sku_id} = ${sku.id}
              AND ${sales.is_deleted} = 0
              AND ${sales.has_been_canceled} = 0
              AND ${sales.status} = 'completed'
            ), 0)`,
            remaining: sql<number>`COALESCE((
              SELECT SUM(${stock_purchases.quantity_bought}) - COALESCE((
                SELECT SUM(${sales.quantity})
                FROM ${sales}
                INNER JOIN ${stock_purchases} ON ${stock_purchases.id} = ${sales.stock_purchased_id}
                WHERE ${stock_purchases.sku_id} = ${sku.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)
              FROM ${stock_purchases}
              WHERE ${stock_purchases.sku_id} = ${sku.id}
              AND ${stock_purchases.is_deleted} = 0
            ), 0)`
          })
          .from(sku)
          .where(
            and(
              eq(sku.is_deleted, false),
              inArray(sku.product_id, productIds)
            )
          )
          .limit(max_skus_return * productIds.length)
          .all() : Promise.resolve([])
      ])

      /* ============================
         BUILD DATA MAPS
      ============================ */
      const imageMap = new Map<number, any[]>()
      if (include_images) {
        for (const img of images) {
          if (!imageMap.has(img.product_id)) {
            imageMap.set(img.product_id, [])
          }
          try {
            const parsedImage = img.image ? JSON.parse(img.image) : {}
            imageMap.get(img.product_id)?.push({
              id: img.id,
              ...parsedImage
            })
          } catch {
            imageMap.get(img.product_id)?.push({
              id: img.id,
              path: null,
              error: 'Invalid image data'
            })
          }
        }
      }

      const skuMap = new Map<number, any[]>()
      const skuCountMap = new Map<number, number>()

      if (include_skus) {
        for (const s of skus) {
          skuCountMap.set(s.product_id, (skuCountMap.get(s.product_id) ?? 0) + 1)
          if (!skuMap.has(s.product_id)) {
            skuMap.set(s.product_id, [])
          }
          if ((skuMap.get(s.product_id)?.length ?? 0) < max_skus_return) {
            skuMap.get(s.product_id)?.push(s)
          }
        }
      }

      /* ============================
         BUILD FINAL PRODUCTS WITH METRICS
      ============================ */
      let totalProductsWithImages = 0
      let totalProductsWithSkus = 0
      let totalProductsWithStock = 0
      let totalOutOfStock = 0
      let totalLowStock = 0
      let totalOverstocked = 0
      
      let grandTotalBought = 0
      let grandTotalSold = 0
      let grandTotalRemaining = 0
      let grandTotalRevenue = 0
      let grandTotalCost = 0
      let grandTotalProfit = 0
      let grandTotalInventoryValue = 0

      const finalProducts = productRows.map(row => {
        const total_profit = Number(row.total_revenue) - Number(row.total_cost) - Number(row.total_shipping_cost)
        const profit_margin = Number(row.total_revenue) > 0 
          ? (total_profit / Number(row.total_revenue)) * 100 
          : 0
        
        const total_items_remaining = Number(row.total_items_bought) - Number(row.total_items_sold)
        const days_of_inventory = Number(row.days_of_inventory)
        
        // Determine stock status
        let stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
        if (total_items_remaining <= 0) {
          stock_status = 'Out of Stock'
          totalOutOfStock++
        } else if (days_of_inventory < 30) {
          stock_status = 'Low Stock'
          totalLowStock++
        } else if (days_of_inventory > 180) {
          stock_status = 'Overstocked'
          totalOverstocked++
        } else {
          stock_status = 'In Stock'
        }

        // Status flags
        const is_low_stock = days_of_inventory < 30 && days_of_inventory > 0
        const is_high_margin = profit_margin > 30
        const is_loss_making = profit_margin < 0
        const is_best_seller = Number(row.total_items_sold) > 500

        // Update grand totals
        grandTotalBought += Number(row.total_items_bought)
        grandTotalSold += Number(row.total_items_sold)
        grandTotalRemaining += total_items_remaining
        grandTotalRevenue += Number(row.total_revenue)
        grandTotalCost += Number(row.total_cost)
        grandTotalProfit += total_profit
        grandTotalInventoryValue += Number(row.inventory_value)

        if (row.sku_count > 0) totalProductsWithSkus++
        if (imageMap.has(row.id) && imageMap.get(row.id)!.length > 0) totalProductsWithImages++
        if (total_items_remaining > 0) totalProductsWithStock++

        const product: any = {
          id: row.id,
          product_name: row.product_name,
          category_id: row.category_id,
          category_name: categoryInfo?.name ?? 'Unknown',
          description: row.description,
          created_on: row.created_on,
          updated_on: row.updated_on,
          is_active: row.is_active === 1,
          is_deleted: row.is_deleted === 1,
          sku_count: row.sku_count,
          metrics: {
            // Core inventory metrics
            total_items_bought: Number(row.total_items_bought),
            total_items_sold: Number(row.total_items_sold),
            total_items_remaining,
            inventory_value: Number(row.inventory_value),
            
            // Financial metrics
            total_revenue: Number(row.total_revenue),
            total_cost: Number(row.total_cost),
            total_profit,
            profit_margin: Number(profit_margin.toFixed(2)),
            
            // SKU metrics
            sku_count: row.sku_count,
            avg_sku_profit_margin: 0,
            
            // Performance metrics
            sell_through_rate: Number(row.sell_through_rate).toFixed(1),
            days_of_inventory: Math.round(days_of_inventory),
            
            // Status flags
            is_low_stock,
            is_high_margin,
            is_loss_making,
            is_best_seller,
            stock_status
          }
        }

        if (include_images) {
          product.images = imageMap.get(row.id) ?? []
        }

        if (include_skus) {
          product.skus = skuMap.get(row.id) ?? []
        }

        // Filter fields if requested
        if (fields && fields.length > 0) {
          const filtered: any = {}
          fields.forEach(field => {
            if (field in product) {
              filtered[field] = product[field]
            }
          })
          return filtered
        }

        return product
      })

      /* ============================
         BUILD CATEGORY SUMMARY
      ============================ */
      const summary = {
        category_id: category_id,
        category_name: categoryInfo?.name ?? 'Unknown',
        total_products: totalCount,
        total_items_bought: grandTotalBought,
        total_items_sold: grandTotalSold,
        total_items_remaining: grandTotalRemaining,
        total_inventory_value: Number(grandTotalInventoryValue.toFixed(2)),
        total_revenue: Number(grandTotalRevenue.toFixed(2)),
        total_profit: Number(grandTotalProfit.toFixed(2)),
        avg_profit_margin: grandTotalRevenue > 0 
          ? Number(((grandTotalProfit / grandTotalRevenue) * 100).toFixed(2)) 
          : 0,
        with_images: totalProductsWithImages,
        with_skus: totalProductsWithSkus,
        with_stock: totalProductsWithStock,
        out_of_stock: totalOutOfStock,
        low_stock: totalLowStock,
        overstocked: totalOverstocked
      }

      /* ============================
         PAGINATION METADATA
      ============================ */
      const totalPages = Math.ceil(totalCount / limit)
      const from = offset + 1
      const to = Math.min(offset + limit, totalCount)

      return {
        success: true,
        data: {
          category: categoryInfo ? {
            id: categoryInfo.id,
            name: categoryInfo.name,
            description: categoryInfo.description,
            parent_category_id: categoryInfo.parent_category_id,
            is_active: categoryInfo.is_active === 1,
            is_deleted: categoryInfo.is_deleted === 1,
            created_on: categoryInfo.created_on,
            updated_on: categoryInfo.updated_on
          } : null,
          products: finalProducts,
          pagination: {
            page,
            limit,
            total: totalCount,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
            returned: finalProducts.length,
            from: totalCount > 0 ? from : 0,
            to: totalCount > 0 ? to : 0
          },
          summary
        }
      }

    } catch (error) {
      console.error('Error fetching products by category:', error)
      return {
        success: false,
        message: 'Failed to fetch products.'
      }
    }
  }
)

function createEmptyCategorySummary() {
  return {
    category_id: 0,
    category_name: '',
    total_products: 0,
    total_items_bought: 0,
    total_items_sold: 0,
    total_items_remaining: 0,
    total_inventory_value: 0,
    total_revenue: 0,
    total_profit: 0,
    avg_profit_margin: 0,
    with_images: 0,
    with_skus: 0,
    with_stock: 0,
    out_of_stock: 0,
    low_stock: 0,
    overstocked: 0
  }
}


ipcMain.handle(
  'products:get-by-id',
  async (_event, payload: GetProductByIdPayload) => {
    try {
      // const MAX_SKU_RETURN = 50 // Return all SKUs for a single product
      const MAX_PURCHASES_PER_SKU = 10 // Show more purchase history
      const MAX_RECENT_SALES = 20 // Recent sales to show

      if (!payload.id) {
        return { success: false, message: 'Product id is required.' }
      }

      const includeDeleted = payload.include_deleted ?? false

      /* ============================
         FETCH PRODUCT WITH COMPLETE DETAILS
      ============================ */
      const product = await db()
        .select({
          id: products.id,
          sync_id: products.sync_id,
          product_name: products.product_name,
          category_id: products.category_id,
          description: products.description,
          created_on: products.created_on,
          updated_on: products.updated_on,
          last_sync: products.last_sync,
          is_deleted: products.is_deleted,
          is_active: products.is_active,
          is_sync_required: products.is_sync_required
        })
        .from(products)
        .where(
          and(
            eq(products.id, payload.id),
            includeDeleted ? undefined : eq(products.is_deleted, false)
          )
        )
        .get()

      if (!product) {
        return { success: false, message: 'Product not found.' }
      }

      /* ============================
         FETCH CATEGORY DETAILS WITH PARENT HIERARCHY
      ============================ */
      const categoryHierarchy: any[] = []
      let currentCategoryId = product.category_id
      
      while (currentCategoryId) {
        const cat = await db()
          .select({
            id: product_categories.id,
            name: product_categories.category_name,
            parent_id: product_categories.parent_category_id,
            is_active: product_categories.is_active,
            is_deleted: product_categories.is_deleted
          })
          .from(product_categories)
          .where(
            and(
              eq(product_categories.id, currentCategoryId),
              eq(product_categories.is_deleted, false)
            )
          )
          .get()
        
        if (cat) {
          categoryHierarchy.unshift(cat)
          currentCategoryId = cat.parent_id
        } else {
          break
        }
      }

      const category = categoryHierarchy[categoryHierarchy.length - 1] || null

      /* ============================
         FETCH PRODUCT IMAGES WITH METADATA
      ============================ */
      const productImages = await db()
        .select({
          id: product_image.id,
          image: product_image.image,
          created_on: product_image.created_on,
          updated_on: product_image.updated_on,
          is_deleted: product_image.is_deleted
        })
        .from(product_image)
        .where(
          and(
            eq(product_image.product_id, product.id),
            includeDeleted ? undefined : eq(product_image.is_deleted, false)
          )
        )
        .orderBy(asc(product_image.created_on))
        .all()

      const images = productImages.map((img) => ({
        id: img.id,
        ...(safeParse(img.image) ?? {}),
        created_on: img.created_on,
        is_primary: false // You might want to add a primary flag to your schema
      }))

      /* ============================
         FETCH ALL SKUS WITH COMPLETE METRICS
      ============================ */
      const skuList = await db()
        .select({
          id: sku.id,
          sync_id: sku.sync_id,
          product_id: sku.product_id,
          sku_name: sku.sku_name,
          code: sku.code,
          created_on: sku.created_on,
          updated_on: sku.updated_on,
          last_sync: sku.last_sync,
          is_active: sku.is_active,
          is_deleted: sku.is_deleted,
          is_sync_required: sku.is_sync_required
        })
        .from(sku)
        .where(
          and(
            eq(sku.product_id, product.id),
            includeDeleted ? undefined : eq(sku.is_deleted, false)
          )
        )
        .orderBy(asc(sku.sku_name))
        .all()

      const skuIds = skuList.map(s => s.id)

      /* ============================
         FETCH SKU IMAGES
      ============================ */
      const skuImages = skuIds.length > 0
        ? await db()
            .select({
              id: sku_images.id,
              sku_id: sku_images.sku_id,
              image: sku_images.image,
              created_on: sku_images.created_on
            })
            .from(sku_images)
            .where(
              and(
                eq(sku_images.is_deleted, false),
                inArray(sku_images.sku_id, skuIds)
              )
            )
            .orderBy(asc(sku_images.created_on))
            .all()
        : []

      const skuImagesMap = new Map<number, any[]>()
      for (const img of skuImages) {
        if (!skuImagesMap.has(img.sku_id)) {
          skuImagesMap.set(img.sku_id, [])
        }
        try {
          const parsedImage = img.image ? JSON.parse(img.image) : {}
          skuImagesMap.get(img.sku_id)?.push({
            id: img.id,
            ...parsedImage,
            created_on: img.created_on
          })
        } catch {
          skuImagesMap.get(img.sku_id)?.push({
            id: img.id,
            path: null,
            error: 'Invalid image data',
            created_on: img.created_on
          })
        }
      }

      /* ============================
         FETCH SKU ATTRIBUTES
      ============================ */
      const skuAttributes = skuIds.length > 0
        ? await db()
            .select({
              id: sku_attributes.id,
              sku_id: sku_attributes.sku_id,
              attribute_id: sku_attributes.attribute_id,
              value: sku_attributes.value,
              attribute_name: attributes.attribute_name,
              unit: attributes.unit,
              created_on: sku_attributes.created_on
            })
            .from(sku_attributes)
            .leftJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
            .where(
              and(
                eq(sku_attributes.is_deleted, false),
                inArray(sku_attributes.sku_id, skuIds)
              )
            )
            .orderBy(asc(attributes.attribute_name))
            .all()
        : []

      const skuAttributesMap = new Map<number, any[]>()
      for (const attr of skuAttributes) {
        if (!skuAttributesMap.has(attr.sku_id)) {
          skuAttributesMap.set(attr.sku_id, [])
        }
        skuAttributesMap.get(attr.sku_id)?.push({
          id: attr.id,
          attribute_id: attr.attribute_id,
          name: attr.attribute_name,
          value: attr.value,
          unit: attr.unit,
          display_value: attr.unit ? `${attr.value} ${attr.unit}` : attr.value,
          created_on: attr.created_on
        })
      }

      /* ============================
         FETCH ALL STOCK PURCHASES WITH SALES DATA
      ============================ */
      const purchases = skuIds.length > 0
        ? await db()
            .select({
              id: stock_purchases.id,
              sku_id: stock_purchases.sku_id,
              quantity_bought: stock_purchases.quantity_bought,
              price_per_unit: stock_purchases.price_per_unit,
              total_price_bought: stock_purchases.total_price_bought,
              shipping_cost: stock_purchases.shipping_cost,
              min_selling_price: stock_purchases.min_selling_price,
              max_selling_price: stock_purchases.max_selling_price,
              purchased_on: stock_purchases.purchased_on,
              arrived_on: stock_purchases.arrived_on,
              expiry_date: stock_purchases.expiry_date,
              batch_number: stock_purchases.batch_number,
              supplier_id: stock_purchases.supplier_id,
              // Calculate sold quantity for this batch
              sold_quantity: sql<number>`COALESCE((
                SELECT SUM(${sales.quantity})
                FROM ${sales}
                WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)`,
              // Calculate revenue from this batch
              revenue: sql<number>`COALESCE((
                SELECT SUM(${sales.total_price})
                FROM ${sales}
                WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)`,
              // Calculate shipping cost from sales of this batch
              shipping_from_sales: sql<number>`COALESCE((
                SELECT SUM(${sales.shipping_cost})
                FROM ${sales}
                WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)`,
              // Count number of sales from this batch
              sale_count: sql<number>`COALESCE((
                SELECT COUNT(*)
                FROM ${sales}
                WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
                AND ${sales.status} = 'completed'
              ), 0)`
            })
            .from(stock_purchases)
            .where(
              and(
                eq(stock_purchases.is_deleted, false),
                inArray(stock_purchases.sku_id, skuIds)
              )
            )
            .orderBy(desc(stock_purchases.purchased_on))
            .all()
        : []

      // Group purchases by SKU
      const skuPurchasesMap = new Map<number, any[]>()
      for (const purchase of purchases) {
        if (!skuPurchasesMap.has(purchase.sku_id)) {
          skuPurchasesMap.set(purchase.sku_id, [])
        }
        skuPurchasesMap.get(purchase.sku_id)!.push(purchase)
      }

      /* ============================
         FETCH SUPPLIER DETAILS
      ============================ */
      const supplierIds = [...new Set(purchases.map(p => p.supplier_id).filter((id): id is number => id !== null && id !== undefined))]
      
      let suppliersMap = new Map()
      if (supplierIds.length > 0) {
        const suppliersList = await db()
          .select({
            id: suppliers.id,
            sync_id: suppliers.sync_id,
            supplier_name: suppliers.supplier_name,
            contact_person: suppliers.contact_person,
            email: suppliers.email,
            phone_number: suppliers.phone_number,
            address: suppliers.address,
            created_on: suppliers.created_on,
            is_active: suppliers.is_active
          })
          .from(suppliers)
          .where(
            and(
              inArray(suppliers.id, supplierIds),
              eq(suppliers.is_deleted, false)
            )
          )
          .all()
        
        suppliersMap = new Map(suppliersList.map(s => [s.id, s]))
      }

      /* ============================
         FETCH RECENT SALES FOR THIS PRODUCT
      ============================ */
      const recentSales = skuIds.length > 0
        ? await db()
            .select({
              id: sales.id,
              sku_id: sku.id,
              sku_name: sku.sku_name,
              quantity: sales.quantity,
              total_price: sales.total_price,
              shipping_cost: sales.shipping_cost,
              sold_on: sales.sold_on,
              status: sales.status,
              customer_id: sales.customer_id,
              profit_margin: sql<number>`(
                (${sales.total_price} - (
                  (${stock_purchases.total_price_bought} + COALESCE(${stock_purchases.shipping_cost}, 0)) * 
                  ${sales.quantity} / NULLIF(${stock_purchases.quantity_bought}, 1)
                ) - COALESCE(${sales.shipping_cost}, 0)) * 100.0 / NULLIF(${sales.total_price}, 0)
              )`
            })
            .from(sales)
            .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
            .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
            .where(
              and(
                inArray(sku.id, skuIds),
                eq(sales.is_deleted, false),
                eq(sales.has_been_canceled, false),
                eq(sales.status, 'completed')
              )
            )
            .orderBy(desc(sales.sold_on))
            .limit(MAX_RECENT_SALES)
            .all()
        : []

      /* ============================
         FETCH CUSTOMER DETAILS FOR RECENT SALES
      ============================ */
      // const customerIds = [...new Set(recentSales.map(s => s.customer_id).filter((id): id is number => id !== null && id !== undefined))]
      
      /* ============================
        FETCH CUSTOMER DETAILS FOR RECENT SALES
      ============================ */
      // let customersMap: any = new Map()
      // if (customerIds.length > 0) {
      //   const customersList = await db()
      //     .select({
      //       id: customers.id,
      //       name: customers.name,
      //       email: customers.email,
      //       phone: customers.phone
      //     })
      //     .from(customers)
      //     .where(inArray(customers.id, customerIds))
      //     .all()
        
      //   customersMap = new Map(customersList.map(c => [c.id, c]))
      // }

      /* ============================
         CALCULATE PRODUCT-LEVEL METRICS (ACCURATE, NOT PLACEHOLDER)
      ============================ */
      
      // Total items bought across all SKUs
      const totalItemsBought = purchases.reduce((sum, p) => sum + p.quantity_bought, 0)
      
      // Total items sold across all SKUs
      const totalItemsSold = purchases.reduce((sum, p) => sum + p.sold_quantity, 0)
      
      // Total items remaining
      const totalItemsRemaining = totalItemsBought - totalItemsSold
      
      // Total revenue
      const totalRevenue = purchases.reduce((sum, p) => sum + p.revenue, 0)
      
      // Total cost (including inbound shipping)
      const totalCost = purchases.reduce((sum, p) => {
        const landedCost = p.total_price_bought + (p.shipping_cost || 0)
        const costOfSold = (landedCost / p.quantity_bought) * p.sold_quantity
        return sum + costOfSold
      }, 0)
      
      // Total shipping cost paid on sales
      const totalShippingCost = purchases.reduce((sum, p) => sum + p.shipping_from_sales, 0)
      
      // Total profit
      const totalProfit = totalRevenue - totalCost - totalShippingCost
      
      // Profit margin
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
      
      // Inventory value (remaining stock at cost)
      purchases.reduce((sum, p) => {
        const remaining = p.quantity_bought - p.sold_quantity
        if (remaining <= 0) return sum
        const unitCost = (p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought
        return sum + (remaining * unitCost)
      }, 0)
      
      // Sell-through rate
      const sellThroughRate = totalItemsBought > 0 ? (totalItemsSold / totalItemsBought) * 100 : 0

      // Days of inventory (based on last 30 days sales)
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
      
      // Days of inventory (based on last 30 days sales)
      const last30DaysSales = recentSales
        .filter(s => {
          const soldOnTimestamp = s.sold_on instanceof Date 
            ? Math.floor(s.sold_on.getTime() / 1000) 
            : Number(s.sold_on)
          return soldOnTimestamp >= thirtyDaysAgo
        })
        .reduce((sum, s) => sum + s.quantity, 0)
      
      const avgDailySales = last30DaysSales / 30
      const daysOfInventory = avgDailySales > 0 ? totalItemsRemaining / avgDailySales : 999
      
      // Financial health indicators
      const isLowStock = daysOfInventory < 30 && daysOfInventory > 0
      const isHighMargin = profitMargin > 30
      const isLossMaking = profitMargin < 0
      const isBestSeller = totalItemsSold > 500

      /* ============================
         BUILD COMPLETE SKU LIST WITH ALL METRICS
      ============================ */
      const completeSkuList = await Promise.all(skuList.map(async (s) => {
        // Get purchases for this SKU
        const skuPurchases = skuPurchasesMap.get(s.id) ?? []
        
        // Calculate SKU-specific metrics
        const skuTotalBought = skuPurchases.reduce((sum, p) => sum + p.quantity_bought, 0)
        const skuTotalSold = skuPurchases.reduce((sum, p) => sum + p.sold_quantity, 0)
        const skuTotalRemaining = skuTotalBought - skuTotalSold
        const skuTotalRevenue = skuPurchases.reduce((sum, p) => sum + p.revenue, 0)
        
        // Calculate SKU cost
        const skuTotalCost = skuPurchases.reduce((sum, p) => {
          const landedCost = p.total_price_bought + (p.shipping_cost || 0)
          const costOfSold = (landedCost / p.quantity_bought) * p.sold_quantity
          return sum + costOfSold
        }, 0)
        
        const skuTotalShipping = skuPurchases.reduce((sum, p) => sum + p.shipping_from_sales, 0)
        const skuTotalProfit = skuTotalRevenue - skuTotalCost - skuTotalShipping
        const skuProfitMargin = skuTotalRevenue > 0 ? (skuTotalProfit / skuTotalRevenue) * 100 : 0
        
        // Calculate average cost per unit
        const totalLandedCost = skuPurchases.reduce((sum, p) => {
          return sum + p.total_price_bought + (p.shipping_cost || 0)
        }, 0)
        const avgCostPerUnit = skuTotalBought > 0 ? totalLandedCost / skuTotalBought : 0
        
        // Calculate SKU sell-through rate
        const skuSellThrough = skuTotalBought > 0 ? (skuTotalSold / skuTotalBought) * 100 : 0

        // Days of inventory (based on 30 days sales)
        const skuThirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)

        // Calculate SKU days of inventory
        const skuLast30DaysSales = recentSales
          .filter(rs => {
            const skuSoldOnTimeStamp = rs.sold_on instanceof Date
              ? Math.floor(rs.sold_on.getTime() / 1000)
              : Number(rs.sold_on)
            return skuSoldOnTimeStamp >= skuThirtyDaysAgo
          })
          .reduce((sum, rs) => sum + rs.quantity, 0)

        const skuAvgDailySales = skuLast30DaysSales / 30
        const skuDaysOfInventory = skuAvgDailySales > 0 ? skuTotalRemaining / skuAvgDailySales : 999
        
        // Get recent purchases with supplier details
        const recentPurchases = skuPurchases
          .sort((a, b) => b.purchased_on - a.purchased_on)
          .slice(0, MAX_PURCHASES_PER_SKU)
          .map(p => ({
            id: p.id,
            batch_number: p.batch_number,
            quantity_bought: p.quantity_bought,
            price_per_unit: p.price_per_unit,
            total_price_bought: p.total_price_bought,
            shipping_cost: p.shipping_cost,
            landed_cost_per_unit: (p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought,
            min_selling_price: p.min_selling_price,
            max_selling_price: p.max_selling_price,
            purchased_on: p.purchased_on,
            arrived_on: p.arrived_on,
            expiry_date: p.expiry_date,
            sold_quantity: p.sold_quantity,
            remaining_quantity: p.quantity_bought - p.sold_quantity,
            revenue: p.revenue,
            profit: p.revenue - ((p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought * p.sold_quantity) - p.shipping_from_sales,
            margin: p.revenue > 0 ? 
              ((p.revenue - ((p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought * p.sold_quantity) - p.shipping_from_sales) / p.revenue) * 100 : 0,
            sale_count: p.sale_count,
            supplier: p.supplier_id ? suppliersMap.get(p.supplier_id) : null
          }))

        return {
          id: s.id,
          sync_id: s.sync_id,
          sku_name: s.sku_name,
          code: s.code,
          created_on: s.created_on,
          updated_on: s.updated_on,
          is_active: s.is_active === true,
          is_deleted: s.is_deleted === true,
          
          // Related data
          images: skuImagesMap.get(s.id) ?? [],
          attributes: skuAttributesMap.get(s.id) ?? [],
          recent_purchases: recentPurchases,
          
          // Summary counts
          total_purchases: skuPurchases.length,
          total_batches: skuPurchases.length,
          
          // Core metrics
          metrics: {
            // Volume metrics
            total_bought: skuTotalBought,
            total_sold: skuTotalSold,
            total_remaining: skuTotalRemaining,
            
            // Financial metrics
            total_revenue: Number(skuTotalRevenue.toFixed(2)),
            total_cost: Number(skuTotalCost.toFixed(2)),
            total_shipping_paid: Number(skuTotalShipping.toFixed(2)),
            total_profit: Number(skuTotalProfit.toFixed(2)),
            profit_margin: Number(skuProfitMargin.toFixed(2)),
            
            // Per-unit metrics
            avg_cost_per_unit: Number(avgCostPerUnit.toFixed(2)),
            avg_selling_price: skuTotalSold > 0 ? Number((skuTotalRevenue / skuTotalSold).toFixed(2)) : 0,
            avg_profit_per_unit: skuTotalSold > 0 ? Number((skuTotalProfit / skuTotalSold).toFixed(2)) : 0,
            
            // Performance metrics
            sell_through_rate: Number(skuSellThrough.toFixed(1)),
            days_of_inventory: Math.round(skuDaysOfInventory),
            
            // Status flags
            is_low_stock: skuDaysOfInventory < 30 && skuDaysOfInventory > 0,
            is_high_margin: skuProfitMargin > 30,
            is_loss_making: skuProfitMargin < 0,
            is_best_seller: skuTotalSold > 100,
            stock_status: skuTotalRemaining <= 0 ? 'Out of Stock' :
                         skuDaysOfInventory < 30 ? 'Low Stock' :
                         skuDaysOfInventory > 180 ? 'Overstocked' : 'In Stock'
          },
          
          // Batch summary
          batch_summary: {
            oldest_batch: skuPurchases.length > 0 ? 
              new Date(Math.min(...skuPurchases.map(p => p.purchased_on)) * 1000).toISOString().split('T')[0] : null,
            newest_batch: skuPurchases.length > 0 ?
              new Date(Math.max(...skuPurchases.map(p => p.purchased_on)) * 1000).toISOString().split('T')[0] : null,
            total_batches: skuPurchases.length,
            active_batches: skuPurchases.filter(p => p.quantity_bought - p.sold_quantity > 0).length
          }
        }
      }))

      /* ============================
         CALCULATE AVERAGE SKU PROFIT MARGIN (WEIGHTED)
      ============================ */
      let totalSkuRevenue = 0
      let totalSkuProfit = 0
      
      for (const sku of completeSkuList) {
        totalSkuRevenue += sku.metrics.total_revenue
        totalSkuProfit += sku.metrics.total_profit
      }
      
      const weightedAvgSkuMargin = totalSkuRevenue > 0 ? (totalSkuProfit / totalSkuRevenue) * 100 : 0

      /* ============================
         BUILD MONTHLY SALES TREND
      ============================ */
      const salesByMonth = new Map<string, { revenue: number; profit: number; quantity: number }>()
      
      for (const sale of recentSales) {

        const soldOnTimestamp = sale.sold_on instanceof Date 
          ? Math.floor(sale.sold_on.getTime() / 1000) 
          : Number(sale.sold_on)

        const date = new Date(soldOnTimestamp * 1000)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        const current = salesByMonth.get(monthKey) || { revenue: 0, profit: 0, quantity: 0 }
        const profit = sale.total_price - (sale.total_price * (100 - sale.profit_margin) / 100) // Approximate
        salesByMonth.set(monthKey, {
          revenue: current.revenue + sale.total_price,
          profit: current.profit + profit,
          quantity: current.quantity + sale.quantity
        })
      }
      
      const monthlyTrend = Array.from(salesByMonth.entries())
        .map(([month, data]) => ({
          month,
          revenue: Number(data.revenue.toFixed(2)),
          profit: Number(data.profit.toFixed(2)),
          quantity: data.quantity,
          margin: data.revenue > 0 ? Number(((data.profit / data.revenue) * 100).toFixed(2)) : 0
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12) // Last 12 months

      /* ============================
         CALCULATE SUPPLIER PERFORMANCE
      ============================ */
      const supplierPerformance = Array.from(suppliersMap.values()).map(supplier => {
        const supplierPurchases = purchases.filter(p => p.supplier_id === supplier.id)
        const totalSpent = supplierPurchases.reduce((sum, p) => sum + p.total_price_bought + (p.shipping_cost || 0), 0)
        const totalBought = supplierPurchases.reduce((sum, p) => sum + p.quantity_bought, 0)
        const totalSold = supplierPurchases.reduce((sum, p) => sum + p.sold_quantity, 0)
        const totalRevenue = supplierPurchases.reduce((sum, p) => sum + p.revenue, 0)
        
        return {
          id: supplier.id,
          name: supplier.supplier_name,
          total_spent: Number(totalSpent.toFixed(2)),
          total_bought: totalBought,
          total_sold: totalSold,
          total_revenue: Number(totalRevenue.toFixed(2)),
          sell_through: totalBought > 0 ? Number(((totalSold / totalBought) * 100).toFixed(1)) : 0,
          batches: supplierPurchases.length
        }
      })

      /* ============================
         RETURN COMPLETE PRODUCT DETAILS
      ============================ */
      return {
        success: true,
        data: {
          // Basic info
          id: product.id,
          sync_id: product.sync_id,
          product_name: product.product_name,
          description: product.description,
          created_on: product.created_on,
          updated_on: product.updated_on,
          is_active: product.is_active === true,
          is_deleted: product.is_deleted === true,
          
          // Category with hierarchy
          category: category ? {
            id: category.id,
            name: category.name,
            is_active: category.is_active === 1,
            hierarchy: categoryHierarchy.map(c => ({
              id: c.id,
              name: c.name
            }))
          } : null,
          
          // Media
          images,
          
          // SKUs with complete data
          skus: completeSkuList,
          sku_count: completeSkuList.length,
          active_sku_count: completeSkuList.filter(s => s.is_active).length,
          
          // Core product metrics
          metrics: {
            // Volume metrics
            total_items_bought: totalItemsBought,
            total_items_sold: totalItemsSold,
            total_items_remaining: totalItemsRemaining,
            
            // Financial metrics
            total_revenue: Number(totalRevenue.toFixed(2)),
            total_cost: Number(totalCost.toFixed(2)),
            total_shipping_paid: Number(totalShippingCost.toFixed(2)),
            total_profit: Number(totalProfit.toFixed(2)),
            profit_margin: Number(profitMargin.toFixed(2)),
            
            // Per-unit metrics
            avg_cost_per_unit: totalItemsBought > 0 ? 
              Number((purchases.reduce((sum, p) => sum + p.total_price_bought + (p.shipping_cost || 0), 0) / totalItemsBought).toFixed(2)) : 0,
            avg_selling_price: totalItemsSold > 0 ? Number((totalRevenue / totalItemsSold).toFixed(2)) : 0,
            avg_profit_per_unit: totalItemsSold > 0 ? Number((totalProfit / totalItemsSold).toFixed(2)) : 0,
            
            // SKU metrics
            avg_sku_profit_margin: Number(weightedAvgSkuMargin.toFixed(2)),
            
            // Performance metrics
            sell_through_rate: Number(sellThroughRate.toFixed(1)),
            days_of_inventory: Math.round(daysOfInventory),
            
            // Status flags
            is_low_stock: isLowStock,
            is_high_margin: isHighMargin,
            is_loss_making: isLossMaking,
            is_best_seller: isBestSeller,
            stock_status: totalItemsRemaining <= 0 ? 'Out of Stock' :
                         daysOfInventory < 30 ? 'Low Stock' :
                         daysOfInventory > 180 ? 'Overstocked' : 'In Stock'
          },
          
          // Detailed summaries
          summary: {
            total_skus: completeSkuList.length,
            active_skus: completeSkuList.filter(s => s.is_active).length,
            total_images: images.length,
            total_attributes: skuAttributes.length,
            total_purchases: purchases.length,
            total_sales: recentSales.length,
            total_suppliers: suppliersMap.size,
            last_purchase: purchases[0]?.purchased_on ?? null,
            last_sale: recentSales[0]?.sold_on ?? null
          },
          
          // Trends and analytics
          analytics: {
            monthly_sales_trend: monthlyTrend,
            top_performing_skus: completeSkuList
              .filter(s => s.metrics.total_sold > 0)
              .sort((a, b) => b.metrics.total_profit - a.metrics.total_profit)
              .slice(0, 5)
              .map(s => ({
                id: s.id,
                sku_name: s.sku_name,
                total_sold: s.metrics.total_sold,
                total_profit: s.metrics.total_profit,
                profit_margin: s.metrics.profit_margin
              })),
            slow_moving_skus: completeSkuList
              .filter(s => s.metrics.sell_through_rate < 30 && s.metrics.total_remaining > 0)
              .map(s => ({
                id: s.id,
                sku_name: s.sku_name,
                remaining: s.metrics.total_remaining,
                sell_through_rate: s.metrics.sell_through_rate
              })),
            supplier_performance: supplierPerformance
          }
        }
      }

    } catch (error) {
      console.error('Error fetching product by id:', error)
      return { success: false, message: 'Failed to fetch product.' }
    }
  }
)


ipcMain.handle(
  'products:soft-delete',
  async (_event, payload: { 
    id: number; 
    cascade?: boolean;
    restore?: boolean;
  }) => {
    try {
      const cascade = payload.cascade ?? true
      const isRestore = payload.restore ?? false
      const action = isRestore ? 'restore' : 'delete'
      const actionPastTense = isRestore ? 'restored' : 'deleted'

      if (!payload.id) {
        return { 
          success: false, 
          message: `Product ID is required for ${action}.` 
        }
      }

      /* ============================
         CHECK IF PRODUCT EXISTS
      ============================ */
      const product = db()
        .select({ 
          id: products.id,
          product_name: products.product_name,
          is_deleted: products.is_deleted,
          category_id: products.category_id,
          is_active: products.is_active
        })
        .from(products)
        .where(eq(products.id, payload.id))
        .get()

      if (!product) {
        return { 
          success: false, 
          message: `Product with ID ${payload.id} not found.` 
        }
      }

      // Check if already in desired state
      if (isRestore && !product.is_deleted) {
        return { 
          success: false, 
          message: 'Product is already active (not deleted).' 
        }
      }
      if (!isRestore && product.is_deleted) {
        return { 
          success: false, 
          message: 'Product is already deleted.' 
        }
      }

      /* ============================
         PERFORM SOFT DELETE/RESTORE IN TRANSACTION
      ============================ */
      const result = db().transaction(() => {
        try {
          const affectedItems: Record<string, any> = {
            product: {
              id: payload.id,
              name: product.product_name,
              action: action
            }
          }

          /* ============================
             STAGE 1: UPDATE THE PRODUCT ITSELF
          ============================ */
          db()
            .update(products)
            .set({
              is_deleted: isRestore ? false : true,
              updated_on: sql`(strftime('%s', 'now'))`,
              is_sync_required: true
            })
            .where(eq(products.id, payload.id))
            .run()

          // Mark the category for sync
          db()
            .update(product_categories)
            .set({
              is_sync_required: true,
              updated_on: sql`(strftime('%s', 'now'))`
            })
            .where(eq(product_categories.id, product.category_id))
            .run()
          
          affectedItems.category_updated = true

          /* ============================
             STAGE 2: CHECK FOR CHILD ITEMS (IF NOT CASCADING)
          ============================ */
          if (!cascade) {
            const skuCount = db()
              .select({ count: sql<number>`COUNT(*)` })
              .from(sku)
              .where(
                and(
                  eq(sku.product_id, payload.id),
                  isRestore ? eq(sku.is_deleted, true) : eq(sku.is_deleted, false)
                )
              )
              .get()

            if (Number(skuCount?.count ?? 0) > 0) {
              throw new Error(
                `Cannot ${action} product with existing SKUs. Use cascade=true to ${action} all.`
              )
            }

            // If no child items, just return success for the product alone
            return {
              success: true,
              message: `Product "${product.product_name}" ${actionPastTense} successfully.`,
              data: {
                id: payload.id,
                product_name: product.product_name,
                action: action,
                cascaded: false,
                timestamp: Math.floor(Date.now() / 1000),
                affected: {
                  product: 1,
                  details: affectedItems
                }
              }
            }
          }

          /* ============================
             STAGE 3: PROCESS ALL RELATIONSHIPS (CASCADE)
          ============================ */
          
          // Create context for relationship handlers
          const context: RelationshipContext = {
            db: db(),
            tables: {
              product_image,
              sku,
              sku_images,
              sku_attributes,
              stock_purchases,
              suppliers
            },
            helpers: {
              getChildIds: (table, foreignKey, parentIds, isRestore) => {
                if (parentIds.length === 0) return []
                
                return db()
                  .select({ id: table.id })
                  .from(table)
                  .where(
                    and(
                      inArray(table[foreignKey], parentIds),
                      isRestore ? eq(table.is_deleted, true) : eq(table.is_deleted, false)
                    )
                  )
                  .all()
                  .map(row => row.id)
              },
              updateBulk: (table, ids, isRestore) => {
                if (ids.length === 0) return
                
                db()
                  .update(table)
                  .set({
                    is_deleted: isRestore ? false : true,
                    updated_on: sql`(strftime('%s', 'now'))`,
                    is_sync_required: true
                  })
                  .where(inArray(table.id, ids))
                  .run()
              }
            }
          }

          // Process all relationships through the registry
          const relationshipResults = relationshipRegistry.processAll(
            context,
            [payload.id],
            isRestore
          )

          // Store results in affectedItems
          Object.assign(affectedItems, relationshipResults)

          /* ============================
             STAGE 4: HANDLE SUPPLIER SYNC (SPECIAL CASE)
          ============================ */
          if (isRestore && affectedItems.stock_purchases?.length > 0) {
            const supplierIds = [...new Set(
              db()
                .select({ supplier_id: stock_purchases.supplier_id })
                .from(stock_purchases)
                .where(inArray(stock_purchases.id, affectedItems.stock_purchases))
                .all()
                .map(p => p.supplier_id)
                .filter((id): id is number => id !== null && id !== undefined)
            )]

            if (supplierIds.length > 0) {
              db()
                .update(suppliers)
                .set({
                  is_sync_required: true,
                  updated_on: sql`(strftime('%s', 'now'))`
                })
                .where(inArray(suppliers.id, supplierIds))
                .run()
              
              affectedItems.suppliers_updated = supplierIds.length
            }
          }

          /* ============================
             STAGE 5: CALCULATE TOTALS FOR RESPONSE
          ============================ */
          const totals = {
            product_images: affectedItems.product_images?.length || 0,
            skus: affectedItems.skus?.length || 0,
            sku_images: affectedItems.sku_images?.length || 0,
            sku_attributes: affectedItems.sku_attributes?.length || 0,
            stock_purchases: affectedItems.stock_purchases?.length || 0
          }

          /* ============================
             RETURN SUCCESS WITH AFFECTED ITEMS
          ============================ */
          return {
            success: true,
            message: `Product "${product.product_name}" and all related items ${actionPastTense} successfully.`,
            data: {
              id: payload.id,
              product_name: product.product_name,
              action: action,
              cascaded: true,
              timestamp: Math.floor(Date.now() / 1000),
              affected: {
                ...totals,
                total: Object.values(totals).reduce((a, b) => a + b, 0) + 1, // +1 for the product itself
                details: affectedItems
              }
            }
          }

        } catch (error) {
          console.error('Transaction error:', error)
          throw error // Rollback transaction
        }
      })

      return result

    } catch (error) {
      console.error(`Error in product soft-delete/restore:`, error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} product.` 
      }
    }
  }
)


// Enhanced search with multiple filters and batch fetching of related data to minimize queries and optimize performance
// Note: This is a more complex implementation that may require further optimization and indexing on the database for larger datasets
// Will be done later as part of the performance optimization phase, but this is a more feature-rich search handler that can be used as a base for building advanced search and filtering capabilities in the future
ipcMain.handle(
  'products:search',
  async (_event, payload: ProductSearchPayload = {}) => {
    try {
      const MAX_SKU_RETURN = 10
      const MAX_RESULTS = Math.min(payload.limit ?? 300, 500)

      const query = payload.query?.trim() ?? ''
      const category_id = payload.category_id ?? null
      const include_subcategories = payload.include_subcategories ?? false

      const include_deleted = payload.include_deleted ?? false
      const include_inactive = payload.include_inactive ?? false
      const include_unsynced = payload.include_unsynced ?? true

      const has_sku = payload.has_sku ?? 'both'

      const created_from = payload.created_from ?? null
      const created_to = payload.created_to ?? null

      /* ============================
         BUILD CATEGORY FILTER
      ============================ */
      let categoryIds: number[] | null = null

      if (category_id) {
        if (!include_subcategories) {
          categoryIds = [category_id]
        } else {
          // include category + its children (1-level or recursive)
          // assuming your product_categories table has parent_category_id
          const allCategories = db()
            .select({
              id: product_categories.id,
              parent_category_id: product_categories.parent_category_id
            })
            .from(product_categories)
            .where(eq(product_categories.is_deleted, false))
            .all()

          const map = new Map<number, number[]>()

          allCategories.forEach((c) => {
            if (!map.has(c.parent_category_id ?? 0)) {
              map.set(c.parent_category_id ?? 0, [])
            }
            map.get(c.parent_category_id ?? 0)?.push(c.id)
          })

          const collect = (id: number): number[] => {
            const result: number[] = [id]
            const children = map.get(id) ?? []
            for (const child of children) {
              result.push(...collect(child))
            }
            return result
          }

          categoryIds = Array.from(new Set(collect(category_id)))
        }
      }

      /* ============================
         WHERE CLAUSE
      ============================ */
      const baseWhere = and(
        include_deleted ? undefined : eq(products.is_deleted, false),
        include_inactive ? undefined : eq(products.is_active, true),
        include_unsynced ? undefined : eq(products.is_sync_required, false),

        categoryIds
          ? sql`${products.category_id} IN (${sql.join(
              categoryIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          : undefined,

        query.length > 0
          ? sql`(
              LOWER(${products.product_name}) LIKE ${'%' + query.toLowerCase() + '%'}
              OR LOWER(${products.description}) LIKE ${'%' + query.toLowerCase() + '%'}
            )`
          : undefined,

        created_from ? sql`${products.created_on} >= ${created_from}` : undefined,
        created_to ? sql`${products.created_on} <= ${created_to}` : undefined
      )

      /* ============================
         APPLY HAS_SKU FILTER
      ============================ */
      let finalWhere = baseWhere

      if (has_sku === 'yes') {
        finalWhere = and(
          baseWhere,
          sql`EXISTS (
            SELECT 1 FROM sku
            WHERE sku.product_id = ${products.id}
            AND sku.is_deleted = 0
          )`
        )
      }

      if (has_sku === 'no') {
        finalWhere = and(
          baseWhere,
          sql`NOT EXISTS (
            SELECT 1 FROM sku
            WHERE sku.product_id = ${products.id}
            AND sku.is_deleted = 0
          )`
        )
      }

      /* ============================
         FETCH PRODUCTS (NOT PAGINATED)
      ============================ */
      const productList = db()
        .select({
          id: products.id,
          product_name: products.product_name,
          category_id: products.category_id,
          description: products.description,
          created_on: products.created_on,
          updated_on: products.updated_on,
          last_sync: products.last_sync,
          is_deleted: products.is_deleted,
          is_active: products.is_active,
          is_sync_required: products.is_sync_required
        })
        .from(products)
        .where(finalWhere)
        .limit(MAX_RESULTS)
        .all()

      const productIds = productList.map((p) => p.id)

      if (productIds.length === 0) {
        return { success: true, data: { products: [] } }
      }

      /* ============================
         FETCH IMAGES (BATCH)
      ============================ */
      const allImages = db()
        .select({
          id: product_image.id,
          product_id: product_image.product_id,
          image: product_image.image
        })
        .from(product_image)
        .where(
          and(
            eq(product_image.is_deleted, false),
            sql`${product_image.product_id} IN (${sql.join(
              productIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        )
        .all()

      const imageMap = new Map<number, any[]>()

      allImages.forEach((img) => {
        if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, [])
        imageMap.get(img.product_id)?.push({
          id: img.id,
          ...(safeParse(img.image) ?? {})
        })
      })

      /* ============================
         FETCH SKU (BATCH)
      ============================ */
      const allSku = db()
        .select({
          id: sku.id,
          product_id: sku.product_id,
          sku_name: sku.sku_name,
          code: sku.code,
          created_on: sku.created_on,
          updated_on: sku.updated_on,
          last_sync: sku.last_sync,
          is_active: sku.is_active,
          is_deleted: sku.is_deleted,
          is_sync_required: sku.is_sync_required
        })
        .from(sku)
        .where(
          and(
            eq(sku.is_deleted, false),
            sql`${sku.product_id} IN (${sql.join(
              productIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        )
        .all()

      const skuMap = new Map<number, any[]>()
      const skuCountMap = new Map<number, number>()

      allSku.forEach((s) => {
        skuCountMap.set(s.product_id, (skuCountMap.get(s.product_id) ?? 0) + 1)

        if (!skuMap.has(s.product_id)) skuMap.set(s.product_id, [])
        if ((skuMap.get(s.product_id)?.length ?? 0) < MAX_SKU_RETURN) {
          skuMap.get(s.product_id)?.push(s)
        }
      })

      const finalProducts = productList.map((p) => ({
        ...p,
        images: imageMap.get(p.id) ?? [],
        sku: skuMap.get(p.id) ?? [],
        sku_count: skuCountMap.get(p.id) ?? 0
      }))

      return {
        success: true,
        data: {
          products: finalProducts
        }
      }
    } catch (error) {
      console.error('Error searching products:', error)
      return {
        success: false,
        message: 'Failed to search products.'
      }
    }
  }
)


ipcMain.handle('sku:create', async (_event, payload: CreateSkuPayload) => {
  const createdFiles: string[] = []

  try {
    const MAX_IMAGES = 6
    const MAX_ATTRIBUTES = 30

    /* ============================
       BASIC VALIDATION
    ============================ */
    if (!payload.product_id) {
      return { success: false, message: 'Product id is required.' }
    }

    if (!payload.sku_name?.trim()) {
      return { success: false, message: 'SKU name is required.' }
    }

    if (!payload.code?.trim()) {
      return { success: false, message: 'SKU code is required.' }
    }

    const skuName = payload.sku_name.trim()
    const skuCode = payload.code.trim().toUpperCase() // Standardize code format

    const images = payload.images ?? []
    const attrList = payload.sku_attributes ?? []

    if (images.length > MAX_IMAGES) {
      return {
        success: false,
        message: `Maximum of ${MAX_IMAGES} images allowed.`
      }
    }

    if (attrList.length > MAX_ATTRIBUTES) {
      return {
        success: false,
        message: `Maximum of ${MAX_ATTRIBUTES} attributes allowed.`
      }
    }

    /* ============================
       CHECK PRODUCT EXISTS
    ============================ */
    const existingProduct = db()
      .select({ 
        id: products.id,
        product_name: products.product_name,
        is_active: products.is_active 
      })
      .from(products)
      .where(
        and(
          eq(products.id, payload.product_id),
          eq(products.is_deleted, false)
        )
      )
      .get()

    if (!existingProduct) {
      return { success: false, message: 'Product not found.' }
    }

    if (!existingProduct.is_active) {
      return { success: false, message: 'Cannot add SKU to inactive product.' }
    }

    /* ============================
       CHECK SKU CODE UNIQUENESS
    ============================ */
    const existingSkuCode = db()
      .select({ id: sku.id })
      .from(sku)
      .where(
        and(
          eq(sku.code, skuCode),
          eq(sku.is_deleted, false)
        )
      )
      .get()

    if (existingSkuCode) {
      return { success: false, message: 'SKU code already exists.' }
    }

    /* ============================
       VALIDATE ATTRIBUTES PAYLOAD
    ============================ */
    const attributeIds = attrList.map((a) => a.attribute_id)

    // Check for duplicate attribute_ids
    const duplicates = attributeIds.filter(
      (id, index) => attributeIds.indexOf(id) !== index
    )

    if (duplicates.length > 0) {
      return {
        success: false,
        message: `Duplicate attribute_id(s) found: ${[...new Set(duplicates)].join(', ')}`
      }
    }

    // Validate each attribute
    for (const attr of attrList) {
      if (!attr.attribute_id) {
        return { success: false, message: 'attribute_id is required for all attributes.' }
      }

      if (!attr.value?.trim()) {
        return {
          success: false,
          message: `Attribute value is required for attribute_id ${attr.attribute_id}.`
        }
      }
    }

    /* ============================
       CHECK ATTRIBUTES EXIST AND STORE DETAILS
    ============================ */
    let attributeMap = new Map<number, { id: number; attribute_name: string; unit: string }>()

    if (attributeIds.length > 0) {
      const foundAttributes = db()
        .select({ 
          id: attributes.id,
          attribute_name: attributes.attribute_name,
          unit: attributes.unit
        })
        .from(attributes)
        .where(
          and(
            eq(attributes.is_deleted, false),
            inArray(attributes.id, attributeIds)
          )
        )
        .all()

      const foundSet = new Set(foundAttributes.map((a) => a.id))
      const missing = attributeIds.filter((id) => !foundSet.has(id))

      if (missing.length > 0) {
        return {
          success: false,
          message: `Invalid attribute_id(s): ${missing.join(', ')}`
        }
      }

      // Store attribute details for later use in response
      attributeMap = new Map(
        foundAttributes.map(
          a => [
            a.id,
            {
              ...a,
              unit: a.unit || ''
            }
          ]
        )
      )
    }

    /* ============================
       PREPARE IMAGE PROCESSING
    ============================ */
    const processImageSync = (imageData: string, skuId: number, index: number): { 
      imageJson: string, 
      filePath: string,
      fileName: string 
    } => {
      const [meta, base64] = imageData.split(',')
      const mimeMatch = meta.match(/data:(.*);base64/)
      
      if (!mimeMatch) {
        throw new Error('Invalid image data format')
      }

      const mime = mimeMatch[1]
      const buffer = Buffer.from(base64, 'base64')
      const ext = mime.split('/')[1] || 'jpg'
      
      // Validate file size (5MB max)
      const MAX_SIZE = 5 * 1024 * 1024
      if (buffer.length > MAX_SIZE) {
        throw new Error(`Image size exceeds 5MB limit`)
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(mime)) {
        throw new Error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.')
      }

      const fileName = `sku_${skuId}_${index + 1}_${Date.now()}.${ext}`
      const filePath = path.join(skuImagesDir, fileName)

      fs.writeFileSync(filePath, buffer)
      createdFiles.push(filePath)

      const imageJson = JSON.stringify({
        path: filePath,
        filename: fileName,
        mime_type: mime,
        file_size: buffer.length,
        uploaded_at: new Date().toISOString(),
        is_primary: index === 0 // First image is primary
      })

      return { imageJson, filePath, fileName }
    }

    /* ============================
       CREATE SKU IMAGES DIRECTORY
    ============================ */
    const skuImagesDir = path.join(app.getPath('userData'), 'sku_images')
    fs.mkdirSync(skuImagesDir, { recursive: true })

    /* ============================
       TRANSACTION START
    ============================ */
    const result = db().transaction((tx) => {
      try {
        /* ============================
           INSERT SKU
        ============================ */
        const skuResult = tx
          .insert(sku)
          .values({
            product_id: payload.product_id,
            sku_name: skuName,
            code: skuCode,
            is_active: payload.is_active ?? true,
            sync_id: randomUUID(),
            created_on: sql`(strftime('%s', 'now'))`,
            updated_on: sql`(strftime('%s', 'now'))`
          })
          .run()

        const skuId = Number(skuResult.lastInsertRowid)

        /* ============================
           HANDLE SKU IMAGES
        ============================ */
        const createdImages: any[] = []

        if (images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            const img = images[i]

            if (!img?.image_data) continue

            try {
              const { imageJson, filePath, fileName } = processImageSync(img.image_data, skuId, i)

              const imgResult = tx
                .insert(sku_images)
                .values({
                  sku_id: skuId,
                  image: imageJson,
                  sync_id: randomUUID(),
                  created_on: sql`(strftime('%s', 'now'))`
                })
                .run()

              createdImages.push({
                id: Number(imgResult.lastInsertRowid),
                path: filePath,
                filename: fileName,
                is_primary: i === 0
              })

            } catch (imgError) {
              throw new Error(`Failed to process image ${i + 1}: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`)
            }
          }
        }

        /* ============================
           INSERT SKU ATTRIBUTES WITH ATTRIBUTE DETAILS
        ============================ */
        const createdAttributes: any[] = []

        if (attrList.length > 0) {
          for (const attr of attrList) {
            const attrResult = tx
              .insert(sku_attributes)
              .values({
                sku_id: skuId,
                attribute_id: attr.attribute_id,
                value: attr.value.trim(),
                is_active: attr.is_active ?? true,
                sync_id: randomUUID(),
                created_on: sql`(strftime('%s', 'now'))`
              })
              .run()

            // Get attribute details from the map we created earlier
            const attributeDetails = attributeMap.get(attr.attribute_id)
            
            createdAttributes.push({
              id: Number(attrResult.lastInsertRowid),
              attribute_id: attr.attribute_id,
              attribute_name: attributeDetails?.attribute_name || 'Unknown',
              value: attr.value.trim(),
              unit: attributeDetails?.unit || ''
            })
          }
        }

        /* ============================
           UPDATE PRODUCT SYNC STATUS
        ============================ */
        tx
          .update(products)
          .set({
            is_sync_required: true,
            updated_on: sql`(strftime('%s', 'now'))`
          })
          .where(eq(products.id, payload.product_id))
          .run()

        /* ============================
           RETURN SUCCESS WITH ENRICHED DATA
        ============================ */
        return {
          skuId,
          skuName,
          skuCode,
          createdImages,
          createdAttributes,
          imageCount: createdImages.length,
          attributeCount: createdAttributes.length
        }

      } catch (error) {
        console.error('Transaction error:', error)
        throw error // Rollback transaction
      }
    })

    /* ============================
       ENRICHED RESPONSE WITH ATTRIBUTE NAMES
    ============================ */
    return {
      success: true,
      message: 'SKU created successfully.',
      data: {
        id: result.skuId,
        sku_name: result.skuName,
        code: result.skuCode,
        product_id: payload.product_id,
        product_name: existingProduct.product_name,
        images: result.createdImages.map(img => ({
          id: img.id,
          path: img.path,
          filename: img.filename,
          is_primary: img.is_primary
        })),
        attributes: result.createdAttributes.map(attr => ({
          id: attr.id,
          attribute_id: attr.attribute_id,
          name: attr.attribute_name,
          value: attr.value,
          unit: attr.unit
        })),
        image_count: result.imageCount,
        attribute_count: result.attributeCount,
        summary: {
          has_images: result.imageCount > 0,
          has_attributes: result.attributeCount > 0,
          primary_image: result.createdImages.find(img => img.is_primary) || null
        }
      }
    }

  } catch (error) {
    console.error('Error creating SKU:', error)

    /* ============================
       CLEANUP FILES IF TRANSACTION FAILED
    ============================ */
    for (const filePath of createdFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (err) {
        console.error('Failed to cleanup file:', filePath, err)
      }
    }

    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to create SKU.' 
    }
  }
})


ipcMain.handle('sku:update', async (_event, payload: UpdateSkuPayload) => {
  const createdFiles: string[] = []
  const deletedFiles: string[] = []

  try {
    const MAX_IMAGES = 6

    if (!payload.id) {
      return { success: false, message: 'SKU id is required.' }
    }

    /* ============================
       CHECK SKU EXISTS WITH DETAILS
    ============================ */
    const existingSku = db()
      .select({ 
        id: sku.id,
        sku_name: sku.sku_name,
        code: sku.code,
        product_id: sku.product_id,
        is_active: sku.is_active,
        is_deleted: sku.is_deleted
      })
      .from(sku)
      .where(and(eq(sku.id, payload.id), eq(sku.is_deleted, false)))
      .get()

    if (!existingSku) {
      return { success: false, message: 'SKU not found.' }
    }

    /* ============================
       GET PRODUCT DETAILS FOR RESPONSE
    ============================ */
    const product = db()
      .select({ 
        id: products.id,
        product_name: products.product_name 
      })
      .from(products)
      .where(eq(products.id, existingSku.product_id))
      .get()

    /* ============================
       PREPARE IMAGE PROCESSING
    ============================ */
    const skuImagesDir = path.join(app.getPath('userData'), 'sku_images')
    fs.mkdirSync(skuImagesDir, { recursive: true })

    const processImageSync = (imageData: string, fileName: string): { 
      imageJson: string, 
      filePath: string 
    } => {
      const [meta, base64] = imageData.split(',')
      const mimeMatch = meta.match(/data:(.*);base64/)
      
      if (!mimeMatch) {
        throw new Error('Invalid image data format')
      }

      const mime = mimeMatch[1]
      const buffer = Buffer.from(base64, 'base64')
      const ext = mime.split('/')[1] || 'jpg'
      
      // Validate file size (5MB max)
      const MAX_SIZE = 5 * 1024 * 1024
      if (buffer.length > MAX_SIZE) {
        throw new Error(`Image size exceeds 5MB limit`)
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(mime)) {
        throw new Error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.')
      }

      const fullFileName = `${fileName}_${Date.now()}.${ext}`
      const filePath = path.join(skuImagesDir, fullFileName)

      fs.writeFileSync(filePath, buffer)

      const imageJson = JSON.stringify({
        path: filePath,
        filename: fullFileName,
        mime_type: mime,
        file_size: buffer.length,
        uploaded_at: new Date().toISOString()
      })

      return { imageJson, filePath }
    }

    /* ============================
       TRANSACTION
    ============================ */
    const result = db().transaction((tx) => {
      try {
        const changes = {
          sku: {} as any,
          images: {
            added: 0,
            updated: 0,
            deleted: 0
          },
          attributes: {
            added: 0,
            updated: 0,
            deleted: 0
          }
        }

        /* ============================
           UPDATE SKU TABLE (DYNAMIC)
        ============================ */
        const updateData: any = {
          updated_on: sql`(strftime('%s', 'now'))`,
          is_sync_required: true
        }

        if (payload.sku_name !== undefined) {
          if (!payload.sku_name.trim()) {
            throw new Error('SKU name cannot be empty.')
          }
          updateData.sku_name = payload.sku_name.trim()
          changes.sku.name_updated = true
        }

        if (payload.code !== undefined) {
          if (!payload.code.trim()) {
            throw new Error('SKU code cannot be empty.')
          }

          const newCode = payload.code.trim().toUpperCase()
          
          // Check if code already exists for another SKU
          const codeExists = tx
            .select({ id: sku.id })
            .from(sku)
            .where(
              and(
                eq(sku.code, newCode),
                eq(sku.is_deleted, false),
                sql`${sku.id} != ${payload.id}`
              )
            )
            .get()

          if (codeExists) {
            throw new Error(`SKU code "${newCode}" already exists.`)
          }

          updateData.code = newCode
          changes.sku.code_updated = true
        }

        if (payload.is_active !== undefined) {
          updateData.is_active = payload.is_active
          changes.sku.active_changed = true
        }

        // Apply SKU updates if any
        if (Object.keys(updateData).length > 1) { // More than just updated_on
          tx.update(sku)
            .set(updateData)
            .where(eq(sku.id, payload.id))
            .run()
        }

        /* ============================
           UPDATE IMAGES
        ============================ */
        if (payload.update_images) {
          const imagesPayload = payload.images ?? []

          // Get current active images
          const existingImages = tx
            .select({
              id: sku_images.id,
              image: sku_images.image
            })
            .from(sku_images)
            .where(and(eq(sku_images.sku_id, payload.id), eq(sku_images.is_deleted, false)))
            .all()

          const existingCount = existingImages.length
          const existingImageMap = new Map(existingImages.map(img => [img.id, img]))

          // Categorize images
          const toAdd = imagesPayload.filter((img) => !img.id && img.image_data)
          const toUpdate = imagesPayload.filter((img) => img.id && img.image_data && img.image_data !== '')
          const toDelete = imagesPayload.filter(
            (img) => img.id && (img.image_data === '' || img.image_data === null)
          )

          // Validate total count
          const newCount = existingCount - toDelete.length + toAdd.length
          if (newCount > MAX_IMAGES) {
            throw new Error(`Maximum of ${MAX_IMAGES} images allowed. Current: ${existingCount}, Adding: ${toAdd.length}, Removing: ${toDelete.length}`)
          }

          /* ----------------------------
             DELETE IMAGES
          ---------------------------- */
          if (toDelete.length > 0) {
            const deleteIds = toDelete.map(img => img.id!)
            
            // Get image paths for cleanup
            for (const img of toDelete) {
              const existing = existingImageMap.get(img.id!)
              if (existing?.image) {
                try {
                  const imgData = JSON.parse(existing.image)
                  if (imgData.path && fs.existsSync(imgData.path)) {
                    deletedFiles.push(imgData.path)
                  }
                } catch (e) {
                  console.warn('Could not parse image data for deletion:', e)
                }
              }
            }

            tx.update(sku_images)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(sku_images.id, deleteIds))
              .run()

            changes.images.deleted = deleteIds.length
          }

          /* ----------------------------
             UPDATE EXISTING IMAGES
          ---------------------------- */
          for (const img of toUpdate) {
            try {
              const fileName = `sku_${payload.id}_img_${img.id}`
              const { imageJson, filePath } = processImageSync(img.image_data!, fileName)
              createdFiles.push(filePath)

              // Get old image path for cleanup
              const existing = existingImageMap.get(img.id!)
              if (existing?.image) {
                try {
                  const oldImgData = JSON.parse(existing.image)
                  if (oldImgData.path && fs.existsSync(oldImgData.path)) {
                    deletedFiles.push(oldImgData.path)
                  }
                } catch (e) {
                  console.warn('Could not parse old image data:', e)
                }
              }

              tx.update(sku_images)
                .set({
                  image: imageJson,
                  updated_on: sql`(strftime('%s', 'now'))`,
                  is_sync_required: true
                })
                .where(eq(sku_images.id, img.id!))
                .run()

              changes.images.updated++
            } catch (imgError) {
              throw new Error(`Failed to update image ${img.id}: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`)
            }
          }

          /* ----------------------------
             ADD NEW IMAGES
          ---------------------------- */
          for (let i = 0; i < toAdd.length; i++) {
            const img = toAdd[i]
            
            try {
              const fileName = `sku_${payload.id}_new_${Date.now()}_${i}`
              const { imageJson, filePath } = processImageSync(img.image_data!, fileName)
              createdFiles.push(filePath)

              tx.insert(sku_images)
                .values({
                  sku_id: payload.id,
                  image: imageJson,
                  sync_id: randomUUID(),
                  created_on: sql`(strftime('%s', 'now'))`
                })
                .run()

              changes.images.added++
            } catch (imgError) {
              throw new Error(`Failed to add new image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`)
            }
          }
        }

        /* ============================
           UPDATE ATTRIBUTES
        ============================ */
        if (payload.update_attributes) {
          const attrsPayload = payload.sku_attributes ?? []

          // Get current attributes
          const existingAttrs = tx
            .select({
              id: sku_attributes.id,
              attribute_id: sku_attributes.attribute_id,
              value: sku_attributes.value,
              is_active: sku_attributes.is_active,
              is_deleted: sku_attributes.is_deleted
            })
            .from(sku_attributes)
            .where(and(eq(sku_attributes.sku_id, payload.id), eq(sku_attributes.is_deleted, false)))
            .all()

          const existingAttrMap = new Map(existingAttrs.map(attr => [attr.id, attr]))

          // Get all attribute IDs that will be needed for validation
          const attributeIdsForValidation = [
            ...attrsPayload.filter(a => a.attribute_id).map(a => a.attribute_id!),
            ...existingAttrs.map(a => a.attribute_id)
          ]

          // Fetch attribute details for all needed IDs
          const attributeDetails = attributeIdsForValidation.length > 0
            ? tx
                .select({ 
                  id: attributes.id,
                  attribute_name: attributes.attribute_name,
                  unit: attributes.unit 
                })
                .from(attributes)
                .where(
                  and(
                    eq(attributes.is_deleted, false),
                    inArray(attributes.id, attributeIdsForValidation)
                  )
                )
                .all()
            : []

          const attributeMap = new Map(attributeDetails.map(a => [a.id, a]))

          // Categorize attributes
          const toDeleteAttrs = attrsPayload.filter(
            (a) => a.id && (a.value === '' || a.value === null)
          )

          const toUpdateAttrs = attrsPayload.filter(
            (a) => a.id && a.value !== undefined && a.value !== null && a.value !== ''
          )

          const toAddAttrs = attrsPayload.filter(
            (a) => !a.id && a.attribute_id && a.value && a.value.trim()
          )


          /* ----------------------------
            VALIDATE ATTRIBUTE IDs FOR NEW ATTRIBUTES
          ---------------------------- */
          if (toAddAttrs.length > 0) {
            const newAttributeIds = toAddAttrs.map(a => a.attribute_id!)
            const validIds = new Set(attributeDetails.map(a => a.id))
            const missingIds = newAttributeIds.filter(id => !validIds.has(id))

            if (missingIds.length > 0) {
              throw new Error(`Invalid attribute_id(s): ${missingIds.join(', ')}`)
            }
          }

          /* ----------------------------
             DELETE ATTRIBUTES
          ---------------------------- */
          if (toDeleteAttrs.length > 0) {
            const deleteIds = toDeleteAttrs.map(a => a.id!)
            tx.update(sku_attributes)
              .set({
                is_deleted: true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(sku_attributes.id, deleteIds))
              .run()

            changes.attributes.deleted = deleteIds.length
          }

          /* ----------------------------
            UPDATE EXISTING ATTRIBUTES
          ---------------------------- */
          for (const attr of toUpdateAttrs) {
            const existingAttr = existingAttrMap.get(attr.id!)
            
            // Check if value actually changed
            if (existingAttr && existingAttr.value !== attr.value?.trim()) {
              
              tx.update(sku_attributes)
                .set({
                  value: attr.value!.trim(),
                  is_active: attr.is_active ?? true,
                  updated_on: sql`(strftime('%s', 'now'))`,
                  is_sync_required: true
                })
                .where(eq(sku_attributes.id, attr.id!))
                .run()

              changes.attributes.updated++
            }
          }

          /* ----------------------------
            ADD NEW ATTRIBUTES
          ---------------------------- */
          for (const attr of toAddAttrs) {
            // Check if this attribute already exists for this SKU (soft-deleted or active)
            const existingWithSameAttr = existingAttrs.find(
              e => e.attribute_id === attr.attribute_id
            )

            if (existingWithSameAttr) {
              // If it exists but is soft-deleted, reactivate it
              if (existingWithSameAttr.is_deleted) {
                tx.update(sku_attributes)
                  .set({
                    is_deleted: false,
                    value: attr.value!.trim(),
                    is_active: attr.is_active ?? true,
                    updated_on: sql`(strftime('%s', 'now'))`,
                    is_sync_required: true
                  })
                  .where(eq(sku_attributes.id, existingWithSameAttr.id))
                  .run()
                
                changes.attributes.updated++
              } else {
                // If it exists and is active, throw error (duplicate)
                throw new Error(`Attribute "${attributeMap.get(attr.attribute_id!)?.attribute_name}" already exists for this SKU.`)
              }
            } else {
              // Add new attribute
              // const attributeName = attributeMap.get(attr.attribute_id!)?.attribute_name || 'Unknown'
              
              tx.insert(sku_attributes)
                .values({
                  sku_id: payload.id,
                  attribute_id: attr.attribute_id!,
                  value: attr.value!.trim(),
                  is_active: attr.is_active ?? true,
                  sync_id: randomUUID(),
                  created_on: sql`(strftime('%s', 'now'))`
                })
                .run()

              changes.attributes.added++
            }
          }
        }

        /* ============================
           UPDATE PRODUCT SYNC STATUS
        ============================ */
        tx.update(products)
          .set({
            is_sync_required: true,
            updated_on: sql`(strftime('%s', 'now'))`
          })
          .where(eq(products.id, existingSku.product_id))
          .run()

        /* ============================
           RETURN SUMMARY
        ============================ */
        return {
          success: true,
          changes
        }

      } catch (error) {
        console.error('Transaction error:', error)
        throw error
      }
    })

    /* ============================
       CLEANUP OLD FILES AFTER SUCCESSFUL TRANSACTION
    ============================ */
    for (const filePath of deletedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (err) {
        console.error('Failed to cleanup old file:', filePath, err)
      }
    }

    /* ============================
       FETCH UPDATED SKU FOR RESPONSE
    ============================ */
    const updatedSku = db()
      .select({
        id: sku.id,
        sku_name: sku.sku_name,
        code: sku.code,
        is_active: sku.is_active,
        product_id: sku.product_id
      })
      .from(sku)
      .where(eq(sku.id, payload.id))
      .get()

    return {
      success: true,
      message: 'SKU updated successfully.',
      data: {
        id: payload.id,
        sku_name: updatedSku?.sku_name,
        code: updatedSku?.code,
        is_active: updatedSku?.is_active,
        product: product ? {
          id: product.id,
          name: product.product_name
        } : null,
        changes: result.changes,
        summary: {
          images_affected: result.changes.images.added + result.changes.images.updated + result.changes.images.deleted,
          attributes_affected: result.changes.attributes.added + result.changes.attributes.updated + result.changes.attributes.deleted,
          files_created: createdFiles.length,
          files_cleaned: deletedFiles.length
        }
      }
    }

  } catch (error: any) {
    console.error('Error updating SKU:', error)

    /* ============================
       CLEANUP NEW FILES IF TRANSACTION FAILED
    ============================ */
    for (const filePath of createdFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (err) {
        console.error('Failed to cleanup file:', filePath, err)
      }
    }

    return {
      success: false,
      message: error?.message ?? 'Failed to update SKU.'
    }
  }
})


function applyTriStateFilter(column: any, value: TriState | undefined) {
  if (!value || value === 'both') return undefined
  return eq(column, value === 'yes')
}


// ============================================================================
// SKU METRIC FUNCTIONS
// ============================================================================

/**
 * Calculates total items sold for a specific SKU
 */
export function calculateSkuTotalItemsSold(skuId: number): number {
  try {
    const result = db()
      .select({
        total: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .get()

    return Number(result?.total || 0)
  } catch (error) {
    console.error(`Error calculating items sold for SKU ${skuId}:`, error)
    return 0
  }
}

/**
 * Calculates total items bought for a specific SKU
 */
export function calculateSkuTotalItemsBought(skuId: number): number {
  try {
    const result = db()
      .select({
        total: sql<number>`COALESCE(SUM(${stock_purchases.quantity_bought}), 0)`
      })
      .from(stock_purchases)
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .get()

    return Number(result?.total || 0)
  } catch (error) {
    console.error(`Error calculating items bought for SKU ${skuId}:`, error)
    return 0
  }
}

/**
 * Calculates total revenue for a specific SKU
 */
export function calculateSkuTotalRevenue(skuId: number): number {
  try {
    const result = db()
      .select({
        total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .get()

    return Number(result?.total || 0)
  } catch (error) {
    console.error(`Error calculating revenue for SKU ${skuId}:`, error)
    return 0
  }
}

/**
 * Calculates total cost (COGS) for a specific SKU
 */
export function calculateSkuTotalCost(skuId: number): number {
  try {
    // First get all purchases for this SKU
    const purchases = db()
      .select({
        id: stock_purchases.id,
        quantity_bought: stock_purchases.quantity_bought,
        total_price_bought: stock_purchases.total_price_bought,
        shipping_cost: stock_purchases.shipping_cost
      })
      .from(stock_purchases)
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    if (purchases.length === 0) return 0

    // Get all sales for this SKU
    const sales_data = db()
      .select({
        stock_purchased_id: sales.stock_purchased_id,
        quantity: sales.quantity
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .all()

    // Group sales by purchase
    const salesByPurchase = new Map<number, number>()
    for (const sale of sales_data) {
      const current = salesByPurchase.get(sale.stock_purchased_id ? sale.stock_purchased_id : 0) || 0
      salesByPurchase.set(sale.stock_purchased_id ? sale.stock_purchased_id : 0, current + sale.quantity)
    }

    // Calculate cost of goods sold
    let totalCost = 0
    for (const purchase of purchases) {
      const soldQuantity = salesByPurchase.get(purchase.id) || 0
      if (soldQuantity > 0) {
        const landedCostPerUnit = (purchase.total_price_bought + (purchase.shipping_cost || 0)) / purchase.quantity_bought
        totalCost += landedCostPerUnit * soldQuantity
      }
    }

    return Number(totalCost.toFixed(2))
  } catch (error) {
    console.error(`Error calculating cost for SKU ${skuId}:`, error)
    return 0
  }
}

/**
 * Calculates total shipping cost paid on sales for a specific SKU
 */
export function calculateSkuTotalShipping(skuId: number): number {
  try {
    const result = db()
      .select({
        total: sql<number>`COALESCE(SUM(${sales.shipping_cost}), 0)`
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .get()

    return Number(result?.total || 0)
  } catch (error) {
    console.error(`Error calculating shipping for SKU ${skuId}:`, error)
    return 0
  }
}

/**
 * Calculates profit metrics for a specific SKU
 */
export interface SkuProfitAnalysis {
  totalRevenue: number
  totalCost: number
  totalShipping: number
  totalProfit: number
  profitMargin: number
}

export function calculateSkuProfit(skuId: number): SkuProfitAnalysis {
  try {
    const totalRevenue = calculateSkuTotalRevenue(skuId)
    const totalCost = calculateSkuTotalCost(skuId)
    const totalShipping = calculateSkuTotalShipping(skuId)
    const totalProfit = totalRevenue - totalCost - totalShipping
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalShipping: Number(totalShipping.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(2))
    }
  } catch (error) {
    console.error(`Error calculating profit for SKU ${skuId}:`, error)
    return {
      totalRevenue: 0,
      totalCost: 0,
      totalShipping: 0,
      totalProfit: 0,
      profitMargin: 0
    }
  }
}

/**
 * Calculates inventory value for a specific SKU
 */
export interface SkuInventoryAnalysis {
  totalBought: number
  totalSold: number
  totalRemaining: number
  inventoryValue: number
  avgCostPerUnit: number
  avgSellingPrice: number
}

export function calculateSkuInventory(skuId: number): SkuInventoryAnalysis {
  try {
    const totalBought = calculateSkuTotalItemsBought(skuId)
    const totalSold = calculateSkuTotalItemsSold(skuId)
    const totalRemaining = totalBought - totalSold

    // Get all purchases to calculate average cost
    const purchases = db()
      .select({
        quantity_bought: stock_purchases.quantity_bought,
        total_price_bought: stock_purchases.total_price_bought,
        shipping_cost: stock_purchases.shipping_cost
      })
      .from(stock_purchases)
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    // Calculate average cost per unit (weighted)
    let totalLandedCost = 0
    let totalUnits = 0
    for (const purchase of purchases) {
      totalLandedCost += purchase.total_price_bought + (purchase.shipping_cost || 0)
      totalUnits += purchase.quantity_bought
    }
    const avgCostPerUnit = totalUnits > 0 ? totalLandedCost / totalUnits : 0

    // Calculate inventory value
    const inventoryValue = totalRemaining * avgCostPerUnit

    // Calculate average selling price
    const totalRevenue = calculateSkuTotalRevenue(skuId)
    const avgSellingPrice = totalSold > 0 ? totalRevenue / totalSold : 0

    return {
      totalBought,
      totalSold,
      totalRemaining,
      inventoryValue: Number(inventoryValue.toFixed(2)),
      avgCostPerUnit: Number(avgCostPerUnit.toFixed(2)),
      avgSellingPrice: Number(avgSellingPrice.toFixed(2))
    }
  } catch (error) {
    console.error(`Error calculating inventory for SKU ${skuId}:`, error)
    return {
      totalBought: 0,
      totalSold: 0,
      totalRemaining: 0,
      inventoryValue: 0,
      avgCostPerUnit: 0,
      avgSellingPrice: 0
    }
  }
}

/**
 * Calculates sell-through rate for a specific SKU
 */
export interface SkuSellThroughAnalysis {
  rate: number
  last30DaysSales: number
  last60DaysSales: number
  last90DaysSales: number
  averageMonthlyRate: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

export function calculateSkuSellThrough(skuId: number): SkuSellThroughAnalysis {
  try {
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60)

    // Get total bought
    const totalBought = calculateSkuTotalItemsBought(skuId)

    // Get sales by period
    const salesData = db()
      .select({
        quantity: sales.quantity,
        soldOn: sales.sold_on
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .all()

    let last30Days = 0
    let last60Days = 0
    let last90Days = 0

    for (const sale of salesData) {
      const soldOn = Number(sale.soldOn)
      if (soldOn >= thirtyDaysAgo) last30Days += sale.quantity
      if (soldOn >= sixtyDaysAgo) last60Days += sale.quantity
      if (soldOn >= ninetyDaysAgo) last90Days += sale.quantity
    }

    const overallRate = totalBought > 0 ? (calculateSkuTotalItemsSold(skuId) / totalBought) * 100 : 0
    const averageMonthlyRate = last90Days / 3

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (last30Days > last60Days / 2 && last60Days > last90Days / 3) {
      trend = 'increasing'
    } else if (last30Days < last60Days / 2 && last60Days < last90Days / 3) {
      trend = 'decreasing'
    }

    return {
      rate: Number(overallRate.toFixed(1)),
      last30DaysSales: last30Days,
      last60DaysSales: last60Days,
      last90DaysSales: last90Days,
      averageMonthlyRate: Number(averageMonthlyRate.toFixed(1)),
      trend
    }
  } catch (error) {
    console.error(`Error calculating sell-through for SKU ${skuId}:`, error)
    return {
      rate: 0,
      last30DaysSales: 0,
      last60DaysSales: 0,
      last90DaysSales: 0,
      averageMonthlyRate: 0,
      trend: 'stable'
    }
  }
}


/**
 * Comprehensive SKU metrics analysis
 */
export interface SkuMetricsAnalysis {
  // Volume metrics
  total_bought: number
  total_sold: number
  total_remaining: number
  
  // Financial metrics
  total_revenue: number
  total_cost: number
  total_shipping: number
  total_profit: number
  profit_margin: number
  
  // Per-unit metrics
  avg_cost_per_unit: number
  avg_selling_price: number
  avg_profit_per_unit: number
  
  // Performance metrics
  sell_through_rate: number
  last_30_days_sales: number
  days_of_inventory: number
  
  // Status flags
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
  is_low_stock: boolean
  is_overstocked: boolean
  is_out_of_stock: boolean
  is_profitable: boolean
  
  // Projections
  projected_runout_date: string | null
}

export function calculateSkuMetrics(skuId: number): SkuMetricsAnalysis {
  try {
    // Use all the individual functions we created
    const totalBought = calculateSkuTotalItemsBought(skuId)
    const totalSold = calculateSkuTotalItemsSold(skuId)
    const totalRemaining = totalBought - totalSold
    
    const profit = calculateSkuProfit(skuId)
    const inventory = calculateSkuInventory(skuId)
    const sellThrough = calculateSkuSellThrough(skuId)
    const days = calculateSkuDaysOfInventory(skuId)
    
    // Calculate average profit per unit
    const avgProfitPerUnit = totalSold > 0 ? profit.totalProfit / totalSold : 0
    
    // Determine stock status
    let stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
    if (totalRemaining <= 0) {
      stock_status = 'Out of Stock'
    } else if (days.days < 30) {
      stock_status = 'Low Stock'
    } else if (days.days > 180) {
      stock_status = 'Overstocked'
    } else {
      stock_status = 'In Stock'
    }
    
    return {
      // Volume metrics
      total_bought: totalBought,
      total_sold: totalSold,
      total_remaining: totalRemaining,
      
      // Financial metrics
      total_revenue: profit.totalRevenue,
      total_cost: profit.totalCost,
      total_shipping: profit.totalShipping,
      total_profit: profit.totalProfit,
      profit_margin: profit.profitMargin,
      
      // Per-unit metrics
      avg_cost_per_unit: inventory.avgCostPerUnit,
      avg_selling_price: inventory.avgSellingPrice,
      avg_profit_per_unit: Number(avgProfitPerUnit.toFixed(2)),
      
      // Performance metrics
      sell_through_rate: sellThrough.rate,
      last_30_days_sales: sellThrough.last30DaysSales,
      days_of_inventory: days.days,
      
      // Status flags
      stock_status,
      is_low_stock: stock_status === 'Low Stock',
      is_overstocked: stock_status === 'Overstocked',
      is_out_of_stock: stock_status === 'Out of Stock',
      is_profitable: profit.profitMargin > 0,
      
      // Projections
      projected_runout_date: days.projectedRunoutDate
    }
  } catch (error) {
    console.error(`Error calculating metrics for SKU ${skuId}:`, error)
    return {
      total_bought: 0,
      total_sold: 0,
      total_remaining: 0,
      total_revenue: 0,
      total_cost: 0,
      total_shipping: 0,
      total_profit: 0,
      profit_margin: 0,
      avg_cost_per_unit: 0,
      avg_selling_price: 0,
      avg_profit_per_unit: 0,
      sell_through_rate: 0,
      last_30_days_sales: 0,
      days_of_inventory: 999,
      stock_status: 'Out of Stock',
      is_low_stock: false,
      is_overstocked: false,
      is_out_of_stock: true,
      is_profitable: false,
      projected_runout_date: null
    }
  }
}


/**
 * Calculates days of inventory for a specific SKU
 */
export interface SkuDaysAnalysis {
  days: number
  by30DayRate: number
  by60DayRate: number
  by90DayRate: number
  projectedRunoutDate: string | null
}

export function calculateSkuDaysOfInventory(skuId: number): SkuDaysAnalysis {
  try {
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60)

    const totalRemaining = calculateSkuTotalItemsBought(skuId) - calculateSkuTotalItemsSold(skuId)
    if (totalRemaining <= 0) {
      return {
        days: 0,
        by30DayRate: 0,
        by60DayRate: 0,
        by90DayRate: 0,
        projectedRunoutDate: null
      }
    }

    // Calculate sales by period
    const salesData = db()
      .select({
        quantity: sales.quantity,
        soldOn: sales.sold_on
      })
      .from(sales)
      .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .all()

    let sales30Days = 0
    let sales60Days = 0
    let sales90Days = 0

    for (const sale of salesData) {
      const soldOn = Number(sale.soldOn)
      if (soldOn >= thirtyDaysAgo) sales30Days += sale.quantity
      if (soldOn >= sixtyDaysAgo) sales60Days += sale.quantity
      if (soldOn >= ninetyDaysAgo) sales90Days += sale.quantity
    }

    const dailyRate30 = sales30Days / 30
    const dailyRate60 = sales60Days / 60
    const dailyRate90 = sales90Days / 90

    // Use the most reliable rate (prefer 30 days, then 60, then 90)
    let dailyRate = dailyRate30
    if (dailyRate === 0 && dailyRate60 > 0) dailyRate = dailyRate60
    if (dailyRate === 0 && dailyRate90 > 0) dailyRate = dailyRate90

    const days = dailyRate > 0 ? Math.round(totalRemaining / dailyRate) : 999

    // Calculate projected runout date
    let projectedRunoutDate: string | null = null
    if (dailyRate > 0) {
      const runoutDate = new Date(now * 1000)
      runoutDate.setDate(runoutDate.getDate() + days)
      projectedRunoutDate = runoutDate.toISOString().split('T')[0]
    }

    return {
      days,
      by30DayRate: dailyRate30 > 0 ? Math.round(totalRemaining / dailyRate30) : 999,
      by60DayRate: dailyRate60 > 0 ? Math.round(totalRemaining / dailyRate60) : 999,
      by90DayRate: dailyRate90 > 0 ? Math.round(totalRemaining / dailyRate90) : 999,
      projectedRunoutDate
    }
  } catch (error) {
    console.error(`Error calculating days of inventory for SKU ${skuId}:`, error)
    return {
      days: 999,
      by30DayRate: 999,
      by60DayRate: 999,
      by90DayRate: 999,
      projectedRunoutDate: null
    }
  }
}

/**
 * Calculates average cost per unit for a specific SKU
 */
export function calculateSkuAvgCostPerUnit(skuId: number): number {
  try {
    const purchases = db()
      .select({
        quantity_bought: stock_purchases.quantity_bought,
        total_price_bought: stock_purchases.total_price_bought,
        shipping_cost: stock_purchases.shipping_cost
      })
      .from(stock_purchases)
      .where(
        and(
          eq(stock_purchases.sku_id, skuId),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    if (purchases.length === 0) return 0

    let totalLandedCost = 0
    let totalUnits = 0
    for (const purchase of purchases) {
      totalLandedCost += purchase.total_price_bought + (purchase.shipping_cost || 0)
      totalUnits += purchase.quantity_bought
    }

    return totalUnits > 0 ? Number((totalLandedCost / totalUnits).toFixed(2)) : 0
  } catch (error) {
    console.error(`Error calculating avg cost for SKU ${skuId}:`, error)
    return 0
  }
}

/**
 * Calculates average selling price for a specific SKU
 */
export function calculateSkuAvgSellingPrice(skuId: number): number {
  try {
    const totalSold = calculateSkuTotalItemsSold(skuId)
    if (totalSold === 0) return 0

    const totalRevenue = calculateSkuTotalRevenue(skuId)
    return Number((totalRevenue / totalSold).toFixed(2))
  } catch (error) {
    console.error(`Error calculating avg selling price for SKU ${skuId}:`, error)
    return 0
  }
}


ipcMain.handle('sku:get-all', async (_event, payload?: GetAllSkusPayload) => {
  try {
    const {
      // Tri-state filters
      is_active = 'both',
      is_deleted = 'both',
      is_sync_required = 'both',
      
      // Product filters
      product_id,
      
      // Search
      search,
      
      // Performance filters
      min_profit_margin,
      max_profit_margin,
      min_sell_through,
      max_sell_through,
      low_stock_only = false,
      overstocked_only = false,
      out_of_stock_only = false,
      
      // Pagination
      should_paginate = true,
      page = 1,
      limit = 20,
      
      // Sorting
      sort_by = 'created_on',
      sort_order = 'desc',
      
      // Nested data
      nested = true,
      with_images = true,
      with_attributes = true,
      with_stock_purchases = true,
      with_sales_history = false,
      stock_purchases_limit = 5,
      sales_limit = 10
    } = payload || {}

    /* ============================
       BUILD WHERE CONDITIONS (SIMPLE!)
    ============================ */
    const conditions: SQL[] = []

    // Apply tri-state filters
    const activeFilter = applyTriStateFilter(sku.is_active, is_active)
    const deletedFilter = applyTriStateFilter(sku.is_deleted, is_deleted)
    const syncFilter = applyTriStateFilter(sku.is_sync_required, is_sync_required)

    if (activeFilter) conditions.push(activeFilter)
    if (deletedFilter) conditions.push(deletedFilter)
    if (syncFilter) conditions.push(syncFilter)

    // Product filter
    if (product_id) {
      if (Array.isArray(product_id)) {
        conditions.push(inArray(sku.product_id, product_id))
      } else {
        conditions.push(eq(sku.product_id, product_id))
      }
    }

    // Search filter (by SKU name or code)
    if (search) {
      const searchPattern = `%${search}%`
      const searchCondition = or(
        like(sku.sku_name, searchPattern),
        like(sku.code, searchPattern)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    /* ============================
       GET TOTAL COUNT
    ============================ */
    const totalRow = db()
      .select({ count: sql<number>`COUNT(*)` })
      .from(sku)
      .where(whereConditions)
      .get()

    const total = totalRow?.count ?? 0
    const offset = (page - 1) * limit

    /* ============================
       BUILD ORDER BY (SIMPLE FIELDS ONLY)
    ============================ */
    let orderByClause
    switch (sort_by) {
      case 'sku_name':
        orderByClause = sort_order === 'asc' ? asc(sku.sku_name) : desc(sku.sku_name)
        break
      case 'code':
        orderByClause = sort_order === 'asc' ? asc(sku.code) : desc(sku.code)
        break
      case 'created_on':
        orderByClause = sort_order === 'asc' ? asc(sku.created_on) : desc(sku.created_on)
        break
      case 'updated_on':
        orderByClause = sort_order === 'asc' ? asc(sku.updated_on) : desc(sku.updated_on)
        break
      default:
        orderByClause = desc(sku.created_on)
    }

    /* ============================
       GET SKUS (SIMPLE QUERY!)
    ============================ */
    let query = db()
      .select({
        id: sku.id,
        product_id: sku.product_id,
        sku_name: sku.sku_name,
        code: sku.code,
        created_on: sku.created_on,
        updated_on: sku.updated_on,
        last_sync: sku.last_sync,
        is_active: sku.is_active,
        is_deleted: sku.is_deleted,
        is_sync_required: sku.is_sync_required
      })
      .from(sku)
      .where(whereConditions)
      .orderBy(orderByClause)

    const skuRows = should_paginate
      ? await query.limit(limit).offset(offset).all()
      : await query.all()

    if (!nested) {
      return {
        success: true,
        data: {
          items: skuRows.map(s => ({
            id: s.id,
            sku_name: s.sku_name,
            code: s.code,
            product_id: s.product_id,
            is_active: s.is_active === true,
            is_deleted: s.is_deleted === true,
            timestamps: {
              created_on: s.created_on,
              updated_on: s.updated_on,
              last_sync: s.last_sync
            }
          })),
          total,
          ...(should_paginate ? { page, limit, total_pages: Math.ceil(total / limit) } : {})
        }
      }
    }

    const skuIds = skuRows.map(s => s.id)

    if (skuIds.length === 0) {
      return {
        success: true,
        data: { items: [], total, ...(should_paginate ? { page, limit, total_pages: 0 } : {}) }
      }
    }

    /* ============================
       FETCH RELATED DATA
    ============================ */
    const [allImages, allAttributes, allProducts, allPurchases, allSales, allSuppliers] = await Promise.all([
      // Images
      with_images ? db()
        .select({
          id: sku_images.id,
          sku_id: sku_images.sku_id,
          image: sku_images.image,
          created_on: sku_images.created_on
        })
        .from(sku_images)
        .where(and(eq(sku_images.is_deleted, false), inArray(sku_images.sku_id, skuIds)))
        .orderBy(asc(sku_images.created_on))
        .all() : Promise.resolve([]),

      // Attributes
      with_attributes ? db()
        .select({
          id: sku_attributes.id,
          sku_id: sku_attributes.sku_id,
          attribute_id: sku_attributes.attribute_id,
          value: sku_attributes.value,
          is_active: sku_attributes.is_active,
          attribute_name: attributes.attribute_name,
          unit: attributes.unit
        })
        .from(sku_attributes)
        .innerJoin(attributes, eq(attributes.id, sku_attributes.attribute_id))
        .where(and(eq(sku_attributes.is_deleted, false), inArray(sku_attributes.sku_id, skuIds)))
        .orderBy(asc(attributes.attribute_name))
        .all() : Promise.resolve([]),

      // Products
      db()
        .select({
          id: products.id,
          name: products.product_name,
          is_active: products.is_active,
          category_id: products.category_id
        })
        .from(products)
        .where(inArray(products.id, [...new Set(skuRows.map(s => s.product_id))]))
        .all(),

      // Stock purchases
      with_stock_purchases ? db()
        .select({
          id: stock_purchases.id,
          sku_id: stock_purchases.sku_id,
          quantity_bought: stock_purchases.quantity_bought,
          price_per_unit: stock_purchases.price_per_unit,
          total_price_bought: stock_purchases.total_price_bought,
          shipping_cost: stock_purchases.shipping_cost,
          purchased_on: stock_purchases.purchased_on,
          arrived_on: stock_purchases.arrived_on,
          expiry_date: stock_purchases.expiry_date,
          supplier_id: stock_purchases.supplier_id,
          batch_number: stock_purchases.batch_number,
          min_selling_price: stock_purchases.min_selling_price,
          max_selling_price: stock_purchases.max_selling_price
        })
        .from(stock_purchases)
        .where(and(eq(stock_purchases.is_deleted, false), inArray(stock_purchases.sku_id, skuIds)))
        .orderBy(desc(stock_purchases.purchased_on))
        .all() : Promise.resolve([]),

      // Sales history (simple version without profit margin calculation)
      with_sales_history ? db()
        .select({
          id: sales.id,
          sku_id: sku.id,
          quantity: sales.quantity,
          total_price: sales.total_price,
          shipping_cost: sales.shipping_cost,
          sold_on: sales.sold_on,
          status: sales.status
        })
        .from(sales)
        .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .where(and(inArray(sku.id, skuIds), eq(sales.is_deleted, false), eq(sales.has_been_canceled, false), eq(sales.status, 'completed')))
        .orderBy(desc(sales.sold_on))
        .limit(sales_limit * skuIds.length)
        .all() : Promise.resolve([]),

      // Suppliers
      db()
        .select({
          id: suppliers.id,
          supplier_name: suppliers.supplier_name,
          contact_person: suppliers.contact_person,
          email: suppliers.email,
          phone_number: suppliers.phone_number
        })
        .from(suppliers)
        .where(eq(suppliers.is_deleted, false))
        .all()
    ])

    /* ============================
       BUILD DATA MAPS
    ============================ */
    const imageMap = new Map<number, any[]>()
    for (const img of allImages) {
      if (!imageMap.has(img.sku_id)) imageMap.set(img.sku_id, [])
      const parsedImage = safeParse(img.image)
      imageMap.get(img.sku_id)!.push({ id: img.id, ...(parsedImage || {}), created_on: img.created_on })
    }

    const attributeMap = new Map<number, any[]>()
    for (const attr of allAttributes) {
      if (!attributeMap.has(attr.sku_id)) attributeMap.set(attr.sku_id, [])
      attributeMap.get(attr.sku_id)!.push({
        id: attr.id,
        attribute_id: attr.attribute_id,
        name: attr.attribute_name,
        value: attr.value,
        unit: attr.unit,
        display_value: attr.unit ? `${attr.value} ${attr.unit}` : attr.value,
        is_active: attr.is_active === true
      })
    }

    const productMap = new Map<number, any>(allProducts.map(p => [p.id, p]))
    const supplierMap = new Map<number, any>(allSuppliers.map(s => [s.id, s]))

    const purchaseMap = new Map<number, any[]>()
    for (const purchase of allPurchases) {
      if (!purchaseMap.has(purchase.sku_id)) purchaseMap.set(purchase.sku_id, [])
      const purchases = purchaseMap.get(purchase.sku_id)!
      if (purchases.length < stock_purchases_limit) {
        purchases.push({
          ...purchase,
          supplier: purchase.supplier_id ? supplierMap.get(purchase.supplier_id) : null
        })
      }
    }

    const salesMap = new Map<number, any[]>()
    for (const sale of allSales) {
      if (!salesMap.has(sale.sku_id)) salesMap.set(sale.sku_id, [])
      const sales = salesMap.get(sale.sku_id)!
      if (sales.length < sales_limit) sales.push(sale)
    }

    /* ============================
       BUILD FINAL ITEMS WITH YOUR FUNCTIONS!
    ============================ */
    const items = await Promise.all(skuRows.map(async (s) => {
      const product = productMap.get(s.product_id)
      
      // ========== USE YOUR FUNCTIONS! ==========
      // You'll need to create these functions similar to product ones
      const skuMetrics = await calculateSkuMetrics(s.id) // Create this function
      const skuProfit = await calculateSkuProfit(s.id)   // Create this function
      const skuInventory = await calculateSkuInventory(s.id) // Create this function
      const skuSellThrough = await calculateSkuSellThrough(s.id) // Create this function
      const skuDays = await calculateSkuDaysOfInventory(s.id) // Create this function
      
      return {
        id: s.id,
        sku_name: s.sku_name,
        code: s.code,
        
        product: product ? {
          id: product.id,
          name: product.name,
          is_active: product.is_active === true,
          category_id: product.category_id
        } : { id: s.product_id, name: 'Unknown' },
        
        is_active: s.is_active === true,
        is_deleted: s.is_deleted === true,
        
        timestamps: {
          created_on: s.created_on,
          updated_on: s.updated_on,
          last_sync: s.last_sync
        },
        
        images: imageMap.get(s.id) ?? [],
        attributes: attributeMap.get(s.id) ?? [],
        stock_purchases: purchaseMap.get(s.id) ?? [],
        recent_sales: salesMap.get(s.id) ?? [],
        
        metrics: {
          // Use values from your functions
          total_bought: skuMetrics.total_bought,
          total_sold: skuMetrics.total_sold,
          total_remaining: skuMetrics.total_remaining,
          total_revenue: skuMetrics.total_revenue,
          total_cost: skuMetrics.total_cost,
          total_profit: skuProfit.totalProfit,
          profit_margin: skuProfit.profitMargin,
          avg_cost_per_unit: skuInventory.avgCostPerUnit,
          avg_selling_price: skuMetrics.avg_selling_price,
          sell_through_rate: skuSellThrough.rate,
          days_of_inventory: skuDays.days,
          stock_status: skuMetrics.total_remaining <= 0 ? 'Out of Stock' :
                        skuDays.days < 30 ? 'Low Stock' :
                        skuDays.days > 180 ? 'Overstocked' : 'In Stock',
          is_low_stock: skuDays.days < 30 && skuDays.days > 0,
          is_overstocked: skuDays.days > 180,
          is_out_of_stock: skuMetrics.total_remaining <= 0,
          is_profitable: skuProfit.profitMargin > 0
        },
        
        stats: {
          image_count: imageMap.get(s.id)?.length || 0,
          attribute_count: attributeMap.get(s.id)?.length || 0,
          purchase_count: purchaseMap.get(s.id)?.length || 0,
          sale_count: salesMap.get(s.id)?.length || 0
        }
      }
    }))

    // Apply metric-based filters in memory
    let filteredItems = [...items]
    
    if (min_profit_margin !== undefined) {
      filteredItems = filteredItems.filter(i => i.metrics.profit_margin >= min_profit_margin)
    }
    if (max_profit_margin !== undefined) {
      filteredItems = filteredItems.filter(i => i.metrics.profit_margin <= max_profit_margin)
    }
    if (min_sell_through !== undefined) {
      filteredItems = filteredItems.filter(i => i.metrics.sell_through_rate >= min_sell_through)
    }
    if (max_sell_through !== undefined) {
      filteredItems = filteredItems.filter(i => i.metrics.sell_through_rate <= max_sell_through)
    }
    if (low_stock_only) {
      filteredItems = filteredItems.filter(i => i.metrics.is_low_stock)
    }
    if (overstocked_only) {
      filteredItems = filteredItems.filter(i => i.metrics.is_overstocked)
    }
    if (out_of_stock_only) {
      filteredItems = filteredItems.filter(i => i.metrics.is_out_of_stock)
    }

    // Apply metric-based sorting
    if (sort_by === 'profit_margin') {
      filteredItems.sort((a, b) => sort_order === 'asc' 
        ? a.metrics.profit_margin - b.metrics.profit_margin
        : b.metrics.profit_margin - a.metrics.profit_margin)
    } else if (sort_by === 'sell_through_rate') {
      filteredItems.sort((a, b) => sort_order === 'asc'
        ? a.metrics.sell_through_rate - b.metrics.sell_through_rate
        : b.metrics.sell_through_rate - a.metrics.sell_through_rate)
    }

    return {
      success: true,
      data: {
        items: filteredItems,
        pagination: should_paginate ? {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1,
          returned: filteredItems.length,
          from: offset + 1,
          to: offset + filteredItems.length
        } : undefined,
        summary: {
          total_skus: total,
          filtered_count: filteredItems.length,
          with_images: items.filter(i => i.images.length > 0).length,
          with_attributes: items.filter(i => i.attributes.length > 0).length,
          with_stock: items.filter(i => i.stock_purchases.length > 0).length,
          in_stock: items.filter(i => i.metrics.total_remaining > 0).length,
          low_stock: items.filter(i => i.metrics.is_low_stock).length,
          out_of_stock: items.filter(i => i.metrics.is_out_of_stock).length,
          overstocked: items.filter(i => i.metrics.is_overstocked).length
        }
      }
    }

  } catch (error) {
    console.error('Error getting all skus:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to fetch skus.' }
  }
})


// ipcMain.handle('sku:get-by-id', async (_event, payload: { id: number; include_deleted?: boolean }) => {
//   try {
//     const { id, include_deleted = false } = payload

//     if (!id) {
//       return { success: false, message: 'SKU id is required.' }
//     }

//     /* ============================
//        FETCH SKU WITH PRODUCT DETAILS
//     ============================ */
//     const skuData = db()
//       .select({
//         // SKU fields
//         id: sku.id,
//         sync_id: sku.sync_id,
//         product_id: sku.product_id,
//         sku_name: sku.sku_name,
//         code: sku.code,
//         created_on: sku.created_on,
//         updated_on: sku.updated_on,
//         last_sync: sku.last_sync,
//         is_active: sku.is_active,
//         is_deleted: sku.is_deleted,
//         is_sync_required: sku.is_sync_required,

//         // Product fields
//         product_name: products.product_name,
//         product_is_active: products.is_active,
//         product_category_id: products.category_id
//       })
//       .from(sku)
//       .innerJoin(products, eq(sku.product_id, products.id))
//       .where(
//         and(
//           eq(sku.id, id),
//           include_deleted ? undefined : eq(sku.is_deleted, false)
//         )
//       )
//       .get()

//     if (!skuData) {
//       return { success: false, message: 'SKU not found.' }
//     }

//     /* ============================
//        FETCH CATEGORY DETAILS
//     ============================ */
//     const category = db()
//       .select({
//         id: product_categories.id,
//         name: product_categories.category_name,
//         is_active: product_categories.is_active
//       })
//       .from(product_categories)
//       .where(eq(product_categories.id, skuData.product_category_id))
//       .get()

//     /* ============================
//        FETCH SKU IMAGES
//     ============================ */
//     const images = db()
//       .select({
//         id: sku_images.id,
//         image: sku_images.image,
//         created_on: sku_images.created_on
//       })
//       .from(sku_images)
//       .where(
//         and(
//           eq(sku_images.sku_id, id),
//           eq(sku_images.is_deleted, false)
//         )
//       )
//       .orderBy(desc(sku_images.created_on))
//       .all()

//     // Parse image JSON
//     const parsedImages = images.map(img => ({
//       id: img.id,
//       ...(safeParse(img.image) || {}),
//       uploaded_at: img.created_on
//     }))

//     /* ============================
//        FETCH SKU ATTRIBUTES WITH DETAILS
//     ============================ */
//     const skuAttributes = db()
//       .select({
//         id: sku_attributes.id,
//         sync_id: sku_attributes.sync_id,
//         attribute_id: sku_attributes.attribute_id,
//         value: sku_attributes.value,
//         is_active: sku_attributes.is_active,
//         is_deleted: sku_attributes.is_deleted,
//         attribute_name: attributes.attribute_name,
//         unit: attributes.unit,
//         attribute_created_on: attributes.created_on
//       })
//       .from(sku_attributes)
//       .innerJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
//       .where(
//         and(
//           eq(sku_attributes.sku_id, id),
//           eq(sku_attributes.is_deleted, false)
//         )
//       )
//       .orderBy(asc(attributes.attribute_name))
//       .all()

//     /* ============================
//        FETCH STOCK PURCHASES WITH SUPPLIER DETAILS AND SALES DATA
//     ============================ */
//     const purchases = db()
//       .select({
//         // Purchase fields
//         id: stock_purchases.id,
//         sync_id: stock_purchases.sync_id,
//         quantity_bought: stock_purchases.quantity_bought,
//         price_per_unit: stock_purchases.price_per_unit,
//         total_price_bought: stock_purchases.total_price_bought,
//         shipping_cost: stock_purchases.shipping_cost,
//         min_selling_price: stock_purchases.min_selling_price,
//         max_selling_price: stock_purchases.max_selling_price,
//         manufacture_date: stock_purchases.manufacture_date,
//         expiry_date: stock_purchases.expiry_date,
//         batch_number: stock_purchases.batch_number,
//         purchased_on: stock_purchases.purchased_on,
//         arrived_on: stock_purchases.arrived_on,
        
//         // Supplier details
//         supplier_id: suppliers.id,
//         supplier_name: suppliers.supplier_name,
//         supplier_contact: suppliers.contact_person,
//         supplier_email: suppliers.email,
//         supplier_phone: suppliers.phone_number,
//         supplier_is_active: suppliers.is_active,
        
//         // Calculate sold quantity for this batch
//         sold_quantity: sql<number>`COALESCE((
//           SELECT SUM(${sales.quantity})
//           FROM ${sales}
//           WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
//           AND ${sales.is_deleted} = 0
//           AND ${sales.has_been_canceled} = 0
//           AND ${sales.status} = 'completed'
//         ), 0)`,
        
//         // Calculate revenue from this batch
//         revenue: sql<number>`COALESCE((
//           SELECT SUM(${sales.total_price})
//           FROM ${sales}
//           WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
//           AND ${sales.is_deleted} = 0
//           AND ${sales.has_been_canceled} = 0
//           AND ${sales.status} = 'completed'
//         ), 0)`,
        
//         // Calculate shipping cost from sales of this batch
//         shipping_from_sales: sql<number>`COALESCE((
//           SELECT SUM(${sales.shipping_cost})
//           FROM ${sales}
//           WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
//           AND ${sales.is_deleted} = 0
//           AND ${sales.has_been_canceled} = 0
//           AND ${sales.status} = 'completed'
//         ), 0)`,
        
//         // Count number of sales from this batch
//         sale_count: sql<number>`COALESCE((
//           SELECT COUNT(*)
//           FROM ${sales}
//           WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
//           AND ${sales.is_deleted} = 0
//           AND ${sales.has_been_canceled} = 0
//           AND ${sales.status} = 'completed'
//         ), 0)`
//       })
//       .from(stock_purchases)
//       .leftJoin(suppliers, eq(stock_purchases.supplier_id, suppliers.id))
//       .where(
//         and(
//           eq(stock_purchases.sku_id, id),
//           eq(stock_purchases.is_deleted, false)
//         )
//       )
//       .orderBy(desc(stock_purchases.purchased_on))
//       .all()

//     /* ============================
//        CALCULATE PURCHASE STATISTICS AND METRICS
//     ============================ */
    
//     // Calculate total quantity bought and sold
//     const totalQuantityBought = purchases.reduce((sum, p) => sum + p.quantity_bought, 0)
//     const totalQuantitySold = purchases.reduce((sum, p) => sum + (p.sold_quantity || 0), 0)
//     const totalQuantityRemaining = totalQuantityBought - totalQuantitySold
    
//     // Calculate financial metrics
//     const totalRevenue = purchases.reduce((sum, p) => sum + (p.revenue || 0), 0)
//     const totalCost = purchases.reduce((sum, p) => {
//       const landedCost = p.total_price_bought + (p.shipping_cost || 0)
//       const costOfSold = (landedCost / p.quantity_bought) * (p.sold_quantity || 0)
//       return sum + costOfSold
//     }, 0)
//     const totalShippingPaid = purchases.reduce((sum, p) => sum + (p.shipping_from_sales || 0), 0)
//     const totalProfit = totalRevenue - totalCost - totalShippingPaid
    
//     // Calculate average cost per unit (weighted by quantity)
//     const totalLandedCost = purchases.reduce((sum, p) => {
//       return sum + p.total_price_bought + (p.shipping_cost || 0)
//     }, 0)
//     const weightedAvgCostPerUnit = totalQuantityBought > 0 ? totalLandedCost / totalQuantityBought : 0
    
//     // Calculate average selling price
//     const avgSellingPrice = totalQuantitySold > 0 ? totalRevenue / totalQuantitySold : 0
    
//     // Calculate sell-through rate
//     const sellThroughRate = totalQuantityBought > 0 
//       ? (totalQuantitySold / totalQuantityBought) * 100 
//       : 0
    
//     // Calculate days of inventory (based on last 30 days sales)
//     const now = Math.floor(Date.now() / 1000)
//     const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
    
//     // We need to fetch recent sales for this calculation
//     const recentSales = db()
//       .select({
//         quantity: sales.quantity,
//         sold_on: sales.sold_on
//       })
//       .from(sales)
//       .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
//       .where(
//         and(
//           eq(stock_purchases.sku_id, id),
//           eq(sales.is_deleted, false),
//           eq(sales.has_been_canceled, false),
//           eq(sales.status, 'completed'),
//           sql`${sales.sold_on} >= ${thirtyDaysAgo}`
//         )
//       )
//       .all()
    
//     const last30DaysSales = recentSales.reduce((sum, s) => sum + s.quantity, 0)
//     const avgDailySales = last30DaysSales / 30
//     const daysOfInventory = avgDailySales > 0 ? totalQuantityRemaining / avgDailySales : 
//                            totalQuantityRemaining > 0 ? 999 : 0

//     /* ============================
//        FETCH RECENT SALES DETAILS
//     ============================ */
//     const salesHistory = db()
//       .select({
//         id: sales.id,
//         quantity: sales.quantity,
//         total_price: sales.total_price,
//         shipping_cost: sales.shipping_cost,
//         sold_on: sales.sold_on,
//         status: sales.status,
//         profit_margin: sql<number>`(
//           (${sales.total_price} - (
//             (${stock_purchases.total_price_bought} + COALESCE(${stock_purchases.shipping_cost}, 0)) * 
//             ${sales.quantity} / NULLIF(${stock_purchases.quantity_bought}, 1)
//           ) - COALESCE(${sales.shipping_cost}, 0)) * 100.0 / NULLIF(${sales.total_price}, 0)
//         )`
//       })
//       .from(sales)
//       .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
//       .where(
//         and(
//           eq(stock_purchases.sku_id, id),
//           eq(sales.is_deleted, false),
//           eq(sales.has_been_canceled, false),
//           eq(sales.status, 'completed')
//         )
//       )
//       .orderBy(desc(sales.sold_on))
//       .limit(20)
//       .all()

//     /* ============================
//        CALCULATE DYNAMIC LOW STOCK THRESHOLD
//     ============================ */
    
//     // Dynamic low stock calculation based on multiple factors:
//     // 1. Days of inventory (if less than 30 days, it's low)
//     // 2. Value of inventory (high-value items might have lower thresholds)
//     // 3. Sales velocity (fast movers need more stock)
//     // 4. Cost of stockout (lost sales vs carrying cost)
    
//     const avgCostPerUnit = weightedAvgCostPerUnit
//     // const inventoryValue = totalQuantityRemaining * avgCostPerUnit
    
//     // Determine low stock threshold based on:
//     // - Sales velocity (higher velocity = higher threshold)
//     // - Item value (higher value = lower threshold to avoid tying up cash)
//     // - Typical order patterns
//     let lowStockThreshold = 10 // Base threshold
    
//     if (avgDailySales > 5) {
//       // Fast mover: need more stock
//       lowStockThreshold = Math.ceil(avgDailySales * 14) // 2 weeks of stock
//     } else if (avgDailySales > 1) {
//       // Medium mover
//       lowStockThreshold = Math.ceil(avgDailySales * 21) // 3 weeks of stock
//     } else {
//       // Slow mover
//       lowStockThreshold = Math.ceil(avgDailySales * 30) // 1 month of stock
//     }
    
//     // Adjust for high-value items (reduce threshold to avoid tying up cash)
//     if (avgCostPerUnit > 100) {
//       lowStockThreshold = Math.floor(lowStockThreshold * 0.7)
//     } else if (avgCostPerUnit > 50) {
//       lowStockThreshold = Math.floor(lowStockThreshold * 0.85)
//     }
    
//     // Ensure minimum threshold
//     lowStockThreshold = Math.max(5, lowStockThreshold)
    
//     const isLowStock = totalQuantityRemaining > 0 && totalQuantityRemaining <= lowStockThreshold
//     const isOverstocked = daysOfInventory > 180 && totalQuantityRemaining > 0
//     const isOutOfStock = totalQuantityRemaining <= 0

//     /* ============================
//        FETCH SUPPLIER PERFORMANCE
//     ============================ */
//     const supplierPerformance = purchases
//       .filter(p => p.supplier_id)
//       .reduce((acc, p) => {
//         const supplierId = p.supplier_id
//         if (!supplierId) return acc
        
//         if (!acc[supplierId]) {
//           acc[supplierId] = {
//             id: supplierId,
//             name: p.supplier_name,
//             contact: p.supplier_contact,
//             total_spent: 0,
//             total_bought: 0,
//             total_sold: 0,
//             batches: 0,
//             last_purchase: null
//           }
//         }
        
//         acc[supplierId].total_spent += p.total_price_bought + (p.shipping_cost || 0)
//         acc[supplierId].total_bought += p.quantity_bought
//         acc[supplierId].total_sold += p.sold_quantity || 0
//         acc[supplierId].batches++
        
//         const purchaseDate = p.purchased_on
//         if (purchaseDate) { // Only compare if purchaseDate exists
//           if (!acc[supplierId].last_purchase || purchaseDate > acc[supplierId].last_purchase) {
//             acc[supplierId].last_purchase = purchaseDate
//           }
//         }

//         return acc
//       }, {} as Record<number, any>)

//     /* ============================
//        BUILD COMPLETE RESPONSE
//     ============================ */
//     return {
//       success: true,
//       data: {
//         // Basic SKU info
//         id: skuData.id,
//         sync_id: skuData.sync_id,
//         sku_name: skuData.sku_name,
//         code: skuData.code,
//         is_active: skuData.is_active === true,
//         is_deleted: skuData.is_deleted === true,
        
//         // Timestamps
//         timestamps: {
//           created_on: skuData.created_on,
//           updated_on: skuData.updated_on,
//           last_sync: skuData.last_sync
//         },

//         // Product details
//         product: {
//           id: skuData.product_id,
//           name: skuData.product_name,
//           is_active: skuData.product_is_active === true,
//           category: category ? {
//             id: category.id,
//             name: category.name,
//             is_active: category.is_active === 1
//           } : null
//         },

//         // Related data
//         images: parsedImages,
//         attributes: skuAttributes.map(a => ({
//           id: a.id,
//           sync_id: a.sync_id,
//           attribute_id: a.attribute_id,
//           name: a.attribute_name,
//           value: a.value,
//           unit: a.unit,
//           display_value: a.unit ? `${a.value} ${a.unit}` : a.value,
//           is_active: a.is_active === true
//         })),
        
//         // Stock purchases with complete metrics
//         stock_purchases: purchases.map(p => {
//           const landedCostPerUnit = (p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought
//           const remaining = p.quantity_bought - (p.sold_quantity || 0)
//           const profitFromBatch = (p.revenue || 0) - (landedCostPerUnit * (p.sold_quantity || 0)) - (p.shipping_from_sales || 0)
//           const marginFromBatch = (p.revenue || 0) > 0 ? (profitFromBatch / (p.revenue || 0)) * 100 : 0
          
//           return {
//             id: p.id,
//             sync_id: p.sync_id,
//             batch_number: p.batch_number,
            
//             quantities: {
//               bought: p.quantity_bought,
//               sold: p.sold_quantity || 0,
//               remaining: remaining
//             },
            
//             pricing: {
//               price_per_unit: p.price_per_unit,
//               landed_cost_per_unit: Number(landedCostPerUnit.toFixed(2)),
//               total_price: p.total_price_bought,
//               shipping_cost: p.shipping_cost,
//               selling_price_range: {
//                 min: p.min_selling_price,
//                 max: p.max_selling_price
//               }
//             },
            
//             financials: {
//               revenue: Number((p.revenue || 0).toFixed(2)),
//               cost: Number((landedCostPerUnit * (p.sold_quantity || 0)).toFixed(2)),
//               shipping_paid: Number((p.shipping_from_sales || 0).toFixed(2)),
//               profit: Number(profitFromBatch.toFixed(2)),
//               margin: Number(marginFromBatch.toFixed(2))
//             },
            
//             dates: {
//               purchased: p.purchased_on,
//               arrived: p.arrived_on,
//               manufacture: p.manufacture_date,
//               expiry: p.expiry_date
//             },
            
//             supplier: p.supplier_id ? {
//               id: p.supplier_id,
//               name: p.supplier_name,
//               contact: p.supplier_contact,
//               email: p.supplier_email,
//               phone: p.supplier_phone,
//               is_active: p.supplier_is_active === true
//             } : null,
            
//             performance: {
//               sale_count: p.sale_count || 0,
//               sell_through_rate: p.quantity_bought > 0 
//                 ? Number((((p.sold_quantity || 0) / p.quantity_bought) * 100).toFixed(1))
//                 : 0,
//               days_on_hand: p.purchased_on 
//                 ? Math.round((Date.now() / 1000 - Number(p.purchased_on)) / (24 * 60 * 60))
//                 : 0
//             }
//           }
//         }),

//         // Sales history
//         recent_sales: salesHistory.map(s => ({
//           id: s.id,
//           quantity: s.quantity,
//           total_price: Number(s.total_price.toFixed(2)),
//           shipping_cost: Number(s.shipping_cost?.toFixed(2) || 0),
//           sold_on: s.sold_on,
//           profit_margin: Number(s.profit_margin?.toFixed(2) || 0)
//         })),

//         // Core metrics
//         metrics: {
//           // Volume
//           total_bought: totalQuantityBought,
//           total_sold: totalQuantitySold,
//           total_remaining: totalQuantityRemaining,
          
//           // Financial
//           total_revenue: Number(totalRevenue.toFixed(2)),
//           total_cost: Number(totalCost.toFixed(2)),
//           total_shipping_paid: Number(totalShippingPaid.toFixed(2)),
//           total_profit: Number(totalProfit.toFixed(2)),
//           profit_margin: totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
          
//           // Per-unit
//           avg_cost_per_unit: Number(weightedAvgCostPerUnit.toFixed(2)),
//           avg_selling_price: Number(avgSellingPrice.toFixed(2)),
//           avg_profit_per_unit: totalQuantitySold > 0 ? Number((totalProfit / totalQuantitySold).toFixed(2)) : 0,
          
//           // Performance
//           sell_through_rate: Number(sellThroughRate.toFixed(1)),
//           days_of_inventory: Math.round(daysOfInventory),
//           last_30_days_sales: last30DaysSales,
//           avg_daily_sales: Number(avgDailySales.toFixed(2)),
          
//           // Value
//           inventory_value: Number((totalQuantityRemaining * weightedAvgCostPerUnit).toFixed(2)),
//           potential_revenue: Number((totalQuantityRemaining * avgSellingPrice).toFixed(2))
//         },

//         // Statistics
//         statistics: {
//           images: {
//             count: parsedImages.length
//           },
//           attributes: {
//             count: skuAttributes.length,
//             active_count: skuAttributes.filter(a => a.is_active).length
//           },
//           purchases: {
//             total_purchases: purchases.length,
//             total_quantity_bought: totalQuantityBought,
//             total_quantity_sold: totalQuantitySold,
//             total_quantity_remaining: totalQuantityRemaining,
//             total_cost: Number(purchases.reduce((sum, p) => sum + p.total_price_bought, 0).toFixed(2)),
//             average_price_per_unit: Number((purchases.reduce((sum, p) => sum + p.price_per_unit, 0) / (purchases.length || 1)).toFixed(2)),
//             average_profit_margin: purchases.length > 0
//               ? Number((purchases.reduce((sum, p) => {
//                   const landedCost = p.total_price_bought + (p.shipping_cost || 0)
//                   const revenue = p.revenue || 0
//                   const profit = revenue - (landedCost / p.quantity_bought * (p.sold_quantity || 0)) - (p.shipping_from_sales || 0)
//                   return sum + (revenue > 0 ? (profit / revenue) * 100 : 0)
//                 }, 0) / purchases.length).toFixed(2))
//               : 0,
//             unique_suppliers: [...new Set(purchases.map(p => p.supplier_id).filter(Boolean))].length,
//             last_purchase_date: purchases[0]?.purchased_on || null,
//             first_purchase_date: purchases[purchases.length - 1]?.purchased_on || null
//           },
//           sales: {
//             count: salesHistory.length,
//             total_revenue: Number(salesHistory.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)),
//             average_sale_value: salesHistory.length > 0
//               ? Number((salesHistory.reduce((sum, s) => sum + s.total_price, 0) / salesHistory.length).toFixed(2))
//               : 0,
//             last_sale_date: salesHistory[0]?.sold_on || null
//           }
//         },

//         // Supplier performance
//         supplier_performance: Object.values(supplierPerformance).map((s: any) => ({
//           id: s.id,
//           name: s.name,
//           contact: s.contact,
//           total_spent: Number(s.total_spent.toFixed(2)),
//           total_bought: s.total_bought,
//           total_sold: s.total_sold,
//           sell_through_rate: s.total_bought > 0 ? Number(((s.total_sold / s.total_bought) * 100).toFixed(1)) : 0,
//           batches: s.batches,
//           last_purchase: s.last_purchase
//         })),

//         // Summary flags
//         summary: {
//           has_images: parsedImages.length > 0,
//           has_attributes: skuAttributes.length > 0,
//           has_stock: purchases.length > 0 && totalQuantityRemaining > 0,
//           has_supplier: [...new Set(purchases.map(p => p.supplier_id).filter(Boolean))].length > 0,
//           has_sales: salesHistory.length > 0,
          
//           // Dynamic stock status
//           stock_status: isOutOfStock ? 'Out of Stock' : 
//                         isLowStock ? 'Low Stock' : 
//                         isOverstocked ? 'Overstocked' : 'In Stock',
//           is_low_stock: isLowStock,
//           is_overstocked: isOverstocked,
//           is_out_of_stock: isOutOfStock,
//           is_profitable: totalProfit > 0,
          
//           is_active: skuData.is_active === true && skuData.is_deleted === false,
          
//           // Dynamic thresholds
//           low_stock_threshold: lowStockThreshold,
//           recommended_reorder_quantity: Math.max(
//             Math.ceil(avgDailySales * 30) - totalQuantityRemaining,
//             0
//           )
//         }
//       }
//     }

//   } catch (error) {
//     console.error('Error fetching SKU by id:', error)
//     return { 
//       success: false, 
//       message: error instanceof Error ? error.message : 'Failed to fetch SKU.' 
//     }
//   }
// })


ipcMain.handle(
  'sku:soft-delete',
  async (_event, payload: { 
    id: number; 
    cascade?: boolean;
    restore?: boolean;
  }) => {
    try {
      const cascade = payload.cascade ?? true
      const isRestore = payload.restore ?? false
      const action = isRestore ? 'restore' : 'delete'
      const actionPastTense = isRestore ? 'restored' : 'deleted'

      if (!payload.id) {
        return { 
          success: false, 
          message: `SKU ID is required for ${action}.` 
        }
      }

      /* ============================
         CHECK IF SKU EXISTS
      ============================ */
      const skuData = db()
        .select({ 
          id: sku.id,
          sku_name: sku.sku_name,
          code: sku.code,
          is_deleted: sku.is_deleted,
          product_id: sku.product_id,
          is_active: sku.is_active
        })
        .from(sku)
        .where(eq(sku.id, payload.id))
        .get()

      if (!skuData) {
        return { 
          success: false, 
          message: `SKU with ID ${payload.id} not found.` 
        }
      }

      // Check if already in desired state
      if (isRestore && !skuData.is_deleted) {
        return { 
          success: false, 
          message: 'SKU is already active (not deleted).' 
        }
      }
      if (!isRestore && skuData.is_deleted) {
        return { 
          success: false, 
          message: 'SKU is already deleted.' 
        }
      }

      /* ============================
         PERFORM SOFT DELETE/RESTORE IN TRANSACTION
      ============================ */
      const result = db().transaction(() => {
        try {
          const affectedItems: Record<string, any> = {
            sku: {
              id: payload.id,
              name: skuData.sku_name,
              code: skuData.code,
              action: action
            }
          }

          /* ============================
             STAGE 1: UPDATE THE SKU ITSELF
          ============================ */
          db()
            .update(sku)
            .set({
              is_deleted: isRestore ? false : true,
              updated_on: sql`(strftime('%s', 'now'))`,
              is_sync_required: true
            })
            .where(eq(sku.id, payload.id))
            .run()

          // Mark the product for sync
          db()
            .update(products)
            .set({
              is_sync_required: true,
              updated_on: sql`(strftime('%s', 'now'))`
            })
            .where(eq(products.id, skuData.product_id))
            .run()
          
          affectedItems.product_updated = true

          /* ============================
             STAGE 2: CHECK FOR CHILD ITEMS (IF NOT CASCADING)
          ============================ */
          if (!cascade) {
            // Check for SKU images
            const imageCount = db()
              .select({ count: sql<number>`COUNT(*)` })
              .from(sku_images)
              .where(
                and(
                  eq(sku_images.sku_id, payload.id),
                  isRestore ? eq(sku_images.is_deleted, true) : eq(sku_images.is_deleted, false)
                )
              )
              .get()

            if (Number(imageCount?.count ?? 0) > 0) {
              throw new Error(
                `Cannot ${action} SKU with existing images. Use cascade=true to ${action} all.`
              )
            }

            // Check for SKU attributes
            const attrCount = db()
              .select({ count: sql<number>`COUNT(*)` })
              .from(sku_attributes)
              .where(
                and(
                  eq(sku_attributes.sku_id, payload.id),
                  isRestore ? eq(sku_attributes.is_deleted, true) : eq(sku_attributes.is_deleted, false)
                )
              )
              .get()

            if (Number(attrCount?.count ?? 0) > 0) {
              throw new Error(
                `Cannot ${action} SKU with existing attributes. Use cascade=true to ${action} all.`
              )
            }

            // Check for stock purchases
            const purchaseCount = db()
              .select({ count: sql<number>`COUNT(*)` })
              .from(stock_purchases)
              .where(
                and(
                  eq(stock_purchases.sku_id, payload.id),
                  isRestore ? eq(stock_purchases.is_deleted, true) : eq(stock_purchases.is_deleted, false)
                )
              )
              .get()

            if (Number(purchaseCount?.count ?? 0) > 0) {
              throw new Error(
                `Cannot ${action} SKU with existing stock purchases. Use cascade=true to ${action} all.`
              )
            }

            // If no child items, just return success for the SKU alone
            return {
              success: true,
              message: `SKU "${skuData.sku_name}" (${skuData.code}) ${actionPastTense} successfully.`,
              data: {
                id: payload.id,
                sku_name: skuData.sku_name,
                code: skuData.code,
                product_id: skuData.product_id,
                action: action,
                cascaded: false,
                timestamp: Math.floor(Date.now() / 1000),
                affected: {
                  sku: 1,
                  details: affectedItems
                }
              }
            }
          }

          /* ============================
             STAGE 3: CREATE CONTEXT FOR RELATIONSHIP HANDLERS
          ============================ */
          
          // Create context for relationship handlers
          const context: RelationshipContext = {
            db: db(),
            tables: {
              product_image, // Not directly related to SKU, but kept for consistency
              sku,
              sku_images,
              sku_attributes,
              stock_purchases,
              suppliers
            },
            helpers: {
              getChildIds: (table, foreignKey, parentIds, isRestore) => {
                if (parentIds.length === 0) return []
                
                return db()
                  .select({ id: table.id })
                  .from(table)
                  .where(
                    and(
                      inArray(table[foreignKey], parentIds),
                      isRestore ? eq(table.is_deleted, true) : eq(table.is_deleted, false)
                    )
                  )
                  .all()
                  .map(row => row.id)
              },
              updateBulk: (table, ids, isRestore) => {
                if (ids.length === 0) return
                
                db()
                  .update(table)
                  .set({
                    is_deleted: isRestore ? false : true,
                    updated_on: sql`(strftime('%s', 'now'))`,
                    is_sync_required: true
                  })
                  .where(inArray(table.id, ids))
                  .run()
              }
            }
          }

          /* ============================
             STAGE 4: HANDLE SKU IMAGES
          ============================ */
          const skuImageIds = context.helpers.getChildIds(
            sku_images,
            'sku_id',
            [payload.id],
            isRestore
          )
          
          if (skuImageIds.length > 0) {
            context.helpers.updateBulk(sku_images, skuImageIds, isRestore)
            affectedItems.sku_images = skuImageIds
          }

          /* ============================
             STAGE 5: HANDLE SKU ATTRIBUTES
          ============================ */
          const skuAttributeIds = context.helpers.getChildIds(
            sku_attributes,
            'sku_id',
            [payload.id],
            isRestore
          )
          
          if (skuAttributeIds.length > 0) {
            context.helpers.updateBulk(sku_attributes, skuAttributeIds, isRestore)
            affectedItems.sku_attributes = skuAttributeIds
          }

          /* ============================
             STAGE 6: HANDLE STOCK PURCHASES
          ============================ */
          const purchaseIds = context.helpers.getChildIds(
            stock_purchases,
            'sku_id',
            [payload.id],
            isRestore
          )
          
          if (purchaseIds.length > 0) {
            context.helpers.updateBulk(stock_purchases, purchaseIds, isRestore)
            affectedItems.stock_purchases = purchaseIds

            // Handle supplier sync for restored purchases
            if (isRestore && purchaseIds.length > 0) {
              const supplierIds = [...new Set(
                db()
                  .select({ supplier_id: stock_purchases.supplier_id })
                  .from(stock_purchases)
                  .where(inArray(stock_purchases.id, purchaseIds))
                  .all()
                  .map(p => p.supplier_id)
                  .filter((id): id is number => id !== null && id !== undefined)
              )]

              if (supplierIds.length > 0) {
                db()
                  .update(suppliers)
                  .set({
                    is_sync_required: true,
                    updated_on: sql`(strftime('%s', 'now'))`
                  })
                  .where(inArray(suppliers.id, supplierIds))
                  .run()
                
                affectedItems.suppliers_updated = supplierIds.length
              }
            }
          }

          /* ============================
             STAGE 7: CALCULATE TOTALS FOR RESPONSE
          ============================ */
          const totals = {
            sku_images: affectedItems.sku_images?.length || 0,
            sku_attributes: affectedItems.sku_attributes?.length || 0,
            stock_purchases: affectedItems.stock_purchases?.length || 0
          }

          /* ============================
             RETURN SUCCESS WITH AFFECTED ITEMS
          ============================ */
          return {
            success: true,
            message: `SKU "${skuData.sku_name}" (${skuData.code}) and all related items ${actionPastTense} successfully.`,
            data: {
              id: payload.id,
              sku_name: skuData.sku_name,
              code: skuData.code,
              product_id: skuData.product_id,
              action: action,
              cascaded: true,
              timestamp: Math.floor(Date.now() / 1000),
              affected: {
                ...totals,
                total: Object.values(totals).reduce((a, b) => a + b, 0) + 1, // +1 for the SKU itself
                details: affectedItems
              }
            }
          }

        } catch (error) {
          console.error('Transaction error:', error)
          throw error // Rollback transaction
        }
      })

      return result

    } catch (error) {
      console.error(`Error in SKU soft-delete/restore:`, error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} SKU.` 
      }
    }
  }
)


ipcMain.handle('attributes:create', async (_event, payload: CreateAttributePayload) => {
  try {
    /* ============================
       VALIDATION
    ============================ */
    if (!payload.attribute_name?.trim()) {
      return { success: false, message: 'Attribute name is required.' }
    }

    const attributeName = payload.attribute_name.trim()
    const unit = payload.unit?.trim() || ''

    /* ============================
       CHECK FOR DUPLICATE NAME
    ============================ */
    const existing = db()
      .select({ id: attributes.id })
      .from(attributes)
      .where(
        and(
          eq(attributes.attribute_name, attributeName),
          eq(attributes.is_deleted, false)
        )
      )
      .get()

    if (existing) {
      return { success: false, message: 'Attribute with this name already exists.' }
    }

    /* ============================
       INSERT ATTRIBUTE
    ============================ */
    const result = db()
      .insert(attributes)
      .values({
        attribute_name: attributeName,
        unit: unit,
        is_active: payload.is_active ?? true,
        sync_id: randomUUID(),
        created_on: sql`(strftime('%s', 'now'))`,
        updated_on: sql`(strftime('%s', 'now'))`
      })
      .run()

    const attributeId = Number(result.lastInsertRowid)

    /* ============================
       FETCH CREATED ATTRIBUTE
    ============================ */
    const newAttribute = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit,
        is_active: attributes.is_active,
        created_on: attributes.created_on
      })
      .from(attributes)
      .where(eq(attributes.id, attributeId))
      .get()

    return {
      success: true,
      message: 'Attribute created successfully.',
      data: newAttribute
    }

  } catch (error) {
    console.error('Error creating attribute:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create attribute.'
    }
  }
})


ipcMain.handle('attributes:get-all', async (_event, payload?: GetAllAttributesPayload) => {
  try {
    const {
      is_active = 'both',
      is_deleted = 'both',
      is_sync_required = 'both',
      search,
      has_units,
      should_paginate = true,
      page = 1,
      limit = 20,
      sort_by = 'attribute_name',
      sort_order = 'asc',
      with_sku_count = false
    } = payload || {}

    const offset = (page - 1) * limit

    /* ============================
       BUILD WHERE CONDITIONS
    ============================ */
    const conditions: SQL[] = []

    // Apply tri-state filters
    if (is_active !== 'both') {
      conditions.push(eq(attributes.is_active, is_active === 'yes'))
    }
    if (is_deleted !== 'both') {
      conditions.push(eq(attributes.is_deleted, is_deleted === 'yes'))
    }
    if (is_sync_required !== 'both') {
      conditions.push(eq(attributes.is_sync_required, is_sync_required === 'yes'))
    }

    // Search filter
    if (search) {
      conditions.push(
        or(
          like(attributes.attribute_name, `%${search}%`),
          like(attributes.unit, `%${search}%`)
        ) as SQL
      )
    }

    // Units filter
    if (has_units !== undefined) {
      if (has_units) {
        conditions.push(sql`${attributes.unit} != ''`)
      } else {
        conditions.push(sql`${attributes.unit} = ''`)
      }
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    /* ============================
       GET TOTAL COUNT
    ============================ */
    const countResult = db()
      .select({ count: sql<number>`COUNT(*)` })
      .from(attributes)
      .where(whereConditions)
      .get()

    const total = countResult?.count ?? 0

    /* ============================
       BUILD ORDER BY
    ============================ */
    let orderByClause
    switch (sort_by) {
      case 'attribute_name':
        orderByClause = sort_order === 'asc' ? sql`${attributes.attribute_name} ASC` : sql`${attributes.attribute_name} DESC`
        break
      case 'unit':
        orderByClause = sort_order === 'asc' ? sql`${attributes.unit} ASC` : sql`${attributes.unit} DESC`
        break
      case 'created_on':
        orderByClause = sort_order === 'asc' ? sql`${attributes.created_on} ASC` : sql`${attributes.created_on} DESC`
        break
      default:
        orderByClause = sql`${attributes.attribute_name} ASC`
    }

    /* ============================
       FETCH ATTRIBUTES
    ============================ */
    let query = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit,
        sync_id: attributes.sync_id,
        created_on: attributes.created_on,
        updated_on: attributes.updated_on,
        last_sync: attributes.last_sync,
        is_active: attributes.is_active,
        is_deleted: attributes.is_deleted,
        is_sync_required: attributes.is_sync_required
      })
      .from(attributes)
      .where(whereConditions)
      .orderBy(orderByClause)

    const attributeList = should_paginate
      ? query.limit(limit).offset(offset).all()
      : query.all()

    /* ============================
       FETCH SKU COUNTS (IF REQUESTED)
    ============================ */
    let skuCountMap = new Map<number, number>()

    if (with_sku_count && attributeList.length > 0) {
      const attributeIds = attributeList.map(a => a.id)

      const skuCounts = db()
        .select({
          attribute_id: sku_attributes.attribute_id,
          count: sql<number>`COUNT(DISTINCT ${sku_attributes.sku_id})`
        })
        .from(sku_attributes)
        .where(
          and(
            inArray(sku_attributes.attribute_id, attributeIds),
            eq(sku_attributes.is_deleted, false)
          )
        )
        .groupBy(sku_attributes.attribute_id)
        .all()

      skuCountMap = new Map(skuCounts.map(s => [s.attribute_id, s.count]))
    }

    /* ============================
       BUILD RESPONSE
    ============================ */
    const items = attributeList.map(attr => ({
      ...attr,
      sku_count: skuCountMap.get(attr.id) || 0,
      unit_display: attr.unit || '(no unit)'
    }))

    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        items,
        pagination: should_paginate ? {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
          returned: items.length,
          from: offset + 1,
          to: offset + items.length
        } : undefined,
        summary: {
          total_attributes: total,
          with_units: items.filter(i => i.unit).length,
          without_units: items.filter(i => !i.unit).length
        }
      }
    }

  } catch (error) {
    console.error('Error fetching attributes:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attributes.'
    }
  }
})


ipcMain.handle('attributes:get-by-id', async (_event, payload: GetAttributeByIdPayload) => {
  try {
    const { id, include_deleted = false, with_sku_details = false } = payload

    if (!id) {
      return { success: false, message: 'Attribute ID is required.' }
    }

    /* ============================
       FETCH ATTRIBUTE
    ============================ */
    const attribute = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit,
        sync_id: attributes.sync_id,
        created_on: attributes.created_on,
        updated_on: attributes.updated_on,
        last_sync: attributes.last_sync,
        is_active: attributes.is_active,
        is_deleted: attributes.is_deleted,
        is_sync_required: attributes.is_sync_required
      })
      .from(attributes)
      .where(
        and(
          eq(attributes.id, id),
          include_deleted ? undefined : eq(attributes.is_deleted, false)
        )
      )
      .get()

    if (!attribute) {
      return { success: false, message: 'Attribute not found.' }
    }

    /* ============================
       FETCH SKU ATTRIBUTES FOR THIS ATTRIBUTE
    ============================ */
    const skuAttributeList = db()
      .select({
        id: sku_attributes.id,
        sku_id: sku_attributes.sku_id,
        value: sku_attributes.value,
        is_active: sku_attributes.is_active,
        sku_name: sku.sku_name,
        sku_code: sku.code,
        product_id: sku.product_id,
        product_name: products.product_name
      })
      .from(sku_attributes)
      .innerJoin(sku, eq(sku_attributes.sku_id, sku.id))
      .innerJoin(products, eq(sku.product_id, products.id))
      .where(
        and(
          eq(sku_attributes.attribute_id, id),
          eq(sku_attributes.is_deleted, false)
        )
      )
      .limit(with_sku_details ? 100 : 10) // Limit if not requesting full details
      .all()

    /* ============================
       CALCULATE STATISTICS
    ============================ */
    const stats = {
      total_skus: skuAttributeList.length,
      unique_values: [...new Set(skuAttributeList.map(s => s.value))].length,
      active_skus: skuAttributeList.filter(s => s.is_active).length,
      sample_values: [...new Set(skuAttributeList.map(s => s.value))].slice(0, 5)
    }

    /* ============================
       BUILD RESPONSE
    ============================ */
    return {
      success: true,
      data: {
        ...attribute,
        unit_display: attribute.unit || '(no unit)',
        statistics: stats,
        sku_attributes: with_sku_details ? skuAttributeList.map(sa => ({
          id: sa.id,
          sku: {
            id: sa.sku_id,
            name: sa.sku_name,
            code: sa.sku_code,
            product: {
              id: sa.product_id,
              name: sa.product_name
            }
          },
          value: sa.value,
          is_active: sa.is_active
        })) : undefined,
        sku_count: stats.total_skus,
        value_count: stats.unique_values
      }
    }

  } catch (error) {
    console.error('Error fetching attribute by id:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attribute.'
    }
  }
})


ipcMain.handle('attributes:update', async (_event, payload: UpdateAttributePayload) => {
  try {
    const { id } = payload

    if (!id) {
      return { success: false, message: 'Attribute ID is required.' }
    }

    /* ============================
       CHECK IF ATTRIBUTE EXISTS
    ============================ */
    const existing = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit
      })
      .from(attributes)
      .where(and(eq(attributes.id, id), eq(attributes.is_deleted, false)))
      .get()

    if (!existing) {
      return { success: false, message: 'Attribute not found.' }
    }

    /* ============================
       BUILD UPDATE DATA
    ============================ */
    const updateData: any = {
      updated_on: sql`(strftime('%s', 'now'))`,
      is_sync_required: true
    }

    if (payload.attribute_name !== undefined) {
      const newName = payload.attribute_name.trim()
      if (!newName) {
        return { success: false, message: 'Attribute name cannot be empty.' }
      }

      // Check for duplicate name (excluding current attribute)
      if (newName !== existing.attribute_name) {
        const duplicate = db()
          .select({ id: attributes.id })
          .from(attributes)
          .where(
            and(
              eq(attributes.attribute_name, newName),
              eq(attributes.is_deleted, false),
              sql`${attributes.id} != ${id}`
            )
          )
          .get()

        if (duplicate) {
          return { success: false, message: 'Another attribute with this name already exists.' }
        }
      }

      updateData.attribute_name = newName
    }

    if (payload.unit !== undefined) {
      updateData.unit = payload.unit?.trim() || ''
    }

    if (payload.is_active !== undefined) {
      updateData.is_active = payload.is_active
    }

    /* ============================
       PERFORM UPDATE
    ============================ */
    db()
      .update(attributes)
      .set(updateData)
      .where(eq(attributes.id, id))
      .run()

    /* ============================
       FETCH UPDATED ATTRIBUTE
    ============================ */
    const updated = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit,
        is_active: attributes.is_active,
        updated_on: attributes.updated_on
      })
      .from(attributes)
      .where(eq(attributes.id, id))
      .get()

    return {
      success: true,
      message: 'Attribute updated successfully.',
      data: updated
    }

  } catch (error) {
    console.error('Error updating attribute:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update attribute.'
    }
  }
})


ipcMain.handle('attributes:soft-delete', async (_event, payload: DeleteAttributePayload) => {
  try {
    const { id, cascade = false, restore = false } = payload
    const action = restore ? 'restore' : 'delete'
    const actionPastTense = restore ? 'restored' : 'deleted'

    if (!id) {
      return { success: false, message: `Attribute ID is required for ${action}.` }
    }

    /* ============================
       CHECK IF ATTRIBUTE EXISTS
    ============================ */
    const attribute = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        is_deleted: attributes.is_deleted
      })
      .from(attributes)
      .where(eq(attributes.id, id))
      .get()

    if (!attribute) {
      return { success: false, message: 'Attribute not found.' }
    }

    // Check if already in desired state
    if (restore && !attribute.is_deleted) {
      return { success: false, message: 'Attribute is already active.' }
    }
    if (!restore && attribute.is_deleted) {
      return { success: false, message: 'Attribute is already deleted.' }
    }

    /* ============================
       CHECK FOR SKU ATTRIBUTES IF NOT CASCADING
    ============================ */
    if (!cascade) {
      const skuAttributeCount = db()
        .select({ count: sql<number>`COUNT(*)` })
        .from(sku_attributes)
        .where(
          and(
            eq(sku_attributes.attribute_id, id),
            restore ? eq(sku_attributes.is_deleted, true) : eq(sku_attributes.is_deleted, false)
          )
        )
        .get()

      if (Number(skuAttributeCount?.count ?? 0) > 0) {
        throw new Error(
          `Cannot ${action} attribute that is in use by SKUs. Use cascade=true to ${action} all.`
        )
      }
    }

    /* ============================
       PERFORM IN TRANSACTION
    ============================ */
    const result = db().transaction(() => {
      try {
        const affectedItems: Record<string, any> = {
          attribute: {
            id,
            name: attribute.attribute_name,
            action
          }
        }

        /* ============================
           UPDATE ATTRIBUTE ITSELF
        ============================ */
        db()
          .update(attributes)
          .set({
            is_deleted: restore ? false : true,
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          })
          .where(eq(attributes.id, id))
          .run()

        /* ============================
           CASCADE TO SKU ATTRIBUTES (IF REQUESTED)
        ============================ */
        if (cascade) {
          const skuAttributeIds = db()
            .select({ id: sku_attributes.id })
            .from(sku_attributes)
            .where(
              and(
                eq(sku_attributes.attribute_id, id),
                restore ? eq(sku_attributes.is_deleted, true) : eq(sku_attributes.is_deleted, false)
              )
            )
            .all()
            .map(sa => sa.id)

          if (skuAttributeIds.length > 0) {
            db()
              .update(sku_attributes)
              .set({
                is_deleted: restore ? false : true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(sku_attributes.id, skuAttributeIds))
              .run()

            affectedItems.sku_attributes = skuAttributeIds
          }
        }

        return {
          success: true,
          message: `Attribute "${attribute.attribute_name}" ${actionPastTense} successfully.${cascade ? ' Cascaded to SKU attributes.' : ''}`,
          data: {
            id,
            attribute_name: attribute.attribute_name,
            action,
            cascaded: cascade,
            affected: {
              sku_attributes: affectedItems.sku_attributes?.length || 0,
              details: affectedItems
            }
          }
        }

      } catch (error) {
        console.error('Transaction error:', error)
        throw error
      }
    })

    return result

  } catch (error) {
    console.error(`Error in attribute ${payload.restore ? 'restore' : 'delete'}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} attribute.`
    }
  }
})


ipcMain.handle('sku-attributes:create', async (_event, payload: CreateSkuAttributePayload) => {
  try {
    const { sku_id, attribute_id, value, is_active = true } = payload

    /* ============================
       VALIDATION
    ============================ */
    if (!sku_id) {
      return { success: false, message: 'SKU ID is required.' }
    }

    if (!attribute_id) {
      return { success: false, message: 'Attribute ID is required.' }
    }

    if (!value?.trim()) {
      return { success: false, message: 'Attribute value is required.' }
    }

    const trimmedValue = value.trim()

    /* ============================
       CHECK IF SKU EXISTS
    ============================ */
    const skuExists = db()
      .select({ id: sku.id })
      .from(sku)
      .where(and(eq(sku.id, sku_id), eq(sku.is_deleted, false)))
      .get()

    if (!skuExists) {
      return { success: false, message: 'SKU not found.' }
    }

    /* ============================
       CHECK IF ATTRIBUTE EXISTS
    ============================ */
    const attributeExists = db()
      .select({
        id: attributes.id,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit
      })
      .from(attributes)
      .where(and(eq(attributes.id, attribute_id), eq(attributes.is_deleted, false)))
      .get()

    if (!attributeExists) {
      return { success: false, message: 'Attribute not found.' }
    }

    /* ============================
       CHECK FOR DUPLICATE (SKU + ATTRIBUTE)
    ============================ */
    const existing = db()
      .select({ id: sku_attributes.id })
      .from(sku_attributes)
      .where(
        and(
          eq(sku_attributes.sku_id, sku_id),
          eq(sku_attributes.attribute_id, attribute_id),
          eq(sku_attributes.is_deleted, false)
        )
      )
      .get()

    if (existing) {
      return {
        success: false,
        message: `Attribute "${attributeExists.attribute_name}" already exists for this SKU.`
      }
    }

    /* ============================
       INSERT SKU ATTRIBUTE
    ============================ */
    const result = db()
      .insert(sku_attributes)
      .values({
        sku_id,
        attribute_id,
        value: trimmedValue,
        is_active,
        sync_id: randomUUID(),
        created_on: sql`(strftime('%s', 'now'))`,
        updated_on: sql`(strftime('%s', 'now'))`
      })
      .run()

    const skuAttributeId = Number(result.lastInsertRowid)

    /* ============================
       FETCH CREATED SKU ATTRIBUTE WITH DETAILS
    ============================ */
    const newSkuAttribute = db()
      .select({
        id: sku_attributes.id,
        sku_id: sku_attributes.sku_id,
        attribute_id: sku_attributes.attribute_id,
        value: sku_attributes.value,
        is_active: sku_attributes.is_active,
        created_on: sku_attributes.created_on,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit,
        sku_name: sku.sku_name,
        sku_code: sku.code
      })
      .from(sku_attributes)
      .innerJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
      .innerJoin(sku, eq(sku_attributes.sku_id, sku.id))
      .where(eq(sku_attributes.id, skuAttributeId))
      .get()

    return {
      success: true,
      message: 'SKU attribute created successfully.',
      data: newSkuAttribute
    }

  } catch (error) {
    console.error('Error creating SKU attribute:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create SKU attribute.'
    }
  }
})


ipcMain.handle('sku-attributes:get-all', async (_event, payload?: GetAllSkuAttributesPayload) => {
  try {
    const {
      sku_id,
      attribute_id,
      is_active = 'both',
      is_deleted = 'both',
      search,
      should_paginate = true,
      page = 1,
      limit = 20,
      sort_by = 'attribute_name',
      sort_order = 'asc',
      with_sku_details = true,
      with_attribute_details = true
    } = payload || {}

    const offset = (page - 1) * limit

    /* ============================
       BUILD WHERE CONDITIONS
    ============================ */
    const conditions: SQL[] = []

    // SKU filter
    if (sku_id) {
      if (Array.isArray(sku_id)) {
        conditions.push(inArray(sku_attributes.sku_id, sku_id))
      } else {
        conditions.push(eq(sku_attributes.sku_id, sku_id))
      }
    }

    // Attribute filter
    if (attribute_id) {
      if (Array.isArray(attribute_id)) {
        conditions.push(inArray(sku_attributes.attribute_id, attribute_id))
      } else {
        conditions.push(eq(sku_attributes.attribute_id, attribute_id))
      }
    }

    // Apply tri-state filters
    if (is_active !== 'both') {
      conditions.push(eq(sku_attributes.is_active, is_active === 'yes'))
    }
    if (is_deleted !== 'both') {
      conditions.push(eq(sku_attributes.is_deleted, is_deleted === 'yes'))
    }

    // Search filter (in attribute name or value)
    if (search) {
      conditions.push(
        sql`(
          EXISTS (
            SELECT 1 FROM ${attributes}
            WHERE ${attributes.id} = ${sku_attributes.attribute_id}
            AND ${attributes.attribute_name} LIKE ${`%${search}%`}
          )
          OR ${sku_attributes.value} LIKE ${`%${search}%`}
        )`
      )
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    /* ============================
       GET TOTAL COUNT
    ============================ */
    const countResult = db()
      .select({ count: sql<number>`COUNT(*)` })
      .from(sku_attributes)
      .where(whereConditions)
      .get()

    const total = countResult?.count ?? 0

    /* ============================
       BUILD ORDER BY CLAUSE
    ============================ */
    let orderByClause: SQL

    switch (sort_by) {
      case 'value':
        orderByClause = sort_order === 'asc'
          ? sql`${sku_attributes.value} ASC`
          : sql`${sku_attributes.value} DESC`
        break
      case 'created_on':
        orderByClause = sort_order === 'asc'
          ? sql`${sku_attributes.created_on} ASC`
          : sql`${sku_attributes.created_on} DESC`
        break
      case 'attribute_name':
      default:
        // Use a subquery to get the attribute name for sorting
        orderByClause = sort_order === 'asc'
          ? sql`(
              SELECT ${attributes.attribute_name} 
              FROM ${attributes} 
              WHERE ${attributes.id} = ${sku_attributes.attribute_id}
            ) ASC`
          : sql`(
              SELECT ${attributes.attribute_name} 
              FROM ${attributes} 
              WHERE ${attributes.id} = ${sku_attributes.attribute_id}
            ) DESC`
        break
    }

    /* ============================
       FETCH SKU ATTRIBUTES
    ============================ */
    const baseQuery = db()
      .select({
        id: sku_attributes.id,
        sku_id: sku_attributes.sku_id,
        attribute_id: sku_attributes.attribute_id,
        value: sku_attributes.value,
        is_active: sku_attributes.is_active,
        is_deleted: sku_attributes.is_deleted,
        created_on: sku_attributes.created_on,
        updated_on: sku_attributes.updated_on
      })
      .from(sku_attributes)
      .where(whereConditions)
      .orderBy(orderByClause)

    const skuAttributeList = should_paginate
      ? baseQuery.limit(limit).offset(offset).all()
      : baseQuery.all()

    if (skuAttributeList.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          pagination: should_paginate ? {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false,
            returned: 0
          } : undefined
        }
      }
    }

    /* ============================
       FETCH RELATED DATA
    ============================ */
    const skuIds = [...new Set(skuAttributeList.map(sa => sa.sku_id))]
    const attributeIds = [...new Set(skuAttributeList.map(sa => sa.attribute_id))]

    // Fetch SKU details
    let skuMap = new Map()
    if (with_sku_details && skuIds.length > 0) {
      const skuDetails = db()
        .select({
          id: sku.id,
          sku_name: sku.sku_name,
          code: sku.code,
          product_id: sku.product_id
        })
        .from(sku)
        .where(inArray(sku.id, skuIds))
        .all()
      
      skuMap = new Map(skuDetails.map(s => [s.id, s]))
    }

    // Fetch attribute details
    let attributeMap = new Map()
    if (with_attribute_details && attributeIds.length > 0) {
      const attributeDetails = db()
        .select({
          id: attributes.id,
          attribute_name: attributes.attribute_name,
          unit: attributes.unit
        })
        .from(attributes)
        .where(inArray(attributes.id, attributeIds))
        .all()
      
      attributeMap = new Map(attributeDetails.map(a => [a.id, a]))
    }

    /* ============================
       BUILD RESPONSE
    ============================ */
    const items = skuAttributeList.map(sa => {
      const skuInfo = skuMap.get(sa.sku_id)
      const attrInfo = attributeMap.get(sa.attribute_id)
      
      let displayValue = sa.value
      if (with_attribute_details && attrInfo) {
        displayValue = `${attrInfo.attribute_name}: ${sa.value}${attrInfo.unit ? ` ${attrInfo.unit}` : ''}`
      }

      return {
        id: sa.id,
        value: sa.value,
        is_active: sa.is_active,
        is_deleted: sa.is_deleted,
        timestamps: {
          created_on: sa.created_on,
          updated_on: sa.updated_on
        },
        sku: with_sku_details 
          ? (skuInfo || { id: sa.sku_id, sku_name: 'Unknown', code: 'Unknown' })
          : { id: sa.sku_id },
        attribute: with_attribute_details 
          ? (attrInfo || { id: sa.attribute_id, attribute_name: 'Unknown', unit: '' })
          : { id: sa.attribute_id },
        display_value: displayValue
      }
    })

    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        items,
        pagination: should_paginate ? {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
          returned: items.length,
          from: offset + 1,
          to: offset + items.length
        } : undefined,
        summary: {
          total: items.length,
          unique_attributes: attributeIds.length,
          unique_skus: skuIds.length
        }
      }
    }

  } catch (error) {
    console.error('Error fetching SKU attributes:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch SKU attributes.'
    }
  }
})


ipcMain.handle('sku-attributes:get-by-id', async (_event, payload: GetSkuAttributeByIdPayload) => {
  try {
    const { id, include_deleted = false } = payload

    if (!id) {
      return { success: false, message: 'SKU Attribute ID is required.' }
    }

    /* ============================
       FETCH SKU ATTRIBUTE WITH DETAILS
    ============================ */
    const skuAttribute = db()
      .select({
        id: sku_attributes.id,
        sku_id: sku_attributes.sku_id,
        attribute_id: sku_attributes.attribute_id,
        value: sku_attributes.value,
        is_active: sku_attributes.is_active,
        is_deleted: sku_attributes.is_deleted,
        created_on: sku_attributes.created_on,
        updated_on: sku_attributes.updated_on,
        last_sync: sku_attributes.last_sync,
        is_sync_required: sku_attributes.is_sync_required,
        // SKU details
        sku_name: sku.sku_name,
        sku_code: sku.code,
        sku_is_active: sku.is_active,
        product_id: sku.product_id,
        // Product details
        product_name: products.product_name,
        // Attribute details
        attribute_name: attributes.attribute_name,
        attribute_unit: attributes.unit,
        attribute_is_active: attributes.is_active
      })
      .from(sku_attributes)
      .innerJoin(sku, eq(sku_attributes.sku_id, sku.id))
      .innerJoin(products, eq(sku.product_id, products.id))
      .innerJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
      .where(
        and(
          eq(sku_attributes.id, id),
          include_deleted ? undefined : eq(sku_attributes.is_deleted, false)
        )
      )
      .get()

    if (!skuAttribute) {
      return { success: false, message: 'SKU Attribute not found.' }
    }

    /* ============================
       FETCH OTHER ATTRIBUTES FOR THIS SKU (for context)
    ============================ */
    const otherAttributes = db()
      .select({
        id: sku_attributes.id,
        attribute_id: sku_attributes.attribute_id,
        value: sku_attributes.value,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit
      })
      .from(sku_attributes)
      .innerJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
      .where(
        and(
          eq(sku_attributes.sku_id, skuAttribute.sku_id),
          eq(sku_attributes.is_deleted, false),
          sql`${sku_attributes.id} != ${id}`
        )
      )
      .limit(10)
      .all()

    /* ============================
       BUILD RESPONSE
    ============================ */
    return {
      success: true,
      data: {
        id: skuAttribute.id,
        value: skuAttribute.value,
        is_active: skuAttribute.is_active,
        timestamps: {
          created_on: skuAttribute.created_on,
          updated_on: skuAttribute.updated_on,
          last_sync: skuAttribute.last_sync
        },
        sku: {
          id: skuAttribute.sku_id,
          name: skuAttribute.sku_name,
          code: skuAttribute.sku_code,
          is_active: skuAttribute.sku_is_active,
          product: {
            id: skuAttribute.product_id,
            name: skuAttribute.product_name
          }
        },
        attribute: {
          id: skuAttribute.attribute_id,
          name: skuAttribute.attribute_name,
          unit: skuAttribute.attribute_unit,
          is_active: skuAttribute.attribute_is_active
        },
        display: `${skuAttribute.attribute_name}: ${skuAttribute.value}${skuAttribute.attribute_unit ? ` ${skuAttribute.attribute_unit}` : ''}`,
        other_sku_attributes: otherAttributes.map(oa => ({
          id: oa.id,
          display: `${oa.attribute_name}: ${oa.value}${oa.unit ? ` ${oa.unit}` : ''}`
        }))
      }
    }

  } catch (error) {
    console.error('Error fetching SKU attribute by id:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch SKU attribute.'
    }
  }
})


ipcMain.handle('sku-attributes:update', async (_event, payload: UpdateSkuAttributePayload) => {
  try {
    const { id } = payload

    if (!id) {
      return { success: false, message: 'SKU Attribute ID is required.' }
    }

    /* ============================
       CHECK IF SKU ATTRIBUTE EXISTS
    ============================ */
    const existing = db()
      .select({
        id: sku_attributes.id,
        sku_id: sku_attributes.sku_id,
        attribute_id: sku_attributes.attribute_id,
        value: sku_attributes.value,
        is_active: sku_attributes.is_active
      })
      .from(sku_attributes)
      .where(and(eq(sku_attributes.id, id), eq(sku_attributes.is_deleted, false)))
      .get()

    if (!existing) {
      return { success: false, message: 'SKU Attribute not found.' }
    }

    /* ============================
       BUILD UPDATE DATA
    ============================ */
    const updateData: any = {
      updated_on: sql`(strftime('%s', 'now'))`,
      is_sync_required: true
    }

    if (payload.value !== undefined) {
      const newValue = payload.value.trim()
      if (!newValue) {
        return { success: false, message: 'Attribute value cannot be empty.' }
      }
      updateData.value = newValue
    }

    if (payload.is_active !== undefined) {
      updateData.is_active = payload.is_active
    }

    /* ============================
       PERFORM UPDATE
    ============================ */
    db()
      .update(sku_attributes)
      .set(updateData)
      .where(eq(sku_attributes.id, id))
      .run()

    /* ============================
       FETCH UPDATED SKU ATTRIBUTE WITH DETAILS
    ============================ */
    const updated = db()
      .select({
        id: sku_attributes.id,
        sku_id: sku_attributes.sku_id,
        attribute_id: sku_attributes.attribute_id,
        value: sku_attributes.value,
        is_active: sku_attributes.is_active,
        updated_on: sku_attributes.updated_on,
        attribute_name: attributes.attribute_name,
        unit: attributes.unit
      })
      .from(sku_attributes)
      .innerJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
      .where(eq(sku_attributes.id, id))
      .get()

    return {
      success: true,
      message: 'SKU Attribute updated successfully.',
      data: updated
    }

  } catch (error) {
    console.error('Error updating SKU attribute:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update SKU attribute.'
    }
  }
})


ipcMain.handle('sku-attributes:soft-delete', async (_event, payload: DeleteSkuAttributePayload) => {
  try {
    const { id, restore = false } = payload
    const action = restore ? 'restore' : 'delete'
    const actionPastTense = restore ? 'restored' : 'deleted'

    if (!id) {
      return { success: false, message: `SKU Attribute ID is required for ${action}.` }
    }

    /* ============================
       CHECK IF SKU ATTRIBUTE EXISTS
    ============================ */
    const skuAttribute = db()
      .select({
        id: sku_attributes.id,
        is_deleted: sku_attributes.is_deleted,
        value: sku_attributes.value,
        attribute_name: attributes.attribute_name
      })
      .from(sku_attributes)
      .innerJoin(attributes, eq(sku_attributes.attribute_id, attributes.id))
      .where(eq(sku_attributes.id, id))
      .get()

    if (!skuAttribute) {
      return { success: false, message: 'SKU Attribute not found.' }
    }

    // Check if already in desired state
    if (restore && !skuAttribute.is_deleted) {
      return { success: false, message: 'SKU Attribute is already active.' }
    }
    if (!restore && skuAttribute.is_deleted) {
      return { success: false, message: 'SKU Attribute is already deleted.' }
    }

    /* ============================
       PERFORM SOFT DELETE/RESTORE
    ============================ */
    db()
      .update(sku_attributes)
      .set({
        is_deleted: restore ? false : true,
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      })
      .where(eq(sku_attributes.id, id))
      .run()

    // Mark parent SKU for sync
    const skuInfo = db()
      .select({ product_id: sku.product_id })
      .from(sku)
      .innerJoin(sku_attributes, eq(sku.id, sku_attributes.sku_id))
      .where(eq(sku_attributes.id, id))
      .get()

    if (skuInfo) {
      db()
        .update(products)
        .set({
          is_sync_required: true,
          updated_on: sql`(strftime('%s', 'now'))`
        })
        .where(eq(products.id, skuInfo.product_id))
        .run()
    }

    return {
      success: true,
      message: `SKU Attribute "${skuAttribute.attribute_name}: ${skuAttribute.value}" ${actionPastTense} successfully.`,
      data: {
        id,
        action,
        restored: restore
      }
    }

  } catch (error) {
    console.error(`Error in SKU attribute ${payload.restore ? 'restore' : 'delete'}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} SKU attribute.`
    }
  }
})


ipcMain.handle('suppliers:create', async (_event, payload: CreateSupplierPayload) => {
  try {
    /* ============================
       VALIDATION
    ============================ */
    if (!payload.supplier_name?.trim()) {
      return { success: false, message: 'Supplier name is required.' }
    }

    const supplierName = payload.supplier_name.trim()

    // Email validation if provided
    if (payload.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(payload.email)) {
        return { success: false, message: 'Invalid email format.' }
      }
    }

    /* ============================
       CHECK FOR DUPLICATE
    ============================ */
    const existing = db()
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.supplier_name, supplierName),
          eq(suppliers.is_deleted, false)
        )
      )
      .get()

    if (existing) {
      return { success: false, message: 'Supplier with this name already exists.' }
    }

    /* ============================
       INSERT SUPPLIER
    ============================ */
    const result = db()
      .insert(suppliers)
      .values({
        supplier_name: supplierName,
        contact_person: payload.contact_person?.trim() || '',
        phone_number: payload.phone_number?.trim() || '',
        email: payload.email?.trim() || '',
        address: payload.address?.trim() || '',
        is_active: payload.is_active ?? true,
        sync_id: randomUUID(),
        created_on: sql`(strftime('%s', 'now'))`,
        updated_on: sql`(strftime('%s', 'now'))`
      })
      .run()

    const supplierId = Number(result.lastInsertRowid)

    /* ============================
       FETCH CREATED SUPPLIER
    ============================ */
    const newSupplier = db()
      .select({
        id: suppliers.id,
        supplier_name: suppliers.supplier_name,
        contact_person: suppliers.contact_person,
        phone_number: suppliers.phone_number,
        email: suppliers.email,
        address: suppliers.address,
        is_active: suppliers.is_active,
        created_on: suppliers.created_on
      })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .get()

    return {
      success: true,
      message: 'Supplier created successfully.',
      data: newSupplier
    }

  } catch (error) {
    console.error('Error creating supplier:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create supplier.'
    }
  }
})


ipcMain.handle('suppliers:get-all', async (_event, payload?: GetAllSuppliersPayload) => {
  try {
    const {
      is_active = 'both',
      is_deleted = 'both',
      is_sync_required = 'both',
      search,
      has_purchases,
      should_paginate = true,
      page = 1,
      limit = 20,
      sort_by = 'supplier_name',
      sort_order = 'asc',
      with_purchase_stats = false,
      min_total_spent,
      max_total_spent,
      min_purchases,
      max_purchases,
      with_recent_purchases_only
    } = payload || {}

    const offset = (page - 1) * limit

    /* ============================
       BUILD WHERE CONDITIONS
    ============================ */
    const conditions: SQL[] = []

    // Apply tri-state filters
    if (is_active !== 'both') {
      conditions.push(eq(suppliers.is_active, is_active === 'yes'))
    }
    if (is_deleted !== 'both') {
      conditions.push(eq(suppliers.is_deleted, is_deleted === 'yes'))
    }
    if (is_sync_required !== 'both') {
      conditions.push(eq(suppliers.is_sync_required, is_sync_required === 'yes'))
    }

    // Search filter - using the pattern that works
    if (search) {
      const searchPattern = `%${search}%`
      const searchCondition = or(
        like(suppliers.supplier_name, searchPattern),
        like(suppliers.contact_person, searchPattern),
        like(suppliers.email, searchPattern),
        like(suppliers.phone_number, searchPattern)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    // Has purchases filter
    if (has_purchases !== undefined) {
      if (has_purchases) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${stock_purchases}
            WHERE ${stock_purchases.supplier_id} = ${suppliers.id}
            AND ${stock_purchases.is_deleted} = 0
          )`
        )
      } else {
        conditions.push(
          sql`NOT EXISTS (
            SELECT 1 FROM ${stock_purchases}
            WHERE ${stock_purchases.supplier_id} = ${suppliers.id}
            AND ${stock_purchases.is_deleted} = 0
          )`
        )
      }
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    /* ============================
       GET TOTAL COUNT
    ============================ */
    db()
      .select({ count: sql<number>`COUNT(*)` })
      .from(suppliers)
      .where(whereConditions)
      .get()

    // const total = countResult?.count ?? 0

    /* ============================
       BUILD ORDER BY
    ============================ */
    let orderByClause: SQL

    switch (sort_by) {
      case 'supplier_name':
        orderByClause = sort_order === 'asc'
          ? asc(suppliers.supplier_name)
          : desc(suppliers.supplier_name)
        break
      case 'contact_person':
        orderByClause = sort_order === 'asc'
          ? asc(suppliers.contact_person)
          : desc(suppliers.contact_person)
        break
      case 'created_on':
        orderByClause = sort_order === 'asc'
          ? asc(suppliers.created_on)
          : desc(suppliers.created_on)
        break
      case 'total_spent':
      case 'total_purchases':
      case 'avg_profit_margin':
        // Will be handled after stats are fetched
        orderByClause = asc(suppliers.supplier_name) // Default, will be overridden
        break
      default:
        orderByClause = asc(suppliers.supplier_name)
    }

    /* ============================
       FETCH SUPPLIERS
    ============================ */
    const baseQuery = db()
      .select({
        id: suppliers.id,
        sync_id: suppliers.sync_id,
        supplier_name: suppliers.supplier_name,
        contact_person: suppliers.contact_person,
        phone_number: suppliers.phone_number,
        email: suppliers.email,
        address: suppliers.address,
        created_on: suppliers.created_on,
        updated_on: suppliers.updated_on,
        last_sync: suppliers.last_sync,
        is_active: suppliers.is_active,
        is_deleted: suppliers.is_deleted,
        is_sync_required: suppliers.is_sync_required
      })
      .from(suppliers)
      .where(whereConditions)
      .orderBy(orderByClause)

    const supplierList = should_paginate
      ? baseQuery.limit(limit).offset(offset).all()
      : baseQuery.all()

    if (supplierList.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          pagination: should_paginate ? {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false,
            returned: 0,
            from: 0,
            to: 0
          } : undefined,
          summary: {
            total_suppliers: 0,
            active_suppliers: 0,
            total_spent_all: 0,
            total_purchases_all: 0,
            avg_profit_margin_all: 0
          }
        }
      }
    }

    /* ============================
       FETCH PURCHASE STATS WITH RICH METRICS
    ============================ */
    let purchaseStats = new Map()
    const supplierIds = supplierList.map(s => s.id)

    // Get detailed purchase statistics including sales data
    const stats = db()
      .select({
        supplier_id: stock_purchases.supplier_id,
        total_purchases: sql<number>`COUNT(*)`,
        total_quantity_bought: sql<number>`COALESCE(SUM(${stock_purchases.quantity_bought}), 0)`,
        total_spent: sql<number>`COALESCE(SUM(${stock_purchases.total_price_bought} + COALESCE(${stock_purchases.shipping_cost}, 0)), 0)`,
        total_shipping_paid: sql<number>`COALESCE(SUM(${stock_purchases.shipping_cost}), 0)`,
        last_purchase_date: sql<number>`MAX(${stock_purchases.purchased_on})`,
        first_purchase_date: sql<number>`MIN(${stock_purchases.purchased_on})`,
        
        // Calculate total sold from these purchases
        total_sold: sql<number>`COALESCE((
          SELECT SUM(${sales.quantity})
          FROM ${sales}
          INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
          WHERE sp.supplier_id = ${stock_purchases.supplier_id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`,
        
        // Calculate total revenue from these purchases
        total_revenue: sql<number>`COALESCE((
          SELECT SUM(${sales.total_price})
          FROM ${sales}
          INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
          WHERE sp.supplier_id = ${stock_purchases.supplier_id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`,
        
        // Calculate average profit margin
        avg_profit_margin: sql<number>`COALESCE((
          SELECT AVG(
            (${sales.total_price} - (
              (sp.total_price_bought + COALESCE(sp.shipping_cost, 0)) * 
              ${sales.quantity} / NULLIF(sp.quantity_bought, 1)
            ) - COALESCE(${sales.shipping_cost}, 0)) * 100.0 / NULLIF(${sales.total_price}, 0)
          )
          FROM ${sales}
          INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
          WHERE sp.supplier_id = ${stock_purchases.supplier_id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`,
        
        // Get unique products supplied
        unique_products: sql<number>`COUNT(DISTINCT ${sku.product_id})`,
        
        // Get unique SKUs
        unique_skus: sql<number>`COUNT(DISTINCT ${stock_purchases.sku_id})`
      })
      .from(stock_purchases)
      .leftJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .where(
        and(
          inArray(stock_purchases.supplier_id, supplierIds),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .groupBy(stock_purchases.supplier_id)
      .all()

    purchaseStats = new Map(stats.map(s => [s.supplier_id, s]))

    // If sorting by stats-based fields, we need to sort in memory
    let items = supplierList.map(s => {
      const stats = purchaseStats.get(s.id) || {
        total_purchases: 0,
        total_quantity_bought: 0,
        total_spent: 0,
        total_shipping_paid: 0,
        total_sold: 0,
        total_revenue: 0,
        avg_profit_margin: 0,
        last_purchase_date: null,
        first_purchase_date: null,
        unique_products: 0,
        unique_skus: 0
      }

      // Calculate remaining quantity (if needed)
      const total_remaining = stats.total_quantity_bought - stats.total_sold

      // Calculate sell-through rate
      const sell_through_rate = stats.total_quantity_bought > 0
        ? (stats.total_sold / stats.total_quantity_bought) * 100
        : 0

      // Calculate profit (revenue - cost)
      const total_profit = stats.total_revenue - stats.total_spent

      return {
        // Basic supplier info
        id: s.id,
        sync_id: s.sync_id,
        supplier_name: s.supplier_name,
        contact_person: s.contact_person,
        phone_number: s.phone_number,
        email: s.email,
        address: s.address,
        created_on: s.created_on,
        updated_on: s.updated_on,
        is_active: s.is_active === true,
        is_deleted: s.is_deleted === true,
        
        // Purchase statistics
        purchase_stats: with_purchase_stats ? {
          // Volume metrics
          total_purchases: stats.total_purchases,
          total_quantity_bought: stats.total_quantity_bought,
          total_quantity_sold: stats.total_sold,
          total_quantity_remaining: total_remaining,
          
          // Financial metrics
          total_spent: Number(stats.total_spent.toFixed(2)),
          total_shipping_paid: Number(stats.total_shipping_paid.toFixed(2)),
          total_revenue: Number(stats.total_revenue.toFixed(2)),
          total_profit: Number(total_profit.toFixed(2)),
          avg_profit_margin: Number(stats.avg_profit_margin.toFixed(2)),
          
          // Performance metrics
          sell_through_rate: Number(sell_through_rate.toFixed(1)),
          
          // Product diversity
          unique_products: stats.unique_products,
          unique_skus: stats.unique_skus,
          
          // Dates
          first_purchase_date: stats.first_purchase_date,
          last_purchase_date: stats.last_purchase_date,
          
          // Recency (days since last purchase)
          days_since_last_purchase: stats.last_purchase_date
            ? Math.round((Date.now() / 1000 - Number(stats.last_purchase_date)) / (24 * 60 * 60))
            : null
        } : undefined
      }
    })

    /* ============================
       APPLY STATS-BASED FILTERS
    ============================ */
    if (min_total_spent !== undefined) {
      items = items.filter(i => (i.purchase_stats?.total_spent || 0) >= min_total_spent)
    }
    if (max_total_spent !== undefined) {
      items = items.filter(i => (i.purchase_stats?.total_spent || 0) <= max_total_spent)
    }
    if (min_purchases !== undefined) {
      items = items.filter(i => (i.purchase_stats?.total_purchases || 0) >= min_purchases)
    }
    if (max_purchases !== undefined) {
      items = items.filter(i => (i.purchase_stats?.total_purchases || 0) <= max_purchases)
    }
    if (with_recent_purchases_only) {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
      items = items.filter(i => {
        const lastPurchase = i.purchase_stats?.last_purchase_date
        return lastPurchase && Number(lastPurchase) >= thirtyDaysAgo
      })
    }

    /* ============================
       APPLY STATS-BASED SORTING
    ============================ */
    if (sort_by === 'total_spent') {
      items.sort((a, b) => {
        const aVal = a.purchase_stats?.total_spent || 0
        const bVal = b.purchase_stats?.total_spent || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    } else if (sort_by === 'total_purchases') {
      items.sort((a, b) => {
        const aVal = a.purchase_stats?.total_purchases || 0
        const bVal = b.purchase_stats?.total_purchases || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    } else if (sort_by === 'avg_profit_margin') {
      items.sort((a, b) => {
        const aVal = a.purchase_stats?.avg_profit_margin || 0
        const bVal = b.purchase_stats?.avg_profit_margin || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    /* ============================
       CALCULATE AGGREGATE STATISTICS
    ============================ */
    // const totalActive = items.filter(i => i.is_active).length
    const totalSpentAll = items.reduce((sum, i) => sum + (i.purchase_stats?.total_spent || 0), 0)
    const totalPurchasesAll = items.reduce((sum, i) => sum + (i.purchase_stats?.total_purchases || 0), 0)
    const avgProfitMarginAll = items.filter(i => i.purchase_stats?.total_purchases > 0)
      .reduce((sum, i) => sum + (i.purchase_stats?.avg_profit_margin || 0), 0) / 
      (items.filter(i => i.purchase_stats?.total_purchases > 0).length || 1)

    /* ============================
       APPLY PAGINATION AFTER FILTERS
    ============================ */
    const filteredTotal = items.length
    const paginatedItems = should_paginate
      ? items.slice(offset, offset + limit)
      : items

    const totalPages = Math.ceil(filteredTotal / limit)

    /* ============================
       BUILD RESPONSE
    ============================ */
    return {
      success: true,
      data: {
        items: paginatedItems,
        pagination: should_paginate ? {
          page,
          limit,
          total: filteredTotal,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
          returned: paginatedItems.length,
          from: offset + 1,
          to: offset + paginatedItems.length
        } : undefined,
        summary: {
          total_suppliers: filteredTotal,
          active_suppliers: paginatedItems.filter(i => i.is_active).length,
          total_spent_all: Number(totalSpentAll.toFixed(2)),
          total_purchases_all: totalPurchasesAll,
          avg_profit_margin_all: Number(avgProfitMarginAll.toFixed(2)),
          suppliers_with_purchases: items.filter(i => (i.purchase_stats?.total_purchases || 0) > 0).length
        }
      }
    }

  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch suppliers.'
    }
  }
})


ipcMain.handle('suppliers:get-by-id', async (_event, payload: GetSupplierByIdPayload) => {
  try {
    const { 
      id, 
      include_deleted = false, 
      with_purchases = true, 
      purchase_limit = 20,
      // include_sales_stats = true 
    } = payload

    if (!id) {
      return { success: false, message: 'Supplier ID is required.' }
    }

    /* ============================
       FETCH SUPPLIER
    ============================ */
    const supplier = db()
      .select({
        id: suppliers.id,
        sync_id: suppliers.sync_id,
        supplier_name: suppliers.supplier_name,
        contact_person: suppliers.contact_person,
        phone_number: suppliers.phone_number,
        email: suppliers.email,
        address: suppliers.address,
        created_on: suppliers.created_on,
        updated_on: suppliers.updated_on,
        last_sync: suppliers.last_sync,
        is_active: suppliers.is_active,
        is_deleted: suppliers.is_deleted,
        is_sync_required: suppliers.is_sync_required
      })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.id, id),
          include_deleted ? undefined : eq(suppliers.is_deleted, false)
        )
      )
      .get()

    if (!supplier) {
      return { success: false, message: 'Supplier not found.' }
    }

    /* ============================
       FETCH PURCHASE STATISTICS WITH METRICS
    ============================ */
    const purchaseStats = db()
      .select({
        // Basic counts
        total_purchases: sql<number>`COUNT(*)`,
        total_quantity_bought: sql<number>`COALESCE(SUM(${stock_purchases.quantity_bought}), 0)`,
        total_spent: sql<number>`COALESCE(SUM(${stock_purchases.total_price_bought}), 0)`,
        total_shipping_cost: sql<number>`COALESCE(SUM(${stock_purchases.shipping_cost}), 0)`,
        
        // Date ranges
        first_purchase_date: sql<number>`MIN(${stock_purchases.purchased_on})`,
        last_purchase_date: sql<number>`MAX(${stock_purchases.purchased_on})`,
        
        // Product diversity
        unique_skus: sql<number>`COUNT(DISTINCT ${stock_purchases.sku_id})`,
        unique_products: sql<number>`COUNT(DISTINCT ${sku.product_id})`,
        
        // Price statistics
        avg_price_per_unit: sql<number>`AVG(${stock_purchases.price_per_unit})`,
        min_price_per_unit: sql<number>`MIN(${stock_purchases.price_per_unit})`,
        max_price_per_unit: sql<number>`MAX(${stock_purchases.price_per_unit})`,
        
        // Batch statistics
        avg_batch_size: sql<number>`AVG(${stock_purchases.quantity_bought})`,
        
        // Sales and profit metrics (if include_sales_stats is true)
        total_sold: sql<number>`COALESCE((
          SELECT SUM(${sales.quantity})
          FROM ${sales}
          INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
          WHERE sp.supplier_id = ${id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`,
        
        total_revenue: sql<number>`COALESCE((
          SELECT SUM(${sales.total_price})
          FROM ${sales}
          INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
          WHERE sp.supplier_id = ${id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`,
        
        total_profit: sql<number>`COALESCE((
          SELECT SUM(
            ${sales.total_price} - (
              (sp.total_price_bought + COALESCE(sp.shipping_cost, 0)) * 
              ${sales.quantity} / NULLIF(sp.quantity_bought, 1)
            ) - COALESCE(${sales.shipping_cost}, 0)
          )
          FROM ${sales}
          INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
          WHERE sp.supplier_id = ${id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`
      })
      .from(stock_purchases)
      .leftJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .where(
        and(
          eq(stock_purchases.supplier_id, id),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .get()

    /* ============================
       CALCULATE REMAINING QUANTITY AND METRICS
    ============================ */
    
    // Get all purchases with sold quantities to calculate remaining
    const purchasesWithSales = db()
      .select({
        id: stock_purchases.id,
        quantity_bought: stock_purchases.quantity_bought,
        sold_quantity: sql<number>`COALESCE((
          SELECT SUM(${sales.quantity})
          FROM ${sales}
          WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
          AND ${sales.is_deleted} = 0
          AND ${sales.has_been_canceled} = 0
          AND ${sales.status} = 'completed'
        ), 0)`
      })
      .from(stock_purchases)
      .where(
        and(
          eq(stock_purchases.supplier_id, id),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .all()

    const totalQuantityRemaining = purchasesWithSales.reduce(
      (sum, p) => sum + (p.quantity_bought - p.sold_quantity), 
      0
    )

    // Calculate average profit margin
    const avgProfitMargin = purchaseStats && purchaseStats.total_revenue > 0
      ? ((purchaseStats.total_revenue - purchaseStats.total_spent) / purchaseStats.total_revenue) * 100
      : 0

    /* ============================
       FETCH RECENT PURCHASES WITH DETAILS (IF REQUESTED)
    ============================ */
    let recentPurchases: any[] = []

    if (with_purchases) {
      const purchases = db()
        .select({
          id: stock_purchases.id,
          sku_id: stock_purchases.sku_id,
          quantity_bought: stock_purchases.quantity_bought,
          price_per_unit: stock_purchases.price_per_unit,
          total_price_bought: stock_purchases.total_price_bought,
          shipping_cost: stock_purchases.shipping_cost,
          purchased_on: stock_purchases.purchased_on,
          arrived_on: stock_purchases.arrived_on,
          batch_number: stock_purchases.batch_number,
          min_selling_price: stock_purchases.min_selling_price,
          max_selling_price: stock_purchases.max_selling_price,
          sku_name: sku.sku_name,
          sku_code: sku.code,
          product_name: products.product_name,
          product_id: products.id,
          
          // Calculate sold quantity for this batch
          sold_quantity: sql<number>`COALESCE((
            SELECT SUM(${sales.quantity})
            FROM ${sales}
            WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`,
          
          // Calculate revenue from this batch
          revenue: sql<number>`COALESCE((
            SELECT SUM(${sales.total_price})
            FROM ${sales}
            WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`,
          
          // Calculate shipping from sales
          shipping_from_sales: sql<number>`COALESCE((
            SELECT SUM(${sales.shipping_cost})
            FROM ${sales}
            WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
            AND ${sales.status} = 'completed'
          ), 0)`
        })
        .from(stock_purchases)
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(
          and(
            eq(stock_purchases.supplier_id, id),
            eq(stock_purchases.is_deleted, false)
          )
        )
        .orderBy(desc(stock_purchases.purchased_on))
        .limit(purchase_limit)
        .all()

      recentPurchases = purchases.map(p => {
        const remaining = p.quantity_bought - (p.sold_quantity || 0)
        const landedCost = p.total_price_bought + (p.shipping_cost || 0)
        const costPerUnit = landedCost / p.quantity_bought
        const profitFromBatch = (p.revenue || 0) - (costPerUnit * (p.sold_quantity || 0)) - (p.shipping_from_sales || 0)
        const marginFromBatch = (p.revenue || 0) > 0 ? (profitFromBatch / (p.revenue || 0)) * 100 : 0
        
        // Calculate days since purchase
        const daysSincePurchase = p.purchased_on 
          ? Math.round((Date.now() / 1000 - Number(p.purchased_on)) / (24 * 60 * 60))
          : null

        return {
          id: p.id,
          sku_id: p.sku_id,
          sku_name: p.sku_name,
          sku_code: p.sku_code,
          product_name: p.product_name,
          product_id: p.product_id,
          batch_number: p.batch_number,
          
          quantities: {
            bought: p.quantity_bought,
            sold: p.sold_quantity || 0,
            remaining: remaining
          },
          
          pricing: {
            price_per_unit: p.price_per_unit,
            total_price: p.total_price_bought,
            shipping_cost: p.shipping_cost,
            landed_cost_per_unit: Number(costPerUnit.toFixed(2)),
            selling_price_range: {
              min: p.min_selling_price,
              max: p.max_selling_price
            }
          },
          
          financials: {
            revenue: Number((p.revenue || 0).toFixed(2)),
            cost: Number((costPerUnit * (p.sold_quantity || 0)).toFixed(2)),
            shipping_paid: Number((p.shipping_from_sales || 0).toFixed(2)),
            profit: Number(profitFromBatch.toFixed(2)),
            margin: Number(marginFromBatch.toFixed(2))
          },
          
          dates: {
            purchased: p.purchased_on,
            arrived: p.arrived_on
          },
          
          performance: {
            sell_through_rate: p.quantity_bought > 0 
              ? Number((((p.sold_quantity || 0) / p.quantity_bought) * 100).toFixed(1))
              : 0,
            days_since_purchase: daysSincePurchase
          }
        }
      })
    }

    /* ============================
       FETCH PRODUCT SUMMARY
    ============================ */
    const productSummary = db()
      .select({
        product_id: products.id,
        product_name: products.product_name,
        total_quantity: sql<number>`SUM(${stock_purchases.quantity_bought})`,
        total_spent: sql<number>`SUM(${stock_purchases.total_price_bought})`,
        last_purchase: sql<number>`MAX(${stock_purchases.purchased_on})`
      })
      .from(stock_purchases)
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .innerJoin(products, eq(sku.product_id, products.id))
      .where(
        and(
          eq(stock_purchases.supplier_id, id),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .groupBy(products.id)
      .orderBy(desc(sql`SUM(${stock_purchases.quantity_bought})`))
      .limit(10)
      .all()

    /* ============================
       CALCULATE PERFORMANCE METRICS
    ============================ */
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60)

    // Get purchases in last 30/90 days
    const recentPurchasesCount = purchasesWithSales.filter(p => {
      const purchase = recentPurchases.find(rp => rp.id === p.id)
      return purchase?.dates?.purchased && Number(purchase.dates.purchased) >= thirtyDaysAgo
    }).length

    const purchasesLast90Days = purchasesWithSales.filter(p => {
      const purchase = recentPurchases.find(rp => rp.id === p.id)
      return purchase?.dates?.purchased && Number(purchase.dates.purchased) >= ninetyDaysAgo
    }).length

    /* ============================
       BUILD COMPLETE RESPONSE
    ============================ */
    return {
      success: true,
      data: {
        // Basic supplier info
        id: supplier.id,
        sync_id: supplier.sync_id,
        supplier_name: supplier.supplier_name,
        contact_person: supplier.contact_person,
        phone_number: supplier.phone_number,
        email: supplier.email,
        address: supplier.address,
        is_active: supplier.is_active === true,
        is_deleted: supplier.is_deleted === true,
        created_on: supplier.created_on,
        updated_on: supplier.updated_on,
        
        // Comprehensive statistics
        statistics: {
          // Purchase counts
          total_purchases: Number(purchaseStats?.total_purchases || 0),
          purchases_last_30_days: recentPurchasesCount,
          purchases_last_90_days: purchasesLast90Days,
          
          // Quantity metrics
          total_quantity_bought: Number(purchaseStats?.total_quantity_bought || 0),
          total_quantity_sold: Number(purchaseStats?.total_sold || 0),
          total_quantity_remaining: totalQuantityRemaining,
          
          // Financial metrics
          total_spent: Number((purchaseStats?.total_spent || 0).toFixed(2)),
          total_shipping_cost: Number((purchaseStats?.total_shipping_cost || 0).toFixed(2)),
          total_revenue: Number((purchaseStats?.total_revenue || 0).toFixed(2)),
          total_profit: Number((purchaseStats?.total_profit || 0).toFixed(2)),
          avg_profit_margin: Number(avgProfitMargin.toFixed(2)),
          
          // Product diversity
          unique_skus: Number(purchaseStats?.unique_skus || 0),
          unique_products: Number(purchaseStats?.unique_products || 0),
          
          // Price statistics
          avg_price_per_unit: Number((purchaseStats?.avg_price_per_unit || 0).toFixed(2)),
          min_price_per_unit: Number((purchaseStats?.min_price_per_unit || 0).toFixed(2)),
          max_price_per_unit: Number((purchaseStats?.max_price_per_unit || 0).toFixed(2)),
          avg_batch_size: Math.round(Number(purchaseStats?.avg_batch_size || 0)),
          
          // Dates
          first_purchase_date: purchaseStats?.first_purchase_date || null,
          last_purchase_date: purchaseStats?.last_purchase_date || null,
          
          // Recency
          days_since_last_purchase: purchaseStats?.last_purchase_date
            ? Math.round((now - Number(purchaseStats.last_purchase_date)) / (24 * 60 * 60))
            : null
        },
        
        // Recent purchases with rich details
        recent_purchases: recentPurchases,
        
        // Top products from this supplier
        top_products: productSummary.map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          total_quantity: p.total_quantity,
          total_spent: Number((p.total_spent || 0).toFixed(2)),
          last_purchase: p.last_purchase
        })),
        
        // Summary counts
        purchase_count: Number(purchaseStats?.total_purchases || 0),
        active_products_count: productSummary.length,
        
        // Performance rating
        performance_rating: (() => {
          const totalPurchases = Number(purchaseStats?.total_purchases || 0)
          const avgMargin = avgProfitMargin
          
          if (totalPurchases === 0) return 'No purchases'
          if (avgMargin > 30 && totalPurchases > 10) return 'Excellent'
          if (avgMargin > 20 && totalPurchases > 5) return 'Good'
          if (avgMargin > 10) return 'Average'
          return 'Below Average'
        })(),
        
        // Reliability score (based on purchase frequency and consistency)
        reliability_score: (() => {
          const totalPurchases = Number(purchaseStats?.total_purchases || 0)
          const uniqueProducts = Number(purchaseStats?.unique_products || 0)
          const hasRecentPurchase = purchaseStats?.last_purchase_date && 
            Number(purchaseStats.last_purchase_date) >= thirtyDaysAgo
          
          if (totalPurchases > 20 && uniqueProducts > 5 && hasRecentPurchase) return 5
          if (totalPurchases > 10 && uniqueProducts > 3) return 4
          if (totalPurchases > 5) return 3
          if (totalPurchases > 0) return 2
          return 1
        })()
      }
    }

  } catch (error) {
    console.error('Error fetching supplier by id:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch supplier.'
    }
  }
})


ipcMain.handle('suppliers:update', async (_event, payload: UpdateSupplierPayload) => {
  try {
    const { id } = payload

    if (!id) {
      return { success: false, message: 'Supplier ID is required.' }
    }

    /* ============================
       CHECK IF SUPPLIER EXISTS
    ============================ */
    const existing = db()
      .select({
        id: suppliers.id,
        supplier_name: suppliers.supplier_name,
        email: suppliers.email
      })
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.is_deleted, false)))
      .get()

    if (!existing) {
      return { success: false, message: 'Supplier not found.' }
    }

    // Email validation if provided
    if (payload.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(payload.email)) {
        return { success: false, message: 'Invalid email format.' }
      }
    }

    /* ============================
       BUILD UPDATE DATA
    ============================ */
    const updateData: any = {
      updated_on: sql`(strftime('%s', 'now'))`,
      is_sync_required: true
    }

    if (payload.supplier_name !== undefined) {
      const newName = payload.supplier_name.trim()
      if (!newName) {
        return { success: false, message: 'Supplier name cannot be empty.' }
      }

      // Check for duplicate name
      if (newName !== existing.supplier_name) {
        const duplicate = db()
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(
            and(
              eq(suppliers.supplier_name, newName),
              eq(suppliers.is_deleted, false),
              sql`${suppliers.id} != ${id}`
            )
          )
          .get()

        if (duplicate) {
          return { success: false, message: 'Another supplier with this name already exists.' }
        }
      }

      updateData.supplier_name = newName
    }

    if (payload.contact_person !== undefined) {
      updateData.contact_person = payload.contact_person?.trim() || ''
    }

    if (payload.phone_number !== undefined) {
      updateData.phone_number = payload.phone_number?.trim() || ''
    }

    if (payload.email !== undefined) {
      updateData.email = payload.email?.trim() || ''
    }

    if (payload.address !== undefined) {
      updateData.address = payload.address?.trim() || ''
    }

    if (payload.is_active !== undefined) {
      updateData.is_active = payload.is_active
    }

    /* ============================
       PERFORM UPDATE
    ============================ */
    db()
      .update(suppliers)
      .set(updateData)
      .where(eq(suppliers.id, id))
      .run()

    /* ============================
       FETCH UPDATED SUPPLIER
    ============================ */
    const updated = db()
      .select({
        id: suppliers.id,
        supplier_name: suppliers.supplier_name,
        contact_person: suppliers.contact_person,
        phone_number: suppliers.phone_number,
        email: suppliers.email,
        address: suppliers.address,
        is_active: suppliers.is_active,
        updated_on: suppliers.updated_on
      })
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .get()

    return {
      success: true,
      message: 'Supplier updated successfully.',
      data: updated
    }

  } catch (error) {
    console.error('Error updating supplier:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update supplier.'
    }
  }
})


ipcMain.handle('suppliers:soft-delete', async (_event, payload: DeleteSupplierPayload) => {
  try {
    const { id, cascade = false, restore = false } = payload
    const action = restore ? 'restore' : 'delete'
    const actionPastTense = restore ? 'restored' : 'deleted'

    if (!id) {
      return { success: false, message: `Supplier ID is required for ${action}.` }
    }

    /* ============================
       CHECK IF SUPPLIER EXISTS
    ============================ */
    const supplier = db()
      .select({
        id: suppliers.id,
        supplier_name: suppliers.supplier_name,
        is_deleted: suppliers.is_deleted
      })
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .get()

    if (!supplier) {
      return { success: false, message: 'Supplier not found.' }
    }

    // Check if already in desired state
    if (restore && !supplier.is_deleted) {
      return { success: false, message: 'Supplier is already active.' }
    }
    if (!restore && supplier.is_deleted) {
      return { success: false, message: 'Supplier is already deleted.' }
    }

    /* ============================
       CHECK FOR PURCHASES IF NOT CASCADING
    ============================ */
    if (!cascade) {
      const purchaseCount = db()
        .select({ count: sql<number>`COUNT(*)` })
        .from(stock_purchases)
        .where(
          and(
            eq(stock_purchases.supplier_id, id),
            restore ? eq(stock_purchases.is_deleted, true) : eq(stock_purchases.is_deleted, false)
          )
        )
        .get()

      if (Number(purchaseCount?.count ?? 0) > 0) {
        throw new Error(
          `Cannot ${action} supplier with existing stock purchases. Use cascade=true to ${action} all.`
        )
      }
    }

    /* ============================
       PERFORM IN TRANSACTION
    ============================ */
    const result = db().transaction(() => {
      try {
        const affectedItems: Record<string, any> = {
          supplier: {
            id,
            name: supplier.supplier_name,
            action
          }
        }

        /* ============================
           UPDATE SUPPLIER ITSELF
        ============================ */
        db()
          .update(suppliers)
          .set({
            is_deleted: restore ? false : true,
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          })
          .where(eq(suppliers.id, id))
          .run()

        /* ============================
           CASCADE TO STOCK PURCHASES (IF REQUESTED)
        ============================ */
        if (cascade) {
          const purchaseIds = db()
            .select({ id: stock_purchases.id })
            .from(stock_purchases)
            .where(
              and(
                eq(stock_purchases.supplier_id, id),
                restore ? eq(stock_purchases.is_deleted, true) : eq(stock_purchases.is_deleted, false)
              )
            )
            .all()
            .map(p => p.id)

          if (purchaseIds.length > 0) {
            db()
              .update(stock_purchases)
              .set({
                is_deleted: restore ? false : true,
                updated_on: sql`(strftime('%s', 'now'))`,
                is_sync_required: true
              })
              .where(inArray(stock_purchases.id, purchaseIds))
              .run()

            affectedItems.stock_purchases = purchaseIds
          }
        }

        return {
          success: true,
          message: `Supplier "${supplier.supplier_name}" ${actionPastTense} successfully.${cascade ? ' Cascaded to stock purchases.' : ''}`,
          data: {
            id,
            supplier_name: supplier.supplier_name,
            action,
            cascaded: cascade,
            affected: {
              stock_purchases: affectedItems.stock_purchases?.length || 0
            }
          }
        }

      } catch (error) {
        console.error('Transaction error:', error)
        throw error
      }
    })

    return result

  } catch (error) {
    console.error(`Error in supplier ${payload.restore ? 'restore' : 'delete'}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} supplier.`
    }
  }
})


ipcMain.handle('stock-purchases:create', async (_event, payload: CreateStockPurchasePayload) => {
  try {
    /* ============================
       VALIDATION
    ============================ */
    if (!payload.sku_id) {
      return { success: false, message: 'SKU ID is required.' }
    }

    if (!payload.quantity || payload.quantity <= 0) {
      return { success: false, message: 'Quantity must be greater than 0.' }
    }

    if (!payload.price_per_unit || payload.price_per_unit <= 0) {
      return { success: false, message: 'Price per unit must be greater than 0.' }
    }

    if (!payload.total_price_bought || payload.total_price_bought <= 0) {
      return { success: false, message: 'Total price must be greater than 0.' }
    }

    /* ============================
       CHECK IF SKU EXISTS
    ============================ */
    const skuExists = db()
      .select({ 
        id: sku.id,
        sku_name: sku.sku_name,
        product_id: sku.product_id 
      })
      .from(sku)
      .where(and(eq(sku.id, payload.sku_id), eq(sku.is_deleted, false)))
      .get()

    if (!skuExists) {
      return { success: false, message: 'SKU not found.' }
    }

    /* ============================
       CHECK SUPPLIER IF PROVIDED
    ============================ */
    if (payload.supplier_id) {
      const supplierExists = db()
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(and(eq(suppliers.id, payload.supplier_id), eq(suppliers.is_deleted, false)))
        .get()

      if (!supplierExists) {
        return { success: false, message: 'Supplier not found.' }
      }
    }

    // Validate dates if provided
    if (payload.manufacture_date && payload.expiry_date) {
      if (payload.manufacture_date > payload.expiry_date) {
        return { success: false, message: 'Manufacture date cannot be after expiry date.' }
      }
    }

    // Build insert data - let SQL handle timestamps
    const stockInsertData: any = {
      sku_id: payload.sku_id,
      quantity_bought: payload.quantity,
      price_per_unit: payload.price_per_unit,
      total_price_bought: payload.total_price_bought,
      shipping_cost: payload.shipping_cost || 0,
      min_selling_price: payload.min_price || 0,
      max_selling_price: payload.max_price || payload.price_per_unit * 1.2,
      manufacture_date: payload.manufacture_date || '',
      expiry_date: payload.expiry_date || '',
      batch_number: payload.batch_number || '',
    }

    // Only add timestamps if explicitly provided, otherwise let SQL use defaults
    if (payload.purchased_on) {
      stockInsertData.purchased_on = sql`${payload.purchased_on}`  // Pass as SQL value
    }
    
    if (payload.arrived_on) {
      stockInsertData.arrived_on = sql`${payload.arrived_on}`
    }

    if (payload.supplier_id) {
      stockInsertData.supplier_id = payload.supplier_id
    }

    /* ============================
       INSERT STOCK PURCHASE
    ============================ */
    const result = db()
      .insert(stock_purchases)
      .values(stockInsertData)
      .run()

    const purchaseId = Number(result.lastInsertRowid)

    /* ============================
       FETCH CREATED PURCHASE WITH DETAILS
    ============================ */
    const newPurchase = db()
      .select({
        id: stock_purchases.id,
        sku_id: stock_purchases.sku_id,
        quantity_bought: stock_purchases.quantity_bought,
        price_per_unit: stock_purchases.price_per_unit,
        total_price_bought: stock_purchases.total_price_bought,
        shipping_cost: stock_purchases.shipping_cost,
        min_price: stock_purchases.min_selling_price,
        max_price: stock_purchases.max_selling_price,
        manufacture_date: stock_purchases.manufacture_date,
        expiry_date: stock_purchases.expiry_date,
        batch_number: stock_purchases.batch_number,
        purchased_on: stock_purchases.purchased_on,
        arrived_on: stock_purchases.arrived_on,
        supplier_id: stock_purchases.supplier_id,
        sku_name: sku.sku_name,
        sku_code: sku.code,
        supplier_name: suppliers.supplier_name
      })
      .from(stock_purchases)
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .leftJoin(suppliers, eq(stock_purchases.supplier_id, suppliers.id))
      .where(eq(stock_purchases.id, purchaseId))
      .get()

    return {
      success: true,
      message: 'Stock purchase created successfully.',
      data: newPurchase
    }

  } catch (error) {
    console.error('Error creating stock purchase:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create stock purchase.'
    }
  }
})


ipcMain.handle('stock-purchases:get-all', async (_event, payload?: GetAllStockPurchasesPayload) => {
  try {
    const {
      // Core filters
      sku_id,
      supplier_id,
      is_deleted = 'both',
      
      // Date filters
      date_from,
      date_to,
      expiry_from,
      expiry_to,
      
      // Performance filters
      min_profit_margin,
      max_profit_margin,
      min_sell_through,
      max_sell_through,
      
      // Batch filters
      batch_number,
      has_remaining_stock,
      expiring_soon_only,
      
      // Pagination
      should_paginate = true,
      page = 1,
      limit = 20,
      
      // Sorting
      sort_by = 'purchased_on',
      sort_order = 'desc',
      
      // Related data
      with_sku_details = true,
      with_supplier_details = true,
      with_sales_stats = true
    } = payload || {}

    const offset = (page - 1) * limit
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysFromNow = now + (30 * 24 * 60 * 60)

    /* ============================
       BUILD WHERE CONDITIONS
    ============================ */
    const conditions: SQL[] = []

    // SKU filter
    if (sku_id) {
      if (Array.isArray(sku_id)) {
        conditions.push(inArray(stock_purchases.sku_id, sku_id))
      } else {
        conditions.push(eq(stock_purchases.sku_id, sku_id))
      }
    }

    // Supplier filter
    if (supplier_id) {
      if (Array.isArray(supplier_id)) {
        conditions.push(inArray(stock_purchases.supplier_id, supplier_id))
      } else {
        conditions.push(eq(stock_purchases.supplier_id, supplier_id))
      }
    }

    // Deleted filter
    if (is_deleted !== 'both') {
      conditions.push(eq(stock_purchases.is_deleted, is_deleted === 'yes'))
    }

    // Date range filters
    if (date_from) {
      conditions.push(sql`${stock_purchases.purchased_on} >= ${date_from}`)
    }
    if (date_to) {
      conditions.push(sql`${stock_purchases.purchased_on} <= ${date_to}`)
    }

    // Expiry date filters
    if (expiry_from) {
      conditions.push(sql`${stock_purchases.expiry_date} >= ${expiry_from}`)
    }
    if (expiry_to) {
      conditions.push(sql`${stock_purchases.expiry_date} <= ${expiry_to}`)
    }
    
    // Expiring soon filter (within 30 days)
    if (expiring_soon_only) {
      conditions.push(
        sql`${stock_purchases.expiry_date} IS NOT NULL AND 
            ${stock_purchases.expiry_date} <= ${thirtyDaysFromNow} AND
            ${stock_purchases.expiry_date} >= ${now}`
      )
    }

    // Batch number filter
    if (batch_number) {
      const batchCondition = like(stock_purchases.batch_number, `%${batch_number}%`)
      if (batchCondition) {
        conditions.push(batchCondition)
      }
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    /* ============================
       CALCULATE METRICS SUBQUERIES
    ============================ */
    
    // Sold quantity subquery
    const soldQuantitySubquery = sql<number>`COALESCE((
      SELECT SUM(${sales.quantity})
      FROM ${sales}
      WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
      AND ${sales.is_deleted} = 0
      AND ${sales.has_been_canceled} = 0
      AND ${sales.status} = 'completed'
    ), 0)`.as('sold_quantity')
    
    // Revenue subquery
    const revenueSubquery = sql<number>`COALESCE((
      SELECT SUM(${sales.total_price})
      FROM ${sales}
      WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
      AND ${sales.is_deleted} = 0
      AND ${sales.has_been_canceled} = 0
      AND ${sales.status} = 'completed'
    ), 0)`.as('revenue')
    
    // Shipping from sales subquery
    const shippingFromSalesSubquery = sql<number>`COALESCE((
      SELECT SUM(${sales.shipping_cost})
      FROM ${sales}
      WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
      AND ${sales.is_deleted} = 0
      AND ${sales.has_been_canceled} = 0
      AND ${sales.status} = 'completed'
    ), 0)`.as('shipping_from_sales')
    
    // Sale count subquery
    const saleCountSubquery = sql<number>`COALESCE((
      SELECT COUNT(*)
      FROM ${sales}
      WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
      AND ${sales.is_deleted} = 0
      AND ${sales.has_been_canceled} = 0
      AND ${sales.status} = 'completed'
    ), 0)`.as('sale_count')
    
    // First sale date subquery
    const firstSaleDateSubquery = sql<number>`(
      SELECT MIN(${sales.sold_on})
      FROM ${sales}
      WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
      AND ${sales.is_deleted} = 0
      AND ${sales.has_been_canceled} = 0
      AND ${sales.status} = 'completed'
    )`.as('first_sale_date')
    
    // Last sale date subquery
    const lastSaleDateSubquery = sql<number>`(
      SELECT MAX(${sales.sold_on})
      FROM ${sales}
      WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
      AND ${sales.is_deleted} = 0
      AND ${sales.has_been_canceled} = 0
      AND ${sales.status} = 'completed'
    )`.as('last_sale_date')

    /* ============================
       GET TOTAL COUNT
    ============================ */
    // const countResult = db()
    //   .select({ count: sql<number>`COUNT(*)` })
    //   .from(stock_purchases)
    //   .where(whereConditions)
    //   .get()

    // const total = countResult?.count ?? 0

    /* ============================
       BUILD ORDER BY
    ============================ */
    let orderByClause: SQL

    switch (sort_by) {
      case 'purchased_on':
        orderByClause = sort_order === 'asc'
          ? asc(stock_purchases.purchased_on)
          : desc(stock_purchases.purchased_on)
        break
      case 'expiry_date':
        orderByClause = sort_order === 'asc'
          ? asc(stock_purchases.expiry_date)
          : desc(stock_purchases.expiry_date)
        break
      case 'price_per_unit':
        orderByClause = sort_order === 'asc'
          ? asc(stock_purchases.price_per_unit)
          : desc(stock_purchases.price_per_unit)
        break
      case 'profit_margin':
      case 'sell_through_rate':
      case 'remaining_quantity':
        // Will be handled after calculation
        orderByClause = desc(stock_purchases.purchased_on)
        break
      default:
        orderByClause = desc(stock_purchases.purchased_on)
    }

    /* ============================
       FETCH STOCK PURCHASES WITH METRICS
    ============================ */
    const baseQuery = db()
      .select({
        // Core fields
        id: stock_purchases.id,
        sku_id: stock_purchases.sku_id,
        sync_id: stock_purchases.sync_id,
        
        // Quantity
        quantity_bought: stock_purchases.quantity_bought,
        
        // Cost fields
        price_per_unit: stock_purchases.price_per_unit,
        total_price_bought: stock_purchases.total_price_bought,
        shipping_cost: stock_purchases.shipping_cost,
        
        // Selling price targets
        min_selling_price: stock_purchases.min_selling_price,
        max_selling_price: stock_purchases.max_selling_price,
        
        // Product information
        manufacture_date: stock_purchases.manufacture_date,
        expiry_date: stock_purchases.expiry_date,
        batch_number: stock_purchases.batch_number,
        
        // Dates
        purchased_on: stock_purchases.purchased_on,
        arrived_on: stock_purchases.arrived_on,
        created_on: stock_purchases.created_on,
        updated_on: stock_purchases.updated_on,
        
        // Flags
        is_deleted: stock_purchases.is_deleted,
        is_sync_required: stock_purchases.is_sync_required,
        
        // Supplier
        supplier_id: stock_purchases.supplier_id,
        
        // Sales metrics (if requested)
        ...(with_sales_stats ? {
          sold_quantity: soldQuantitySubquery,
          revenue: revenueSubquery,
          shipping_from_sales: shippingFromSalesSubquery,
          sale_count: saleCountSubquery,
          first_sale_date: firstSaleDateSubquery,
          last_sale_date: lastSaleDateSubquery
        } : {})
      })
      .from(stock_purchases)
      .where(whereConditions)
      .orderBy(orderByClause)

    const purchaseList = should_paginate
      ? baseQuery.limit(limit).offset(offset).all()
      : baseQuery.all()

    if (purchaseList.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          pagination: should_paginate ? {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false,
            returned: 0,
            from: 0,
            to: 0
          } : undefined,
          summary: createEmptyPurchaseSummary()
        }
      }
    }

    /* ============================
       FETCH RELATED DATA
    ============================ */
    const skuIds = [...new Set(purchaseList.map(p => p.sku_id))]
    const supplierIds = [...new Set(purchaseList.map(p => p.supplier_id).filter((id): id is number => 
      id !== null && id !== undefined && id > 0
    ))]

    // Fetch SKU details with product info
    let skuMap = new Map()
    if (with_sku_details && skuIds.length > 0) {
      const skuDetails = db()
        .select({
          id: sku.id,
          sku_name: sku.sku_name,
          code: sku.code,
          is_active: sku.is_active,
          product_id: sku.product_id,
          product_name: products.product_name,
          product_category_id: products.category_id
        })
        .from(sku)
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(inArray(sku.id, skuIds))
        .all()
      
      skuMap = new Map(skuDetails.map(s => [s.id, s]))
    }

    // Fetch supplier details
    let supplierMap = new Map()
    if (with_supplier_details && supplierIds.length > 0) {
      const supplierDetails = db()
        .select({
          id: suppliers.id,
          supplier_name: suppliers.supplier_name,
          contact_person: suppliers.contact_person,
          email: suppliers.email,
          phone_number: suppliers.phone_number,
          is_active: suppliers.is_active
        })
        .from(suppliers)
        .where(inArray(suppliers.id, supplierIds))
        .all()
      
      supplierMap = new Map(supplierDetails.map(s => [s.id, s]))
    }

    /* ============================
       CALCULATE METRICS FOR EACH PURCHASE
    ============================ */
    let items = purchaseList.map(p => {
      // Core calculations
      const landedCostPerUnit = (p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought
      const totalLandedCost = p.total_price_bought + (p.shipping_cost || 0)
      
      // Sales metrics (if available)
      const soldQuantity = with_sales_stats ? (p.sold_quantity || 0) : 0
      const remainingQuantity = p.quantity_bought - soldQuantity
      const sellThroughRate = p.quantity_bought > 0 ? (soldQuantity / p.quantity_bought) * 100 : 0
      
      // Financial metrics
      const revenue = with_sales_stats ? (p.revenue || 0) : 0
      const shippingFromSales = with_sales_stats ? (p.shipping_from_sales || 0) : 0
      const costOfSold = landedCostPerUnit * soldQuantity
      const profit = revenue - costOfSold - shippingFromSales
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0
      
      // Expected revenue based on min/max prices
      const minPrice = p.min_selling_price || (p.price_per_unit * 1.1)
      const maxPrice = p.max_selling_price || (p.price_per_unit * 1.3)
      const avgPrice = (minPrice + maxPrice) / 2
      
      const expectedRevenue = {
        min: p.quantity_bought * minPrice,
        max: p.quantity_bought * maxPrice,
        avg: p.quantity_bought * avgPrice
      }
      
      // Expected profit (based on average expected revenue)
      const expectedProfit = expectedRevenue.avg - totalLandedCost
      const expectedProfitMargin = expectedRevenue.avg > 0 ? (expectedProfit / expectedRevenue.avg) * 100 : 0
      
      // Days calculations
      const daysInInventory = p.purchased_on 
        ? Math.round((now - Number(p.purchased_on)) / (24 * 60 * 60))
        : null
      
      const daysToExpiry = p.expiry_date 
        ? Math.round((Number(p.expiry_date) - now) / (24 * 60 * 60))
        : null
      
      // Performance rating
      let performanceRating: 'Excellent' | 'Good' | 'Average' | 'Poor' = 'Average'
      if (sellThroughRate > 80 && profitMargin > 30) {
        performanceRating = 'Excellent'
      } else if (sellThroughRate > 60 && profitMargin > 20) {
        performanceRating = 'Good'
      } else if (sellThroughRate > 30 && profitMargin > 10) {
        performanceRating = 'Average'
      } else {
        performanceRating = 'Poor'
      }
      
      // Stock status
      let stockStatus: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked' = 'In Stock'
      if (remainingQuantity <= 0) {
        stockStatus = 'Out of Stock'
      } else if (remainingQuantity < p.quantity_bought * 0.2) {
        stockStatus = 'Low Stock'
      } else if (remainingQuantity > p.quantity_bought * 0.8 && daysInInventory && daysInInventory > 90) {
        stockStatus = 'Overstocked'
      }
      
      return {
        // Core purchase data
        id: p.id,
        sync_id: p.sync_id,
        batch_number: p.batch_number,
        
        // SKU details
        sku_id: p.sku_id,
        sku: skuMap.get(p.sku_id) || { id: p.sku_id, sku_name: 'Unknown', code: 'Unknown' },
        
        // Supplier details
        supplier_id: p.supplier_id,
        supplier: p.supplier_id && supplierMap.has(p.supplier_id) 
          ? supplierMap.get(p.supplier_id)
          : null,
        
        // Quantity metrics
        quantities: {
          bought: p.quantity_bought,
          sold: soldQuantity,
          remaining: remainingQuantity,
          sell_through_rate: Number(sellThroughRate.toFixed(1))
        },
        
        // Cost metrics
        costs: {
          price_per_unit: p.price_per_unit,
          shipping_cost: p.shipping_cost || 0,
          landed_cost_per_unit: Number(landedCostPerUnit.toFixed(2)),
          total_landed_cost: Number(totalLandedCost.toFixed(2))
        },
        
        // Pricing targets
        selling_price_range: {
          min: minPrice,
          max: maxPrice,
          avg: avgPrice
        },
        
        // Financial performance
        financials: {
          revenue: Number(revenue.toFixed(2)),
          cost_of_sold: Number(costOfSold.toFixed(2)),
          shipping_paid_on_sales: Number(shippingFromSales.toFixed(2)),
          profit: Number(profit.toFixed(2)),
          profit_margin: Number(profitMargin.toFixed(2)),
          
          // Expected vs actual
          expected_revenue: expectedRevenue,
          expected_profit: Number(expectedProfit.toFixed(2)),
          expected_profit_margin: Number(expectedProfitMargin.toFixed(2)),
          
          // Variance analysis
          revenue_vs_expected: {
            vs_min: revenue - expectedRevenue.min,
            vs_avg: revenue - expectedRevenue.avg,
            vs_max: revenue - expectedRevenue.max
          }
        },
        
        // Dates
        dates: {
          purchased: p.purchased_on,
          arrived: p.arrived_on,
          created: p.created_on,
          updated: p.updated_on,
          manufacture: p.manufacture_date,
          expiry: p.expiry_date
        },
        
        // Time metrics
        time_metrics: {
          days_in_inventory: daysInInventory,
          days_to_expiry: daysToExpiry,
          is_expired: daysToExpiry !== null && daysToExpiry < 0,
          is_expiring_soon: daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30,
          first_sale_date: p.first_sale_date || null,
          last_sale_date: p.last_sale_date || null,
          days_since_last_sale: p.last_sale_date 
            ? Math.round((now - Number(p.last_sale_date)) / (24 * 60 * 60))
            : null
        },
        
        // Sales metrics
        sales_metrics: with_sales_stats ? {
          sale_count: p.sale_count || 0,
          avg_sale_quantity: p.sale_count ? Math.round((soldQuantity / p.sale_count) * 10) / 10 : 0,
          avg_daily_sales: daysInInventory ? Number((soldQuantity / daysInInventory).toFixed(2)) : 0
        } : undefined,
        
        // Performance rating
        performance: {
          rating: performanceRating,
          stock_status: stockStatus,
          is_profitable: profit > 0,
          is_fully_sold: remainingQuantity <= 0,
          has_sales: (p.sale_count || 0) > 0
        },
        
        // Flags
        is_deleted: p.is_deleted === true,
        is_sync_required: p.is_sync_required === true
      }
    })

    /* ============================
       APPLY POST-QUERY FILTERS
    ============================ */
    if (min_profit_margin !== undefined) {
      items = items.filter(i => (i.financials.profit_margin || 0) >= min_profit_margin)
    }
    if (max_profit_margin !== undefined) {
      items = items.filter(i => (i.financials.profit_margin || 0) <= max_profit_margin)
    }
    if (min_sell_through !== undefined) {
      items = items.filter(i => i.quantities.sell_through_rate >= min_sell_through)
    }
    if (max_sell_through !== undefined) {
      items = items.filter(i => i.quantities.sell_through_rate <= max_sell_through)
    }
    if (has_remaining_stock !== undefined) {
      items = items.filter(i => has_remaining_stock ? i.quantities.remaining > 0 : i.quantities.remaining <= 0)
    }

    /* ============================
       APPLY SORTING FOR CALCULATED FIELDS
    ============================ */
    if (sort_by === 'profit_margin') {
      items.sort((a, b) => {
        const aVal = a.financials.profit_margin || 0
        const bVal = b.financials.profit_margin || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    } else if (sort_by === 'sell_through_rate') {
      items.sort((a, b) => {
        const aVal = a.quantities.sell_through_rate || 0
        const bVal = b.quantities.sell_through_rate || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    } else if (sort_by === 'remaining_quantity') {
      items.sort((a, b) => {
        const aVal = a.quantities.remaining || 0
        const bVal = b.quantities.remaining || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    /* ============================
       CALCULATE AGGREGATE STATISTICS
    ============================ */
    const summary = {
      total_purchases: items.length,
      total_quantity_bought: items.reduce((sum, i) => sum + i.quantities.bought, 0),
      total_quantity_sold: items.reduce((sum, i) => sum + i.quantities.sold, 0),
      total_quantity_remaining: items.reduce((sum, i) => sum + i.quantities.remaining, 0),
      
      total_cost: Number(items.reduce((sum, i) => sum + i.costs.total_landed_cost, 0).toFixed(2)),
      total_revenue: Number(items.reduce((sum, i) => sum + i.financials.revenue, 0).toFixed(2)),
      total_profit: Number(items.reduce((sum, i) => sum + i.financials.profit, 0).toFixed(2)),
      
      avg_profit_margin: items.length > 0 
        ? Number((items.reduce((sum, i) => sum + i.financials.profit_margin, 0) / items.length).toFixed(2))
        : 0,
      
      total_expected_revenue: Number(items.reduce((sum, i) => sum + i.financials.expected_revenue.avg, 0).toFixed(2)),
      total_expected_profit: Number(items.reduce((sum, i) => sum + i.financials.expected_profit, 0).toFixed(2)),
      
      performance_breakdown: {
        excellent: items.filter(i => i.performance.rating === 'Excellent').length,
        good: items.filter(i => i.performance.rating === 'Good').length,
        average: items.filter(i => i.performance.rating === 'Average').length,
        poor: items.filter(i => i.performance.rating === 'Poor').length
      },
      
      stock_status_breakdown: {
        in_stock: items.filter(i => i.performance.stock_status === 'In Stock').length,
        low_stock: items.filter(i => i.performance.stock_status === 'Low Stock').length,
        overstocked: items.filter(i => i.performance.stock_status === 'Overstocked').length,
        out_of_stock: items.filter(i => i.performance.stock_status === 'Out of Stock').length
      },
      
      expiring_soon: items.filter(i => i.time_metrics.is_expiring_soon).length,
      expired: items.filter(i => i.time_metrics.is_expired).length,
      
      total_value_at_risk: Number(items
        .filter(i => i.time_metrics.is_expiring_soon || i.time_metrics.is_expired)
        .reduce((sum, i) => sum + (i.quantities.remaining * i.costs.landed_cost_per_unit), 0)
        .toFixed(2))
    }

    /* ============================
       APPLY PAGINATION AFTER FILTERS
    ============================ */
    const filteredTotal = items.length
    const paginatedItems = should_paginate
      ? items.slice(offset, offset + limit)
      : items

    const totalPages = Math.ceil(filteredTotal / limit)

    return {
      success: true,
      data: {
        items: paginatedItems,
        pagination: should_paginate ? {
          page,
          limit,
          total: filteredTotal,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
          returned: paginatedItems.length,
          from: offset + 1,
          to: offset + paginatedItems.length
        } : undefined,
        summary
      }
    }

  } catch (error) {
    console.error('Error fetching stock purchases:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch stock purchases.'
    }
  }
})

function createEmptyPurchaseSummary() {
  return {
    total_purchases: 0,
    total_quantity_bought: 0,
    total_quantity_sold: 0,
    total_quantity_remaining: 0,
    total_cost: 0,
    total_revenue: 0,
    total_profit: 0,
    avg_profit_margin: 0,
    total_expected_revenue: 0,
    total_expected_profit: 0,
    performance_breakdown: {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0
    },
    stock_status_breakdown: {
      in_stock: 0,
      low_stock: 0,
      overstocked: 0,
      out_of_stock: 0
    },
    expiring_soon: 0,
    expired: 0,
    total_value_at_risk: 0
  }
}


ipcMain.handle('stock-purchases:get-by-id', async (_event, payload: GetStockPurchaseByIdPayload) => {
  try {
    const { 
      id, 
      include_deleted = false,
      with_sales_history = true,
      sales_limit = 50
    } = payload

    if (!id) {
      return { success: false, message: 'Stock purchase ID is required.' }
    }

    /* ============================
       FETCH STOCK PURCHASE WITH DETAILS
    ============================ */
    const purchase = db()
      .select({
        // Core purchase fields
        id: stock_purchases.id,
        sync_id: stock_purchases.sync_id,
        sku_id: stock_purchases.sku_id,
        
        // Quantity
        quantity_bought: stock_purchases.quantity_bought,
        
        // Cost fields
        price_per_unit: stock_purchases.price_per_unit,
        total_price_bought: stock_purchases.total_price_bought,
        shipping_cost: stock_purchases.shipping_cost,
        
        // Selling price targets
        min_selling_price: stock_purchases.min_selling_price,
        max_selling_price: stock_purchases.max_selling_price,
        
        // Product information
        manufacture_date: stock_purchases.manufacture_date,
        expiry_date: stock_purchases.expiry_date,
        batch_number: stock_purchases.batch_number,
        
        // Dates
        purchased_on: stock_purchases.purchased_on,
        arrived_on: stock_purchases.arrived_on,
        created_on: stock_purchases.created_on,
        updated_on: stock_purchases.updated_on,
        
        // Flags
        is_deleted: stock_purchases.is_deleted,
        is_sync_required: stock_purchases.is_sync_required,
        
        // Supplier
        supplier_id: stock_purchases.supplier_id,
        
        // SKU details
        sku_name: sku.sku_name,
        sku_code: sku.code,
        sku_is_active: sku.is_active,
        
        // Product details
        product_id: sku.product_id,
        product_name: products.product_name,
        product_category_id: products.category_id,
        
        // Supplier details
        supplier_name: suppliers.supplier_name,
        supplier_contact: suppliers.contact_person,
        supplier_email: suppliers.email,
        supplier_phone: suppliers.phone_number,
        supplier_is_active: suppliers.is_active
      })
      .from(stock_purchases)
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .innerJoin(products, eq(sku.product_id, products.id))
      .leftJoin(suppliers, eq(stock_purchases.supplier_id, suppliers.id))
      .where(
        and(
          eq(stock_purchases.id, id),
          include_deleted ? undefined : eq(stock_purchases.is_deleted, false)
        )
      )
      .get()

    if (!purchase) {
      return { success: false, message: 'Stock purchase not found.' }
    }

    /* ============================
       FETCH ALL SALES FROM THIS BATCH
    ============================ */
    const sales_history = with_sales_history ? db()
      .select({
        id: sales.id,
        quantity: sales.quantity,
        total_price: sales.total_price,
        shipping_cost: sales.shipping_cost,
        sold_on: sales.sold_on,
        status: sales.status,
        customer_id: sales.customer_id,
        has_been_canceled: sales.has_been_canceled,
        
        // Calculate profit for this sale
        profit: sql<number>`(
          ${sales.total_price} - (
            (${purchase.total_price_bought} + COALESCE(${purchase.shipping_cost}, 0)) * 
            ${sales.quantity} / NULLIF(${purchase.quantity_bought}, 1)
          ) - COALESCE(${sales.shipping_cost}, 0)
        )`,
        
        profit_margin: sql<number>`(
          (${sales.total_price} - (
            (${purchase.total_price_bought} + COALESCE(${purchase.shipping_cost}, 0)) * 
            ${sales.quantity} / NULLIF(${purchase.quantity_bought}, 1)
          ) - COALESCE(${sales.shipping_cost}, 0)) * 100.0 / NULLIF(${sales.total_price}, 0)
        )`
      })
      .from(sales)
      .where(
        and(
          eq(sales.stock_purchased_id, id),
          eq(sales.is_deleted, false),
          eq(sales.has_been_canceled, false),
          eq(sales.status, 'completed')
        )
      )
      .orderBy(desc(sales.sold_on))
      .limit(sales_limit)
      .all() : []

    /* ============================
       CALCULATE CORE METRICS
    ============================ */
    const now = Date.now() / 1000
    const totalLandedCost = purchase.total_price_bought + (purchase.shipping_cost || 0)
    const landedCostPerUnit = totalLandedCost / purchase.quantity_bought
    
    // Sales metrics
    const totalSold = sales_history.reduce((sum, s) => sum + s.quantity, 0)
    const totalRevenue = sales_history.reduce((sum, s) => sum + s.total_price, 0)
    const totalShippingFromSales = sales_history.reduce((sum, s) => sum + (s.shipping_cost || 0), 0)
    const totalProfit = sales_history.reduce((sum, s) => sum + (s.profit || 0), 0)
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    
    const remainingQuantity = purchase.quantity_bought - totalSold
    const remainingValue = remainingQuantity * landedCostPerUnit
    const sellThroughRate = purchase.quantity_bought > 0 ? (totalSold / purchase.quantity_bought) * 100 : 0
    
    // Time metrics
    const daysInInventory = purchase.purchased_on 
      ? Math.round((now - Number(purchase.purchased_on)) / (24 * 60 * 60))
      : null
    
    const daysToExpiry = purchase.expiry_date 
      ? Math.round((Number(purchase.expiry_date) - now) / (24 * 60 * 60))
      : null
    
    const isExpired = daysToExpiry !== null && daysToExpiry < 0
    const isExpiringSoon = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30
    
    // Sales velocity
    const avgDailySales = daysInInventory ? totalSold / daysInInventory : 0
    const projectedDaysToSellRemaining = avgDailySales > 0 ? remainingQuantity / avgDailySales : null
    
    // Expected revenue based on min/max prices
    const minPrice = purchase.min_selling_price || (purchase.price_per_unit * 1.1)
    const maxPrice = purchase.max_selling_price || (purchase.price_per_unit * 1.3)
    const avgPrice = (minPrice + maxPrice) / 2
    
    const expectedRevenue = {
      min: purchase.quantity_bought * minPrice,
      max: purchase.quantity_bought * maxPrice,
      avg: purchase.quantity_bought * avgPrice,
      remaining: {
        min: remainingQuantity * minPrice,
        max: remainingQuantity * maxPrice,
        avg: remainingQuantity * avgPrice
      }
    }
    
    // Expected profit
    const expectedProfit = {
      min: expectedRevenue.min - totalLandedCost,
      max: expectedRevenue.max - totalLandedCost,
      avg: expectedRevenue.avg - totalLandedCost,
      remaining: {
        min: expectedRevenue.remaining.min - (remainingQuantity * landedCostPerUnit),
        max: expectedRevenue.remaining.max - (remainingQuantity * landedCostPerUnit),
        avg: expectedRevenue.remaining.avg - (remainingQuantity * landedCostPerUnit)
      }
    }
    
    // ROI calculations
    const roi = {
      overall: {
        min: totalLandedCost > 0 ? (expectedProfit.min / totalLandedCost) * 100 : 0,
        max: totalLandedCost > 0 ? (expectedProfit.max / totalLandedCost) * 100 : 0,
        avg: totalLandedCost > 0 ? (expectedProfit.avg / totalLandedCost) * 100 : 0
      },
      realized: {
        value: totalLandedCost > 0 ? (totalProfit / totalLandedCost) * 100 : 0,
        percent_of_expected: expectedProfit.avg !== 0 
          ? ((totalProfit / expectedProfit.avg) * 100) 
          : 0
      },
      projected: {
        if_sold_at_min: remainingQuantity > 0 ? ((expectedRevenue.remaining.min - (remainingQuantity * landedCostPerUnit)) / (remainingQuantity * landedCostPerUnit)) * 100 : 0,
        if_sold_at_avg: remainingQuantity > 0 ? ((expectedRevenue.remaining.avg - (remainingQuantity * landedCostPerUnit)) / (remainingQuantity * landedCostPerUnit)) * 100 : 0,
        if_sold_at_max: remainingQuantity > 0 ? ((expectedRevenue.remaining.max - (remainingQuantity * landedCostPerUnit)) / (remainingQuantity * landedCostPerUnit)) * 100 : 0
      }
    }
    
    // Performance rating
    let performanceRating: 'Excellent' | 'Good' | 'Average' | 'Poor' = 'Average'
    if (sellThroughRate > 80 && avgProfitMargin > 30) {
      performanceRating = 'Excellent'
    } else if (sellThroughRate > 60 && avgProfitMargin > 20) {
      performanceRating = 'Good'
    } else if (sellThroughRate > 30 && avgProfitMargin > 10) {
      performanceRating = 'Average'
    } else {
      performanceRating = 'Poor'
    }
    
    // Stock status
    let stockStatus: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked' = 'In Stock'
    if (remainingQuantity <= 0) {
      stockStatus = 'Out of Stock'
    } else if (remainingQuantity < purchase.quantity_bought * 0.2) {
      stockStatus = 'Low Stock'
    } else if (remainingQuantity > purchase.quantity_bought * 0.8 && daysInInventory && daysInInventory > 90) {
      stockStatus = 'Overstocked'
    }
    
    // Variance analysis (actual vs expected)
    const revenueVariance = {
      vs_min: totalRevenue - expectedRevenue.min,
      vs_avg: totalRevenue - expectedRevenue.avg,
      vs_max: totalRevenue - expectedRevenue.max,
      percentage: expectedRevenue.avg > 0 ? ((totalRevenue - expectedRevenue.avg) / expectedRevenue.avg) * 100 : 0
    }
    
    const profitVariance = {
      vs_min: totalProfit - expectedProfit.min,
      vs_avg: totalProfit - expectedProfit.avg,
      vs_max: totalProfit - expectedProfit.max,
      percentage: expectedProfit.avg !== 0 ? ((totalProfit - expectedProfit.avg) / Math.abs(expectedProfit.avg)) * 100 : 0
    }
    
    // Daily sales breakdown
    const salesByDay = sales_history.reduce((acc, sale) => {
      const date = new Date(Number(sale.sold_on) * 1000).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          date,
          quantity: 0,
          revenue: 0,
          profit: 0
        }
      }
      acc[date].quantity += sale.quantity
      acc[date].revenue += sale.total_price
      acc[date].profit += sale.profit || 0
      return acc
    }, {} as Record<string, any>)
    
    const dailySalesBreakdown = Object.values(salesByDay).sort((a, b) => 
      (a.date > b.date ? -1 : 1)
    )

    /* ============================
       BUILD COMPLETE RESPONSE
    ============================ */
    return {
      success: true,
      data: {
        // Core purchase data
        id: purchase.id,
        sync_id: purchase.sync_id,
        batch_number: purchase.batch_number,
        
        // SKU details
        sku: {
          id: purchase.sku_id,
          name: purchase.sku_name,
          code: purchase.sku_code,
          is_active: purchase.sku_is_active === true,
          product: {
            id: purchase.product_id,
            name: purchase.product_name,
            category_id: purchase.product_category_id
          }
        },
        
        // Supplier details
        supplier: purchase.supplier_id ? {
          id: purchase.supplier_id,
          name: purchase.supplier_name,
          contact: purchase.supplier_contact,
          email: purchase.supplier_email,
          phone: purchase.supplier_phone,
          is_active: purchase.supplier_is_active === true
        } : null,
        
        // Quantity metrics
        quantities: {
          bought: purchase.quantity_bought,
          sold: totalSold,
          remaining: remainingQuantity,
          sell_through_rate: Number(sellThroughRate.toFixed(1))
        },
        
        // Cost metrics
        costs: {
          price_per_unit: purchase.price_per_unit,
          shipping_cost: purchase.shipping_cost || 0,
          landed_cost_per_unit: Number(landedCostPerUnit.toFixed(2)),
          total_landed_cost: Number(totalLandedCost.toFixed(2)),
          remaining_value: Number(remainingValue.toFixed(2))
        },
        
        // Pricing targets
        selling_price_range: {
          min: minPrice,
          max: maxPrice,
          avg: avgPrice
        },
        
        // Dates
        dates: {
          purchased: purchase.purchased_on,
          arrived: purchase.arrived_on,
          created: purchase.created_on,
          updated: purchase.updated_on,
          manufacture: purchase.manufacture_date,
          expiry: purchase.expiry_date
        },
        
        // Time metrics
        time_metrics: {
          days_in_inventory: daysInInventory,
          days_to_expiry: daysToExpiry,
          is_expired: isExpired,
          is_expiring_soon: isExpiringSoon,
          avg_daily_sales: Number(avgDailySales.toFixed(2)),
          projected_days_to_sell_remaining: projectedDaysToSellRemaining 
            ? Math.round(projectedDaysToSellRemaining) 
            : null
        },
        
        // Financial performance
        financials: {
          // Actual performance
          actual: {
            revenue: Number(totalRevenue.toFixed(2)),
            shipping_paid: Number(totalShippingFromSales.toFixed(2)),
            profit: Number(totalProfit.toFixed(2)),
            profit_margin: Number(avgProfitMargin.toFixed(2))
          },
          
          // Expected performance
          expected: {
            revenue: expectedRevenue,
            profit: expectedProfit,
            roi: roi.overall
          },
          
          // Remaining potential
          remaining_potential: {
            revenue: expectedRevenue.remaining,
            profit: expectedProfit.remaining,
            roi: {
              min: Number(roi.projected.if_sold_at_min.toFixed(2)),
              avg: Number(roi.projected.if_sold_at_avg.toFixed(2)),
              max: Number(roi.projected.if_sold_at_max.toFixed(2))
            }
          },
          
          // ROI analysis
          roi: {
            realized: Number(roi.realized.value.toFixed(2)),
            percent_of_expected: Number(roi.realized.percent_of_expected.toFixed(1)),
            projected: roi.projected
          }
        },
        
        // Variance analysis
        variance: {
          revenue: {
            vs_min: Number(revenueVariance.vs_min.toFixed(2)),
            vs_avg: Number(revenueVariance.vs_avg.toFixed(2)),
            vs_max: Number(revenueVariance.vs_max.toFixed(2)),
            percentage: Number(revenueVariance.percentage.toFixed(1))
          },
          profit: {
            vs_min: Number(profitVariance.vs_min.toFixed(2)),
            vs_avg: Number(profitVariance.vs_avg.toFixed(2)),
            vs_max: Number(profitVariance.vs_max.toFixed(2)),
            percentage: Number(profitVariance.percentage.toFixed(1))
          }
        },
        
        // Sales history
        sales_history: sales_history.map(s => ({
          id: s.id,
          quantity: s.quantity,
          total_price: Number(s.total_price.toFixed(2)),
          shipping_cost: Number((s.shipping_cost || 0).toFixed(2)),
          sold_on: s.sold_on,
          profit: Number((s.profit || 0).toFixed(2)),
          profit_margin: Number((s.profit_margin || 0).toFixed(2))
        })),
        
        // Daily sales breakdown
        daily_sales_breakdown: dailySalesBreakdown,
        
        // Performance rating
        performance: {
          rating: performanceRating,
          stock_status: stockStatus,
          is_profitable: totalProfit > 0,
          is_fully_sold: remainingQuantity <= 0,
          has_exceeded_expectations: profitVariance.percentage > 10,
          has_met_expectations: profitVariance.percentage >= -10 && profitVariance.percentage <= 10,
          has_missed_expectations: profitVariance.percentage < -10
        },
        
        // Flags
        is_deleted: purchase.is_deleted === true,
        is_sync_required: purchase.is_sync_required === true
      }
    }

  } catch (error) {
    console.error('Error fetching stock purchase by id:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch stock purchase.'
    }
  }
})


ipcMain.handle('stock-purchases:update', async (_event, payload: UpdateStockPurchasePayload) => {
  try {
    const { id } = payload

    if (!id) {
      return { success: false, message: 'Stock purchase ID is required.' }
    }

    /* ============================
       CHECK IF PURCHASE EXISTS
    ============================ */
    const existing = db()
      .select({
        id: stock_purchases.id,
        sku_id: stock_purchases.sku_id,
        quantity_bought: stock_purchases.quantity_bought,
        manufacture_date: stock_purchases.manufacture_date,
        expiry_date: stock_purchases.expiry_date,
      })
      .from(stock_purchases)
      .where(and(eq(stock_purchases.id, id), eq(stock_purchases.is_deleted, false)))
      .get()

    if (!existing) {
      return { success: false, message: 'Stock purchase not found.' }
    }

    /* ============================
       VALIDATION
    ============================ */
    if (payload.quantity !== undefined && payload.quantity <= 0) {
      return { success: false, message: 'Quantity must be greater than 0.' }
    }

    if (payload.price_per_unit !== undefined && payload.price_per_unit <= 0) {
      return { success: false, message: 'Price per unit must be greater than 0.' }
    }

    if (payload.total_price_bought !== undefined && payload.total_price_bought <= 0) {
      return { success: false, message: 'Total price must be greater than 0.' }
    }

    // Validate dates
    const manufactureDate = payload.manufacture_date ?? existing.manufacture_date
    const expiryDate = payload.expiry_date ?? existing.expiry_date

    if (manufactureDate && expiryDate && manufactureDate > expiryDate) {
      return { success: false, message: 'Manufacture date cannot be after expiry date.' }
    }

    // Check supplier if provided
    if (payload.supplier_id !== undefined && payload.supplier_id !== null && payload.supplier_id > 0) {
      const supplierExists = db()
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(and(eq(suppliers.id, payload.supplier_id), eq(suppliers.is_deleted, false)))
        .get()

      if (!supplierExists) {
        return { success: false, message: 'Supplier not found.' }
      }
    }

    /* ============================
   BUILD UPDATE DATA
============================ */
const updateData: any = {
  updated_on: sql`(strftime('%s', 'now'))`,
  is_sync_required: true
}

if (payload.quantity !== undefined) updateData.quantity_bought = payload.quantity  // Note: field name is quantity_bought
if (payload.price_per_unit !== undefined) updateData.price_per_unit = payload.price_per_unit
if (payload.total_price_bought !== undefined) updateData.total_price_bought = payload.total_price_bought
if (payload.shipping_cost !== undefined) updateData.shipping_cost = payload.shipping_cost
if (payload.min_price !== undefined) updateData.min_selling_price = payload.min_price  // Note: field name is min_selling_price
if (payload.max_price !== undefined) updateData.max_selling_price = payload.max_price  // Note: field name is max_selling_price
// Text fields - these should be strings (ISO dates)
if (payload.manufacture_date !== undefined) updateData.manufacture_date = payload.manufacture_date
if (payload.expiry_date !== undefined) updateData.expiry_date = payload.expiry_date
if (payload.batch_number !== undefined) updateData.batch_number = payload.batch_number

// Timestamp fields - convert Unix timestamps to Date objects
if (payload.purchased_on !== undefined) {
  updateData.purchased_on = new Date(payload.purchased_on * 1000) // Convert seconds to milliseconds
}
if (payload.arrived_on !== undefined) {
  updateData.arrived_on = new Date(payload.arrived_on * 1000) // Convert seconds to milliseconds
}

// Supplier field
if (payload.supplier_id !== undefined) updateData.supplier_id = payload.supplier_id

    /* ============================
       PERFORM UPDATE
    ============================ */
    db()
      .update(stock_purchases)
      .set(updateData)
      .where(eq(stock_purchases.id, id))
      .run()

    /* ============================
       FETCH UPDATED PURCHASE
    ============================ */
    const updated = db()
      .select({
        id: stock_purchases.id,
        sku_id: stock_purchases.sku_id,
        quantity_bought: stock_purchases.quantity_bought,
        price_per_unit: stock_purchases.price_per_unit,
        total_price_bought: stock_purchases.total_price_bought,
        // avg_anticipated_profit_margin: stock_purchases.avg_anticipated_profit_margin,
        updated_on: stock_purchases.updated_on
      })
      .from(stock_purchases)
      .where(eq(stock_purchases.id, id))
      .get()

    return {
      success: true,
      message: 'Stock purchase updated successfully.',
      data: updated
    }

  } catch (error) {
    console.error('Error updating stock purchase:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update stock purchase.'
    }
  }
})


ipcMain.handle('stock-purchases:soft-delete', async (_event, payload: DeleteStockPurchasePayload) => {
  try {
    const { id, restore = false } = payload
    const action = restore ? 'restore' : 'delete'
    const actionPastTense = restore ? 'restored' : 'deleted'

    if (!id) {
      return { success: false, message: `Stock purchase ID is required for ${action}.` }
    }

    /* ============================
       CHECK IF PURCHASE EXISTS
    ============================ */
    const purchase = db()
      .select({
        id: stock_purchases.id,
        is_deleted: stock_purchases.is_deleted,
        sku_id: stock_purchases.sku_id,
        batch_number: stock_purchases.batch_number
      })
      .from(stock_purchases)
      .where(eq(stock_purchases.id, id))
      .get()

    if (!purchase) {
      return { success: false, message: 'Stock purchase not found.' }
    }

    // Check if already in desired state
    if (restore && !purchase.is_deleted) {
      return { success: false, message: 'Stock purchase is already active.' }
    }
    if (!restore && purchase.is_deleted) {
      return { success: false, message: 'Stock purchase is already deleted.' }
    }

    /* ============================
       PERFORM SOFT DELETE/RESTORE
    ============================ */
    db()
      .update(stock_purchases)
      .set({
        is_deleted: restore ? false : true,
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      })
      .where(eq(stock_purchases.id, id))
      .run()

    // Mark parent SKU and product for sync
    const skuInfo = db()
      .select({ product_id: sku.product_id })
      .from(sku)
      .where(eq(sku.id, purchase.sku_id))
      .get()

    if (skuInfo) {
      db()
        .update(products)
        .set({
          is_sync_required: true,
          updated_on: sql`(strftime('%s', 'now'))`
        })
        .where(eq(products.id, skuInfo.product_id))
        .run()
    }

    return {
      success: true,
      message: `Stock purchase ${actionPastTense} successfully.`,
      data: {
        id,
        action,
        restored: restore,
        batch_number: purchase.batch_number
      }
    }

  } catch (error) {
    console.error(`Error in stock purchase ${payload.restore ? 'restore' : 'delete'}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} stock purchase.`
    }
  }
})