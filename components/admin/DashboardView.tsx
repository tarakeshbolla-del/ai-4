import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();

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

  // Effect 1: Load all initial data and set up sockets. Runs once.
  useEffect(() => {
    getInitialDashboardData().then(data => {
      setKpis(data.kpis);
      setRootCauses(data.rootCauses);
      setHeatmapData(data.heatmap);
      setLoading(false);
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
  }, []);

  // Effect 2: Respond to filter changes from URL or set initial default view.
  useEffect(() => {
    if (loading) return; // Wait until data is loaded

    const filter = searchParams.get('filter');
    const validCauses = new Set(rootCauses.map(rc => rc.name));

    if (filter && validCauses.has(filter)) {
      // A valid filter is present. If it's not already selected, update the view.
      if (selectedCause !== filter) {
        setSelectedCause(filter);
        setIsWordCloudLoading(true);
        getWordCloudData(filter).then(data => {
            setWordCloudData(data);
            setIsWordCloudLoading(false);
        });
      }
    } else if (!selectedCause && rootCauses.length > 0) {
      // No filter, and nothing is selected yet (initial load case). Default to the first cause.
      setSelectedCause(rootCauses[0].name);
      setIsWordCloudLoading(true);
      getWordCloudData(rootCauses[0].name).then(data => {
          setWordCloudData(data);
          setIsWordCloudLoading(false);
      });
    }
  }, [searchParams, loading, rootCauses, selectedCause]);


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
        <div className="lg:col-span-3 bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[352px] flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Top Root Causes (Pareto)</h3>
          {rootCauses.length > 0 ? (
            <RootCauseFunnel data={rootCauses} onBarClick={handleBarClick} selectedCause={selectedCause} />
          ) : (
            <div className="flex-grow flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <p>Train a model from the Knowledge Base page to see root cause analysis.</p>
            </div>
          )}
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[352px] flex flex-col">
          <h3 className="text-lg font-semibold mb-4">
            Problem Keywords for: <span className="text-light-accent dark:text-dark-accent">{selectedCause || '...'}</span>
          </h3>
           {rootCauses.length > 0 ? (
            <WordCloud data={wordCloudData} isLoading={isWordCloudLoading} />
          ) : (
            <div className="flex-grow flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <p>No root causes to analyze.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Business Impact Heatmap</h3>
        {heatmapData.length > 0 ? (
          <ImpactHeatmap data={heatmapData} />
        ) : (
          <div className="flex-grow flex items-center justify-center text-center text-gray-500 dark:text-gray-400 min-h-[200px]">
            <p>Train a model from the Knowledge Base page to see the business impact heatmap.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;