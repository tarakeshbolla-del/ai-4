
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
    ? { text: '#2C3E50', accent: '#ef4444', grid: '#e5e7eb' }
    : { text: '#E2E8F0', accent: '#f87171', grid: '#374151' };

  const chartData = data.labels.map((label, index) => ({
    name: label,
    Frustration: data.data[index],
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }} domain={[0, 1]} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#ffffff' : '#0A2540',
            borderColor: theme === 'light' ? '#e5e7eb' : '#374151'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 14 }}/>
        <Line 
            type="monotone" 
            dataKey="Frustration" 
            stroke={colors.accent}
            strokeWidth={2} 
            activeDot={{ r: 8 }}
            connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SentimentTrendChart;
