
import React, { useState, useEffect } from 'react';
import { getProblemClusterData, getUserFrustrationData } from '../../services/api';
import type { SunburstNode, SentimentData } from '../../types';
import SunburstChart from './charts/SunburstChart';
import SentimentTrendChart from './charts/SentimentTrendChart';
import LoadingSpinner from '../common/LoadingSpinner';

const AnalyticsView: React.FC = () => {
    const [clusterData, setClusterData] = useState<SunburstNode | null>(null);
    const [clusterError, setClusterError] = useState<string | null>(null);
    const [isClusterLoading, setIsClusterLoading] = useState(true);
    
    const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
    const [isSentimentLoading, setIsSentimentLoading] = useState(true);

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
    }, []);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Analytics & Reporting</h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[400px]">
                    <h3 className="text-lg font-semibold mb-4">AI-Powered Problem Cluster Analysis</h3>
                    <div className="w-full h-[450px] flex items-center justify-center">
                        {isClusterLoading ? <LoadingSpinner /> : (
                            clusterData ? <SunburstChart data={clusterData} width={450} height={450} /> :
                            <p className="text-center text-gray-500 dark:text-gray-400">{clusterError}</p>
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
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-2">Predictive Hotspots</h3>
                    <p className="text-gray-500 dark:text-gray-400">At-risk applications based on recent trends.</p>
                    <p className="text-2xl font-bold mt-4 text-light-accent dark:text-dark-accent">CRM System</p>
                 </div>
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-2">Ticket Volume Forecast</h3>
                    <p className="text-gray-500 dark:text-gray-400">Predicted tickets for next 7 days.</p>
                     <p className="text-2xl font-bold mt-4">~250 tickets</p>
                 </div>
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-2">SLA Breach Risk Ticker</h3>
                    <p className="text-gray-500 dark:text-gray-400">Tickets nearing SLA breach.</p>
                     <p className="text-2xl font-bold mt-4 text-red-500">12 tickets</p>
                 </div>
            </div>
        </div>
    );
};

export default AnalyticsView;
