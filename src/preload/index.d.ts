// preload/index.d.ts

export { }
import type {
  CreateEmployeeByAdminPayload,
  CreateProductCategoryPayload,
  CreateProductPayload,
  CreateTransactionPayload,
  CreateTransactionResponse,
  DeleteCategoryPayload,
  GetAllTransactionsPayload,
  GetAllTransactionsResponse,
  GetCategoriesPayload,
  GetEmployeesPayload,
  GetProductByIdPayload, GetProductsByCategoryPayload,
  GetProductsPayload,
  GetTransactionByIdPayload,
  GetTransactionByIdResponse,
  GetTransactionsByEmployeePayload,
  GetTransactionsByEmployeeResponse,
  SoftDeleteTransactionPayload,
  SoftDeleteTransactionResponse,
  UpdateProductCategoryPayload,
  UpdateProductPayload,
  UpdateTransactionPayload,
  UpdateTransactionResponse
} from './ipc/type'

// ============================================================================
// DASHBOARD TYPES - Add these to your existing imports
// ============================================================================

import type {
  AlertCenterData,
  CustomersDashboardData,
  // Dashboard Types
  DashboardFilters,
  DashboardResponse,
  FinancialsData,
  ForecastsData,
  InventoryDashboardData,
  OperationsData,
  OverviewDashboardData,
  ProductsDashboardData,
  SalesDashboardData,
  TimePatternsData
} from '../preload/ipc/dashboard/types/dashboard.types'

 
declare global {
  interface Window {
    api: {
      setup: {
        get: () => Promise<{
          success: boolean
          data?: { id: number; progress: number; skipped_stages: number[]; is_completed: number }
          message?: string
        }>
        update: (payload: {
          action: 'next' | 'previous' | 'skip' | 'unskip' | 'complete'
          stage?: number
        }) => Promise<{
          success: boolean
          data?: { id: number; progress: number; skipped_stages: number[]; is_completed: number }
          message?: string
        }>
      }
      businessBranch: {
        upsert: (payload: {
          business_name: string
          branch_location_name: string
          branch_location_coordinate?: { lat: number; long: number } | null
          branch_email_address?: string
          branch_phone_number?: string
          default_language?: string
          default_currency?: string
          verification_code?: string
          attempt_geolocation?: boolean
        }) => Promise<{
          success: boolean
          message?: string
          branchId?: number
        }>
        verify: (payload: { verification_code: string }) => Promise<{
          success: boolean
          message?: string
        }>
        get: () => Promise<{
          success: boolean
          data?: {
            id: number
            sync_id: number
            business_name: string
            branch_location_name: string
            branch_location_coordinate: string | null
            branch_email_address: string | null
            branch_phone_number: string | null
            default_language: string
            default_currency: string
            verification_code: string
            is_approved: number
            is_verified: number
            is_active: number
            is_deleted: number
            last_sync: string
          }
          message?: string
        }>
        updateLocation: () => Promise<{
          success: boolean
          message?: string
          coordinates?: { lat: number; long: number }
        }>
      }

      employees: {
        create: (payload: {
          username: string
          password: string
          role: string
          with_profile_pic?: boolean
          profile_pic_data?: string
          profile_pic_filename?: string
          profile_pic_mime_type?: string
        }) => Promise<{
          success: boolean
          message?: string
          data?: { id: number }
        }>

        createByAdmin: (payload: CreateEmployeeByAdminPayload) => Promise<{
          success: boolean
          message?: string
          data?: { id: number }
        }>
        
        get: (payload?: GetEmployeesPayload) => Promise<{
          success: boolean
          data?: {
            employees: Array<{
              id: number
              sync_id: string | null
              username: string
              role: string

              first_name: string | null
              last_name: string | null
              email: string | null
              phone: string | null

              created_on: string
              updated_on: string

              is_deleted: boolean
              last_sync: string | null
              is_sync_required: boolean
              is_active: boolean

              profile_picture?: {
                path: string
                filename: string
                original_filename: string
                mime_type: string
                file_size: number
                uploaded_at: string
              } | null
            }>
            pagination: {
              page: number
              limit: number
              total: number
              totalPages: number
            }
          }
          message?: string
        }>

        getById: (payload: { id: number; with_profile_pic?: boolean }) => Promise<{
          success: boolean
          data?: {
            id: number
            sync_id: number
            username: string
            password_hash: string
            role: string
            first_name: string
            last_name: string
            email: string
            phone: string
            created_on: string
            updated_on: string
            is_deleted: number
            last_sync: string | null
            is_sync_required: number
            is_active: number
            profile_picture?: {
              path: string
              filename: string
              original_filename: string
              mime_type: string
              file_size: number
              uploaded_at: string
            } | null
          }
          message?: string
        }>
        getProfile: (payload: { with_profile_pic?: boolean }) => Promise<{
          success: boolean
          data?: {
            id: number
            sync_id: number
            username: string
            password_hash: string
            role: string
            first_name: string
            last_name: string
            email: string
            phone: string
            created_on: string
            updated_on: string
            is_deleted: number
            last_sync: string | null
            is_sync_required: number
            is_active: number
            profile_picture?: {
              path: string
              filename: string
              original_filename: string
              mime_type: string
              file_size: number
              uploaded_at: string
            } | null
          }
          message?: string
        }>
        update: (payload: {
          id: number
          username?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string
          password?: string
          role?: string
          is_active?: number
          with_profile_pic?: boolean
          profile_pic_data?: string
          profile_pic_filename?: string
          profile_pic_mime_type?: string
        }) => Promise<{
          success: boolean
          message?: string
        }>
        delete: (payload: { id: number, restore?: boolean }) => Promise<{
          success: boolean
          message?: string
        }>
        login: (payload: { username: string; password: string; role: string }) => Promise<{
          success: boolean
          message?: string
          data?: {
            employee: {
              id: number
              username: string
              role: string
            }
            sessionToken: string
          }
        }>

        logout: () => Promise<{
          success: boolean
          message?: string
        }>

        getCurrentSession: () => Promise<{
          success: boolean
          data?: {
            employee: {
              id: number
              username: string
              role: string
            }
            loginTime: Date
          }
          message?: string
        }>

        checkAuth: () => Promise<{
          success: boolean
          data?: { isAuthenticated: boolean }
          message?: string
        }>

      }
 
      departments: {
        get: ( payload?: { include_deleted?: boolean } ) => Promise<{
          success: boolean
          data?: Array<{
            id: number
            sync_id: string | null
            department_name: string

            created_on: string
            updated_on: string

            is_deleted: boolean
            last_sync: string | null
            is_sync_required: boolean
            is_active: boolean
          }>
          message?: string
        }>
      }

      products: {
        getCategories: (
          payload?: GetCategoriesPayload
        ) => Promise<{
          success: boolean
          data?: {
            categories: Array<{
              id: number
              sync_id: string | null
              category_name: string
              description: string

              parent_category_id: number | null

              created_on: string
              updated_on: string

              is_deleted: boolean
              last_sync: string | null
              is_sync_required: boolean
              is_active: boolean

              product_count: number
              sub_category_count: number

              image?: {
                path: string
                filename: string
                original_filename: string
                mime_type: string
                file_size: number
                uploaded_at: string
              } | null

              sub_categories: Array<{
                id: number
                sync_id: string | null
                category_name: string
                description: string

                parent_category_id: number | null

                created_on: string
                updated_on: string

                is_deleted: boolean
                last_sync: string | null
                is_sync_required: boolean
                is_active: boolean

                product_count: number
                sub_category_count: number

                image?: {
                  path: string
                  filename: string
                  original_filename: string
                  mime_type: string
                  file_size: number
                  uploaded_at: string
                } | null

                sub_categories: Array<any> // if you support deeper nesting
              }>
            }>
          }
          message?: string
        }>

        getCategoryById: (payload: { id: number; nested?: boolean }) => Promise<{
          success: boolean
          data?: {
            id: number
            sync_id: string | null
            category_name: string
            description: string

            parent_category_id: number | null

            created_on: string
            updated_on: string

            is_deleted: boolean
            last_sync: string | null
            is_sync_required: boolean
            is_active: boolean

            product_count: number
            sub_category_count: number

            image?: {
              path: string
              filename: string
              original_filename: string
              mime_type: string
              file_size: number
              uploaded_at: string
            } | null

            subcategories?: Array<{
              id: number
              sync_id: string | null
              category_name: string
              description: string

              parent_category_id: number | null

              created_on: string
              updated_on: string

              is_deleted: boolean
              last_sync: string | null
              is_sync_required: boolean
              is_active: boolean

              product_count: number
              sub_category_count: number

              image?: {
                path: string
                filename: string
                original_filename: string
                mime_type: string
                file_size: number
                uploaded_at: string
              } | null
            }>
          }
          message?: string
        }>

        createCategory: (payload: CreateProductCategoryPayload) => Promise<{
          success: boolean
          message?: string
          data?: { id: number }
        }>

        softDeleteCategory: (payload: DeleteCategoryPayload) => Promise<{
          success: boolean
          message?: string
        }>

        restoreCategory: (payload: { id: number, cascade?: boolean }) => Promise<{
          success: boolean
          message?: string
        }>

        updateCategory: (payload: UpdateProductCategoryPayload) => Promise<{
          success: boolean
          message?: string
        }>


        // Product methods
        createProduct: (payload: CreateProductPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            product_name: string
            images?: Array<{
              id: number
              path: string
              filename: string
              is_primary?: boolean
            }>
            image_count?: number
          }
        }>

      getAllProducts: (payload?: GetProductsPayload) => Promise<{
        success: boolean
        data?: {
          products: Array<{
            id: number
            product_name: string
            category_id: number
            category_name: string
            description: string | null
            created_on: number
            updated_on: number
            is_active: boolean
            is_deleted: boolean
            sku_count: number
            images?: Array<any>
            skus?: Array<any>
            metrics: {
              // Core inventory metrics
              total_items_bought: number
              total_items_sold: number
              total_items_remaining: number
              inventory_value: number
              
              // Financial metrics
              total_revenue: number
              total_cost: number
              total_profit: number
              profit_margin: number
              
              // SKU metrics
              sku_count: number
              avg_sku_profit_margin: number
              
              // Performance metrics
              sell_through_rate: number
              days_of_inventory: number
              
              // Status flags
              is_low_stock: boolean
              is_high_margin: boolean
              is_loss_making: boolean
              is_best_seller: boolean
              stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
            }
          }>
          pagination: {
            page: number
            limit: number
            total: number
            total_pages: number
            has_next: boolean
            has_prev: boolean
            returned: number
            from: number
            to: number
          }
          summary: {
            total_products: number
            total_items_bought: number
            total_items_sold: number
            total_items_remaining: number
            total_inventory_value: number
            total_revenue: number
            total_profit: number
            avg_profit_margin: number
            with_images: number
            with_skus: number
            with_stock: number
            out_of_stock: number
            low_stock: number
            overstocked: number
          }
        }
        message?: string
      }>

        getProductsByCategory: (payload: GetProductsByCategoryPayload) => Promise<{
          success: boolean
          data?: {
            category: {
              id: number
              name: string
              description: string | null
              parent_category_id: number | null
              is_active: boolean
              is_deleted: boolean
              created_on: number
              updated_on: number
            } | null
            products: Array<{
              id: number
              product_name: string
              category_id: number
              category_name: string
              description: string | null
              created_on: number
              updated_on: number
              is_active: boolean
              is_deleted: boolean
              sku_count: number
              images?: Array<any>
              skus?: Array<any>
              metrics: {
                total_items_bought: number
                total_items_sold: number
                total_items_remaining: number
                inventory_value: number
                total_revenue: number
                total_cost: number
                total_profit: number
                profit_margin: number
                sku_count: number
                avg_sku_profit_margin: number
                sell_through_rate: number
                days_of_inventory: number
                is_low_stock: boolean
                is_high_margin: boolean
                is_loss_making: boolean
                is_best_seller: boolean
                stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
              }
            }>
            pagination: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
              from: number
              to: number
            }
            summary: {
              category_id: number
              category_name: string
              total_products: number
              total_items_bought: number
              total_items_sold: number
              total_items_remaining: number
              total_inventory_value: number
              total_revenue: number
              total_profit: number
              avg_profit_margin: number
              with_images: number
              with_skus: number
              with_stock: number
              out_of_stock: number
              low_stock: number
              overstocked: number
            }
          }
          message?: string
        }>

        getProductById: (payload: GetProductByIdPayload) => Promise<{
          success: boolean
          data?: {
            // Basic info
            id: number
            sync_id: string | null
            product_name: string
            description: string | null
            created_on: number
            updated_on: number
            is_active: boolean
            is_deleted: boolean
            
            // Category with hierarchy
            category: {
              id: number
              name: string
              is_active: boolean
              hierarchy: Array<{ id: number; name: string }>
            } | null
            
            // Media
            images: Array<any>
            
            // SKUs
            skus: Array<{
              id: number
              sync_id: string | null
              sku_name: string
              code: string
              created_on: number
              updated_on: number
              is_active: boolean
              is_deleted: boolean
              images: Array<any>
              attributes: Array<any>
              recent_purchases: Array<any>
              total_purchases: number
              total_batches: number
              metrics: {
                // Volume
                total_bought: number
                total_sold: number
                total_remaining: number
                
                // Financial
                total_revenue: number
                total_cost: number
                total_shipping_paid: number
                total_profit: number
                profit_margin: number
                
                // Per-unit
                avg_cost_per_unit: number
                avg_selling_price: number
                avg_profit_per_unit: number
                
                // Performance
                sell_through_rate: number
                days_of_inventory: number
                
                // Status
                is_low_stock: boolean
                is_high_margin: boolean
                is_loss_making: boolean
                is_best_seller: boolean
                stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
              }
              batch_summary: {
                oldest_batch: string | null
                newest_batch: string | null
                total_batches: number
                active_batches: number
              }
            }>
            sku_count: number
            active_sku_count: number
            
            // Product metrics
            metrics: {
              // Volume
              total_items_bought: number
              total_items_sold: number
              total_items_remaining: number
              
              // Financial
              total_revenue: number
              total_cost: number
              total_shipping_paid: number
              total_profit: number
              profit_margin: number
              
              // Per-unit
              avg_cost_per_unit: number
              avg_selling_price: number
              avg_profit_per_unit: number
              
              // SKU metrics
              avg_sku_profit_margin: number
              
              // Performance
              sell_through_rate: number
              days_of_inventory: number
              
              // Status
              is_low_stock: boolean
              is_high_margin: boolean
              is_loss_making: boolean
              is_best_seller: boolean
              stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
            }
            
            // Summaries
            summary: {
              total_skus: number
              active_skus: number
              total_images: number
              total_attributes: number
              total_purchases: number
              total_sales: number
              total_suppliers: number
              last_purchase: number | null
              last_sale: number | null
            }
            
            // Analytics
            analytics: {
              monthly_sales_trend: Array<{
                month: string
                revenue: number
                profit: number
                quantity: number
                margin: number
              }>
              top_performing_skus: Array<{
                id: number
                sku_name: string
                total_sold: number
                total_profit: number
                profit_margin: number
              }>
              slow_moving_skus: Array<{
                id: number
                sku_name: string
                remaining: number
                sell_through_rate: number
              }>
              supplier_performance: Array<{
                id: number
                name: string
                total_spent: number
                total_bought: number
                total_sold: number
                total_revenue: number
                sell_through: number
                batches: number
              }>
            }
          }
          message?: string
        }>

        updateProduct: (payload: UpdateProductPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            updated_fields: string[]
            images?: {
              deleted: number
              updated: number
              added: number
              new_images?: Array<any>
              updated_images?: Array<any>
            }
          }
        }>

        softDeleteProduct: (payload: { 
          id: number; 
          cascade?: boolean;
          restore?: boolean;
        }) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            product_name: string
            action: 'delete' | 'restore'
            cascaded: boolean
            timestamp: number
            affected: {
              product_images: number
              skus: number
              sku_images: number
              sku_attributes: number
              stock_purchases: number
              total: number
              details?: any
            }
          }
        }>

        createSku: (payload: CreateSkuPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            sku_name: string
            code: string
            product_id: number
            product_name: string
            images: Array<{
              id: number
              path: string
              filename: string
              is_primary?: boolean
            }>
            attributes: Array<{
              id: number
              attribute_id: number
              name: string
              value: string
              unit: string
            }>
            image_count: number
            attribute_count: number
          }
        }>

        getAllSkus: (payload?: GetAllSkusPayload) => Promise<{
          success: boolean
          data?: {
            items: Array<{
              // Basic info
              id: number
              sku_name: string
              code: string
              
              // Product info
              product: {
                id: number
                name: string
                is_active: boolean
                category_id: number
              }
              
              // Status
              is_active: boolean
              is_deleted: boolean
              
              // Timestamps
              timestamps: {
                created_on: number
                updated_on: number
                last_sync: number
              }
              
              // Flags
              has_stock_purchases: boolean
              
              // Related data
              images: Array<any>
              attributes: Array<{
                id: number
                name: string
                value: string
                unit: string | null
                display_value: string
                is_active: boolean
              }>
              stock_purchases: Array<any>
              recent_sales: Array<any>
              
              // Core metrics (RICH!)
              metrics: {
                // Volume
                total_bought: number
                total_sold: number
                total_remaining: number
                
                // Financial
                total_revenue: number
                total_cost: number
                total_shipping_paid: number
                total_profit: number
                profit_margin: number
                
                // Per-unit
                avg_cost_per_unit: number
                avg_selling_price: number
                avg_profit_per_unit: number
                
                // Performance
                sell_through_rate: number
                last_30_days_sales: number
                days_of_inventory: number
                
                // Status
                stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
                is_low_stock: boolean
                is_overstocked: boolean
                is_out_of_stock: boolean
                is_profitable: boolean
              }
              
              // Purchase summary
              purchase_summary: {
                total_purchases: number
                total_purchase_value: number
                avg_purchase_value: number
                latest_purchase: number | null
                active_batches: number
              }
              
              // Stats
              stats: {
                image_count: number
                attribute_count: number
                purchase_count: number
                sale_count: number
              }
            }>
            
            pagination?: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
              from: number
              to: number
            }
            
            summary: {
              // Basic counts
              total_skus: number
              filtered_count: number
              
              // Media and attributes
              with_images: number
              with_attributes: number
              with_stock: number
              
              // Inventory status
              in_stock: number
              low_stock: number
              out_of_stock: number
              overstocked: number
              
              // Financial summary
              total_inventory_value: number
              total_revenue: number
              total_profit: number
              avg_profit_margin: number
              
              // Volume summary
              total_units_bought: number
              total_units_sold: number
              total_units_remaining: number
            }
          }
          message?: string
        }>

        getSkuById: (payload: { id: number; include_deleted?: boolean }) => Promise<{
          success: boolean
          data?: {
            // Basic info
            id: number
            sync_id: string | null
            sku_name: string
            code: string
            is_active: boolean
            is_deleted: boolean
            timestamps: {
              created_on: number
              updated_on: number
              last_sync: number
            }
            
            // Product details
            product: {
              id: number
              name: string
              is_active: boolean
              category?: {
                id: number
                name: string
                is_active: boolean
              } | null
            }
            
            // Related data
            images: Array<any>
            attributes: Array<{
              id: number
              sync_id: string | null
              attribute_id: number
              name: string
              value: string
              unit: string
              display_value: string
              is_active: boolean
            }>
            
            // Stock purchases with complete metrics
            stock_purchases: Array<{
              id: number
              sync_id: string | null
              batch_number: string | null
              quantities: {
                bought: number
                sold: number
                remaining: number
              }
              pricing: {
                price_per_unit: number
                landed_cost_per_unit: number
                total_price: number
                shipping_cost: number
                selling_price_range: {
                  min: number
                  max: number
                }
              }
              financials: {
                revenue: number
                cost: number
                shipping_paid: number
                profit: number
                margin: number
              }
              dates: {
                purchased: number | null
                arrived: number | null
                manufacture: string | null
                expiry: string | null
              }
              supplier: {
                id: number
                name: string
                contact: string | null
                email: string | null
                phone: string | null
                is_active: boolean
              } | null
              performance: {
                sale_count: number
                sell_through_rate: number
                days_on_hand: number
              }
            }>
            
            // Sales history
            recent_sales: Array<{
              id: number
              quantity: number
              total_price: number
              shipping_cost: number
              sold_on: number
              profit_margin: number
            }>
            
            // Core metrics
            metrics: {
              total_bought: number
              total_sold: number
              total_remaining: number
              total_revenue: number
              total_cost: number
              total_shipping_paid: number
              total_profit: number
              profit_margin: number
              avg_cost_per_unit: number
              avg_selling_price: number
              avg_profit_per_unit: number
              sell_through_rate: number
              days_of_inventory: number
              last_30_days_sales: number
              avg_daily_sales: number
              inventory_value: number
              potential_revenue: number
            }
            
            // Statistics
            statistics: {
              images: { count: number }
              attributes: { count: number; active_count: number }
              purchases: {
                total_purchases: number
                total_quantity_bought: number
                total_quantity_sold: number
                total_quantity_remaining: number
                total_cost: number
                average_price_per_unit: number
                average_profit_margin: number
                unique_suppliers: number
                last_purchase_date: number | null
                first_purchase_date: number | null
              }
              sales: {
                count: number
                total_revenue: number
                average_sale_value: number
                last_sale_date: number | null
              }
            }
            
            // Supplier performance
            supplier_performance: Array<{
              id: number
              name: string
              contact: string | null
              total_spent: number
              total_bought: number
              total_sold: number
              sell_through_rate: number
              batches: number
              last_purchase: number | null
            }>
            
            // Summary flags
            summary: {
              has_images: boolean
              has_attributes: boolean
              has_stock: boolean
              has_supplier: boolean
              has_sales: boolean
              stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
              is_low_stock: boolean
              is_overstocked: boolean
              is_out_of_stock: boolean
              is_profitable: boolean
              is_active: boolean
              low_stock_threshold: number
              recommended_reorder_quantity: number
            }
          }
          message?: string
        }>

        updateSku: (payload: UpdateSkuPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            sku_name: string
            code: string
            is_active: boolean
            product: {
              id: number
              name: string
            } | null
            changes: {
              images: { added: number; updated: number; deleted: number }
              attributes: { added: number; updated: number; deleted: number }
            }
            summary: {
              images_affected: number
              attributes_affected: number
              files_created: number
              files_cleaned: number
            }
          }
        }>

        softDeleteSku: (payload: DeleteSkuPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            sku_name: string
            code: string
            product_id: number
            action: 'delete' | 'restore'
            cascaded: boolean
            timestamp: number
            affected: {
              sku_images: number
              sku_attributes: number
              stock_purchases: number
              total: number
              details?: any
            }
          }
        }>


        createAttribute: (payload: CreateAttributePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            attribute_name: string
            unit: string | null
            is_active: boolean
            created_on: number
          }
        }>

        getAllAttributes: (payload?: GetAllAttributesPayload) => Promise<{
          success: boolean
          data?: {
            items: Array<{
              id: number
              attribute_name: string
              unit: string | null
              is_active: boolean
              is_deleted: boolean
              created_on: number
              updated_on: number
              sku_count?: number
              unit_display: string
            }>
            pagination?: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
            }
            summary?: {
              total_attributes: number
              with_units: number
              without_units: number
            }
          }
          message?: string
        }>

        getAttributeById: (payload: GetAttributeByIdPayload) => Promise<{
          success: boolean
          data?: {
            id: number
            attribute_name: string
            unit: string | null
            is_active: boolean
            is_deleted: boolean
            created_on: number
            updated_on: number
            unit_display: string
            statistics: {
              total_skus: number
              unique_values: number
              active_skus: number
              sample_values: string[]
            }
            sku_attributes?: Array<{
              id: number
              sku: {
                id: number
                name: string
                code: string
                product: { id: number; name: string }
              }
              value: string
              is_active: boolean
            }>
            sku_count: number
            value_count: number
          }
          message?: string
        }>

        updateAttribute: (payload: UpdateAttributePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            attribute_name: string
            unit: string | null
            is_active: boolean
            updated_on: number
          }
        }>

        softDeleteAttribute: (payload: DeleteAttributePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            attribute_name: string
            action: 'delete' | 'restore'
            cascaded: boolean
            affected: {
              sku_attributes: number
            }
          }
        }>


        createSkuAttribute: (payload: CreateSkuAttributePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            sku_id: number
            attribute_id: number
            value: string
            is_active: boolean
            created_on: number
            attribute_name: string
            unit: string | null
            sku_name: string
            sku_code: string
          }
        }>

        getAllSkuAttributes: (payload?: GetAllSkuAttributesPayload) => Promise<{
          success: boolean
          data?: {
            items: Array<{
              id: number
              value: string
              is_active: boolean
              is_deleted: boolean
              timestamps: { created_on: number; updated_on: number }
              sku: any
              attribute: any
              display_value: string
            }>
            pagination?: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
            }
            summary?: {
              total: number
              unique_attributes: number
              unique_skus: number
            }
          }
          message?: string
        }>

        getSkuAttributeById: (payload: GetSkuAttributeByIdPayload) => Promise<{
          success: boolean
          data?: {
            id: number
            value: string
            is_active: boolean
            timestamps: { created_on: number; updated_on: number; last_sync: number }
            sku: {
              id: number
              name: string
              code: string
              is_active: boolean
              product: { id: number; name: string }
            }
            attribute: {
              id: number
              name: string
              unit: string | null
              is_active: boolean
            }
            display: string
            other_sku_attributes: Array<{
              id: number
              display: string
            }>
          }
          message?: string
        }>

        updateSkuAttribute: (payload: UpdateSkuAttributePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            value: string
            is_active: boolean
            updated_on: number
            attribute_name: string
            unit: string | null
          }
        }>

        softDeleteSkuAttribute: (payload: DeleteSkuAttributePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            action: 'delete' | 'restore'
            restored: boolean
          }
        }>


        createStockPurchase: (payload: CreateStockPurchasePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            sku_id: number
            quantity: number
            price_per_unit: number
            total_price_bought: number
            avg_anticipated_profit_margin: number | null
            sku_name: string
            sku_code: string
            supplier_name?: string | null
          }
        }>

        getAllStockPurchases: (payload?: GetAllStockPurchasesPayload) => Promise<{
          success: boolean
          data?: {
            items: Array<{
              id: number
              sync_id: string | null
              batch_number: string | null
              
              // SKU details
              sku_id: number
              sku: {
                id: number
                sku_name: string
                code: string
                product_id: number
                product_name: string
              }
              
              // Supplier details
              supplier_id: number | null
              supplier: any | null
              
              // Quantity metrics
              quantities: {
                bought: number
                sold: number
                remaining: number
                sell_through_rate: number
              }
              
              // Cost metrics
              costs: {
                price_per_unit: number
                shipping_cost: number
                landed_cost_per_unit: number
                total_landed_cost: number
              }
              
              // Pricing targets
              selling_price_range: {
                min: number
                max: number
                avg: number
              }
              
              // Financial performance
              financials: {
                revenue: number
                cost_of_sold: number
                shipping_paid_on_sales: number
                profit: number
                profit_margin: number
                expected_revenue: { min: number; max: number; avg: number }
                expected_profit: number
                expected_profit_margin: number
                revenue_vs_expected: {
                  vs_min: number
                  vs_avg: number
                  vs_max: number
                }
              }
              
              // Dates
              dates: {
                purchased: number | null
                arrived: number | null
                created: number
                updated: number
                manufacture: string | null
                expiry: string | null
              }
              
              // Time metrics
              time_metrics: {
                days_in_inventory: number | null
                days_to_expiry: number | null
                is_expired: boolean
                is_expiring_soon: boolean
                first_sale_date: number | null
                last_sale_date: number | null
                days_since_last_sale: number | null
              }
              
              // Sales metrics
              sales_metrics?: {
                sale_count: number
                avg_sale_quantity: number
                avg_daily_sales: number
              }
              
              // Performance rating
              performance: {
                rating: 'Excellent' | 'Good' | 'Average' | 'Poor'
                stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
                is_profitable: boolean
                is_fully_sold: boolean
                has_sales: boolean
              }
              
              // Flags
              is_deleted: boolean
              is_sync_required: boolean
            }>
            
            pagination?: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
              from: number
              to: number
            }
            
            summary: {
              total_purchases: number
              total_quantity_bought: number
              total_quantity_sold: number
              total_quantity_remaining: number
              total_cost: number
              total_revenue: number
              total_profit: number
              avg_profit_margin: number
              total_expected_revenue: number
              total_expected_profit: number
              performance_breakdown: {
                excellent: number
                good: number
                average: number
                poor: number
              }
              stock_status_breakdown: {
                in_stock: number
                low_stock: number
                overstocked: number
                out_of_stock: number
              }
              expiring_soon: number
              expired: number
              total_value_at_risk: number
            }
          }
          message?: string
        }>

        getStockPurchaseById: (payload: GetStockPurchaseByIdPayload) => Promise<{
          success: boolean
          data?: {
            // Core data
            id: number
            sync_id: string | null
            batch_number: string | null
            
            // SKU details
            sku: {
              id: number
              name: string
              code: string
              is_active: boolean
              product: {
                id: number
                name: string
                category_id: number
              }
            }
            
            // Supplier details
            supplier: {
              id: number
              name: string
              contact: string | null
              email: string | null
              phone: string | null
              is_active: boolean
            } | null
            
            // Quantity metrics
            quantities: {
              bought: number
              sold: number
              remaining: number
              sell_through_rate: number
            }
            
            // Cost metrics
            costs: {
              price_per_unit: number
              shipping_cost: number
              landed_cost_per_unit: number
              total_landed_cost: number
              remaining_value: number
            }
            
            // Pricing targets
            selling_price_range: {
              min: number
              max: number
              avg: number
            }
            
            // Dates
            dates: {
              purchased: number | null
              arrived: number | null
              created: number
              updated: number
              manufacture: string | null
              expiry: string | null
            }
            
            // Time metrics
            time_metrics: {
              days_in_inventory: number | null
              days_to_expiry: number | null
              is_expired: boolean
              is_expiring_soon: boolean
              avg_daily_sales: number
              projected_days_to_sell_remaining: number | null
            }
            
            // Financial performance
            financials: {
              actual: {
                revenue: number
                shipping_paid: number
                profit: number
                profit_margin: number
              }
              expected: {
                revenue: { min: number; max: number; avg: number }
                profit: { min: number; max: number; avg: number }
                roi: { min: number; max: number; avg: number }
              }
              remaining_potential: {
                revenue: { min: number; max: number; avg: number }
                profit: { min: number; max: number; avg: number }
                roi: { min: number; avg: number; max: number }
              }
              roi: {
                realized: number
                percent_of_expected: number
                projected: {
                  if_sold_at_min: number
                  if_sold_at_avg: number
                  if_sold_at_max: number
                }
              }
            }
            
            // Variance analysis
            variance: {
              revenue: {
                vs_min: number
                vs_avg: number
                vs_max: number
                percentage: number
              }
              profit: {
                vs_min: number
                vs_avg: number
                vs_max: number
                percentage: number
              }
            }
            
            // Sales history
            sales_history: Array<{
              id: number
              quantity: number
              total_price: number
              shipping_cost: number
              sold_on: number
              profit: number
              profit_margin: number
            }>
            
            // Daily sales breakdown
            daily_sales_breakdown: Array<{
              date: string
              quantity: number
              revenue: number
              profit: number
            }>
            
            // Performance rating
            performance: {
              rating: 'Excellent' | 'Good' | 'Average' | 'Poor'
              stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
              is_profitable: boolean
              is_fully_sold: boolean
              has_exceeded_expectations: boolean
              has_met_expectations: boolean
              has_missed_expectations: boolean
            }
            
            // Flags
            is_deleted: boolean
            is_sync_required: boolean
          }
          message?: string
        }>

        updateStockPurchase: (payload: UpdateStockPurchasePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            quantity: number
            price_per_unit: number
            total_price_bought: number
            avg_anticipated_profit_margin: number | null
            updated_on: number
          }
        }>

        softDeleteStockPurchase: (payload: DeleteStockPurchasePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            action: 'delete' | 'restore'
            restored: boolean
            batch_number?: string | null
          }
        }>


        createSupplier: (payload: CreateSupplierPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            supplier_name: string
            contact_person: string | null
            phone_number: string | null
            email: string | null
            address: string | null
            is_active: boolean
            created_on: number
          }
        }>

        getAllSuppliers: (payload?: GetAllSuppliersPayload) => Promise<{
          success: boolean
          data?: {
            items: Array<{
              // Basic info
              id: number
              sync_id: string | null
              supplier_name: string
              contact_person: string | null
              phone_number: string | null
              email: string | null
              address: string | null
              created_on: number
              updated_on: number
              is_active: boolean
              is_deleted: boolean
              
              // Purchase statistics (optional)
              purchase_stats?: {
                // Volume metrics
                total_purchases: number
                total_quantity_bought: number
                total_quantity_sold: number
                total_quantity_remaining: number
                
                // Financial metrics
                total_spent: number
                total_shipping_paid: number
                total_revenue: number
                total_profit: number
                avg_profit_margin: number
                
                // Performance metrics
                sell_through_rate: number
                
                // Product diversity
                unique_products: number
                unique_skus: number
                
                // Dates
                first_purchase_date: number | null
                last_purchase_date: number | null
                days_since_last_purchase: number | null
              }
            }>
            pagination?: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
              from: number
              to: number
            }
            summary?: {
              total_suppliers: number
              active_suppliers: number
              total_spent_all: number
              total_purchases_all: number
              avg_profit_margin_all: number
              suppliers_with_purchases: number
            }
          }
          message?: string
        }>

        getSupplierById: (payload: GetSupplierByIdPayload) => Promise<{
          success: boolean
          data?: {
            // Basic info
            id: number
            sync_id: string | null
            supplier_name: string
            contact_person: string | null
            phone_number: string | null
            email: string | null
            address: string | null
            is_active: boolean
            is_deleted: boolean
            created_on: number
            updated_on: number
            
            // Comprehensive statistics
            statistics: {
              // Purchase counts
              total_purchases: number
              purchases_last_30_days: number
              purchases_last_90_days: number
              
              // Quantity metrics
              total_quantity_bought: number
              total_quantity_sold: number
              total_quantity_remaining: number
              
              // Financial metrics
              total_spent: number
              total_shipping_cost: number
              total_revenue: number
              total_profit: number
              avg_profit_margin: number
              
              // Product diversity
              unique_skus: number
              unique_products: number
              
              // Price statistics
              avg_price_per_unit: number
              min_price_per_unit: number
              max_price_per_unit: number
              avg_batch_size: number
              
              // Dates
              first_purchase_date: number | null
              last_purchase_date: number | null
              days_since_last_purchase: number | null
            }
            
            // Recent purchases with rich details
            recent_purchases: Array<{
              id: number
              sku_id: number
              sku_name: string
              sku_code: string
              product_name: string
              product_id: number
              batch_number: string | null
              quantities: {
                bought: number
                sold: number
                remaining: number
              }
              pricing: {
                price_per_unit: number
                total_price: number
                shipping_cost: number
                landed_cost_per_unit: number
                selling_price_range: {
                  min: number
                  max: number
                }
              }
              financials: {
                revenue: number
                cost: number
                shipping_paid: number
                profit: number
                margin: number
              }
              dates: {
                purchased: number | null
                arrived: number | null
              }
              performance: {
                sell_through_rate: number
                days_since_purchase: number | null
              }
            }>
            
            // Top products
            top_products: Array<{
              product_id: number
              product_name: string
              total_quantity: number
              total_spent: number
              last_purchase: number | null
            }>
            
            // Summary
            purchase_count: number
            active_products_count: number
            performance_rating: 'No purchases' | 'Excellent' | 'Good' | 'Average' | 'Below Average'
            reliability_score: 1 | 2 | 3 | 4 | 5
          }
          message?: string
        }>

        updateSupplier: (payload: UpdateSupplierPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            supplier_name: string
            contact_person: string | null
            phone_number: string | null
            email: string | null
            address: string | null
            is_active: boolean
            updated_on: number
          }
        }>

        softDeleteSupplier: (payload: DeleteSupplierPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            supplier_name: string
            action: 'delete' | 'restore'
            cascaded: boolean
            affected: {
              stock_purchases: number
            }
          }
        }>
      }



      // Add inside the products object in index.d.ts
    sales: {
        // Sales methods
        createSale: (payload: CreateSalePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            sale_id: number
            payment_id: number
            is_debt_sale: boolean
            remaining_balance: number
            payment_reference: string
          }
        }>

        getAllSales: (payload?: GetAllSalesPayload) => Promise<{
          success: boolean
          data?: {
            sales: Array<{
              id: number
              sync_id: string | null
              quantity: number
              total_price: number
              shipping_cost: number | null
              cost_price_snapshot: number
              status: SaleStatus
              is_debt_sale: boolean
              balance_due: number | null
              sold_on: number | Date
              updated_on: number | Date
              has_been_canceled: boolean
              reason_for_cancellation: string | null
              has_been_overwritten: boolean
              price_override_reason: string | null
              override_approved_by: number | null
              is_deleted: boolean
              is_sync_required: boolean
              
              // Nested relations
              customer: {
                id: number
                name: string
                phone: string | null
                email: string | null
                address: string | null
                is_active: boolean
              } | null
              
              employee: {
                id: number
                name: string
                username: string
                role: string
                email: string | null
              } | null
              
              stock_purchase: {
                id: number
                sku: {
                  id: number
                  name?: string
                  code?: string
                }
                product?: {
                  id: number
                  name: string
                  category_id: number
                } | null
                quantity_bought: number
                price_per_unit: number
                total_cost: number
                shipping_cost: number | null
                min_selling_price: number | null
                max_selling_price: number | null
                batch_number: string | null
                purchased_on: number | null
                expiry_date: string | null
              } | null
              
              payments: Array<{
                id: number
                amount_paid: number
                payment_date: number
                payment_method: PaymentMethod
                reference_number: string | null
                description: string | null
                recorded_by: number | null
                has_been_canceled: boolean
                reason_for_cancellation: string | null
                has_been_overwritten: boolean
                price_override_reason: string | null
                override_approved_by: number | null
              }>
              
              // Core metrics
              profit_margin: number
              
              // Payment metrics
              payment_metrics: {
                total_paid: number
                remaining_balance: number
                payment_count: number
                is_fully_paid: boolean
                is_overdue: boolean
                overdue_days: number | null
              }
              
              // Performance metrics
              performance_metrics: {
                days_since_sale: number
                expected_profit: number
                expected_margin: number
                profit_variance: number
                profit_variance_percentage: number
                performance_vs_expected: 'above' | 'within' | 'below'
              }
              
              // Override info
              override_info: {
                reason: string | null
                approved_by: number | null
              } | null
            }>
            
            pagination: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
              from: number
              to: number
            }
            
            summary?: {
              total_sales: number
              total_revenue: number
              total_profit: number
              average_margin: number
              total_quantity_sold: number
              debt_sales_count: number
              total_debt_amount: number
              total_outstanding_debt: number
              average_sale_value: number
              sales_by_status: Record<SaleStatus, number>
              sales_by_payment_method: Record<string, number>
              sales_by_employee: Array<{
                employee_id: number
                employee_name: string
                count: number
                revenue: number
              }>
              sales_by_customer: Array<{
                customer_id: number
                customer_name: string
                count: number
                revenue: number
              }>
              top_products: Array<{
                product_id: number
                product_name: string
                quantity: number
                revenue: number
              }>
              by_date?: Array<{
                period: string
                count: number
                revenue: number
                profit: number
                avg_margin: number
              }>
              trends?: {
                daily_average: number
                weekly_average: number
                monthly_average: number
                best_day: { date: string; revenue: number; sales: number }
                best_month: { month: string; revenue: number; sales: number }
                profit_trend: 'increasing' | 'decreasing' | 'stable'
              }
            }
          }
          message?: string
        }>

      getSaleById: (payload: GetSaleByIdPayload) => Promise<{
        success: boolean
        data?: {
          sales: Array<{
            // Core sale fields
            id: number
            sync_id: string | null
            quantity: number
            total_price: number
            shipping_cost: number | null
            cost_price_snapshot: number
            status: string
            is_debt_sale: boolean
            balance_due: number | null
            sold_on: number
            updated_on: number
            has_been_canceled: boolean
            reason_for_cancellation: string | null
            has_been_overwritten: boolean
            price_override_reason: string | null
            override_approved_by: number | null
            is_deleted: boolean
            is_sync_required: boolean
            
            // Related data
            customer: {
              id: number
              name: string
              phone?: string
              email?: string
              address?: string
              is_active: boolean
            } | null
            
            employee: {
              id: number
              name: string
              username: string
              role: string
              email?: string
            } | null
            
            product: {
              id: number
              name: string
              category_id: number
              sku: {
                id: number
                name: string
                code: string
              }
              purchase: {
                id: number
                batch_number?: string
                price_per_unit: number
                shipping_cost: number | null
                total_cost: number
                landed_cost_per_unit: number
                min_selling_price: number | null
                max_selling_price: number | null
                purchased_on: number
                expiry_date?: string
              }
            } | null
            
            payments: Array<{
              id: number
              amount_paid: number
              payment_date: number
              payment_method: string
              reference_number?: string
              description?: string
              recorded_by: number | null
              has_been_canceled: boolean
              reason_for_cancellation: string | null
              has_been_overwritten: boolean
              price_override_reason: string | null
              override_approved_by: number | null
            }>
            
            // Core metrics
            profit_margin: number
            
            // Payment metrics
            payment_metrics: {
              total_paid: number
              remaining_balance: number
              payment_count: number
              is_fully_paid: boolean
              is_overdue: boolean
              overdue_days: number | null
            }
            
            // Performance metrics
            performance_metrics: {
              days_since_sale: number
              cost_of_goods_sold: number
              actual_profit: number
              roi: number
              expected_profit: number
              expected_margin: number
              profit_variance: number
              profit_variance_percentage: number
              performance_vs_expected: 'above' | 'within' | 'below'
            }
            
            // Override info
            override_info: {
              reason: string | null
              approved_by: number | null
            } | null
          }>
        }
        message?: string
      }>

        getMySales: (payload?: { include_deleted?: boolean; include_details?: boolean }) => Promise<{
          success: boolean
          data?: {
            sales: Array<any>
          }
          message?: string
        }>

        updateSale: (payload: UpdateSalePayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            action: string
            changes: any[]
            sale: any
          }
        }>

        softDeleteSale: (payload: { id: number; restore?: boolean }) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            action: string
            restored: boolean
          }
        }>

        // Payment methods
        createPayment: (payload: CreatePaymentPayload) => Promise<{
          success: boolean
          message?: string
          data?: any
        }>

        getPaymentById: (payload: GetPaymentByIdPayload) => Promise<{
          success: boolean
          data?: any
          message?: string
        }>

        getPaymentsBySaleId: (payload: GetPaymentsBySaleIdPayload) => Promise<{
          success: boolean
          data?: {
            payments: any[]
            pagination?: any
            summary?: any
          }
          message?: string
        }>

        updatePayment: (payload: UpdatePaymentPayload) => Promise<{
          success: boolean
          message?: string
          data?: any
        }>

        cancelPayment: (payload: CancelPaymentPayload) => Promise<{
          success: boolean
          message?: string
          data?: any
        }>

        softDeletePayment: (payload: { id: number; restore?: boolean }) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            action: string
            restored: boolean
          }
        }>
      },


      // Add inside the products object in index.d.ts, before the files section
      customers: {
        // Customer methods
        createCustomer: (payload: CreateCustomerPayload) => Promise<{
          success: boolean
          message?: string
          data?: CustomerResponse
        }>

        getAllCustomers: (payload?: GetAllCustomersPayload) => Promise<{
          success: boolean
          data?: {
            customers: CustomerResponse[]
            pagination: {
              page: number
              limit: number
              total: number
              total_pages: number
              has_next: boolean
              has_prev: boolean
              returned: number
            }
            summary?: {
              total_customers: number
              active_customers: number
              total_spent_all: number
              average_spent_per_customer: number
            }
          }
          message?: string
        }>

        getCustomerById: (payload: GetCustomerByIdPayload) => Promise<{
          success: boolean
          data?: CustomerResponse
          message?: string
        }>

        updateCustomer: (payload: UpdateCustomerPayload) => Promise<{
          success: boolean
          message?: string
          data?: CustomerResponse
        }>

        softDeleteCustomer: (payload: DeleteCustomerPayload) => Promise<{
          success: boolean
          message?: string
          data?: {
            id: number
            action: 'delete' | 'restore'
            restored: boolean
            has_sales?: boolean
          }
        }>
      },



      // Add inside the api object, after customers and before files
      dashboard: {
        // Overview
        getOverview: (filters?: DashboardFilters) => Promise<DashboardResponse<OverviewDashboardData>>
        
        // Sales Dashboard - Your Rich Hierarchical Structure
        getSalesDashboard: (filters?: DashboardFilters) => Promise<DashboardResponse<SalesDashboardData>>
        
        // Inventory Dashboard
        getInventoryDashboard: (filters?: DashboardFilters) => Promise<DashboardResponse<InventoryDashboardData>>
        
        // Customers Dashboard
        getCustomersDashboard: (filters?: DashboardFilters) => Promise<DashboardResponse<CustomersDashboardData>>
        
        // Products Dashboard
        getProductsDashboard: (filters?: DashboardFilters) => Promise<DashboardResponse<ProductsDashboardData>>
        
        // Analytics - Time Patterns
        getTimePatterns: (filters?: DashboardFilters) => Promise<DashboardResponse<TimePatternsData>>
        
        // Analytics - Forecasts
        getForecasts: (filters?: DashboardFilters) => Promise<DashboardResponse<ForecastsData>>
        
        // Financials Dashboard
        getFinancials: (filters?: DashboardFilters) => Promise<DashboardResponse<FinancialsData>>
        
        // Operations Dashboard
        getOperations: (filters?: DashboardFilters) => Promise<DashboardResponse<OperationsData>>
        
        // Alerts Center
        getAlerts: (filters?: { read?: boolean; category?: string }) => Promise<DashboardResponse<AlertCenterData>>
        markAlertRead: (alertId: string) => Promise<{ success: boolean }>
        dismissAlert: (alertId: string) => Promise<{ success: boolean }>
      },

      transactions: {
        createTransaction: (payload: CreateTransactionPayload) => Promise<CreateTransactionResponse>
        getAllTransactions: (payload?: GetAllTransactionsPayload) => Promise<GetAllTransactionsResponse>
        getTransactionById: (payload: GetTransactionByIdPayload) => Promise<GetTransactionByIdResponse>
        getTransactionsByEmployee: (payload: GetTransactionsByEmployeePayload) => Promise<GetTransactionsByEmployeeResponse>
        updateTransaction: (payload: UpdateTransactionPayload) => Promise<UpdateTransactionResponse>
        softDeleteTransaction: (payload: SoftDeleteTransactionPayload) => Promise<SoftDeleteTransactionResponse>
      }

      files: {
        readFileAsDataURL: (filePath: string) => string | null
      }
    }
  }
}
 