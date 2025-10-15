
import React from 'react';
import type { AnalysisResultData } from '../../types';
import ReactMarkdown from 'react-markdown';

interface AnalysisResultProps {
  result: AnalysisResultData;
  onFeedback: (feedback: 'positive' | 'negative') => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ result, onFeedback }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-light-accent dark:text-dark-accent">Analysis Complete</h2>
        <div className="flex space-x-8 text-sm">
          <p><strong>Predicted Module:</strong> {result.predictedModule}</p>
          <p><strong>Predicted Priority:</strong> {result.predictedPriority}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-600">✅ Previously Solved Similar Issues</h3>
        <ul className="space-y-3">
          {result.similarIssues.map((issue) => (
            <li key={issue.ticket_no} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-medium text-sm">{issue.problem_description}</p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-light-accent dark:text-dark-accent font-semibold">Show Solution</summary>
                <p className="mt-1 p-2 bg-white dark:bg-gray-800 rounded">{issue.solution_text}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-600">🤖 AI-Generated Suggestion</h3>
        <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <ReactMarkdown>{result.aiSuggestion}</ReactMarkdown>
        </div>
      </div>
      
      <div className="text-center space-y-4 pt-6">
        <p className="font-semibold">Did this solve your problem?</p>
        <div className="flex justify-center space-x-4">
            <button 
                onClick={() => onFeedback('positive')}
                className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors"
            >
                👍 Yes, this solved my problem!
            </button>
            <button 
                onClick={() => onFeedback('negative')}
                className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
            >
                👎 This didn't help, create a support ticket
            </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
