import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { SentimentData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface SentimentTrendChartProps {
  data: SentimentData;
}

const SentimentTrendChart: React.FC<SentimentTrendChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#1F2937', accent: '#f97316', grid: '#F3F4F6' }
    : { text: '#F3F4F6', accent: '#fb923c', grid: '#1f2937' };

  const chartData = data.labels.map((label, index) => ({
    name: label,
    Frustration: data.data[index],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }} domain={[0, 1]} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 14 }}/>
        <Line 
            type="monotone" 
            dataKey="Frustration" 
            stroke={colors.accent}
            strokeWidth={2} 
            dot={{ r: 4, fill: colors.accent, strokeWidth: 2, stroke: colors.accent }}
            activeDot={{ r: 8 }}
            connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SentimentTrendChart;