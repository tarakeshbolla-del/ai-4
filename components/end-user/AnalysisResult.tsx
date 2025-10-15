import React from 'react';
import type { AnalysisResultData } from '../../types';
import ReactMarkdown from 'react-markdown';

interface AnalysisResultProps {
  result: AnalysisResultData;
  onFeedback: (feedback: 'positive' | 'negative') => void;
  onBack: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ result, onFeedback, onBack }) => {
  const isFromSimilarIssue = result.fromSimilarIssue === true;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-light-accent dark:text-dark-accent">
          {isFromSimilarIssue ? 'Solution from Knowledge Base' : 'Analysis Complete'}
        </h2>
        {!isFromSimilarIssue && (
          <div className="flex space-x-8 text-sm">
            <p><strong>Predicted Module:</strong> {result.predictedModule}</p>
            <p><strong>Predicted Priority:</strong> {result.predictedPriority}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-600">
            {isFromSimilarIssue ? 'Matched Issue & Solution' : '✅ Previously Solved Similar Issues'}
        </h3>
        {result.similarIssues.length > 0 ? (
            <ul className="space-y-3">
            {result.similarIssues.map((issue) => (
                <li key={issue.ticket_no} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-sm">{issue.problem_description}</p>
                <details className="mt-2 text-sm" open={isFromSimilarIssue}>
                    <summary className="cursor-pointer text-light-accent dark:text-dark-accent font-semibold">Show Solution</summary>
                    <p className="mt-1 p-2 bg-white dark:bg-gray-800 rounded">{issue.solution_text}</p>
                </details>
                </li>
            ))}
            </ul>
        ) : (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    No previous tickets are similar to your issue.
                </p>
            </div>
        )}
      </div>

      {!isFromSimilarIssue && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-600">🤖 AI-Generated Suggestion</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <ReactMarkdown>{result.aiSuggestion}</ReactMarkdown>
          </div>
        </div>
      )}
      
      {isFromSimilarIssue ? (
        <div className="text-center pt-6">
            <button 
                onClick={onBack}
                className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
            >
                ← Back to Form
            </button>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default AnalysisResult;