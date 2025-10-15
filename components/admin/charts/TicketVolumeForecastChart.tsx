import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TicketVolumeForecastDataPoint } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface TicketVolumeForecastChartProps {
  data: TicketVolumeForecastDataPoint[];
}

const TicketVolumeForecastChart: React.FC<TicketVolumeForecastChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#2C3E50', actual: '#0EA5E9', forecast: '#8b5cf6', grid: '#e5e7eb' }
    : { text: '#E2E8F0', actual: '#22D3EE', forecast: '#a78bfa', grid: '#374151' };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.actual} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={colors.actual} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.forecast} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={colors.forecast} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="day" tick={{ fill: colors.text, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
        <Tooltip
          contentStyle={{ 
            backgroundColor: theme === 'light' ? '#ffffff' : '#0A2540',
            borderColor: theme === 'light' ? '#e5e7eb' : '#374151'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 14 }}/>
        <Area 
            type="monotone" 
            dataKey="actual" 
            stroke={colors.actual}
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorActual)" 
            name="Actual Tickets"
        />
         <Area 
            type="monotone" 
            dataKey="forecast" 
            stroke={colors.forecast}
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1} 
            fill="url(#colorForecast)" 
            name="Forecasted Tickets"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default TicketVolumeForecastChart;