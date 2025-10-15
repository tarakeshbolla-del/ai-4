import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../../hooks/useTheme';
import type { EdaReport } from '../../../types';

interface CategoryDistributionChartProps {
  data: EdaReport['categoryDistribution'];
}

const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#2C3E50', accent: '#10b981', grid: '#e5e7eb' }
    : { text: '#E2E8F0', accent: '#34d399', grid: '#374151' };

  const sortedData = [...data].sort((a, b) => a.value - b.value);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis type="number" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis dataKey="name" type="category" tick={{ fill: colors.text, fontSize: 12 }} width={120} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#ffffff' : '#0A2540',
            borderColor: theme === 'light' ? '#e5e7eb' : '#374151'
          }}
          cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
        />
        <Bar dataKey="value" name="Ticket Count" fill={colors.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CategoryDistributionChart;
