// preload/index.ts


import { contextBridge, ipcRenderer } from 'electron'
import fs from 'fs'
import mime from 'mime-types'
import path from 'path'

import { DashboardFilters } from './ipc/dashboard/types/dashboard.types'
import type {
  CancelPaymentPayload,
  CreateAttributePayload,
  CreateCustomerPayload,
  CreateEmployeeByAdminPayload,
  CreatePaymentPayload,
  CreateProductCategoryPayload,
  CreateProductPayload,
  CreateSalePayload,
  CreateSkuAttributePayload,
  CreateSkuPayload,
  CreateStockPurchasePayload,
  CreateSupplierPayload,
  CreateTransactionPayload,
  DeleteAttributePayload,
  DeleteCategoryPayload,
  DeleteCustomerPayload,
  DeleteSkuAttributePayload,
  DeleteStockPurchasePayload,
  DeleteSupplierPayload,
  GetAllAttributesPayload,
  GetAllCustomersPayload,
  GetAllSalesPayload,
  GetAllSkuAttributesPayload,
  GetAllSkusPayload,
  GetAllStockPurchasesPayload,
  GetAllSuppliersPayload,
  GetAllTransactionsPayload,
  GetAttributeByIdPayload,
  GetCategoriesPayload,
  GetCustomerByIdPayload,
  GetEmployeesPayload,
  GetPaymentByIdPayload,
  GetPaymentsBySaleIdPayload,
  GetProductByIdPayload,
  GetProductsByCategoryPayload,
  GetProductsPayload,
  GetSalesByIdPayload,
  GetSkuAttributeByIdPayload,
  GetStockPurchaseByIdPayload,
  GetSupplierByIdPayload,
  GetTransactionByIdPayload,
  GetTransactionsByEmployeePayload,
  SoftDeleteTransactionPayload,
  UpdateAttributePayload,
  UpdateCustomerPayload,
  UpdatePaymentPayload,
  UpdateProductCategoryPayload,
  UpdateProductPayload,
  UpdateSalePayload,
  UpdateSkuAttributePayload,
  UpdateSkuPayload,
  UpdateStockPurchasePayload,
  UpdateSupplierPayload,
  UpdateTransactionPayload
} from './ipc/type'

// Ensure contextIsolation is enabled for security
if (!process.contextIsolated) {
  throw new Error('contextIsolation must be enabled in the BrowserWindow')
}

try {
  contextBridge.exposeInMainWorld('api', {
    /**
     * SETUP IPC METHODS
     */
    setup: {
      get: async () => {
        try {
          // No parameters — only one setup record (id = 1)
          return await ipcRenderer.invoke('setup:get')
        } catch (error) {
          console.error('Failed to get setup:', error)
          return { success: false, message: 'Failed to fetch setup data.' }
        }
      },

      update: async (payload: {
        action: 'next' | 'previous' | 'skip' | 'unskip' | 'complete'
        stage?: number
      }) => {
        try {
          return await ipcRenderer.invoke('setup:update', payload)
        } catch (error) {
          console.error('Failed to update setup:', error)
          return { success: false, message: 'Failed to update setup.' }
        }
      }
    },

    /**
     * BUSINESS BRANCH IPC METHODS
     */
    businessBranch: {
      // Single method for both create and update
      upsert: async (payload: {
        business_name: string
        branch_location_name: string
        branch_location_coordinate?: { lat: number; long: number }
        branch_email_address?: string
        branch_phone_number?: string
        default_language?: string
        default_currency?: string
        verification_code?: string
      }) => {
        try {
          return await ipcRenderer.invoke('business-branch:upsert', payload)
        } catch (error) {
          console.error('Failed to save business branch:', error)
          return { success: false, message: 'Failed to save business branch.' }
        }
      },

      verify: async (payload: { verification_code: string }) => {
        try {
          return await ipcRenderer.invoke('business-branch:verify', payload)
        } catch (error) {
          console.error('Failed to verify business branch:', error)
          return { success: false, message: 'Failed to verify business branch.' }
        }
      },

      get: async () => {
        try {
          return await ipcRenderer.invoke('business-branch:get')
        } catch (error) {
          console.error('Failed to get business branch:', error)
          return { success: false, message: 'Failed to fetch business branch.' }
        }
      },

      updateLocation: async () => {
        try {
          return await ipcRenderer.invoke('business-branch:update-location')
        } catch (error) {
          console.error('Failed to update location coordinates: ', error)
          return { success: false, message: 'Failed to update location coordinates' }
        }
      }
    },

    /**
     * EMPLOYEES IPC METHODS
     */
    employees: {
      create: async (payload: {
        username: string
        password: string
        role: string
        with_profile_pic?: boolean
        profile_pic_data?: string
        profile_pic_filename?: string
        profile_pic_mime_type?: string
      }) => {
        try {
          return await ipcRenderer.invoke('employees:create', payload)
        } catch (error) {
          console.error('Failed to create employee:', error)
          return { success: false, message: 'Failed to create employee.' }
        }
      },

      createByAdmin: async (payload: CreateEmployeeByAdminPayload) => {
        try {
          return await ipcRenderer.invoke('employees:create-by-admin', payload)
        } catch (error) {
          console.error('Failed to create employee by admin:', error)
          return { success: false, message: 'Failed to create employee.' }
        }
      },

      get: async (payload?: GetEmployeesPayload) => {
        try {
          return await ipcRenderer.invoke('employees:get', payload)
        } catch (error) {
          console.error('Failed to fetch employees:', error)
          return { success: false, message: 'Failed to fetch employees.' }
        }
      },

      getById: async (payload: { id: number; with_profile_pic?: boolean }) => {
        try {
          return await ipcRenderer.invoke('employees:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch employee:', error)
          return { success: false, message: 'Failed to fetch employee.' }
        }
      },

      getProfile: async (payload: { with_profile_pic?: boolean }) => {
        try {
          return await ipcRenderer.invoke('employees:get-profile', payload)
        } catch (error) {
          console.error('Failed to fetch current user profile: ', error)
          return { success: false, message: 'Failed to fetch your profile' }
        }
      },

      update: async (payload: {
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
      }) => {
        try {
          return await ipcRenderer.invoke('employees:update', payload)
        } catch (error) {
          console.error('Failed to update employee:', error)
          return { success: false, message: 'Failed to update employee.' }
        }
      },

      delete: async (payload: { id: number, restore?: boolean }) => {
        try {
          return await ipcRenderer.invoke('employees:delete', payload)
        } catch (error) {
          console.error('Failed to delete employee:', error)
          return { success: false, message: 'Failed to delete employee.' }
        }
      },

      login: async (payload: { username: string; password: string; role: string }) => {
        try {
          return await ipcRenderer.invoke('employees:login', payload)
        } catch (error) {
          console.error('Failed to login:', error)
          return { success: false, message: 'Failed to login.' }
        }
      },

      logout: async () => {
        try {
          return await ipcRenderer.invoke('employees:logout')
        } catch (error) {
          console.error('Failed to logout:', error)
          return { success: false, message: 'Failed to logout.' }
        }
      },

      getCurrentSession: async () => {
        try {
          return await ipcRenderer.invoke('employees:get-current-session')
        } catch (error) {
          console.error('Failed to get session:', error)
          return { success: false, message: 'Failed to get session.' }
        }
      },

      checkAuth: async () => {
        try {
          return await ipcRenderer.invoke('employees:check-auth')
        } catch (error) {
          console.error('Failed to check auth:', error)
          return { success: false, message: 'Failed to check authentication.' }
        }
      },
    },

    departments: {
      get: async ( payload?: { include_deleted?: boolean } ) => {
        try {
          return await ipcRenderer.invoke('departments:get', payload)
        } catch (error) {
          console.error('Failed to fetch departments:', error)
          return { success: false, message: 'Failed to fetch departments.' }
        }
      }
    },

    products: {
      getCategories: async (
        payload?: GetCategoriesPayload
      ) => {
        try {
          return await ipcRenderer.invoke('products-categories:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch product categories: ', error)
          return { success: false, message: 'Failed to fetch product categories.' }
        }
      },

      createCategory: async (
        payload: CreateProductCategoryPayload
      ) => {
        try {
          return await ipcRenderer.invoke('products-categories:create', payload)
        } catch (error) {
          console.error('Failed to create product category: ', error)
          return { success: false, message: 'Failed to create product category.' }
        }
      },

      getCategoryById: async (
        payload: {
          id: number;
          include_children?: boolean;
          include_deleted?: boolean;
        }
      ) => {
        try {
          return await ipcRenderer.invoke('products-categories:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch product category: ', error)
          return { success: false, message: 'Failed to fetch product category.' }
        }
      },

      updateCategory: async (
        payload: UpdateProductCategoryPayload
      ) => {
        try {
          return await ipcRenderer.invoke('products-categories:update', payload)
        } catch (error) {
          console.error('Failed to update product category: ', error)
          return { success: false, message: 'Failed to update product category.' }
        }
      },

      softDeleteCategory: async (
        payload: DeleteCategoryPayload
      ) => {
        try {
          return await ipcRenderer.invoke('products-categories:soft-delete', payload)
        } catch (error) {
          console.error('Failed to delete product category: ', error)
          return { success: false, message: 'Failed to delete product category.' }
        }
      },

      restoreCategory: async (
        payload: { id: number, cascade?: boolean }
      ) => {
        try {
          return await ipcRenderer.invoke('products-categories:restore', payload)
        } catch (error) {
          console.error('Failed to restore product category: ', error)
          return { success: false, message: 'Failed to restore product category.' }
        }
      },


      // Product methods
      createProduct: async (payload: CreateProductPayload) => {
        try {
          return await ipcRenderer.invoke('products:create', payload)
        } catch (error) {
          console.error('Failed to create product:', error)
          return { success: false, message: 'Failed to create product.' }
        }
      },

      getAllProducts: async (payload?: GetProductsPayload) => {
        try {
          return await ipcRenderer.invoke('products:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch products:', error)
          return { 
            success: false, 
            message: 'Failed to fetch products.' 
          }
        }
      },

      getProductsByCategory: async (payload: GetProductsByCategoryPayload) => {
        try {
          return await ipcRenderer.invoke('products:get-by-category', payload)
        } catch (error) {
          console.error('Failed to fetch products by category:', error)
          return { 
            success: false, 
            message: 'Failed to fetch products.' 
          }
        }
      },

      getProductById: async (payload: GetProductByIdPayload) => {
        try {
          return await ipcRenderer.invoke('products:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch product:', error)
          return { success: false, message: 'Failed to fetch product.' }
        }
      },

      updateProduct: async (payload: UpdateProductPayload) => {
        try {
          return await ipcRenderer.invoke('products:update', payload)
        } catch (error) {
          console.error('Failed to update product:', error)
          return { success: false, message: 'Failed to update product.' }
        }
      },

      softDeleteProduct: async (payload: { 
        id: number; 
        cascade?: boolean; 
        restore?: boolean;
      }) => {
        try {
          return await ipcRenderer.invoke('products:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete product:', error)
          return { success: false, message: 'Failed to delete product.' }
        }
      },


      createSku: async (payload: CreateSkuPayload) => {
        try {
          return await ipcRenderer.invoke('sku:create', payload)
        } catch (error) {
          console.error('Failed to create SKU:', error)
          return { success: false, message: 'Failed to create SKU.' }
        }
      },

      getAllSkus: async (payload?: GetAllSkusPayload) => {
        try {
          return await ipcRenderer.invoke('sku:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch SKUs:', error)
          return { success: false, message: 'Failed to fetch SKUs.' }
        }
      },

      getSkuById: async (payload: { id: number; include_deleted?: boolean }) => {
        try {
          return await ipcRenderer.invoke('sku:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch SKU:', error)
          return { success: false, message: 'Failed to fetch SKU.' }
        }
      },

      updateSku: async (payload: UpdateSkuPayload) => {
        try {
          return await ipcRenderer.invoke('sku:update', payload)
        } catch (error) {
          console.error('Failed to update SKU:', error)
          return { success: false, message: 'Failed to update SKU.' }
        }
      },

      softDeleteSku: async (payload: { 
        id: number; 
        cascade?: boolean;
        restore?: boolean;
      }) => {
        try {
          return await ipcRenderer.invoke('sku:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete SKU:', error)
          return { success: false, message: 'Failed to delete SKU.' }
        }
      },


      createAttribute: async (payload: CreateAttributePayload) => {
        try {
          return await ipcRenderer.invoke('attributes:create', payload)
        } catch (error) {
          console.error('Failed to create attribute:', error)
          return { success: false, message: 'Failed to create attribute.' }
        }
      },

      getAllAttributes: async (payload?: GetAllAttributesPayload) => {
        try {
          return await ipcRenderer.invoke('attributes:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch attributes:', error)
          return { success: false, message: 'Failed to fetch attributes.' }
        }
      },

      getAttributeById: async (payload: GetAttributeByIdPayload) => {
        try {
          return await ipcRenderer.invoke('attributes:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch attribute:', error)
          return { success: false, message: 'Failed to fetch attribute.' }
        }
      },

      updateAttribute: async (payload: UpdateAttributePayload) => {
        try {
          return await ipcRenderer.invoke('attributes:update', payload)
        } catch (error) {
          console.error('Failed to update attribute:', error)
          return { success: false, message: 'Failed to update attribute.' }
        }
      },

      softDeleteAttribute: async (payload: DeleteAttributePayload) => {
        try {
          return await ipcRenderer.invoke('attributes:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete attribute:', error)
          return { success: false, message: 'Failed to soft delete attribute.' }
        }
      },


      createSkuAttribute: async (payload: CreateSkuAttributePayload) => {
        try {
          return await ipcRenderer.invoke('sku-attributes:create', payload)
        } catch (error) {
          console.error('Failed to create SKU attribute:', error)
          return { success: false, message: 'Failed to create SKU attribute.' }
        }
      },

      getAllSkuAttributes: async (payload?: GetAllSkuAttributesPayload) => {
        try {
          return await ipcRenderer.invoke('sku-attributes:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch SKU attributes:', error)
          return { success: false, message: 'Failed to fetch SKU attributes.' }
        }
      },

      getSkuAttributeById: async (payload: GetSkuAttributeByIdPayload) => {
        try {
          return await ipcRenderer.invoke('sku-attributes:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch SKU attribute:', error)
          return { success: false, message: 'Failed to fetch SKU attribute.' }
        }
      },

      updateSkuAttribute: async (payload: UpdateSkuAttributePayload) => {
        try {
          return await ipcRenderer.invoke('sku-attributes:update', payload)
        } catch (error) {
          console.error('Failed to update SKU attribute:', error)
          return { success: false, message: 'Failed to update SKU attribute.' }
        }
      },

      softDeleteSkuAttribute: async (payload: DeleteSkuAttributePayload) => {
        try {
          return await ipcRenderer.invoke('sku-attributes:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete SKU attribute:', error)
          return { success: false, message: 'Failed to soft delete SKU attribute.' }
        }
      },


      createStockPurchase: async (payload: CreateStockPurchasePayload) => {
        try {
          return await ipcRenderer.invoke('stock-purchases:create', payload)
        } catch (error) {
          console.error('Failed to create stock purchase:', error)
          return { success: false, message: 'Failed to create stock purchase.' }
        }
      },

      getAllStockPurchases: async (payload?: GetAllStockPurchasesPayload) => {
        try {
          return await ipcRenderer.invoke('stock-purchases:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch stock purchases:', error)
          return { success: false, message: 'Failed to fetch stock purchases.' }
        }
      },

      getStockPurchaseById: async (payload: GetStockPurchaseByIdPayload) => {
        try {
          return await ipcRenderer.invoke('stock-purchases:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch stock purchase:', error)
          return { success: false, message: 'Failed to fetch stock purchase.' }
        }
      },

      updateStockPurchase: async (payload: UpdateStockPurchasePayload) => {
        try {
          return await ipcRenderer.invoke('stock-purchases:update', payload)
        } catch (error) {
          console.error('Failed to update stock purchase:', error)
          return { success: false, message: 'Failed to update stock purchase.' }
        }
      },

      softDeleteStockPurchase: async (payload: DeleteStockPurchasePayload) => {
        try {
          return await ipcRenderer.invoke('stock-purchases:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete stock purchase:', error)
          return { success: false, message: 'Failed to soft delete stock purchase.' }
        }
      },


      createSupplier: async (payload: CreateSupplierPayload) => {
        try {
          return await ipcRenderer.invoke('suppliers:create', payload)
        } catch (error) {
          console.error('Failed to create supplier:', error)
          return { success: false, message: 'Failed to create supplier.' }
        }
      },

      getAllSuppliers: async (payload?: GetAllSuppliersPayload) => {
        try {
          return await ipcRenderer.invoke('suppliers:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch suppliers:', error)
          return { success: false, message: 'Failed to fetch suppliers.' }
        }
      },

      getSupplierById: async (payload: GetSupplierByIdPayload) => {
        try {
          return await ipcRenderer.invoke('suppliers:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch supplier:', error)
          return { success: false, message: 'Failed to fetch supplier.' }
        }
      },

      updateSupplier: async (payload: UpdateSupplierPayload) => {
        try {
          return await ipcRenderer.invoke('suppliers:update', payload)
        } catch (error) {
          console.error('Failed to update supplier:', error)
          return { success: false, message: 'Failed to update supplier.' }
        }
      },

      softDeleteSupplier: async (payload: DeleteSupplierPayload) => {
        try {
          return await ipcRenderer.invoke('suppliers:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete supplier:', error)
          return { success: false, message: 'Failed to soft delete supplier.' }
        }
      }
    },





    // Add inside the products object in preload/index.ts
    sales: {
      // Sales methods
      createSale: async (payload: CreateSalePayload) => {
        try {
          return await ipcRenderer.invoke('sales:create', payload)
        } catch (error) {
          console.error('Failed to create sale:', error)
          return { success: false, message: 'Failed to create sale.' }
        }
      },

      getAllSales: async (payload?: GetAllSalesPayload) => {
        try {
          return await ipcRenderer.invoke('sales:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch sales:', error)
          return { success: false, message: 'Failed to fetch sales.' }
        }
      },

      getSaleById: async (payload: GetSalesByIdPayload) => {
        try {
          return await ipcRenderer.invoke('sales:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch sale:', error)
          return { success: false, message: 'Failed to fetch sale.' }
        }
      },

      getMySales: async (payload?: { include_deleted?: boolean; include_details?: boolean }) => {
        try {
          return await ipcRenderer.invoke('sales:get-my-sales', payload)
        } catch (error) {
          console.error('Failed to fetch my sales:', error)
          return { success: false, message: 'Failed to fetch your sales.' }
        }
      },

      updateSale: async (payload: UpdateSalePayload) => {
        try {
          return await ipcRenderer.invoke('sales:update', payload)
        } catch (error) {
          console.error('Failed to update sale:', error)
          return { success: false, message: 'Failed to update sale.' }
        }
      },

      softDeleteSale: async (payload: { id: number; restore?: boolean }) => {
        try {
          return await ipcRenderer.invoke('sales:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete sale:', error)
          return { success: false, message: 'Failed to soft delete sale.' }
        }
      },

      // Payment methods
      createPayment: async (payload: CreatePaymentPayload) => {
        try {
          return await ipcRenderer.invoke('payments:create', payload)
        } catch (error) {
          console.error('Failed to create payment:', error)
          return { success: false, message: 'Failed to create payment.' }
        }
      },

      getPaymentById: async (payload: GetPaymentByIdPayload) => {
        try {
          return await ipcRenderer.invoke('payments:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch payment:', error)
          return { success: false, message: 'Failed to fetch payment.' }
        }
      },

      getPaymentsBySaleId: async (payload: GetPaymentsBySaleIdPayload) => {
        try {
          return await ipcRenderer.invoke('payments:get-by-sale-id', payload)
        } catch (error) {
          console.error('Failed to fetch payments:', error)
          return { success: false, message: 'Failed to fetch payments.' }
        }
      },

      updatePayment: async (payload: UpdatePaymentPayload) => {
        try {
          return await ipcRenderer.invoke('payments:update', payload)
        } catch (error) {
          console.error('Failed to update payment:', error)
          return { success: false, message: 'Failed to update payment.' }
        }
      },

      cancelPayment: async (payload: CancelPaymentPayload) => {
        try {
          return await ipcRenderer.invoke('payments:cancel', payload)
        } catch (error) {
          console.error('Failed to cancel payment:', error)
          return { success: false, message: 'Failed to cancel payment.' }
        }
      },

      softDeletePayment: async (payload: { id: number; restore?: boolean }) => {
        try {
          return await ipcRenderer.invoke('payments:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete payment:', error)
          return { success: false, message: 'Failed to soft delete payment.' }
        }
      },
    },

    customers: {
      // Add inside the products object in preload/index.ts, before the files section

      // Customer methods
      createCustomer: async (payload: CreateCustomerPayload) => {
        try {
          return await ipcRenderer.invoke('customers:create', payload)
        } catch (error) {
          console.error('Failed to create customer:', error)
          return { success: false, message: 'Failed to create customer.' }
        }
      },

      getAllCustomers: async (payload?: GetAllCustomersPayload) => {
        try {
          return await ipcRenderer.invoke('customers:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch customers:', error)
          return { success: false, message: 'Failed to fetch customers.' }
        }
      },

      getCustomerById: async (payload: GetCustomerByIdPayload) => {
        try {
          return await ipcRenderer.invoke('customers:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch customer:', error)
          return { success: false, message: 'Failed to fetch customer.' }
        }
      },

      updateCustomer: async (payload: UpdateCustomerPayload) => {
        try {
          return await ipcRenderer.invoke('customers:update', payload)
        } catch (error) {
          console.error('Failed to update customer:', error)
          return { success: false, message: 'Failed to update customer.' }
        }
      },

      softDeleteCustomer: async (payload: DeleteCustomerPayload) => {
        try {
          return await ipcRenderer.invoke('customers:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete customer:', error)
          return { success: false, message: 'Failed to soft delete customer.' }
        }
      },
    },

    // Add after customers and before files
    dashboard: {
      // Overview - Executive summary cards
      getOverview: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('dashboard:get-overview', filters)
        } catch (error) {
          console.error('Failed to fetch dashboard overview:', error)
          return { 
            success: false, 
            message: 'Failed to fetch dashboard overview.' 
          }
        }
      },

      // Sales Dashboard - Your Rich Hierarchical Structure
      getSalesDashboard: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('sales:get-dashboard', filters)
        } catch (error) {
          console.error('Failed to fetch sales dashboard:', error)
          return { 
            success: false, 
            message: 'Failed to fetch sales dashboard.' 
          }
        }
      },

      // Inventory Dashboard
      getInventoryDashboard: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('inventory:get-dashboard', filters)
        } catch (error) {
          console.error('Failed to fetch inventory dashboard:', error)
          return { 
            success: false, 
            message: 'Failed to fetch inventory dashboard.' 
          }
        }
      },

      // Customers Dashboard
      getCustomersDashboard: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('customers:get-dashboard', filters)
        } catch (error) {
          console.error('Failed to fetch customers dashboard:', error)
          return { 
            success: false, 
            message: 'Failed to fetch customers dashboard.' 
          }
        }
      },

      // Products Dashboard
      getProductsDashboard: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('products:get-dashboard', filters)
        } catch (error) {
          console.error('Failed to fetch products dashboard:', error)
          return { 
            success: false, 
            message: 'Failed to fetch products dashboard.' 
          }
        }
      },

      // Analytics - Time Patterns (Heatmaps, Day-of-week, etc.)
      getTimePatterns: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('analytics:get-time-patterns', filters)
        } catch (error) {
          console.error('Failed to fetch time patterns:', error)
          return { 
            success: false, 
            message: 'Failed to fetch time patterns.' 
          }
        }
      },

      // Analytics - Forecasts (Predictions)
      getForecasts: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('analytics:get-forecasts', filters)
        } catch (error) {
          console.error('Failed to fetch forecasts:', error)
          return { 
            success: false, 
            message: 'Failed to fetch forecasts.' 
          }
        }
      },

      // Financials Dashboard
      getFinancials: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('financials:get-dashboard', filters)
        } catch (error) {
          console.error('Failed to fetch financials dashboard:', error)
          return { 
            success: false, 
            message: 'Failed to fetch financials dashboard.' 
          }
        }
      },

      // Operations Dashboard (Employees, Transactions, Suppliers)
      getOperations: async (filters?: DashboardFilters) => {
        try {
          return await ipcRenderer.invoke('operations:get-dashboard', filters)
        } catch (error) {
          console.error('Failed to fetch operations dashboard:', error)
          return { 
            success: false, 
            message: 'Failed to fetch operations dashboard.' 
          }
        }
      },

      // Alerts Center
      getAlerts: async (filters?: { read?: boolean; category?: string }) => {
        try {
          return await ipcRenderer.invoke('alerts:get-all', filters)
        } catch (error) {
          console.error('Failed to fetch alerts:', error)
          return { 
            success: false, 
            message: 'Failed to fetch alerts.' 
          }
        }
      },

      markAlertRead: async (alertId: string) => {
        try {
          return await ipcRenderer.invoke('alerts:mark-read', alertId)
        } catch (error) {
          console.error('Failed to mark alert as read:', error)
          return { success: false }
        }
      },

      dismissAlert: async (alertId: string) => {
        try {
          return await ipcRenderer.invoke('alerts:dismiss', alertId)
        } catch (error) {
          console.error('Failed to dismiss alert:', error)
          return { success: false }
        }
      }
    },


    transactions: {
      // Create transaction
      createTransaction: async (payload: CreateTransactionPayload) => {
        try {
          return await ipcRenderer.invoke('transactions:create', payload)
        } catch (error) {
          console.error('Failed to create transaction:', error)
          return { success: false, message: 'Failed to create transaction.' }
        }
      },

      // Get all transactions
      getAllTransactions: async (payload?: GetAllTransactionsPayload) => {
        try {
          return await ipcRenderer.invoke('transactions:get-all', payload)
        } catch (error) {
          console.error('Failed to fetch transactions:', error)
          return { success: false, message: 'Failed to fetch transactions.' }
        }
      },

      // Get transaction by ID
      getTransactionById: async (payload: GetTransactionByIdPayload) => {
        try {
          return await ipcRenderer.invoke('transactions:get-by-id', payload)
        } catch (error) {
          console.error('Failed to fetch transaction:', error)
          return { success: false, message: 'Failed to fetch transaction.' }
        }
      },

      // Get transactions by employee
      getTransactionsByEmployee: async (payload: GetTransactionsByEmployeePayload) => {
        try {
          return await ipcRenderer.invoke('transactions:get-by-employee', payload)
        } catch (error) {
          console.error('Failed to fetch employee transactions:', error)
          return { success: false, message: 'Failed to fetch employee transactions.' }
        }
      },

      // Update transaction
      updateTransaction: async (payload: UpdateTransactionPayload) => {
        try {
          return await ipcRenderer.invoke('transactions:update', payload)
        } catch (error) {
          console.error('Failed to update transaction:', error)
          return { success: false, message: 'Failed to update transaction.' }
        }
      },

      // Soft delete / restore transaction
      softDeleteTransaction: async (payload: SoftDeleteTransactionPayload) => {
        try {
          return await ipcRenderer.invoke('transactions:soft-delete', payload)
        } catch (error) {
          console.error('Failed to soft delete transaction:', error)
          return { success: false, message: 'Failed to soft delete transaction.' }
        }
      }
    },

    files: {
      readFileAsDataURL: (filePath: string) => {
        if (!fs.existsSync(filePath)) return null
        const ext = path.extname(filePath)
        const mimeType = mime.lookup(ext) || 'application/octet-stream'
        const data = fs.readFileSync(filePath)
        return `data:${mimeType};base64,${data.toString('base64')}`
      }
    }
  })
} catch (error) {
  console.error('Failed to expose APIs to renderer: ', error)
}
