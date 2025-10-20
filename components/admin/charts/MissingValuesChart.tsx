import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { useTheme } from '../../../hooks/useTheme';
import type { EdaReport } from '../../../types';

interface MissingValuesChartProps {
  columns: EdaReport['columns'];
  rowCount: number;
}

const MissingValuesChart: React.FC<MissingValuesChartProps> = ({ columns, rowCount }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#1F2937', accent: '#f59e0b', grid: '#F3F4F6' }
    : { text: '#F3F4F6', accent: '#facc15', grid: '#1f2937' };

  const data = columns
    .map(col => ({
      name: col.name,
      'Missing (%)': col.missing > 0 ? parseFloat(((col.missing / rowCount) * 100).toFixed(2)) : 0,
    }))
    .filter(item => item['Missing (%)'] > 0)
    .sort((a, b) => b['Missing (%)'] - a['Missing (%)']);

  if (data.length === 0) {
      return (
          <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">No missing values detected.</p>
          </div>
      );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }}>
             <Label value="Missing (%)" position="insideLeft" angle={-90} style={{ textAnchor: 'middle', fill: colors.text, fontSize: 14 }} />
        </YAxis>
        <Tooltip
          formatter={(value) => `${value}%`}
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
        />
        <Bar dataKey="Missing (%)" fill={colors.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MissingValuesChart;