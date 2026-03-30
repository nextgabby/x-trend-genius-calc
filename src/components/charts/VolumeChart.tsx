'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import type { HourlyDataPoint } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface VolumeChartProps {
  data: HourlyDataPoint[];
}

export default function VolumeChart({ data }: VolumeChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).getTime(),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
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
          <Area
            type="monotone"
            dataKey="count"
            stroke="#1D9BF0"
            fill="url(#volumeGradient)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
