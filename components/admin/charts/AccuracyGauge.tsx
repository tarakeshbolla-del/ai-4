import React from 'react';
import { useTheme } from '../../../hooks/useTheme';

interface AccuracyGaugeProps {
  value: number;
}

const AccuracyGauge: React.FC<AccuracyGaugeProps> = ({ value }) => {
  const { theme } = useTheme();
  const radius = 52;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const color = value > 85 ? (theme === 'light' ? '#10b981' : '#34d399') // green
              : value > 70 ? (theme === 'light' ? '#f59e0b' : '#facc15') // amber
              : (theme === 'light' ? '#ef4444' : '#f87171'); // red

  return (
    <div className="relative w-40 h-40">
      <svg
        height="100%"
        width="100%"
        viewBox="0 0 120 120"
        className="transform -rotate-90"
      >
        <circle
          className="text-gray-200 dark:text-gray-700"
          stroke="currentColor"
          cx="60"
          cy="60"
          r={normalizedRadius}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          stroke={color}
          cx="60"
          cy="60"
          r={normalizedRadius}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold text-light-text dark:text-dark-text">
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default AccuracyGauge;
