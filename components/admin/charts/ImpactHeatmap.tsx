import React from 'react';
import type { HeatmapDataPoint } from '../../../types';

interface ImpactHeatmapProps {
  data: HeatmapDataPoint[];
}

const ImpactHeatmap: React.FC<ImpactHeatmapProps> = ({ data }) => {
  const findValue = (category: string, priority: string) => {
    return data.find(d => d.category === category && d.priority === priority)?.value || 0;
  };

  const maxVal = Math.max(...data.map(d => d.value), 1);

  const getColor = (value: number) => {
    const intensity = Math.min(value / maxVal, 1);
    if (intensity < 0.1) return 'bg-cyan-100 dark:bg-cyan-900/20';
    if (intensity < 0.3) return 'bg-cyan-200 dark:bg-cyan-800/40';
    if (intensity < 0.6) return 'bg-cyan-400 dark:bg-cyan-600/60';
    if (intensity < 0.8) return 'bg-cyan-500 dark:bg-cyan-500/80';
    return 'bg-cyan-600 dark:bg-cyan-400';
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
  const priorityOrder = ['Low', 'Medium', 'High', 'Critical'];
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
                    <div className="font-bold text-sm text-right pr-2 flex items-center justify-end">{priority}</div>
                    {categories.map(category => {
                        const value = findValue(category, priority);
                        return (
                             <div 
                                key={`${category}-${priority}`}
                                className={`h-12 flex items-center justify-center rounded transition-colors ${getColor(value)}`}
                                title={`${value} tickets`}
                            >
                                <span className="text-sm font-medium text-black/70 dark:text-white/80">{value}</span>
                             </div>
                        );
                    })}
                </React.Fragment>
            ))}
        </div>
    </div>
  );
};

export default ImpactHeatmap;