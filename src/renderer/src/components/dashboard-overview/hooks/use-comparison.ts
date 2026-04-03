// components/dashboard-overview/hooks/useComparison.ts

import { useMemo } from 'react'
import type {
    ComparisonPeriod,
    ComparisonResult,
    SalesDashboardData
} from '../types/types'

export const useComparison = (
  salesData: SalesDashboardData | undefined,
  period: ComparisonPeriod
): ComparisonResult => {
  return useMemo(() => {
    // Default result when no data
    const defaultResult: ComparisonResult = {
      currentValue: 0,
      previousValue: 0,
      changePercentage: 0,
      trend: 'stable',
      label: 'No data'
    }

    if (!salesData?.breakdown || salesData.breakdown.length === 0) {
      return defaultResult
    }

    const days = salesData.breakdown
    const today = days[0]

    // Helper to calculate day comparison
    const getDayComparison = (offset: number): ComparisonResult => {
      const current = today?.total || 0
      const previous = days[offset]?.total || 0
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0
      
      return {
        currentValue: current,
        previousValue: previous,
        changePercentage: change,
        trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
        label: `vs ${offset} day${offset > 1 ? 's' : ''} ago`
      }
    }

    // Helper to calculate week comparison
    const getWeekComparison = (weekOffset: number): ComparisonResult => {
      // Get current week (last 7 days)
      const currentWeekDays = days.slice(0, 7)
      const currentWeekTotal = currentWeekDays.reduce((sum, day) => sum + day.total, 0)
      
      // Get previous week (next 7 days)
      const startIdx = weekOffset * 7
      const endIdx = Math.min(startIdx + 7, days.length)
      const previousWeekDays = days.slice(startIdx, endIdx)
      const previousWeekTotal = previousWeekDays.reduce((sum, day) => sum + day.total, 0)
      
      const change = previousWeekTotal > 0 
        ? ((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100 
        : 0
      
      return {
        currentValue: currentWeekTotal,
        previousValue: previousWeekTotal,
        changePercentage: change,
        trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
        label: weekOffset === 1 ? 'vs last week' : `vs ${weekOffset} weeks ago`
      }
    }

    // Helper to calculate month comparison
    const getMonthComparison = (monthOffset: number): ComparisonResult => {
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      
      // Get current month's data
      const currentMonthDays = days.filter(day => {
        const date = new Date(day.date)
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      })
      const currentMonthTotal = currentMonthDays.reduce((sum, day) => sum + day.total, 0)
      
      // Get previous month's data
      const prevDate = new Date()
      prevDate.setMonth(prevDate.getMonth() - monthOffset)
      const prevMonth = prevDate.getMonth()
      const prevYear = prevDate.getFullYear()
      
      const prevMonthDays = days.filter(day => {
        const date = new Date(day.date)
        return date.getMonth() === prevMonth && date.getFullYear() === prevYear
      })
      const prevMonthTotal = prevMonthDays.reduce((sum, day) => sum + day.total, 0)
      
      const change = prevMonthTotal > 0 
        ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 
        : 0
      
      return {
        currentValue: currentMonthTotal,
        previousValue: prevMonthTotal,
        changePercentage: change,
        trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
        label: monthOffset === 1 ? 'vs last month' : `vs ${monthOffset} months ago`
      }
    }

    // Helper to calculate year comparison
    const getYearComparison = (yearOffset: number): ComparisonResult => {
      const currentYear = new Date().getFullYear()
      
      // Get current year's data
      const currentYearDays = days.filter(day => {
        const date = new Date(day.date)
        return date.getFullYear() === currentYear
      })
      const currentYearTotal = currentYearDays.reduce((sum, day) => sum + day.total, 0)
      
      // Get previous year's data
      const prevYear = currentYear - yearOffset
      const prevYearDays = days.filter(day => {
        const date = new Date(day.date)
        return date.getFullYear() === prevYear
      })
      const prevYearTotal = prevYearDays.reduce((sum, day) => sum + day.total, 0)
      
      const change = prevYearTotal > 0 
        ? ((currentYearTotal - prevYearTotal) / prevYearTotal) * 100 
        : 0
      
      return {
        currentValue: currentYearTotal,
        previousValue: prevYearTotal,
        changePercentage: change,
        trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
        label: yearOffset === 1 ? 'vs last year' : `vs ${yearOffset} years ago`
      }
    }

    // Main switch statement
    switch (period) {
      // Day comparisons
      case 'today_vs_yesterday':
        return getDayComparison(1)
      case 'today_vs_2days':
        return getDayComparison(2)
      case 'today_vs_3days':
        return getDayComparison(3)
      case 'today_vs_4days':
        return getDayComparison(4)
      case 'today_vs_5days':
        return getDayComparison(5)
      case 'today_vs_6days':
        return getDayComparison(6)
      case 'today_vs_7days':
        return getDayComparison(7)
      
      // Week comparisons
      case 'this_week_vs_last_week':
        return getWeekComparison(1)
      case 'this_week_vs_2weeks':
        return getWeekComparison(2)
      case 'this_week_vs_3weeks':
        return getWeekComparison(3)
      
      // Month comparisons
      case 'this_month_vs_last_month':
        return getMonthComparison(1)
      case 'this_month_vs_3months':
        return getMonthComparison(3)
      case 'this_month_vs_6months':
        return getMonthComparison(6)
      
      // Year comparisons
      case 'this_year_vs_last_year':
        return getYearComparison(1)
      case 'this_year_vs_2years':
        return getYearComparison(2)
      
      default:
        return {
          currentValue: today?.total || 0,
          previousValue: days[1]?.total || 0,
          changePercentage: 0,
          trend: 'stable',
          label: (period as any).replace(/_/g, ' ')
        }
    }
  }, [salesData, period])
}