
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SubmissionForm from './SubmissionForm';
import AnalysisResult from './AnalysisResult';
import LoadingSpinner from '../common/LoadingSpinner';
import Header from '../common/Header';
import { analyzeIssue, submitFeedback } from '../../services/api';
import type { AnalysisResultData } from '../../types';

type ViewState = 'form' | 'loading' | 'result' | 'confirmation';

const UserView: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('form');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const navigate = useNavigate();

  const handleAnalyze = useCallback(async (formData: FormData) => {
    setViewState('loading');
    try {
      const result = await analyzeIssue(formData);
      setAnalysisResult(result);
      setViewState('result');
    } catch (error) {
      console.error("Analysis failed:", error);
      // TODO: Show an error message to the user
      setViewState('form');
    }
  }, []);

  const handleFeedback = useCallback(async (feedback: 'positive' | 'negative') => {
    await submitFeedback(feedback);
    const message = feedback === 'positive'
      ? 'Great! We are glad we could help.'
      : 'Thank you. A support ticket has been created.';
    setFeedbackMessage(message);
    setViewState('confirmation');
  }, []);

  const resetView = useCallback(() => {
    setViewState('form');
    setAnalysisResult(null);
    setFeedbackMessage('');
  }, []);
  
  useEffect(() => {
    let timer: number;
    if (viewState === 'confirmation') {
      timer = window.setTimeout(() => {
        resetView();
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [viewState, resetView]);

  const renderContent = () => {
    switch (viewState) {
      case 'loading':
        return (
          <div className="text-center p-8">
            <LoadingSpinner />
            <p className="mt-4 text-lg text-light-text dark:text-dark-text animate-pulse">
              Analyzing your issue...
            </p>
          </div>
        );
      case 'result':
        return analysisResult && (
          <AnalysisResult result={analysisResult} onFeedback={handleFeedback} />
        );
      case 'confirmation':
        return (
             <div className="text-center p-8 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-semibold text-green-700 dark:text-green-300">
                  {feedbackMessage}
                </p>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  You will be redirected shortly.
                </p>
            </div>
        );
      case 'form':
      default:
        return <SubmissionForm onAnalyze={handleAnalyze} />;
    }
  };

  return (
    <>
      <Header title="PredictiveOps" />
      <main className="container mx-auto p-4 md:p-8 max-w-4xl">
        <div className="bg-white dark:bg-gray-800/50 p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
           {renderContent()}
        </div>
        <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              (Dev) Go to Admin Dashboard
            </button>
        </div>
      </main>
    </>
  );
};

export default UserView;
