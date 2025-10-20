import React from 'react';
import LoadingSpinner from '../../common/LoadingSpinner';

interface WordCloudProps {
  data: { word: string, value: number }[];
  isLoading: boolean;
}

const WordCloud: React.FC<WordCloudProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>;
  }
  
  if (!data || data.length === 0) {
    return <div className="flex justify-center items-center h-full text-gray-500">Select a category to see keywords.</div>;
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 1);

  const getFontSize = (value: number) => {
    const size = 12 + ((value - minVal) / (maxVal - minVal)) * 24; // from 12px to 36px
    return `${Math.max(12, size)}px`;
  };
  
  const colors = [
      'text-sky-500', 'text-cyan-500', 'text-blue-500', 'text-indigo-500', 'text-teal-500',
      'dark:text-sky-400', 'dark:text-cyan-400', 'dark:text-blue-400', 'dark:text-indigo-400', 'dark:text-teal-400'
  ];

  return (
    <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 h-full">
      {data.sort((a,b) => b.value - a.value).map((item, index) => (
        <span
          key={item.word}
          className={`${colors[index % colors.length]} font-semibold`}
          style={{ fontSize: getFontSize(item.value) }}
        >
          {item.word}
        </span>
      ))}
    </div>
  );
};

export default WordCloud;