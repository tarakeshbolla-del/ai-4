import React from 'react';
import type { HeatmapDataPoint } from '../../../types';

interface ImpactHeatmapProps {
  data: HeatmapDataPoint[];
  onCellClick: (category: string, priority: string) => void;
}

const ImpactHeatmap: React.FC<ImpactHeatmapProps> = ({ data, onCellClick }) => {
  const findValue = (category: string, priority: string) => {
    return data.find(d => d.category === category && d.priority === priority)?.value || 0;
  };

  const maxVal = Math.max(...data.map(d => d.value), 1);

  const getColor = (value: number) => {
    const intensity = Math.min(value / maxVal, 1);
    if (value === 0) return 'bg-slate-100 dark:bg-gray-800/50';
    if (intensity < 0.1) return 'bg-sky-100 dark:bg-sky-900/40';
    if (intensity < 0.3) return 'bg-sky-200 dark:bg-sky-800/60';
    if (intensity < 0.6) return 'bg-sky-300 dark:bg-sky-700/80';
    if (intensity < 0.8) return 'bg-sky-400 dark:bg-sky-600';
    return 'bg-sky-500 dark:bg-sky-500';
  };

  const getTextColor = (value: number) => {
      const intensity = Math.min(value / maxVal, 1);
      return intensity > 0.6 ? 'text-white/90' : 'text-slate-800/80 dark:text-slate-100/80';
  }

  const priorityDisplayMap: Record<string, string> = {
    p1: 'High',
    p2: 'Medium',
    p3: 'Low',
  };

  // Dynamically get categories and priorities from the data
  // Fix: Replaced `new Set()` with `reduce()` to ensure correct type inference and avoid 'unknown[]' error.
  const categories: string[] = data.reduce((acc: string[], point) => {
    if (!acc.includes(point.category)) {
      acc.push(point.category);
    }
    return acc;
  }, []);
  // Fix: Replaced `new Set()` with `reduce()` to ensure correct type inference and avoid 'unknown[]' error.
  const priorities: string[] = data.reduce((acc: string[], point) => {
    if (!acc.includes(point.priority)) {
      acc.push(point.priority);
    }
    return acc;
  }, []);

  // Ensure a consistent, logical order for priorities
  const priorityOrder = ['p3', 'p2', 'p1', 'Low', 'Medium', 'High', 'Critical'];
  priorities.sort((a, b) => {
    const indexA = priorityOrder.indexOf(a);
    const indexB = priorityOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both are known
    if (indexA !== -1) return -1; // a is known, b is not
    if (indexB !== -1) return 1; // b is known, a is not
    return a.localeCompare(b); // Both are unknown, sort alphabetically
  });


  return (
    <div className="overflow-x-auto">
        <div className="grid gap-1" style={{gridTemplateColumns: `minmax(80px, 1fr) repeat(${categories.length}, minmax(100px, 2fr))`}}>
            <div />
            {categories.map(cat => <div key={cat} className="font-bold text-center text-sm pb-2 truncate" title={cat}>{cat}</div>)}
            
            {priorities.slice().reverse().map(priority => (
                <React.Fragment key={priority}>
                    <div className="font-bold text-sm text-right pr-2 flex items-center justify-end">{priorityDisplayMap[priority] || priority}</div>
                    {categories.map(category => {
                        const value = findValue(category, priority);
                        return (
                             <button 
                                key={`${category}-${priority}`}
                                onClick={() => onCellClick(category, priority)}
                                disabled={value === 0}
                                className={`h-12 flex items-center justify-center rounded transition-all focus:outline-none ${getColor(value)} ${value > 0 ? 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-light-accent dark:hover:ring-dark-accent ring-offset-light-card dark:ring-offset-dark-card' : 'cursor-default'}`}
                                title={`${value} tickets`}
                                aria-label={`View ${value} tickets for ${category} with ${priorityDisplayMap[priority] || priority} priority`}
                            >
                                <span className={`text-sm font-medium ${getTextColor(value)}`}>{value > 0 ? value : ''}</span>
                             </button>
                        );
                    })}
                </React.Fragment>
            ))}
        </div>
    </div>
  );
};

export default ImpactHeatmap;