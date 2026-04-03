// src/services/dashboard.service.ts

import type {
    AlertCenterData,
    CustomerDashboardData,
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
} from './types/types'

/**
 * Dashboard Service
 * 
 * Makes real API calls to the Electron backend via window.api.dashboard
 * All methods return Promises that resolve to the exact types from the backend
 */

class DashboardService {
  
  // ==========================================================================
  // OVERVIEW DASHBOARD
  // ==========================================================================
  
  /**
   * Get executive overview dashboard data
   * @param filters Optional filters (period, date range, etc.)
   */
  async getOverview(filters?: DashboardFilters): Promise<DashboardResponse<OverviewDashboardData>> {
    try {
      return await window.api.dashboard.getOverview(filters)
    } catch (error) {
      console.error('DashboardService.getOverview error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch overview dashboard'
      }
    }
  }

  // ==========================================================================
  // SALES DASHBOARD - Your Rich Hierarchical Structure
  // ==========================================================================
  
  /**
   * Get sales dashboard with full drill-down hierarchy
   * @param filters Optional filters (period, date, etc.)
   */
  async getSalesDashboard(filters?: DashboardFilters): Promise<DashboardResponse<SalesDashboardData>> {
    try {
      return await window.api.dashboard.getSalesDashboard(filters)
    } catch (error) {
      console.error('DashboardService.getSalesDashboard error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch sales dashboard'
      }
    }
  }

  // ==========================================================================
  // INVENTORY DASHBOARD
  // ==========================================================================
  
  /**
   * Get inventory dashboard with stock intelligence
   * @param filters Optional filters
   */
  async getInventoryDashboard(filters?: DashboardFilters): Promise<DashboardResponse<InventoryDashboardData>> {
    try {
      return await window.api.dashboard.getInventoryDashboard(filters)
    } catch (error) {
      console.error('DashboardService.getInventoryDashboard error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch inventory dashboard'
      }
    }
  }

  // ==========================================================================
  // CUSTOMERS DASHBOARD
  // ==========================================================================
  
  /**
   * Get customers dashboard with analytics
   * @param filters Optional filters
   */
  async getCustomersDashboard(filters?: DashboardFilters): Promise<DashboardResponse<CustomerDashboardData>> {
    try {
      return await window.api.dashboard.getCustomersDashboard(filters)
    } catch (error) {
      console.error('DashboardService.getCustomersDashboard error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch customers dashboard'
      }
    }
  }

  // ==========================================================================
  // PRODUCTS DASHBOARD
  // ==========================================================================
  
  /**
   * Get products dashboard with performance analytics
   * @param filters Optional filters
   */
  async getProductsDashboard(filters?: DashboardFilters): Promise<DashboardResponse<ProductsDashboardData>> {
    try {
      return await window.api.dashboard.getProductsDashboard(filters)
    } catch (error) {
      console.error('DashboardService.getProductsDashboard error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch products dashboard'
      }
    }
  }

  // ==========================================================================
  // TIME PATTERNS ANALYTICS
  // ==========================================================================
  
  /**
   * Get time-based analytics with heatmaps
   * @param filters Optional filters
   */
  async getTimePatterns(filters?: DashboardFilters): Promise<DashboardResponse<TimePatternsData>> {
    try {
      return await window.api.dashboard.getTimePatterns(filters)
    } catch (error) {
      console.error('DashboardService.getTimePatterns error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch time patterns'
      }
    }
  }

  // ==========================================================================
  // FORECASTS ANALYTICS
  // ==========================================================================
  
  /**
   * Get sales and inventory forecasts
   * @param filters Optional filters
   */
  async getForecasts(filters?: DashboardFilters): Promise<DashboardResponse<ForecastsData>> {
    try {
      return await window.api.dashboard.getForecasts(filters)
    } catch (error) {
      console.error('DashboardService.getForecasts error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch forecasts'
      }
    }
  }

  // ==========================================================================
  // FINANCIALS DASHBOARD
  // ==========================================================================
  
  /**
   * Get financial health dashboard
   * @param filters Optional filters
   */
  async getFinancials(filters?: DashboardFilters): Promise<DashboardResponse<FinancialsData>> {
    try {
      return await window.api.dashboard.getFinancials(filters)
    } catch (error) {
      console.error('DashboardService.getFinancials error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch financials dashboard'
      }
    }
  }

  // ==========================================================================
  // OPERATIONS DASHBOARD
  // ==========================================================================
  
  /**
   * Get operations dashboard (employees, transactions, suppliers)
   * @param filters Optional filters
   */
  async getOperations(filters?: DashboardFilters): Promise<DashboardResponse<OperationsData>> {
    try {
      return await window.api.dashboard.getOperations(filters)
    } catch (error) {
      console.error('DashboardService.getOperations error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch operations dashboard'
      }
    }
  }

  // ==========================================================================
  // ALERTS CENTER
  // ==========================================================================
  
  /**
   * Get all alerts
   * @param filters Optional filters (read, category)
   */
  async getAlerts(filters?: { read?: boolean; category?: string }): Promise<DashboardResponse<AlertCenterData>> {
    try {
      return await window.api.dashboard.getAlerts(filters)
    } catch (error) {
      console.error('DashboardService.getAlerts error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch alerts'
      }
    }
  }

  /**
   * Mark an alert as read
   * @param alertId ID of the alert to mark as read
   */
  async markAlertRead(alertId: string): Promise<{ success: boolean }> {
    try {
      return await window.api.dashboard.markAlertRead(alertId)
    } catch (error) {
      console.error('DashboardService.markAlertRead error:', error)
      return { success: false }
    }
  }

  /**
   * Dismiss an alert
   * @param alertId ID of the alert to dismiss
   */
  async dismissAlert(alertId: string): Promise<{ success: boolean }> {
    try {
      return await window.api.dashboard.dismissAlert(alertId)
    } catch (error) {
      console.error('DashboardService.dismissAlert error:', error)
      return { success: false }
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Check if the dashboard API is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.getOverview()
      return response.success
    } catch {
      return false
    }
  }
}

// Export a singleton instance
export const dashboardService = new DashboardService()

// Also export the class for testing/dependency injection
export default DashboardService