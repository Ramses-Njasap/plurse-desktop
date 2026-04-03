import { sessionManager } from '@/session-manager'
import { getDB, logEmployeeActivity } from '@db/sqlite3'
import { customers } from '@schema/sqlite3/customers'
import { payments, sales } from '@schema/sqlite3/sales'
import { and, eq, inArray, like, or, sql, SQL } from 'drizzle-orm'
import { ipcMain } from 'electron'
import type {
  CreateCustomerPayload,
  CustomerResponse,
  DeleteCustomerPayload,
  GetAllCustomersPayload,
  GetCustomerByIdPayload,
  UpdateCustomerPayload
} from '../ipc/type'

// Helper function to filter valid IDs
// function filterValidIds(ids: (number | null | undefined)[]): number[] {
//   return ids.filter((id): id is number => id !== null && id !== undefined && id > 0)
// }

// Helper function to safely convert Date to timestamp
function toTimestamp(value: Date | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Math.floor(value.getTime() / 1000)
  return Number(value)
}

// ============================================================================
// CREATE CUSTOMER
// ============================================================================
ipcMain.handle('customers:create', async (_event, payload: CreateCustomerPayload): Promise<{
  success: boolean
  message?: string
  data?: CustomerResponse
}> => {
  try {
    const db = getDB()
    const { name, phone, email, address, is_active = true } = payload

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    // Validate required fields
    if (!name?.trim()) {
      return { success: false, message: 'Customer name is required' }
    }

    // Check for duplicate customer (by name and phone if provided)
    const conditions: SQL[] = [
      eq(customers.name, name.trim()),
      eq(customers.is_deleted, false)
    ]
    
    if (phone?.trim()) {
      conditions.push(eq(customers.phone, phone.trim()))
    }
    
    if (email?.trim()) {
      conditions.push(eq(customers.email, email.trim()))
    }

    const existingCustomer = db
      .select({ id: customers.id })
      .from(customers)
      .where(and(...conditions))
      .get()

    if (existingCustomer) {
      return { success: false, message: 'Customer with similar details already exists' }
    }

    // Insert customer
    const insertResult = db
      .insert(customers)
      .values({
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        is_active
      })
      .run()

    const customerId = Number(insertResult.lastInsertRowid)

    // Log activity
    logEmployeeActivity({
      activity: 'created customer',
      employee_id: session.employeeId,
      linked_activity_id: customerId,
      linked_activity_table: 'customers'
    })

    // Fetch and return the created customer
    const customer = await fetchCustomerById(customerId, false, false)

    return {
      success: true,
      message: 'Customer created successfully',
      data: customer
    }

  } catch (error) {
    console.error('Error creating customer:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create customer'
    }
  }
})

// ============================================================================
// GET ALL CUSTOMERS
// ============================================================================
ipcMain.handle('customers:get-all', async (_event, payload?: GetAllCustomersPayload): Promise<{
  success: boolean
  message?: string
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
}> => {
  try {
    const db = getDB()
    const {
      page = 1,
      limit = 20,
      include_deleted = false,
      include_inactive = false,
      search,
      sort_by = 'created_on',
      sort_order = 'desc',
      with_sales_stats = true,
      min_total_spent,
      max_total_spent,
      min_sale_count,
      max_sale_count,
      has_debt,
      created_after,
      created_before
    } = payload || {}

    const offset = (page - 1) * limit

    // Build conditions
    const conditions: SQL[] = []

    if (!include_deleted) {
      conditions.push(eq(customers.is_deleted, false))
    }

    if (!include_inactive) {
      conditions.push(eq(customers.is_active, true))
    }

    if (search) {
      conditions.push(
        or(
          like(customers.name, `%${search}%`),
          like(customers.phone, `%${search}%`),
          like(customers.email, `%${search}%`),
          like(customers.address, `%${search}%`)
        ) as SQL
      )
    }

    if (created_after) {
      conditions.push(sql`${customers.created_on} >= ${created_after}`)
    }

    if (created_before) {
      conditions.push(sql`${customers.created_on} <= ${created_before}`)
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const countResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customers)
      .where(whereConditions)
      .get()

    const total = Number(countResult?.count || 0)

    if (total === 0) {
      return {
        success: true,
        data: {
          customers: [],
          pagination: {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false,
            returned: 0
          }
        }
      }
    }

    // Build order by
    let orderByClause: SQL
    switch(sort_by) {
      case 'name':
        orderByClause = sort_order === 'asc' ? sql`${customers.name} ASC` : sql`${customers.name} DESC`
        break
      case 'created_on':
        orderByClause = sort_order === 'asc' ? sql`${customers.created_on} ASC` : sql`${customers.created_on} DESC`
        break
      case 'total_spent':
      case 'sale_count':
        // These will be handled after fetching
        orderByClause = sql`${customers.created_on} DESC`
        break
      default:
        orderByClause = sql`${customers.created_on} DESC`
    }

    // Fetch customers
    const customerList = db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        created_on: customers.created_on,
        updated_on: customers.updated_on,
        is_active: customers.is_active,
        is_deleted: customers.is_deleted,
        is_sync_required: customers.is_sync_required
      })
      .from(customers)
      .where(whereConditions)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all()

    const customerIds = customerList.map(c => c.id)

    // Fetch sales stats for all customers
    let customerStats = new Map()
    let allSales: any[] = []

    if (with_sales_stats && customerIds.length > 0) {
      // Fetch all sales for these customers
      allSales = db
        .select({
          id: sales.id,
          customer_id: sales.customer_id,
          quantity: sales.quantity,
          total_price: sales.total_price,
          status: sales.status,
          is_debt_sale: sales.is_debt_sale,
          sold_on: sales.sold_on,
          profit_margin: sales.profit_margin,
          total_paid: sql<number>`COALESCE((
            SELECT SUM(${payments.amount_paid})
            FROM ${payments}
            WHERE ${payments.sale_id} = ${sales.id}
            AND ${payments.is_deleted} = 0
            AND ${payments.has_been_canceled} = 0
          ), 0)`.as('total_paid')
        })
        .from(sales)
        .where(and(
          inArray(sales.customer_id, customerIds),
          eq(sales.is_deleted, false)
        ))
        .all()

      // Group sales by customer
      const salesByCustomer = allSales.reduce((map, sale) => {
        if (!map.has(sale.customer_id)) {
          map.set(sale.customer_id, [])
        }
        map.get(sale.customer_id).push(sale)
        return map
      }, new Map())

      // Calculate stats for each customer
      for (const [customerId, customerSales] of salesByCustomer.entries()) {
        const totalSpent = customerSales.reduce((sum: number, s: any) => sum + s.total_price, 0)
        // const totalPaid = customerSales.reduce((sum: number, s: any) => sum + (s.total_paid || 0), 0)
        const debtSales = customerSales.filter((s: any) => s.is_debt_sale)
        const totalDebt = debtSales.reduce((sum: number, s: any) => sum + s.total_price, 0)
        const outstandingDebt = debtSales.reduce((sum: number, s: any) => sum + (s.total_price - (s.total_paid || 0)), 0)

        customerStats.set(customerId, {
          total_sales: customerSales.length,
          total_spent: totalSpent,
          average_sale_value: customerSales.length > 0 ? totalSpent / customerSales.length : 0,
          total_quantity: customerSales.reduce((sum: number, s: any) => sum + s.quantity, 0),
          debt_sales_count: debtSales.length,
          total_debt: totalDebt,
          outstanding_debt: outstandingDebt,
          first_purchase: customerSales.length > 0 ? Math.min(...customerSales.map((s: any) => s.sold_on)) : null,
          last_purchase: customerSales.length > 0 ? Math.max(...customerSales.map((s: any) => s.sold_on)) : null
        })
      }
    }

    // Build response with stats
    let customers_response = customerList.map(customer => {
      const stats = customerStats.get(customer.id)
      
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        created_on: toTimestamp(customer.created_on) || 0,
        updated_on: toTimestamp(customer.updated_on) || 0,
        is_active: customer.is_active || false,
        is_deleted: customer.is_deleted || false,
        is_sync_required: customer.is_sync_required || false,
        sales_stats: stats || {
          total_sales: 0,
          total_spent: 0,
          average_sale_value: 0,
          total_quantity: 0,
          debt_sales_count: 0,
          total_debt: 0,
          outstanding_debt: 0,
          first_purchase: null,
          last_purchase: null
        }
      }
    })

    // Apply post-query sorting for calculated fields
    if (sort_by === 'total_spent') {
      customers_response.sort((a, b) => {
        const aVal = a.sales_stats?.total_spent || 0
        const bVal = b.sales_stats?.total_spent || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    } else if (sort_by === 'sale_count') {
      customers_response.sort((a, b) => {
        const aVal = a.sales_stats?.total_sales || 0
        const bVal = b.sales_stats?.total_sales || 0
        return sort_order === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    // Apply value-based filters
    if (min_total_spent !== undefined) {
      customers_response = customers_response.filter(c => (c.sales_stats?.total_spent || 0) >= min_total_spent)
    }
    if (max_total_spent !== undefined) {
      customers_response = customers_response.filter(c => (c.sales_stats?.total_spent || 0) <= max_total_spent)
    }
    if (min_sale_count !== undefined) {
      customers_response = customers_response.filter(c => (c.sales_stats?.total_sales || 0) >= min_sale_count)
    }
    if (max_sale_count !== undefined) {
      customers_response = customers_response.filter(c => (c.sales_stats?.total_sales || 0) <= max_sale_count)
    }
    if (has_debt !== undefined) {
      customers_response = customers_response.filter(c => 
        has_debt ? (c.sales_stats?.outstanding_debt || 0) > 0 : (c.sales_stats?.outstanding_debt || 0) === 0
      )
    }

    const totalPages = Math.ceil(total / limit)

    // Calculate overall summary
    const totalSpentAll = customers_response.reduce((sum, c) => sum + (c.sales_stats?.total_spent || 0), 0)
    const activeCustomers = customers_response.filter(c => c.is_active).length

    return {
      success: true,
      data: {
        customers: customers_response,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
          returned: customers_response.length
        },
        summary: {
          total_customers: customers_response.length,
          active_customers: activeCustomers,
          total_spent_all: totalSpentAll,
          average_spent_per_customer: customers_response.length > 0 ? totalSpentAll / customers_response.length : 0
        }
      }
    }

  } catch (error) {
    console.error('Error fetching customers:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch customers'
    }
  }
})

// ============================================================================
// GET CUSTOMER BY ID
// ============================================================================
ipcMain.handle('customers:get-by-id', async (_event, payload: GetCustomerByIdPayload): Promise<{
  success: boolean
  message?: string
  data?: CustomerResponse
}> => {
  try {
    const { 
      id, 
      include_deleted = false, 
      include_sales = true,
      sales_limit = 20,
      sales_status
    } = payload

    if (!id) {
      return { success: false, message: 'Customer ID is required' }
    }

    const customer = await fetchCustomerById(id, include_deleted, include_sales, sales_limit, sales_status)

    if (!customer) {
      return {
        success: false,
        message: `Customer with ID ${id} not found`
      }
    }

    return {
      success: true,
      data: customer
    }

  } catch (error) {
    console.error('Error fetching customer:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch customer'
    }
  }
})

// ============================================================================
// UPDATE CUSTOMER
// ============================================================================
ipcMain.handle('customers:update', async (_event, payload: UpdateCustomerPayload): Promise<{
  success: boolean
  message?: string
  data?: CustomerResponse
}> => {
  try {
    const db = getDB()
    const { id, name, phone, email, address, is_active } = payload

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    if (!id) {
      return { success: false, message: 'Customer ID is required' }
    }

    // Check if customer exists
    const existingCustomer = db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        is_deleted: customers.is_deleted
      })
      .from(customers)
      .where(eq(customers.id, id))
      .get()

    if (!existingCustomer) {
      return { success: false, message: 'Customer not found' }
    }

    if (existingCustomer.is_deleted) {
      return { success: false, message: 'Cannot update deleted customer' }
    }

    // Build update data
    const updateData: any = {
      updated_on: sql`(strftime('%s', 'now'))`,
      is_sync_required: true
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return { success: false, message: 'Customer name cannot be empty' }
      }
      updateData.name = name.trim()
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null
    }

    if (email !== undefined) {
      updateData.email = email?.trim() || null
    }

    if (address !== undefined) {
      updateData.address = address?.trim() || null
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active
    }

    // Check for duplicates if name or contact info changed
    if (name?.trim() && name.trim() !== existingCustomer.name) {
      const duplicateConditions: SQL[] = [eq(customers.name, name.trim())]
      
      if (phone?.trim()) {
        duplicateConditions.push(eq(customers.phone, phone.trim()))
      }
      
      if (email?.trim()) {
        duplicateConditions.push(eq(customers.email, email.trim()))
      }

      const duplicate = db
        .select({ id: customers.id })
        .from(customers)
        .where(and(
          ...duplicateConditions,
          eq(customers.is_deleted, false),
          sql`${customers.id} != ${id}`
        ))
        .get()

      if (duplicate) {
        return { success: false, message: 'Another customer with similar details already exists' }
      }
    }

    // Perform update
    db.update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .run()

    // Fetch and return updated customer
    const customer = await fetchCustomerById(id, false, true)

    return {
      success: true,
      message: 'Customer updated successfully',
      data: customer
    }

  } catch (error) {
    console.error('Error updating customer:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update customer'
    }
  }
})

// ============================================================================
// SOFT DELETE CUSTOMER
// ============================================================================
ipcMain.handle('customers:soft-delete', async (_event, payload: DeleteCustomerPayload): Promise<{
  success: boolean
  message?: string
  data?: {
    id: number
    action: 'delete' | 'restore'
    restored: boolean
    has_sales?: boolean
  }
}> => {
  try {
    const db = getDB()
    const { id, restore = false } = payload
    const action = restore ? 'restore' : 'delete'

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    if (!id) {
      return { success: false, message: 'Customer ID is required' }
    }

    // Check if customer exists
    const existingCustomer = db
      .select({
        id: customers.id,
        is_deleted: customers.is_deleted,
        name: customers.name
      })
      .from(customers)
      .where(eq(customers.id, id))
      .get()

    if (!existingCustomer) {
      return { success: false, message: 'Customer not found' }
    }

    // Check if already in desired state
    if (restore && !existingCustomer.is_deleted) {
      return { success: false, message: 'Customer is already active' }
    }
    if (!restore && existingCustomer.is_deleted) {
      return { success: false, message: 'Customer is already deleted' }
    }

    // Check if customer has sales when trying to delete
    let hasSales = false
    if (!restore) {
      const salesCount = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(sales)
        .where(and(
          eq(sales.customer_id, id),
          eq(sales.is_deleted, false)
        ))
        .get()

      hasSales = Number(salesCount?.count || 0) > 0

      if (hasSales) {
        return {
          success: false,
          message: 'Cannot delete customer with existing sales. Consider deactivating instead.',
          data: {
            id,
            action,
            restored: restore,
            has_sales: true
          }
        }
      }
    }

    // Perform soft delete/restore
    db.update(customers)
      .set({
        is_deleted: restore ? false : true,
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      })
      .where(eq(customers.id, id))
      .run()

    // Log activity
    logEmployeeActivity({
      activity: `${restore ? 'restored' : 'deleted'} customer`,
      employee_id: session.employeeId,
      linked_activity_id: id,
      linked_activity_table: 'customers'
    })

    return {
      success: true,
      message: `Customer ${restore ? 'restored' : 'deleted'} successfully`,
      data: {
        id,
        action: restore ? 'restore' : 'delete',
        restored: restore
      }
    }

  } catch (error) {
    console.error('Error in customer soft delete:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} customer`
    }
  }
})

// ============================================================================
// HELPER FUNCTION: Fetch customer by ID with sales
// ============================================================================
async function fetchCustomerById(
  id: number,
  includeDeleted: boolean = false,
  includeSales: boolean = true,
  salesLimit: number = 20,
  salesStatus?: string[]
): Promise<any> {
  const db = getDB()

  // Build conditions
  const conditions: SQL[] = [eq(customers.id, id)]
  if (!includeDeleted) {
    conditions.push(eq(customers.is_deleted, false))
  }

  const customer = db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      created_on: customers.created_on,
      updated_on: customers.updated_on,
      is_active: customers.is_active,
      is_deleted: customers.is_deleted,
      is_sync_required: customers.is_sync_required
    })
    .from(customers)
    .where(and(...conditions))
    .get()

  if (!customer) return null

  let sales_data: any[] = []
  let sales_stats: any = null

  if (includeSales) {
    // Build sales conditions
    const salesConditions: SQL[] = [
      eq(sales.customer_id, id),
      eq(sales.is_deleted, false)
    ]

    if (salesStatus && salesStatus.length > 0) {
      salesConditions.push(inArray(sales.status, salesStatus as ("pending" | "completed" | "cancelled" | "refunded")[]))
    }

    // Fetch sales with payment info
    sales_data = db
      .select({
        id: sales.id,
        quantity: sales.quantity,
        total_price: sales.total_price,
        status: sales.status,
        is_debt_sale: sales.is_debt_sale,
        sold_on: sales.sold_on,
        profit_margin: sales.profit_margin,
        total_paid: sql<number>`COALESCE((
          SELECT SUM(${payments.amount_paid})
          FROM ${payments}
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
          AND ${payments.has_been_canceled} = 0
        ), 0)`.as('total_paid')
      })
      .from(sales)
      .where(and(...salesConditions))
      .orderBy(sql`${sales.sold_on} DESC`)
      .limit(salesLimit)
      .all()

    // Calculate stats
    const totalSpent = sales_data.reduce((sum, s) => sum + s.total_price, 0)
    const debtSales = sales_data.filter(s => s.is_debt_sale)
    const totalDebt = debtSales.reduce((sum, s) => sum + s.total_price, 0)
    const outstandingDebt = debtSales.reduce((sum, s) => sum + (s.total_price - (s.total_paid || 0)), 0)

    // Find favorite payment method - FIXED VERSION
    const paymentMethods = db
      .select({
        method: payments.payment_method,
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(payments)
      .innerJoin(sales, eq(payments.sale_id, sales.id))
      .where(and(
        eq(sales.customer_id, id),
        eq(payments.is_deleted, false),
        eq(payments.has_been_canceled, false)
      ))
      .groupBy(payments.payment_method)
      .orderBy(sql`COUNT(*) DESC`)  // Use the full expression, not the alias
      .limit(1)
      .all()

    sales_stats = {
      total_sales: sales_data.length,
      total_spent: totalSpent,
      average_sale_value: sales_data.length > 0 ? totalSpent / sales_data.length : 0,
      total_quantity: sales_data.reduce((sum, s) => sum + s.quantity, 0),
      debt_sales_count: debtSales.length,
      total_debt: totalDebt,
      outstanding_debt: outstandingDebt,
      first_purchase: sales_data.length > 0 ? Math.min(...sales_data.map(s => s.sold_on)) : null,
      last_purchase: sales_data.length > 0 ? Math.max(...sales_data.map(s => s.sold_on)) : null,
      favorite_payment_method: paymentMethods.length > 0 ? paymentMethods[0].method : null
    }
  }

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    created_on: toTimestamp(customer.created_on) || 0,
    updated_on: toTimestamp(customer.updated_on) || 0,
    is_active: customer.is_active || false,
    is_deleted: customer.is_deleted || false,
    is_sync_required: customer.is_sync_required || false,
    sales: sales_data.map(s => ({
      id: s.id,
      quantity: s.quantity,
      total_price: s.total_price,
      status: s.status,
      is_debt_sale: s.is_debt_sale,
      sold_on: toTimestamp(s.sold_on) || 0,
      profit_margin: s.profit_margin,
      total_paid: s.total_paid || 0,
      remaining_balance: s.total_price - (s.total_paid || 0),
      payment_count: 0
    })),
    sales_stats
  }
}