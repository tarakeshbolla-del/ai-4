import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
  return (
    <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h4>
      <p className="text-3xl font-bold mt-2 text-light-text dark:text-dark-text">{value}</p>
    </div>
  );
};

export default KpiCard;