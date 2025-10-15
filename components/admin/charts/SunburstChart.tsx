
import React, { useMemo } from 'react';
import * as d3 from 'd3';
import type { SunburstNode } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface SunburstChartProps {
  data: SunburstNode;
  width?: number;
  height?: number;
}

const SunburstChart: React.FC<SunburstChartProps> = ({ data, width = 500, height = 500 }) => {
  const { theme } = useTheme();

  const chartData = useMemo(() => {
    const radius = Math.min(width, height) / 2;
    
    const hierarchy = d3.hierarchy<SunburstNode>(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<SunburstNode>()
      .size([2 * Math.PI, radius * radius]);

    const root = partition(hierarchy);

    const arc = d3.arc<d3.HierarchyRectangularNode<SunburstNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => Math.sqrt(d.y0))
      .outerRadius(d => Math.sqrt(d.y1) - 1);
    
    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, (data.children?.length || 0) + 1));

    const allNodes = root.descendants().filter(d => d.depth);

    return { allNodes, arc, color, radius };

  }, [data, width, height]);

  const { allNodes, arc, color, radius } = chartData;

  return (
    <svg width={width} height={height} viewBox={`-${width/2} -${height/2} ${width} ${height}`}>
      {allNodes.map(d => {
        const pathData = arc(d);
        if (!pathData) return null;
        
        const nodeColor = d.parent ? color(d.parent.data.name) : 'transparent';
        
        return (
          <g key={d.data.name + d.depth}>
            <path
              d={pathData}
              fill={nodeColor}
              fillOpacity={0.7}
              className="cursor-pointer transition-opacity hover:opacity-100"
            />
            <title>{`${d.ancestors().map(d => d.data.name).reverse().join(" > ")}\nValue: ${d.value}`}</title>
          </g>
        );
      })}
      {allNodes.filter(d => d.y0 + d.y1 > 100 && (d.x1 - d.x0) > 0.05).map(d => {
         const centroid = arc.centroid(d);
         const textAnchor = "middle";
         const fontSize = Math.max(8, Math.min(14, (Math.sqrt(d.y1) - Math.sqrt(d.y0)) / 2));
         return (
             <text
                key={d.data.name + d.depth + 'label'}
                transform={`translate(${centroid[0]}, ${centroid[1]})`}
                textAnchor={textAnchor}
                dy="0.35em"
                fontSize={fontSize}
                fill={theme === 'light' ? '#0A2540' : '#F8FAFC'}
                className="pointer-events-none"
             >
                {d.data.name}
             </text>
         );
      })}
    </svg>
  );
};

export default SunburstChart;
