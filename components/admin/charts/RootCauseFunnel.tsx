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
    ? { text: '#1F2937', accent: '#0ea5e9', accentHover: '#0284c7', grid: '#F3F4F6' }
    : { text: '#F3F4F6', accent: '#38bdf8', accentHover: '#7dd3fc', grid: '#1f2937' };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#FFFFFF' : '#111827',
            borderColor: theme === 'light' ? '#E5E7EB' : '#1f2937'
          }}
          cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
        />
        <Legend wrapperStyle={{ fontSize: 14 }}/>
        <Bar dataKey="tickets" name="Number of Tickets" fill={colors.accent} onClick={(d) => onBarClick(d.name)}>
             {data.map((entry) => (
                <rect 
                    key={`bar-${entry.name}`}
                    fill={entry.name === selectedCause ? colors.accentHover : colors.accent}
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