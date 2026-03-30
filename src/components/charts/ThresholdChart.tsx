'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import type { HourlyDataPoint } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface ThresholdChartProps {
  data: HourlyDataPoint[];
  onThreshold: number;
  offThreshold: number;
}

export default function ThresholdChart({ data, onThreshold, offThreshold }: ThresholdChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).getTime(),
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="thresholdGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1D9BF0" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1D9BF0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2F3336" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(val) => format(new Date(val), 'MMM d')}
            stroke="#71767B"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={formatNumber}
            stroke="#71767B"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#16181C',
              border: '1px solid #2F3336',
              borderRadius: '12px',
              color: '#E7E9EA',
              fontSize: '13px',
            }}
            labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy h:mm a')}
            formatter={(value) => [formatNumber(Number(value)), 'Posts']}
          />
          <ReferenceLine
            y={onThreshold}
            stroke="#00BA7C"
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{
              value: `ON: ${formatNumber(onThreshold)}`,
              position: 'right',
              fill: '#00BA7C',
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          <ReferenceLine
            y={offThreshold}
            stroke="#F4212E"
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{
              value: `OFF: ${formatNumber(offThreshold)}`,
              position: 'right',
              fill: '#F4212E',
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#1D9BF0"
            fill="url(#thresholdGradient)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#00BA7C]" style={{ borderTop: '2px dashed #00BA7C' }} />
          <span className="text-[#00BA7C]">ON Threshold</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#F4212E]" style={{ borderTop: '2px dashed #F4212E' }} />
          <span className="text-[#F4212E]">OFF Threshold</span>
        </div>
      </div>
    </div>
  );
}
