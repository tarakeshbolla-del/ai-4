

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    getProblemClusterData, 
    getUserFrustrationData, 
    getPredictiveHotspots, 
    getSlaBreachTickets, 
    getTicketVolumeForecast,
    getTechnicianWorkload,
    getTicketStatusDistribution,
    getAvgResolutionTimeByCategory,
    getSlaRiskTickets,
    getTicketDistributionByDepartment,
} from '../../services/api';
import { socketService } from '../../services/socketService';
import { SAP_MODULE_FULL_NAMES } from '../../constants';
import type { 
    SunburstNode, 
    SentimentData, 
    PredictiveHotspot, 
    SlaBreachTicket, 
    TicketVolumeForecastDataPoint,
    TechnicianWorkloadData,
    TicketStatusData,
    AvgResolutionTimeData,
    SlaRiskTicket,
    DepartmentalTicketData,
} from '../../types';
import SunburstChart from './charts/SunburstChart';
import SentimentTrendChart from './charts/SentimentTrendChart';
import TicketVolumeForecastChart from './charts/TicketVolumeForecastChart';
import TechnicianWorkloadChart from './charts/TechnicianWorkloadChart';
import TicketStatusChart from './charts/TicketStatusChart';
import AvgResolutionTimeChart from './charts/AvgResolutionTimeChart';
import SlaRiskAnalysis from './charts/SlaRiskAnalysis';
import DepartmentalTicketChart from './charts/DepartmentalTicketChart';
import LoadingSpinner from '../common/LoadingSpinner';

const TrendingUpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
);

const AnalyticsView: React.FC = () => {
    const [clusterData, setClusterData] = useState<SunburstNode | null>(null);
    const [clusterError, setClusterError] = useState<string | null>(null);
    const [isClusterLoading, setIsClusterLoading] = useState(true);
    
    const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
    const [isSentimentLoading, setIsSentimentLoading] = useState(true);

    const [hotspots, setHotspots] = useState<PredictiveHotspot[]>([]);
    const [isHotspotsLoading, setIsHotspotsLoading] = useState(true);

    const [slaTickets, setSlaTickets] = useState<SlaBreachTicket[]>([]);
    const [isSlaTicketsLoading, setIsSlaTicketsLoading] = useState(true);
    
    const [slaRiskTickets, setSlaRiskTickets] = useState<SlaRiskTicket[]>([]);
    const [isSlaRiskLoading, setIsSlaRiskLoading] = useState(true);


    const [ticketForecast, setTicketForecast] = useState<TicketVolumeForecastDataPoint[]>([]);
    const [isForecastLoading, setIsForecastLoading] = useState(true);

    // State for new charts
    const [technicianWorkload, setTechnicianWorkload] = useState<TechnicianWorkloadData[]>([]);
    const [isTechnicianLoading, setIsTechnicianLoading] = useState(true);
    const [ticketStatus, setTicketStatus] = useState<TicketStatusData[]>([]);
    const [isStatusLoading, setIsStatusLoading] = useState(true);
    const [avgResolution, setAvgResolution] = useState<AvgResolutionTimeData[]>([]);
    const [isResolutionLoading, setIsResolutionLoading] = useState(true);
    const [departmentalTickets, setDepartmentalTickets] = useState<DepartmentalTicketData[]>([]);
    const [isDepartmentalLoading, setIsDepartmentalLoading] = useState(true);


    const navigate = useNavigate();

    useEffect(() => {
        setIsClusterLoading(true);
        getProblemClusterData().then(response => {
            if (response.data) {
                setClusterData(response.data);
                setClusterError(null);
            } else {
                setClusterData(null);
                if (response.error === 'insufficient_data') {
                    setClusterError('Insufficient data to generate cluster analysis. More ticket data is required.');
                } else {
                    setClusterError('Could not find any distinct problem clusters.');
                }
            }
            setIsClusterLoading(false);
        });

        setIsSentimentLoading(true);
        getUserFrustrationData().then(data => {
            setSentimentData(data);
            setIsSentimentLoading(false);
        });

        setIsHotspotsLoading(true);
        getPredictiveHotspots().then(data => {
            setHotspots(data);
            setIsHotspotsLoading(false);
        });

        setIsSlaTicketsLoading(true);
        getSlaBreachTickets().then(data => {
            setSlaTickets(data);
            setIsSlaTicketsLoading(false);
        });
        
        setIsSlaRiskLoading(true);
        getSlaRiskTickets().then(data => {
            setSlaRiskTickets(data);
            setIsSlaRiskLoading(false);
        });

        setIsForecastLoading(true);
        getTicketVolumeForecast().then(data => {
            setTicketForecast(data);
            setIsForecastLoading(false);
        });

        // Load data for new charts
        setIsTechnicianLoading(true);
        getTechnicianWorkload().then(data => {
            setTechnicianWorkload(data);
            setIsTechnicianLoading(false);
        });
        setIsStatusLoading(true);
        getTicketStatusDistribution().then(data => {
            setTicketStatus(data);
            setIsStatusLoading(false);
        });
        setIsResolutionLoading(true);
        getAvgResolutionTimeByCategory().then(data => {
            const transformedData = data.map(item => ({
                ...item,
                name: SAP_MODULE_FULL_NAMES[item.name] || item.name
            }));
            setAvgResolution(transformedData);
            setIsResolutionLoading(false);
        });
        setIsDepartmentalLoading(true);
        getTicketDistributionByDepartment().then(data => {
            setDepartmentalTickets(data);
            setIsDepartmentalLoading(false);
        });


        // Setup live listener for new SLA tickets
        socketService.on('new_sla_ticket', (newTicket: SlaBreachTicket) => {
            const ticketWithFlag = { ...newTicket, isNew: true };

            setSlaTickets(prev => {
                const newTickets = [ticketWithFlag, ...prev];
                return Array.from(new Map(newTickets.map(t => [t.ticket_no, t])).values());
            });

            setTimeout(() => {
                setSlaTickets(prev => prev.map(t => t.ticket_no === newTicket.ticket_no ? { ...t, isNew: false } : t));
            }, 2500);
        });

    }, []);

    const handleHotspotClick = (name: string) => {
        navigate(`/admin/dashboard?filter=${encodeURIComponent(name)}`);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                 <div className="xl:col-span-2 bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                    <h3 className="text-lg font-semibold mb-1">Ticket Volume Forecast</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Historical and predicted ticket volume for the upcoming week.</p>
                    <div className="w-full h-[300px] flex items-center justify-center">
                        {isForecastLoading ? <LoadingSpinner /> : (
                            <TicketVolumeForecastChart data={ticketForecast} />
                        )}
                    </div>
                 </div>
                 <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border flex flex-col">
                    <h3 className="text-lg font-semibold mb-1">Live High-Priority Feed</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Live feed of new High & Critical tickets.</p>
                    {isSlaTicketsLoading ? (
                        <div className="flex-grow flex items-center justify-center">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        <div className="flex-grow overflow-y-auto mt-2 -mr-3 pr-3">
                            {slaTickets.length > 0 ? (
                                <ul className="space-y-2">
                                    {slaTickets.map((ticket, index) => (
                                        <li key={`${ticket.ticket_no}-${index}`} className={`flex justify-between items-center text-sm p-3 rounded-md ${ticket.isNew ? 'animate-highlight' : 'bg-slate-50 dark:bg-gray-800/60'}`}>
                                            <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{ticket.ticket_no}</span>
                                            <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${ticket.priority === 'Critical' ? 'text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-500/20' : 'text-yellow-700 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-500/20'}`}>{ticket.priority}</span>
                                            <span className="text-xs text-gray-600 dark:text-gray-400">Breach in <span className="font-bold text-light-text dark:text-dark-text">{ticket.timeToBreach}</span></span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-gray-500 dark:text-gray-400">No tickets are currently at risk.</p>
                                </div>
                            )}
                        </div>
                    )}
                 </div>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                <h3 className="text-lg font-semibold mb-1">Predictive SLA Risk Analysis</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Open tickets with the highest AI-calculated risk of breaching their SLA.</p>
                <div className="w-full flex items-center justify-center">
                    {isSlaRiskLoading ? <LoadingSpinner /> : <SlaRiskAnalysis tickets={slaRiskTickets} />}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                    <h3 className="text-lg font-semibold mb-1">Technician Workload</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Top 10 technicians by assigned ticket volume.</p>
                    <div className="w-full h-[350px] flex items-center justify-center">
                        {isTechnicianLoading ? <LoadingSpinner /> : <TechnicianWorkloadChart data={technicianWorkload} />}
                    </div>
                </div>
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                    <h3 className="text-lg font-semibold mb-1">Ticket Status Distribution</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Current status across all tickets.</p>
                    <div className="w-full h-[350px] flex items-center justify-center">
                        {isStatusLoading ? <LoadingSpinner /> : <TicketStatusChart data={ticketStatus} />}
                    </div>
                </div>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                <h3 className="text-lg font-semibold mb-1">Ticket Distribution by Department</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Total ticket volume for each department.</p>
                <div className="w-full h-[500px] flex items-center justify-center">
                    {isDepartmentalLoading ? <LoadingSpinner /> : <DepartmentalTicketChart data={departmentalTickets} />}
                </div>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                <h3 className="text-lg font-semibold mb-1">Average Resolution Time by Department</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Average time in hours to resolve tickets, grouped by department.</p>
                <div className="w-full h-[400px] flex items-center justify-center">
                    {isResolutionLoading ? <LoadingSpinner /> : <AvgResolutionTimeChart data={avgResolution} />}
                </div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-1">AI-Powered Problem Cluster Analysis</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">A dynamic network graph of problem clusters. Drag nodes to explore.</p>
                    <div className="w-full h-[480px]">
                        {isClusterLoading ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            clusterData ? <SunburstChart data={clusterData} /> :
                            <p className="w-full h-full flex items-center justify-center text-center text-gray-500 dark:text-gray-400">{clusterError}</p>
                        )}
                    </div>
                </div>

                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border min-h-[400px] flex flex-col">
                    <div className="flex-shrink-0">
                        <h3 className="text-lg font-semibold mb-1">Predictive Hotspots</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">At-risk applications based on recent trends. Click to investigate.</p>
                    </div>
                     {isHotspotsLoading ? <div className="flex-grow flex items-center justify-center"><LoadingSpinner /></div> : (
                        <div className="space-y-4">
                            {hotspots.map(hotspot => (
                                <div 
                                    key={hotspot.name} 
                                    className="p-3 rounded-lg cursor-pointer transition-all group hover:bg-slate-50 dark:hover:bg-gray-800/60"
                                    onClick={() => handleHotspotClick(hotspot.name)}
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <p className="font-medium truncate">{hotspot.name}</p>
                                        <div className="flex items-center text-sm ml-4 flex-shrink-0">
                                            {hotspot.trending === 'up' && <TrendingUpIcon className="w-5 h-5 text-red-500" />}
                                            <span className="font-bold ml-1">{ (hotspot.riskScore * 100).toFixed(0) }% Risk</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                                        <div
                                            className="bg-gradient-to-r from-amber-500 to-red-500 h-2 rounded-full"
                                            style={{ width: `${hotspot.riskScore * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex-grow mt-6 pt-6 border-t border-light-border dark:border-dark-border">
                        <h3 className="text-lg font-semibold mb-1">User Frustration Index</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">AI-detected sentiment trend over time.</p>
                         <div className="w-full h-[250px] flex items-center justify-center">
                            {isSentimentLoading ? <LoadingSpinner /> : (
                                sentimentData ? <SentimentTrendChart data={sentimentData} /> :
                                <p className="text-center text-gray-500 dark:text-gray-400">Could not load sentiment data.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsView;