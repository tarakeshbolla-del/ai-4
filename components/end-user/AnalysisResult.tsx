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
        <div className="text-center space-y-4 pt-6 mt-6 p-4 bg-green-500/10 rounded-lg">
          <p className="font-semibold text-green-700 dark:text-green-300">👍 Great! We're glad we could help.</p>
          <button 
              onClick={onReset}
              className="px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:bg-light-accent-hover transition-all"
          >
            Submit Another Ticket
          </button>
        </div>
      );
    }

    if (feedbackGiven === 'negative') {
      return (
        <div className="text-center space-y-4 pt-6 mt-6 p-4 bg-amber-500/10 rounded-lg">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Thanks for the feedback. Would you like to create a support ticket?</p>
          <button 
              onClick={onCreateTicket}
              className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
          >
            Yes, Create Ticket
          </button>
        </div>
      );
    }

    return (
      <div className="text-center space-y-4 pt-6 mt-6 border-t border-light-border dark:border-dark-border">
        <p className="font-semibold">Was this suggestion helpful?</p>
        <div className="flex justify-center space-x-4">
          <button 
              onClick={() => onFeedback('positive')}
              className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors"
          >
              👍 Yes, it helped
          </button>
          <button 
              onClick={() => onFeedback('negative')}
              className="px-6 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm p-3 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-light-border dark:border-dark-border">
            <p><strong>Predicted Module:</strong> <span className="font-semibold text-light-accent dark:text-dark-accent">{result.predictedModule}</span></p>
            <p><strong>Predicted Priority:</strong> <span className="font-semibold text-light-accent dark:text-dark-accent">{result.predictedPriority}</span></p>
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
                <li key={issue.ticket_no} className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-light-border dark:border-dark-border">
                <p className="font-medium text-sm">{issue.problem_description}</p>
                <details className="mt-2 text-sm" open={isFromSimilarIssue}>
                    <summary className="cursor-pointer text-light-accent dark:text-dark-accent font-semibold hover:underline">Show Solution</summary>
                    <div className="mt-2 pt-2 border-t border-light-border dark:border-dark-border prose prose-sm dark:prose-invert max-w-none">
                        <p>{issue.solution_text}</p>
                    </div>
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
            <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-light-border dark:border-dark-border">
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                    No previous tickets are similar to your issue.
                </p>
            </div>
        )}
      </div>

      {!isFromSimilarIssue && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-600">🤖 AI-Generated Suggestion</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-gray-800/50 p-4 rounded-lg border border-light-border dark:border-dark-border">
              <ReactMarkdown>{result.aiSuggestion}</ReactMarkdown>
          </div>
        </div>
      )}
      
      {isFromSimilarIssue ? (
        <div className="text-center pt-6 mt-6 border-t border-light-border dark:border-dark-border">
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