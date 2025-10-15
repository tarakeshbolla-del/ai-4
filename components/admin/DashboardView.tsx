
import React, { useState, useEffect, useCallback } from 'react';
import { getInitialDashboardData, getWordCloudData } from '../../services/api';
import { socketService } from '../../services/socketService';
import type { Kpis, RootCauseData, HeatmapDataPoint } from '../../types';
import KpiCard from './charts/KpiCard';
import RootCauseFunnel from './charts/RootCauseFunnel';
import WordCloud from './charts/WordCloud';
import ImpactHeatmap from './charts/ImpactHeatmap';
import LoadingSpinner from '../common/LoadingSpinner';

const DashboardView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rootCauses, setRootCauses] = useState<RootCauseData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [wordCloudData, setWordCloudData] = useState<{ word: string, value: number }[]>([]);
  const [isWordCloudLoading, setIsWordCloudLoading] = useState(false);

  const handleBarClick = useCallback((cause: string) => {
    if (selectedCause === cause) {
        setSelectedCause(null);
        setWordCloudData([]);
        return;
    }
    setSelectedCause(cause);
    setIsWordCloudLoading(true);
    getWordCloudData(cause).then(data => {
        setWordCloudData(data);
        setIsWordCloudLoading(false);
    });
  }, [selectedCause]);

  useEffect(() => {
    getInitialDashboardData().then(data => {
      setKpis(data.kpis);
      setRootCauses(data.rootCauses);
      setHeatmapData(data.heatmap);
      setLoading(false);
      
      // Set initial word cloud for top cause
      if (data.rootCauses.length > 0) {
        handleBarClick(data.rootCauses[0].name);
      }
    });

    socketService.connect();

    socketService.on('kpi_update', (update: Partial<Kpis>) => {
      setKpis(prev => prev ? { ...prev, ...update } : null);
    });

    socketService.on('heatmap_update', (update: HeatmapDataPoint) => {
      setHeatmapData(prev => {
        const newData = [...prev];
        const index = newData.findIndex(d => d.category === update.category && d.priority === update.priority);
        if (index > -1) {
          newData[index].value += update.value;
        }
        return newData;
      });
    });

    return () => {
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Ticket Deflection Rate" value={`${kpis?.deflectionRate.toFixed(1)}%`} />
        <KpiCard title="Avg. Time to Resolution" value={`${kpis?.avgTimeToResolution.toFixed(1)} hrs`} />
        <KpiCard title="First Contact Resolution" value={`${kpis?.firstContactResolution.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Top Root Causes (Pareto)</h3>
          <RootCauseFunnel data={rootCauses} onBarClick={handleBarClick} selectedCause={selectedCause} />
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">
            Problem Keywords for: <span className="text-light-accent dark:text-dark-accent">{selectedCause || '...'}</span>
          </h3>
          <WordCloud data={wordCloudData} isLoading={isWordCloudLoading} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Business Impact Heatmap</h3>
        <ImpactHeatmap data={heatmapData} />
      </div>
    </div>
  );
};

export default DashboardView;
