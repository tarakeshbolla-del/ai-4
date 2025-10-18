
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SubmissionForm from './SubmissionForm';
import AnalysisResult from './AnalysisResult';
import LoadingSpinner from '../common/LoadingSpinner';
import Header from '../common/Header';
import { analyzeIssue, submitFeedback, createNewTicket } from '../../services/api';
import type { AnalysisResultData, SimilarTicket } from '../../types';

type ViewState = 'form' | 'loading' | 'result' | 'confirmation';

const UserView: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('form');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const navigate = useNavigate();
  
  // State to track the user's feedback choice on the analysis result.
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  // State for the submission form is lifted up to preserve it
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);


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
    setFeedbackGiven(feedback);
  }, []);

  const handleCreateTicket = useCallback(async () => {
    if (analysisResult) {
        const ticketDescription = analysisResult.fromSimilarIssue 
            ? analysisResult.similarIssues[0].problem_description 
            : description;
        
        await createNewTicket(
            ticketDescription, 
            analysisResult.predictedModule, 
            analysisResult.predictedPriority
        );
    }
    setFeedbackMessage('Thank you. A support ticket has been created.');
    setViewState('confirmation');
  }, [analysisResult, description]);
  
  const handleSimilarIssueClick = useCallback((issue: SimilarTicket) => {
    const result: AnalysisResultData = {
        predictedModule: issue.category || 'Unknown',
        predictedPriority: 'N/A',
        similarIssues: [issue],
        aiSuggestion: `Based on your selection, we found a direct match in our knowledge base. Please review the solution from ticket **${issue.ticket_no}**.`,
        fromSimilarIssue: true,
    };
    setAnalysisResult(result);
    setViewState('result');
  }, []);

  const resetView = useCallback(() => {
    setViewState('form');
    setAnalysisResult(null);
    setFeedbackMessage('');
    setFeedbackGiven(null);
    // Clear form state for a fresh start
    setDescription('');
    setCategory('');
    setPriority('');
    setScreenshot(null);
  }, []);

  const handleBackToForm = useCallback(() => {
    setViewState('form');
    setFeedbackGiven(null);
  }, []);
  
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
          <AnalysisResult 
            result={analysisResult} 
            onFeedback={handleFeedback} 
            onBack={handleBackToForm}
            feedbackGiven={feedbackGiven}
            onCreateTicket={handleCreateTicket}
            onReset={resetView}
          />
        );
      case 'confirmation':
        return (
             <div className="text-center p-8 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-semibold text-green-700 dark:text-green-300">
                  {feedbackMessage}
                </p>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {feedbackMessage.includes('created')
                    ? 'Our team will get back to you soon.'
                    : 'We\'re glad we could resolve your issue. Feel free to submit another ticket if you need more help.'}
                </p>
                <button
                  onClick={resetView}
                  className="mt-6 px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Create a New Ticket
                </button>
            </div>
        );
      case 'form':
      default:
        return <SubmissionForm 
            onAnalyze={handleAnalyze} 
            onSimilarIssueClick={handleSimilarIssueClick} 
            description={description}
            onDescriptionChange={setDescription}
            category={category}
            onCategoryChange={setCategory}
            priority={priority}
            onPriorityChange={setPriority}
            screenshot={screenshot}
            onScreenshotChange={setScreenshot}
        />;
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
