
import React from 'react';
import type { SlaRiskTicket } from '../../../types';

interface SlaRiskAnalysisProps {
  tickets: SlaRiskTicket[];
}

const SlaRiskAnalysis: React.FC<SlaRiskAnalysisProps> = ({ tickets }) => {

    const getTimeColor = (time: string) => {
        if (time.startsWith('-')) return 'bg-red-500/20 text-red-600 dark:bg-red-500/20 dark:text-red-300';
        if (time.includes('m')) return 'bg-amber-500/20 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300';
        if (time.includes('h')) {
             const hours = parseInt(time, 10);
             if (hours < 8) return 'bg-amber-500/20 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300';
        }
        return 'bg-green-500/20 text-green-600 dark:bg-green-500/20 dark:text-green-300';
    };

    const getRiskBarColor = (score: number) => {
        if (score > 0.8) return 'from-red-500 to-orange-500';
        if (score > 0.6) return 'from-orange-500 to-amber-500';
        return 'from-amber-500 to-yellow-500';
    };

    if (!tickets || tickets.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 w-full">
                <p className="text-gray-500 dark:text-gray-400">No open tickets with due dates found in the knowledge base.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <ul className="space-y-3">
                {tickets.map(ticket => (
                    <li key={ticket.ticket_no} className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-light-border dark:border-dark-border">
                        <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-12 sm:col-span-5 flex items-center">
                                <span className="font-mono text-xs text-gray-600 dark:text-gray-400 mr-4">{ticket.ticket_no}</span>
                                <p className="text-sm font-medium text-light-text dark:text-dark-text truncate" title={ticket.problem_snippet}>{ticket.problem_snippet}</p>
                            </div>
                            <div className="col-span-6 sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                                {ticket.technician}
                            </div>
                            <div className="col-span-6 sm:col-span-2 text-center">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getTimeColor(ticket.timeRemaining)}`}>
                                    {ticket.timeRemaining.startsWith('-') ? `Overdue` : `Due in ${ticket.timeRemaining}`}
                                </span>
                            </div>
                             <div className="col-span-12 sm:col-span-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                        <div
                                            className={`bg-gradient-to-r ${getRiskBarColor(ticket.riskScore)} h-2.5 rounded-full`}
                                            style={{ width: `${ticket.riskScore * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-bold w-12 text-right">{(ticket.riskScore * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SlaRiskAnalysis;
