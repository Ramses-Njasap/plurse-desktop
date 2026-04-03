import React from 'react';
import type { DashboardAlert } from './types/types';

interface AlertsFeedProps {
  alerts?: DashboardAlert[]
  onMarkAllRead?: () => void
  onViewAlert?: (alertId: string) => void
}

const severityStyle: Record<string, { bg: string; dot: string; icon: string }> = {
  critical: { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', icon: '🔴' },
  warning: { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', icon: '🟡' },
  info: { bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400', icon: '🔵' },
  success: { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-400', icon: '🟢' },
}

const AlertsFeed: React.FC<AlertsFeedProps> = ({ 
  alerts = [], 
  onMarkAllRead, 
  onViewAlert 
}) => {
  const unread = alerts.filter((a) => !a.read).length

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-900">Alerts</h3>
          {unread > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
        {onMarkAllRead && unread > 0 && (
          <button 
            onClick={onMarkAllRead}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No alerts to display
          </div>
        ) : (
          alerts.map((alert) => {
            const style = severityStyle[alert.severity] ?? severityStyle.info
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${!alert.read ? 'bg-gray-50/50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900">{alert.title}</span>
                    {!alert.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.message}</p>
                </div>
                {alert.actionable && onViewAlert && (
                  <button 
                    onClick={() => onViewAlert(alert.id)}
                    className="text-xs text-blue-600 font-medium whitespace-nowrap hover:underline flex-shrink-0"
                  >
                    View →
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default AlertsFeed