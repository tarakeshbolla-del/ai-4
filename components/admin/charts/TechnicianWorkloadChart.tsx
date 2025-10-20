import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TechnicianWorkloadData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface TechnicianWorkloadChartProps {
  data: TechnicianWorkloadData[];
}

const TechnicianWorkloadChart: React.FC<TechnicianWorkloadChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#1F2937', accent: '#8b5cf6', grid: '#F3F4F6' }
    : { text: '#F3F4F6', accent: '#a78bfa', grid: '#1f2937' };

  const sortedData = [...data].sort((a, b) => a.tickets - b.tickets);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis type="number" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis dataKey="name" type="category" tick={{ fill: colors.text, fontSize: 12 }} width={100} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
          cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
        />
        <Bar dataKey="tickets" name="Assigned Tickets" fill={colors.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TechnicianWorkloadChart;
