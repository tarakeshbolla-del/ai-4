import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { SunburstNode } from '../../../types';
import { useTheme } from '../../../hooks/useTheme';

interface ProblemClusterChartProps {
  data: SunburstNode;
}

// NOTE: This component renders a Force-Directed Graph.
// The filename is retained for simplicity based on the project's evolution.
const ProblemClusterChart: React.FC<ProblemClusterChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);

  const { nodes, links } = useMemo(() => {
    const flatNodes: any[] = [];
    const flatLinks: any[] = [];
    let idCounter = 0;

    function traverse(node: SunburstNode, parentId: number | null, depth: number) {
      const id = idCounter++;
      const childrenSum = d3.hierarchy(node).sum(d => d.value || 0).value || 0;
      
      flatNodes.push({
        id,
        name: node.name,
        value: node.value || childrenSum,
        depth,
      });

      if (parentId !== null) {
        flatLinks.push({ source: parentId, target: id });
      }

      if (node.children) {
        node.children.forEach(child => traverse(child, id, depth + 1));
      }
    }

    const totalValue = d3.hierarchy(data).sum(d => d.value || 0).value || 0;
    const rootNode = { ...data, value: totalValue, name: 'All Issues' };
    traverse(rootNode, null, 0);

    return { nodes: flatNodes, links: flatLinks };
  }, [data]);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        if (entries && entries.length > 0 && entries[0].contentRect) {
          const { width, height } = entries[0].contentRect;
          setDimensions({ width, height });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Main simulation and drawing effect
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || !nodes.length) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, d => d.value) || 1])
      .range([4, 45]);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(60).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => radiusScale(d.value) + 3));

    const link = svg.append("g")
      .attr('class', 'links')
      .attr("stroke", theme === 'light' ? "#999" : "#555")
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'link')
      .attr("stroke-width", 1.5);
    
    const nodeGroup = svg.append("g")
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group cursor-pointer');
      
    nodeGroup.append("circle")
        .attr("r", d => radiusScale(d.value))
        .attr("fill", (d: any) => colorScale(d.depth.toString()))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);

    nodeGroup.append("text")
        .text((d: any) => d.name)
        .attr('x', 0)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .style("font-size", d => `${Math.max(8, Math.min(14, radiusScale(d.value) / 2.5))}px`)
        .style("fill", "#fff")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .style("text-shadow", "0 1px 2px rgba(0,0,0,0.7)")
        .style('opacity', d => radiusScale(d.value) > 10 ? 1 : 0);

    nodeGroup
      .on('mouseover', (event, d) => setHoveredNode(d))
      .on('mouseout', () => setHoveredNode(null));

    function drag(simulation: d3.Simulation<any, any>) {
      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }
    nodeGroup.call(drag(simulation) as any);

    simulation.on("tick", () => {
      link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);
    });

    return () => simulation.stop();
  }, [nodes, links, dimensions, theme]);

  // Hover effect
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    if (!hoveredNode) {
        svg.selectAll('.node-group').style('opacity', 1);
        svg.selectAll('.link').style('stroke-opacity', 0.6);
        svg.selectAll('circle').attr('stroke', '#fff');
        return;
    }
    
    svg.selectAll('circle').attr('stroke', d => (d as any).id === hoveredNode.id ? (theme === 'light' ? '#000' : '#fff') : '#fff');

    const linkedByIndex = new Map();
    links.forEach(d => {
        linkedByIndex.set(`${(d.source as any).id},${(d.target as any).id}`, true);
    });
    
    const areNodesConnected = (a: any, b: any) => linkedByIndex.has(`${a.id},${b.id}`) || linkedByIndex.has(`${b.id},${a.id}`) || a.id === b.id;
    
    svg.selectAll('.node-group').style('opacity', d => areNodesConnected(d, hoveredNode) ? 1 : 0.2);
    svg.selectAll('.link').style('stroke-opacity', l => (l.source as any).id === hoveredNode.id || (l.target as any).id === hoveredNode.id ? 0.9 : 0.1);

  }, [hoveredNode, links, theme]);

  const headerText = hoveredNode ? `${hoveredNode.name}: ${hoveredNode.value.toLocaleString()} tickets` : `All Issues: ${nodes[0]?.value.toLocaleString() || 0} tickets`;

  return (
    <div ref={containerRef} className="relative w-full h-full font-sans">
      <div className="absolute top-0 left-4 h-10 flex items-center w-full pr-4 pointer-events-none">
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate font-medium">
          {headerText}
        </p>
      </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height}></svg>
    </div>
  );
};

export default ProblemClusterChart;