
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { RootCauseData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface RootCauseFunnelProps {
  data: RootCauseData[];
  onBarClick: (cause: string) => void;
  selectedCause: string | null;
}

const RootCauseFunnel: React.FC<RootCauseFunnelProps> = ({ data, onBarClick, selectedCause }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#2C3E50', accent: '#0EA5E9', grid: '#e5e7eb' }
    : { text: '#E2E8F0', accent: '#22D3EE', grid: '#374151' };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#ffffff' : '#0A2540',
            borderColor: theme === 'light' ? '#e5e7eb' : '#374151'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 14 }}/>
        <Bar dataKey="tickets" name="Number of Tickets" fill={colors.accent} onClick={(d) => onBarClick(d.name)}>
             {data.map((entry) => (
                <rect 
                    key={`bar-${entry.name}`}
                    fill={entry.name === selectedCause ? (theme === 'light' ? '#0284c7' : '#06b6d4') : colors.accent}
                    opacity={entry.name === selectedCause ? 1 : 0.8}
                    className="cursor-pointer"
                />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RootCauseFunnel;
