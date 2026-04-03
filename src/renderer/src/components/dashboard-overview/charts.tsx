import React from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

// ─── Shared Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      {label && <div className="text-gray-400 mb-1.5 font-medium">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Mini Sparkline ─────────────────────────────────────────────────────────────
interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}
export const Sparkline: React.FC<SparklineProps> = ({ data, color = '#3b82f6', height = 40 }) => {
  const chartData = data.map((v, i) => ({ v, i }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Line Chart ─────────────────────────────────────────────────────────────────
interface LineChartProps {
  data: Array<Record<string, any>>
  lines: Array<{ key: string; name: string; color: string; dashed?: boolean }>
  xKey?: string
  formatter?: (val: number, name: string) => string
  height?: number
}
export const DashLineChart: React.FC<LineChartProps> = ({
  data,
  lines,
  xKey = 'label',
  formatter,
  height = 260,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11, fill: '#9ca3af' }}
        axisLine={false}
        tickLine={false}
        dy={6}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#9ca3af' }}
        axisLine={false}
        tickLine={false}
        width={50}
        tickFormatter={(v) => (formatter ? formatter(v, '') : v)}
      />
      <Tooltip content={<CustomTooltip formatter={formatter} />} />
      <Legend
        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        iconType="circle"
        iconSize={8}
      />
      {lines.map((l) => (
        <Line
          key={l.key}
          type="monotone"
          dataKey={l.key}
          name={l.name}
          stroke={l.color}
          strokeWidth={2}
          strokeDasharray={l.dashed ? '5 4' : undefined}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
)

// ─── Bar Chart ───────────────────────────────────────────────────────────────────
interface BarChartProps {
  data: Array<Record<string, any>>
  bars: Array<{ key: string; name: string; color: string }>
  xKey?: string
  formatter?: (val: number, name: string) => string
  height?: number
  layout?: 'vertical' | 'horizontal'
}
export const DashBarChart: React.FC<BarChartProps> = ({
  data,
  bars,
  xKey = 'label',
  formatter,
  height = 240,
  layout = 'horizontal',
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart
      data={data}
      layout={layout}
      margin={{ top: 4, right: 4, bottom: 4, left: layout === 'vertical' ? 80 : 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={layout === 'horizontal' ? false : true} horizontal={layout === 'horizontal'} />
      {layout === 'horizontal' ? (
        <>
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={6} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => formatter ? formatter(v, '') : v} />
        </>
      ) : (
        <>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatter ? formatter(v, '') : v} />
          <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: '#4b5563' }} axisLine={false} tickLine={false} />
        </>
      )}
      <Tooltip content={<CustomTooltip formatter={formatter} />} />
      {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />}
      {bars.map((b) => (
        <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={40} />
      ))}
    </BarChart>
  </ResponsiveContainer>
)

// ─── Donut / Pie Chart ───────────────────────────────────────────────────────────
interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>
  formatter?: (val: number) => string
  height?: number
  innerRadius?: number
  outerRadius?: number
  centerLabel?: string
  centerValue?: string
}
export const DashDonutChart: React.FC<DonutChartProps> = ({
  data,
  formatter,
  height = 220,
  innerRadius = 55,
  outerRadius = 85,
  centerLabel,
  centerValue,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={3}
        dataKey="value"
      >
        {data.map((entry, i) => (
          <Cell key={i} fill={entry.color} stroke="none" />
        ))}
      </Pie>
      <Tooltip
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const d = payload[0]
          return (
            <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: d.payload.color }} />
                <span className="text-gray-600">{d.name}</span>
              </div>
              <div className="font-semibold text-gray-900 mt-0.5">
                {formatter ? formatter(d.value as number) : d.value}
              </div>
            </div>
          )
        }}
      />
      {centerLabel && (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          <tspan x="50%" dy="-6" fontSize={20} fontWeight={700} fill="#111827">{centerValue}</tspan>
          <tspan x="50%" dy={20} fontSize={11} fill="#9ca3af">{centerLabel}</tspan>
        </text>
      )}
    </PieChart>
  </ResponsiveContainer>
)