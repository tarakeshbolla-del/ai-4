import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProblemClusterData, getUserFrustrationData, getPredictiveHotspots, getSlaBreachTickets, getTicketVolumeForecast } from '../../services/api';
import type { SunburstNode, SentimentData, PredictiveHotspot, SlaBreachTicket, TicketVolumeForecastDataPoint } from '../../types';
import SunburstChart from './charts/SunburstChart';
import SentimentTrendChart from './charts/SentimentTrendChart';
import TicketVolumeForecastChart from './charts/TicketVolumeForecastChart';
import LoadingSpinner from '../common/LoadingSpinner';

const TrendingUpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
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

    const [ticketForecast, setTicketForecast] = useState<TicketVolumeForecastDataPoint[]>([]);
    const [isForecastLoading, setIsForecastLoading] = useState(true);

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
                    setClusterError('Insufficient data to generate cluster analysis. At least 200 tickets are required.');
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

        setIsForecastLoading(true);
        getTicketVolumeForecast().then(data => {
            setTicketForecast(data);
            setIsForecastLoading(false);
        });
    }, []);

    const handleHotspotClick = (name: string) => {
        navigate(`/admin/dashboard?filter=${encodeURIComponent(name)}`);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Analytics & Reporting</h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[400px]">
                    <h3 className="text-lg font-semibold">AI-Powered Problem Cluster Analysis</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">A dynamic network graph of problem clusters. Larger circles have more tickets. Drag nodes to explore.</p>
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

                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-4">User Frustration Index (Sentiment Trend)</h3>
                     <div className="w-full h-[450px] flex items-center justify-center">
                        {isSentimentLoading ? <LoadingSpinner /> : (
                            sentimentData ? <SentimentTrendChart data={sentimentData} /> :
                            <p className="text-center text-gray-500 dark:text-gray-400">Could not load sentiment data.</p>
                        )}
                    </div>
                </div>
            </div>
             <div className="grid grid-cols-1 gap-6">
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-72">
                    <h3 className="text-lg font-semibold mb-2">Predictive Hotspots</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">At-risk applications based on recent trends. Click to investigate.</p>
                    {isHotspotsLoading ? <div className="h-24 flex items-center justify-center"><LoadingSpinner /></div> : (
                        <ul className="space-y-3">
                            {hotspots.map(hotspot => (
                                <li 
                                    key={hotspot.name} 
                                    className="flex items-center justify-between p-2 -m-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                    onClick={() => handleHotspotClick(hotspot.name)}
                                >
                                    <div className="flex-1">
                                        <p className="font-medium truncate">{hotspot.name}</p>
                                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                                            <div
                                                className="bg-orange-500 h-1.5 rounded-full"
                                                style={{ width: `${hotspot.riskScore * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-sm ml-4 flex-shrink-0">
                                        {hotspot.trending === 'up' && <TrendingUpIcon className="w-4 h-4 text-red-500" />}
                                        <span className="font-bold ml-1">{ (hotspot.riskScore * 100).toFixed(0) }%</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                 </div>
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-2">Ticket Volume Forecast</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Historical and predicted ticket volume for the upcoming week.</p>
                    <div className="w-full h-[300px] flex items-center justify-center">
                        {isForecastLoading ? <LoadingSpinner /> : (
                            <TicketVolumeForecastChart data={ticketForecast} />
                        )}
                    </div>
                 </div>
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-72 relative overflow-hidden">
                    <h3 className="text-lg font-semibold mb-2">SLA Breach Risk Ticker</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tickets nearing SLA breach.</p>
                    {isSlaTicketsLoading ? <div className="h-24 flex items-center justify-center"><LoadingSpinner /></div> : (
                        <div className="absolute w-full top-24 pr-6">
                            <ul className="motion-safe:animate-ticker space-y-2">
                                {slaTickets.concat(slaTickets).map((ticket, index) => (
                                    <li key={`${ticket.ticket_no}-${index}`} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                        <span className="font-mono text-xs">{ticket.ticket_no}</span>
                                        <span className={`font-semibold text-xs ${ticket.priority === 'Critical' ? 'text-red-500' : 'text-yellow-500'}`}>{ticket.priority}</span>
                                        <span className="text-xs">Breach in <span className="font-bold">{ticket.timeToBreach}</span></span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};

export default AnalyticsView;