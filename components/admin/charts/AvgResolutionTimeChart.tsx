import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import type { AvgResolutionTimeData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface AvgResolutionTimeChartProps {
  data: AvgResolutionTimeData[];
}

const AvgResolutionTimeChart: React.FC<AvgResolutionTimeChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#1F2937', accent: '#ef4444', grid: '#F3F4F6' }
    : { text: '#F3F4F6', accent: '#f87171', grid: '#1f2937' };

  const sortedData = [...data].sort((a, b) => b['Avg Hours'] - a['Avg Hours']);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 90 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis 
            dataKey="name" 
            tick={{ fill: colors.text, fontSize: 12 }} 
            angle={-45} 
            textAnchor="end" 
            interval={0} 
            height={80}
        />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }}>
            <Label value="Avg. Hours to Resolve" position="insideLeft" angle={-90} style={{ textAnchor: 'middle', fill: colors.text, fontSize: 14 }} />
        </YAxis>
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
          cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
        />
        <Bar dataKey="Avg Hours" fill={colors.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default AvgResolutionTimeChart;
