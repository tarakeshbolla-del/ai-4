import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, SAP_MODULE_FULL_NAMES } from '../../constants';
import { getSimilarIssues, getDynamicCategories, getDynamicPriorities } from '../../services/api';
import type { SimilarTicket } from '../../types';

interface SubmissionFormProps {
  onAnalyze: (formData: FormData) => void;
  onSimilarIssueClick: (issue: SimilarTicket) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  screenshot: File | null;
  onScreenshotChange: (file: File | null) => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ 
    onAnalyze, 
    onSimilarIssueClick,
    description,
    onDescriptionChange,
    category,
    onCategoryChange,
    priority,
    onPriorityChange,
    screenshot,
    onScreenshotChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [similarIssues, setSimilarIssues] = useState<SimilarTicket[]>([]);
  const [isFetchingSimilar, setIsFetchingSimilar] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load dynamic categories and priorities for the dropdowns
    getDynamicCategories().then(cats => setCategories(cats.sort()));
    getDynamicPriorities().then(pris => setPriorities(pris));
  }, []);

  useEffect(() => {
    if (description.trim().length < 15) {
      setSimilarIssues([]);
      return;
    }

    const handler = setTimeout(() => {
      setIsFetchingSimilar(true);
      getSimilarIssues(description).then(issues => {
        setSimilarIssues(issues);
        setIsFetchingSimilar(false);
      });
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [description]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('description', description);
    if (screenshot) {
      formData.append('screenshot', screenshot);
    }
    if (category) {
      formData.append('category', category);
    }
    if (priority) {
      formData.append('priority', priority);
    }
    onAnalyze(formData);
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      onScreenshotChange(files[0]);
    } else {
      onScreenshotChange(null);
    }
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileChange(e.dataTransfer.files);
  };

  const searchTriggered = description.trim().length >= 15;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div 
        className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${isDragging ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10 scale-105' : 'border-gray-300 dark:border-gray-600 hover:border-light-accent dark:hover:border-dark-accent'}`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,.png,.jpg,.jpeg,.gif"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-2 text-gray-500 dark:text-gray-400">
            <UploadIcon className="w-10 h-10" />
            {screenshot ? (
                <p className="text-green-600 dark:text-green-400 font-semibold">✅ {screenshot.name} selected</p>
            ) : (
                <p><span className="font-semibold text-light-accent dark:text-dark-accent">Click to upload</span> or drag and drop a screenshot</p>
            )}
             <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
        </div>
      </div>

      <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center">
              <span className="bg-light-card dark:bg-dark-card px-2 text-sm text-gray-500 dark:text-gray-400">OR</span>
          </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          Describe your issue
        </label>
        <textarea
          id="description"
          rows={6}
          className="w-full p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent transition"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Please provide as much detail as possible..."
        />
      </div>

      {isFetchingSimilar && <p className="text-sm text-center text-gray-500 dark:text-gray-400">Searching for similar issues...</p>}
      
      {!isFetchingSimilar && searchTriggered && similarIssues.length === 0 && (
        <div className="p-3 bg-slate-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">No previous tickets seem to match your description.</p>
        </div>
      )}

      {similarIssues.length > 0 && (
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg">
            <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Similar Solved Issues:</h4>
            <ul className="text-sm space-y-2">
                {similarIssues.map(issue => (
                    <li key={issue.ticket_no}>
                        <button
                          type="button"
                          onClick={() => onSimilarIssueClick(issue)}
                          className="w-full text-left p-3 rounded-md transition-all text-light-text dark:text-dark-text bg-white dark:bg-gray-900/50 hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 border border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent"
                        >
                          <span className="font-medium">{issue.problem_description.substring(0, 80)}...</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Module/Category (Optional)
          </label>
          <select
            id="category"
            className="w-full p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent transition"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">AI will predict</option>
            {categories.map(cat => <option key={cat} value={cat}>{SAP_MODULE_FULL_NAMES[cat] || cat}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Priority (Optional)
          </label>
          <select
            id="priority"
            className="w-full p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent transition"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
          >
            <option value="">AI will predict</option>
            {priorities.map(pri => <option key={pri} value={pri}>{pri}</option>)}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!description && !screenshot}
        className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold rounded-lg hover:shadow-lg hover:from-sky-600 hover:to-cyan-600 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none disabled:transform-none"
      >
        Analyze Issue
      </button>
    </form>
  );
};

export default SubmissionForm;