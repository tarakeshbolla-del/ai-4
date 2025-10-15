
import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
  return (
    <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h4>
      <p className="text-3xl font-bold mt-2 text-light-text dark:text-dark-text">{value}</p>
    </div>
  );
};

export default KpiCard;
