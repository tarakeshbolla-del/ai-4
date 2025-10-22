import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getInitialDashboardData, getWordCloudData, getTicketsByCategoryAndPriority } from '../../services/api';
import { socketService } from '../../services/socketService';
import { SAP_MODULE_FULL_NAMES, SAP_MODULE_REVERSE_NAMES } from '../../constants';
import type { Kpis, RootCauseData, HeatmapDataPoint, SimilarTicket } from '../../types';
import KpiCard from './charts/KpiCard';
import RootCauseFunnel from './charts/RootCauseFunnel';
import WordCloud from './charts/WordCloud';
import ImpactHeatmap from './charts/ImpactHeatmap';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';

const DashboardView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rootCauses, setRootCauses] = useState<RootCauseData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [wordCloudData, setWordCloudData] = useState<{ word: string, value: number }[]>([]);
  const [isWordCloudLoading, setIsWordCloudLoading] = useState(false);
  const [searchParams] = useSearchParams();
  
  // State for the interactive heatmap modal
  const [modalData, setModalData] = useState<{ title: string; tickets: SimilarTicket[] } | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  const handleBarClick = useCallback((cause: string) => {
    if (selectedCause === cause) {
        setSelectedCause(null);
        setWordCloudData([]);
        return;
    }
    setSelectedCause(cause);
    setIsWordCloudLoading(true);
    const shortCause = SAP_MODULE_REVERSE_NAMES[cause] || cause;
    getWordCloudData(shortCause).then(data => {
        setWordCloudData(data);
        setIsWordCloudLoading(false);
    });
  }, [selectedCause]);
  
  const handleHeatmapCellClick = async (category: string, priority: string) => {
    const priorityDisplayMap: Record<string, string> = { p1: 'High', p2: 'Medium', p3: 'Low' };
    const title = `Loading tickets for ${category} / ${priorityDisplayMap[priority] || priority}...`;

    setIsModalLoading(true);
    setModalData({ title, tickets: [] });
    
    const shortCategory = SAP_MODULE_REVERSE_NAMES[category] || category;
    const tickets = await getTicketsByCategoryAndPriority(shortCategory, priority);
    
    setModalData({
        title: `${tickets.length} ${priorityDisplayMap[priority] || priority} tickets for ${category}`,
        tickets: tickets
    });
    setIsModalLoading(false);
  };

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
    const validCauses = new Set(rootCauses.map(rc => SAP_MODULE_FULL_NAMES[rc.name] || rc.name));

    if (filter && validCauses.has(filter)) {
      // A valid filter is present. If it's not already selected, update the view.
      if (selectedCause !== filter) {
        setSelectedCause(filter);
        setIsWordCloudLoading(true);
        const shortCause = SAP_MODULE_REVERSE_NAMES[filter] || filter;
        getWordCloudData(shortCause).then(data => {
            setWordCloudData(data);
            setIsWordCloudLoading(false);
        });
      }
    } else if (!selectedCause && rootCauses.length > 0) {
      // No filter, and nothing is selected yet (initial load case). Default to the first cause.
      const firstCauseFullName = SAP_MODULE_FULL_NAMES[rootCauses[0].name] || rootCauses[0].name;
      setSelectedCause(firstCauseFullName);
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Ticket Deflection Rate" value={`${kpis?.deflectionRate.toFixed(1)}%`} />
        <KpiCard title="Avg. Time to Resolution" value={`${kpis?.avgTimeToResolution.toFixed(1)} hrs`} />
        <KpiCard title="First Contact Resolution" value={`${kpis?.firstContactResolution.toFixed(1)}%`} />
      </div>

      <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border h-96 flex flex-col">
        <h3 className="text-lg font-semibold mb-1">Top Root Causes</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Click a tile to explore related keywords.</p>
        <div className="flex-grow">
          {rootCauses.length > 0 ? (
              <RootCauseFunnel data={rootCauses.map(rc => ({ ...rc, name: SAP_MODULE_FULL_NAMES[rc.name] || rc.name }))} onBarClick={handleBarClick} selectedCause={selectedCause} />
          ) : (
              <div className="flex h-full items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <p>Train a model from the Knowledge Base page to see root cause analysis.</p>
              </div>
          )}
        </div>
      </div>
      <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border h-96 flex flex-col">
        <h3 className="text-lg font-semibold mb-1">
          Problem Keywords
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
           For: <span className="font-semibold text-light-accent dark:text-dark-accent">{selectedCause || '...'}</span>
        </p>
         <div className="flex-grow">
           {rootCauses.length > 0 ? (
            <WordCloud data={wordCloudData} isLoading={isWordCloudLoading} />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <p>No root causes to analyze.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
        <h3 className="text-lg font-semibold mb-1">Business Impact Heatmap</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ticket volume by category and priority. Click a cell to view tickets.</p>
        {heatmapData.length > 0 ? (
          <ImpactHeatmap data={heatmapData.map(d => ({ ...d, category: SAP_MODULE_FULL_NAMES[d.category] || d.category }))} onCellClick={handleHeatmapCellClick} />
        ) : (
          <div className="flex-grow flex items-center justify-center text-center text-gray-500 dark:text-gray-400 min-h-[200px]">
            <p>Train a model from the Knowledge Base page to see the business impact heatmap.</p>
          </div>
        )}
      </div>

       {modalData && (
        <Modal
            isOpen={!!modalData}
            onClose={() => setModalData(null)}
            title={modalData.title}
        >
            {isModalLoading ? (
                <div className="h-48 flex items-center justify-center">
                    <LoadingSpinner />
                </div>
            ) : (
                <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-4">
                    <ul className="space-y-3">
                        {modalData.tickets.map(ticket => (
                            <li key={ticket.ticket_no} className="p-3 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-light-border dark:border-dark-border text-sm">
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold text-light-text dark:text-dark-text">{ticket.problem_description}</p>
                                    <span className="ml-4 flex-shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">{ticket.ticket_no}</span>
                                </div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="font-medium">Technician:</span> {ticket.technician || 'N/A'}
                                    <span className="mx-2">|</span>
                                    <span className="font-medium">Status:</span> {ticket.request_status || 'N/A'}
                                </div>
                                {ticket.solution_text && (
                                    <details className="mt-2 text-xs">
                                        <summary className="cursor-pointer text-light-accent dark:text-dark-accent font-semibold hover:underline">Show Solution</summary>
                                        <p className="mt-1 pt-1 border-t border-light-border/50 dark:border-dark-border/50 text-gray-600 dark:text-gray-300">{ticket.solution_text}</p>
                                    </details>
                                )}
                            </li>
                        ))}
                        {modalData.tickets.length === 0 && (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No tickets found for this selection.</p>
                        )}
                    </ul>
                </div>
            )}
        </Modal>
      )}
    </div>
  );
};

export default DashboardView;