
import React from 'react';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../../constants';
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

  return (
    <div className="overflow-x-auto">
        <div className="grid grid-cols-5 gap-1" style={{gridTemplateColumns: `1fr repeat(${TICKET_CATEGORIES.length}, 2fr)`}}>
            <div />
            {TICKET_CATEGORIES.map(cat => <div key={cat} className="font-bold text-center text-sm pb-2">{cat}</div>)}
            
            {TICKET_PRIORITIES.slice().reverse().map(priority => (
                <React.Fragment key={priority}>
                    <div className="font-bold text-sm text-right pr-2 flex items-center justify-end">{priority}</div>
                    {TICKET_CATEGORIES.map(category => {
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
