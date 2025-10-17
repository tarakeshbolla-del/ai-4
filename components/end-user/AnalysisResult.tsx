
import React, { useState } from 'react';
import type { AnalysisResultData } from '../../types';
import ReactMarkdown from 'react-markdown';

interface AnalysisResultProps {
  result: AnalysisResultData;
  onFeedback: (feedback: 'positive' | 'negative') => void;
  onBack: () => void;
  feedbackGiven: 'positive' | 'negative' | null;
  onCreateTicket: () => void;
  onReset: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ result, onFeedback, onBack, feedbackGiven, onCreateTicket, onReset }) => {
  const isFromSimilarIssue = result.fromSimilarIssue === true;
  const [showAllSimilar, setShowAllSimilar] = useState(false);

  const similarIssuesToShow = showAllSimilar ? result.similarIssues : result.similarIssues.slice(0, 3);

  const renderFeedbackSection = () => {
    if (feedbackGiven === 'positive') {
      return (
        <div className="text-center space-y-4 pt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="font-semibold text-green-700 dark:text-green-300">👍 Great! We're glad we could help.</p>
          <button 
              onClick={onReset}
              className="px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Create another ticket
          </button>
        </div>
      );
    }

    if (feedbackGiven === 'negative') {
      return (
        <div className="text-center space-y-4 pt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Thanks for the feedback. Would you like to create a support ticket?</p>
          <button 
              onClick={onCreateTicket}
              className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
          >
            Yes, create a ticket
          </button>
        </div>
      );
    }

    return (
      <div className="text-center space-y-4 pt-6">
        <p className="font-semibold">Was this suggestion helpful?</p>
        <div className="flex justify-center space-x-4">
          <button 
              onClick={() => onFeedback('positive')}
              className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors"
          >
              👍 Yes
          </button>
          <button 
              onClick={() => onFeedback('negative')}
              className="px-6 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
          >
              👎 No
          </button>
        </div>
      </div>
    );
  };

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
          <>
            <ul className="space-y-3">
            {similarIssuesToShow.map((issue) => (
                <li key={issue.ticket_no} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-sm">{issue.problem_description}</p>
                <details className="mt-2 text-sm" open={isFromSimilarIssue}>
                    <summary className="cursor-pointer text-light-accent dark:text-dark-accent font-semibold">Show Solution</summary>
                    <p className="mt-1 p-2 bg-white dark:bg-gray-800 rounded">{issue.solution_text}</p>
                </details>
                </li>
            ))}
            </ul>
            {result.similarIssues.length > 3 && !showAllSimilar && (
                <div className="text-center">
                    <button
                        onClick={() => setShowAllSimilar(true)}
                        className="mt-2 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Show {result.similarIssues.length - 3} more
                    </button>
                </div>
            )}
          </>
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
      ) : renderFeedbackSection()}
    </div>
  );
};

export default AnalysisResult;
