import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TicketStatusData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface TicketStatusChartProps {
  data: TicketStatusData[];
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#6b7280'];
const DARK_COLORS = ['#34d399', '#facc15', '#60a5fa', '#f87171', '#9ca3af'];

const TicketStatusChart: React.FC<TicketStatusChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const chartColors = theme === 'light' ? COLORS : DARK_COLORS;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius="80%"
          innerRadius="60%"
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
        />
        <Legend wrapperStyle={{ fontSize: '14px', bottom: 0 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default TicketStatusChart;
