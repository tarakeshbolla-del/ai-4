
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../constants';
import { getSimilarIssues } from '../../services/api';
import type { SimilarTicket } from '../../types';

interface SubmissionFormProps {
  onAnalyze: (formData: FormData) => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ onAnalyze }) => {
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [similarIssues, setSimilarIssues] = useState<SimilarTicket[]>([]);
  const [isFetchingSimilar, setIsFetchingSimilar] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (description.split(' ').length < 10) {
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
      setScreenshot(files[0]);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div 
        className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragging ? 'border-light-accent dark:border-dark-accent bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-light-accent dark:hover:border-dark-accent'}`}
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
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        {screenshot ? (
          <p className="text-green-600 dark:text-green-400">✅ {screenshot.name} selected</p>
        ) : (
          <p>Drag & drop a screenshot here, or click to select</p>
        )}
      </div>

      <div className="text-center text-gray-500 dark:text-gray-400 font-semibold">OR</div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Describe your issue
        </label>
        <textarea
          id="description"
          rows={6}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please provide as much detail as possible..."
        />
      </div>

      {isFetchingSimilar && <p className="text-sm text-gray-500">Searching for similar issues...</p>}
      {similarIssues.length > 0 && (
        <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-semibold text-sm">Similar Solved Issues:</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
                {similarIssues.map(issue => (
                    <li key={issue.ticket_no}>
                        <span className="font-medium">{issue.problem_description.substring(0, 80)}...</span>
                    </li>
                ))}
            </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1">
            Module/Category (Optional)
          </label>
          <select
            id="category"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">AI will predict</option>
            {TICKET_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium mb-1">
            Priority (Optional)
          </label>
          <select
            id="priority"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">AI will predict</option>
            {TICKET_PRIORITIES.map(pri => <option key={pri} value={pri}>{pri}</option>)}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!description && !screenshot}
        className="w-full py-3 px-4 bg-light-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Analyze Issue
      </button>
    </form>
  );
};

export default SubmissionForm;
