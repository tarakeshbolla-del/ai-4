import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { DepartmentalTicketData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface DepartmentalTicketChartProps {
  data: DepartmentalTicketData[];
}

const DepartmentalTicketChart: React.FC<DepartmentalTicketChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#1F2937', accent: '#3b82f6', grid: '#F3F4F6' } // a blue color
    : { text: '#F3F4F6', accent: '#60a5fa', grid: '#1f2937' };

  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <p>No departmental data available. <br/> Please train a model from the Knowledge Base page to see this chart.</p>
        </div>
    );
  }

  // Sort ascending for horizontal bar chart (so largest bar is at the top)
  const sortedData = [...data].sort((a, b) => a.Total - b.Total);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis type="number" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: colors.text, fontSize: 12 }}
            width={150} // Allocate more space for long names
            interval={0}
            />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
          cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
        />
        <Bar dataKey="Total" fill={colors.accent}>
          <LabelList dataKey="Total" position="right" style={{ fill: colors.text, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default DepartmentalTicketChart;