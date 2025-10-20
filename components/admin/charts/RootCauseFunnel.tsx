import React from 'react';
import { ResponsiveContainer, Treemap } from 'recharts';
import type { RootCauseData } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface RootCauseFunnelProps {
  data: RootCauseData[];
  onBarClick: (cause: string) => void;
  selectedCause: string | null;
}

const CustomizedContent: React.FC<any> = ({
  depth, x, y, width, height, name, tickets, selectedCause, onBarClick, colors,
}) => {
  // Only render the actual data tiles, not the root container
  if (depth < 1) return null;

  const isSelected = name === selectedCause;
  const fill = isSelected ? colors.accentHover : colors.accent;
  const opacity = isSelected ? 1 : 0.85;

  const canFitText = width > 60 && height > 40;
  const fontSize = Math.max(12, Math.min(width / 5, height / 5, 18));

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          opacity,
          stroke: '#fff',
          strokeWidth: 2,
          cursor: 'pointer',
          transition: 'fill 0.3s ease, opacity 0.3s ease',
        }}
        onClick={() => onBarClick(name)}
      />
      {canFitText && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 'bold',
            pointerEvents: 'none',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}
        >
          <tspan x={x + width / 2} dy="-0.5em">{name}</tspan>
          <tspan x={x + width / 2} dy="1.2em" style={{ fontSize: `${fontSize * 0.85}px`, fontWeight: 'normal' }}>
            {tickets.toLocaleString()}
          </tspan>
        </text>
      )}
    </g>
  );
};


const RootCauseFunnel: React.FC<RootCauseFunnelProps> = ({ data, onBarClick, selectedCause }) => {
  const { theme } = useTheme();
  const colors = theme === 'light' 
    ? { text: '#1F2937', accent: '#0ea5e9', accentHover: '#0284c7', grid: '#F3F4F6' }
    : { text: '#F3F4F6', accent: '#38bdf8', accentHover: '#7dd3fc', grid: '#1f2937' };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={data}
        dataKey="tickets"
        ratio={16 / 9}
        stroke={theme === 'light' ? '#fff' : '#111827'}
        content={
            <CustomizedContent 
                colors={colors} 
                selectedCause={selectedCause} 
                onBarClick={onBarClick} 
            />
        }
        isAnimationActive={true}
        animationDuration={500}
      />
    </ResponsiveContainer>
  );
};

export default RootCauseFunnel;