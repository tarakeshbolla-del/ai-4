import React, { useState, useRef, useEffect, useCallback } from 'react';
import { proposeCsvMapping, uploadKnowledgeBase, initiateTraining, getTrainingStatus, finalizeTicketData, getModelAccuracyReport } from '../../services/api';
import { DEFAULT_SAP_MODULES, SAP_MODULE_FULL_NAMES, DEFAULT_TICKET_PRIORITIES } from '../../../constants';
import type { EdaReport, TrainingStatus, CsvHeaderMapping, ModelAccuracyReport } from '../../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import CategoryDistributionChart from './charts/CategoryDistributionChart';
import MissingValuesChart from './charts/MissingValuesChart';
import AccuracyGauge from './charts/AccuracyGauge';

// A mapping of internal field names to user-friendly labels and descriptions.
const REQUIRED_FIELDS: Record<string, { label: string, description: string, critical?: boolean }> = {
  problem_description: { label: "Problem Description", description: "The main text describing the user's issue (e.g., 'Subject').", critical: true },
  ticket_no: { label: "Ticket ID", description: "A unique identifier for the ticket (e.g., 'Request ID').", critical: true },
  category: { label: "Category", description: "The type of issue (e.g., 'Subcategory')." },
  request_status: { label: "Request Status", description: "Current state of the ticket (e.g., 'Request Status')." },
  technician: { label: "Technician Name", description: "Name of the assigned support person." },
  created_time: { label: "Created Time", description: "When the ticket was created.", critical: true },
  due_by_time: { label: "Due By Time", description: "The final SLA deadline for ticket resolution.", critical: true },
  responded_time: { label: "Responded Time", description: "When the technician responded." },
  request_type: { label: "Request Type", description: "The type of request (e.g., 'Fix It')." },
  solution_text: { label: "Solution Text", description: "The resolution steps for the ticket (optional)." },
};

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ["Upload", "Map Headers", "Clean Data", "Train Model"];
    return (
        <nav aria-label="Progress">
            <ol role="list" className="flex items-center">
                {steps.map((step, stepIdx) => {
                    const isCompleted = stepIdx < currentStep - 1;
                    const isCurrent = stepIdx === currentStep - 1;
                    const isLastStep = stepIdx === steps.length - 1;

                    return (
                        <li key={step} className={`relative ${!isLastStep ? 'pr-8 sm:pr-20' : ''}`}>
                            {/* Render the connector line for all but the last step */}
                            {!isLastStep && (
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className={`h-0.5 w-full ${isCompleted ? 'bg-light-accent dark:bg-dark-accent' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                </div>
                            )}

                            {/* Render the step icon/circle */}
                            {isCompleted ? (
                                <div className="relative flex h-8 w-8 items-center justify-center bg-light-accent dark:bg-dark-accent rounded-full">
                                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            ) : isCurrent ? (
                                <>
                                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-light-accent dark:border-dark-accent bg-light-card dark:bg-dark-card">
                                        <span className="h-2.5 w-2.5 rounded-full bg-light-accent dark:bg-dark-accent" aria-hidden="true" />
                                    </div>
                                    <span className="absolute -bottom-6 text-xs font-semibold text-light-accent dark:text-dark-accent whitespace-nowrap">{step}</span>
                                </>
                            ) : ( // isUpcoming
                                <>
                                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 bg-light-card dark:bg-dark-card" />
                                    <span className="absolute -bottom-6 text-xs text-gray-500 whitespace-nowrap">{step}</span>
                                </>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};


const KnowledgeBaseView: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [edaReport, setEdaReport] = useState<EdaReport | null>(null);
    const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isMapping, setIsMapping] = useState(false);
    const [mappingData, setMappingData] = useState<{ headers: string[], mapping: CsvHeaderMapping, rowCount: number } | null>(null);
    const [currentMapping, setCurrentMapping] = useState<CsvHeaderMapping | null>(null);
    const [currentStep, setCurrentStep] = useState(1);

    // State for the data cleaning steps
    const [categoryMappingOverrides, setCategoryMappingOverrides] = useState<Record<string, string> | null>(null);
    const [rawCategoryCounts, setRawCategoryCounts] = useState<Record<string, number> | null>(null);
    const [priorityMappingOverrides, setPriorityMappingOverrides] = useState<Record<string, string> | null>(null);
    const [rawPriorityCounts, setRawPriorityCounts] = useState<Record<string, number> | null>(null);
    
    const [isPreparing, setIsPreparing] = useState(false);
    const [isDataPrepared, setIsDataPrepared] = useState(false);
    const [accuracyReport, setAccuracyReport] = useState<ModelAccuracyReport | null>(null);
    const [activeCleaningTab, setActiveCleaningTab] = useState('categories');
    
    // State for priority merging
    const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
    const [priorityMergeValue, setPriorityMergeValue] = useState('');


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            // Reset everything on new file selection
            setEdaReport(null);
            setUploadError(null);
            setMappingData(null);
            setCurrentMapping(null);
            setTrainingStatus('idle');
            setCategoryMappingOverrides(null);
            setRawCategoryCounts(null);
            setPriorityMappingOverrides(null);
            setRawPriorityCounts(null);
            setIsDataPrepared(false);
            setAccuracyReport(null);
            setSelectedPriorities(new Set());
            setPriorityMergeValue('');
            setCurrentStep(1);
        }
    };

    const handleApplyCleaning = async (
        cats: Record<string, string> | null = categoryMappingOverrides,
        pris: Record<string, string> | null = priorityMappingOverrides
    ) => {
        if (!cats || !pris) return;
        setIsPreparing(true);
        try {
            await finalizeTicketData(cats, pris);
            setIsDataPrepared(true);
            setCurrentStep(4);
        } catch (error) {
            console.error("Failed to apply cleaning", error);
            setUploadError("An error occurred during data preparation.");
        } finally {
            setIsPreparing(false);
        }
    };

    const handleConfirmAndAnalyze = async (mappingToUse: CsvHeaderMapping) => {
        if (!file) {
            throw new Error("File is missing.");
        }

        setIsUploading(true);
        setEdaReport(null);
        setUploadError(null);
        
        try {
            const { report, categoryMapping, rawCategoryCounts, priorityMapping, rawPriorityCounts } = await uploadKnowledgeBase(file, mappingToUse);
            setEdaReport(report);
            setCategoryMappingOverrides(categoryMapping);
            setRawCategoryCounts(rawCategoryCounts);
            setPriorityMappingOverrides(priorityMapping);
            setRawPriorityCounts(rawPriorityCounts);
            setMappingData(null);
            setCurrentMapping(null);
            
            if ((rawCategoryCounts && Object.keys(rawCategoryCounts).length > 1) || (rawPriorityCounts && Object.keys(rawPriorityCounts).length > 1)) {
                 setActiveCleaningTab(Object.keys(rawCategoryCounts || {}).length > 1 ? 'categories' : 'priorities');
                setCurrentStep(3);
            } else {
                await handleApplyCleaning(categoryMapping, priorityMapping);
            }
        } catch (error) {
            // Re-throw to be caught by the caller, so it can decide how to handle the UI
            throw error;
        } finally {
            setIsUploading(false);
        }
    };

    const handleProposeMapping = async () => {
        if (!file) return;
        setIsMapping(true);
        setUploadError(null);
        
        try {
            const result = await proposeCsvMapping(file);
            
            const criticalFields = Object.entries(REQUIRED_FIELDS)
                .filter(([, details]) => details.critical)
                .map(([field]) => field);
                
            const allCriticalMapped = criticalFields.every(field => !!result.mapping[field]);

            if (allCriticalMapped) {
                // All critical fields are auto-mapped, so we attempt to skip the manual step.
                try {
                    await handleConfirmAndAnalyze(result.mapping);
                } catch (analysisError: any) {
                    // Auto-processing failed, so we fall back to the manual mapping screen.
                    console.error("Auto-analysis failed, falling back to manual mapping.", analysisError);
                    setUploadError(`Auto-analysis failed: ${analysisError.message}. Please verify the column mapping.`);
                    setMappingData(result);
                    setCurrentMapping(result.mapping);
                    setCurrentStep(2);
                }
            } else {
                // Not all critical fields could be mapped, show the user the mapping screen.
                setMappingData(result);
                setCurrentMapping(result.mapping);
                setCurrentStep(2);
            }
        } catch (error: any) {
            console.error("Mapping proposal failed", error);
            setUploadError(error.message || "Failed to read the file. Please check its format.");
            setCurrentStep(1);
        } finally {
            setIsMapping(false);
        }
    };
    
    const handleManualConfirmAndAnalyze = async () => {
        if (!currentMapping) return;
        try {
            await handleConfirmAndAnalyze(currentMapping);
        } catch (error: any) {
            console.error("Manual analysis failed", error);
            setUploadError(error.message || "Failed to parse the file with the provided mapping.");
            setCurrentStep(2); // Stay on the mapping step
        }
    }
    
    const handleMappingChange = (field: string, header: string) => {
        if (!currentMapping) return;
        setCurrentMapping({
            ...currentMapping,
            [field]: header === '-- Not Mapped --' ? null : header,
        });
    };

    const handleCategoryOverrideChange = (rawCategory: string, newNormalizedValue: string) => {
        if (!categoryMappingOverrides) return;
        setCategoryMappingOverrides({
            ...categoryMappingOverrides,
            [rawCategory]: newNormalizedValue,
        });
    };
    
     const handlePriorityOverrideChange = (rawPriority: string, newNormalizedValue: string) => {
        if (!priorityMappingOverrides) return;
        setPriorityMappingOverrides({
            ...priorityMappingOverrides,
            [rawPriority]: newNormalizedValue,
        });
    };
    
    const handleStartTraining = async () => {
        if (trainingStatus === 'in_progress') return;
        setAccuracyReport(null);
        setTrainingStatus('in_progress');
        try {
            await initiateTraining();
        } catch (error) {
            console.error('Failed to initiate training:', error);
            setTrainingStatus('failed');
        }
    };

    // --- MERGE FUNCTIONALITY ---
     const handleSelectPriority = (rawPriority: string, isSelected: boolean) => {
        const newSelection = new Set(selectedPriorities);
        if (isSelected) {
            newSelection.add(rawPriority);
        } else {
            newSelection.delete(rawPriority);
        }
        setSelectedPriorities(newSelection);
    };

    const handleSelectAllPriorities = (isSelected: boolean) => {
        if (isSelected && rawPriorityCounts) {
            setSelectedPriorities(new Set(Object.keys(rawPriorityCounts)));
        } else {
            setSelectedPriorities(new Set());
        }
    };

    const handleMergePriorities = () => {
        if (priorityMergeValue.trim() && selectedPriorities.size > 0 && priorityMappingOverrides) {
            const newOverrides = { ...priorityMappingOverrides };
            selectedPriorities.forEach(pri => {
                newOverrides[pri] = priorityMergeValue.trim();
            });
            setPriorityMappingOverrides(newOverrides);
            setSelectedPriorities(new Set());
            setPriorityMergeValue('');
        }
    };
    // --- END MERGE FUNCTIONALITY ---

    const pollStatus = useCallback(async () => {
        if (trainingStatus === 'in_progress') {
            const { status } = await getTrainingStatus();
            setTrainingStatus(status);
            if (status === 'completed') {
                const report = await getModelAccuracyReport();
                setAccuracyReport(report);
            }
        }
    }, [trainingStatus]);

    useEffect(() => {
        const interval = setInterval(pollStatus, 3000);
        return () => clearInterval(interval);
    }, [pollStatus]);

    const getStatusMessage = () => {
        switch (trainingStatus) {
            case 'in_progress':
                return { text: 'Training in Progress... Building search index and evaluating model. This may take a moment.', color: 'text-yellow-500', pulse: true };
            case 'completed':
                return { text: '✅ Training Complete. See the performance report below.', color: 'text-green-500', pulse: false };
            case 'failed':
                 return { text: '❌ Training Failed. Please check the logs.', color: 'text-red-500', pulse: false };
            default:
                if (isDataPrepared) {
                    return { text: 'Model training is ready to start.', color: 'text-gray-500 dark:text-gray-400', pulse: false };
                }
                return { text: 'Data must be prepared before training can begin.', color: 'text-gray-500 dark:text-gray-400', pulse: false };
        }
    };
    const statusInfo = getStatusMessage();

    const TabButton: React.FC<{isActive: boolean, onClick: () => void, children: React.ReactNode}> = ({isActive, onClick, children}) => (
        <button
            onClick={onClick}
            className={`px-3 py-2 font-medium text-sm rounded-md ${
                isActive 
                ? 'bg-light-accent/10 text-light-accent dark:bg-dark-accent/10 dark:text-dark-accent'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
            {children}
        </button>
    );

    const uniqueNormalizedCategories = categoryMappingOverrides
        ? [...new Set(Object.values(categoryMappingOverrides))].sort()
        : [];

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Knowledge Base Management</h2>
            
            <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                <Stepper currentStep={currentStep} />
            </div>

            {currentStep === 1 && (
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                    <h3 className="text-lg font-semibold mb-1">Step 1: Upload New Knowledge Base</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select a CSV or Excel file containing historical ticket data.</p>
                    <div className="flex items-center space-x-4">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-light-border dark:border-dark-border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                            Choose File
                        </button>
                        <span className="text-gray-500 dark:text-gray-400">{file ? file.name : 'No file chosen'}</span>
                    </div>
                    {uploadError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
                    <button
                        onClick={handleProposeMapping}
                        disabled={!file || isMapping || isUploading || currentStep > 1}
                        className="mt-4 px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:bg-light-accent-hover transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isMapping ? 'Analyzing Headers...' : 'Upload & Analyze'}
                    </button>
                </div>
            )}
            
            {(isMapping || (isUploading && currentStep < 3)) && <div className="flex justify-center"><LoadingSpinner /></div>}
            
            {currentStep === 2 && mappingData && currentMapping && (
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border space-y-6">
                    <h3 className="text-xl font-semibold">Step 2: Confirm Column Mapping</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        We couldn't automatically map all required columns. Please review and correct the mapping below.
                        Fields marked with <span className="font-bold text-red-500">*</span> are required.
                    </p>
                    {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
                    <div className="space-y-4 pt-4">
                        {Object.entries(REQUIRED_FIELDS).map(([field, { label, description, critical }]) => (
                            <div key={field} className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                                <div className="md:col-span-1">
                                    <label className="font-semibold block">{label} {critical && <span className="text-red-500">*</span>}</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                                </div>
                                <div className="md:col-span-2">
                                     <select
                                        value={currentMapping[field] || '-- Not Mapped --'}
                                        onChange={(e) => handleMappingChange(field, e.target.value)}
                                        className="w-full p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent transition"
                                     >
                                        <option>-- Not Mapped --</option>
                                        {mappingData.headers.map(header => <option key={header} value={header}>{header}</option>)}
                                     </select>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="flex items-center justify-end space-x-4 pt-4 border-t border-light-border dark:border-dark-border">
                        <button 
                            onClick={() => { setMappingData(null); setCurrentMapping(null); setCurrentStep(1); setUploadError(null); }}
                            className="px-4 py-2 border border-light-border dark:border-dark-border rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleManualConfirmAndAnalyze}
                            disabled={!currentMapping.problem_description || !currentMapping.ticket_no || !currentMapping.created_time || !currentMapping.due_by_time || isUploading}
                            className="px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:bg-light-accent-hover transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? 'Analyzing Data...' : `Confirm & Analyze ${mappingData.rowCount.toLocaleString()} Rows`}
                        </button>
                    </div>
                </div>
            )}
            
            {currentStep >= 3 && uploadError && (
                 <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
                    <strong className="font-bold">Process Failed: </strong>
                    <span className="block sm:inline">{uploadError}</span>
                </div>
            )}
            
            {currentStep >= 3 && edaReport && (
                 <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border space-y-8">
                    <div>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2 border-light-border dark:border-dark-border">Exploratory Data Analysis Report</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300">
                            <p><strong>File Name:</strong> <span className="font-mono">{edaReport.fileName}</span></p>
                            <p><strong>File Size:</strong> <span className="font-mono">{(Number(edaReport.fileSize) / 1024).toFixed(2)} KB</span></p>
                            <p><strong>Valid Rows:</strong> <span className="font-mono">{edaReport.rowCount.toLocaleString()}</span></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                         <div>
                            <h4 className="font-semibold mb-2 text-center">Category Distribution (Post-Normalization)</h4>
                            <CategoryDistributionChart data={edaReport.categoryDistribution} />
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-center">Missing Values per Column</h4>
                            <MissingValuesChart columns={edaReport.columns} rowCount={edaReport.rowCount} />
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 3 && (categoryMappingOverrides || priorityMappingOverrides) && (
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border space-y-6">
                    <h3 className="text-xl font-semibold">Step 3: Clean & Normalize Data</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Review the AI-powered normalization. You can override any mapping before finalizing the data.</p>
                    
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            {rawCategoryCounts && Object.keys(rawCategoryCounts).length > 1 && (
                                <TabButton isActive={activeCleaningTab === 'categories'} onClick={() => setActiveCleaningTab('categories')}>Categories</TabButton>
                            )}
                             {rawPriorityCounts && Object.keys(rawPriorityCounts).length > 1 && (
                                <TabButton isActive={activeCleaningTab === 'priorities'} onClick={() => setActiveCleaningTab('priorities')}>Priorities</TabButton>
                            )}
                        </nav>
                    </div>

                    {activeCleaningTab === 'categories' && categoryMappingOverrides && rawCategoryCounts && (
                        <div className="space-y-4">
                             <div className="overflow-x-auto border border-light-border dark:border-dark-border rounded-lg max-h-[50vh]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs uppercase sticky top-0">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">Raw Category from CSV</th>
                                            <th scope="col" className="px-4 py-3 text-right">Ticket Count</th>
                                            <th scope="col" className="px-4 py-3">Normalized Value (Editable)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700 dark:text-gray-300">
                                        {Object.entries(rawCategoryCounts).sort(([, a], [, b]) => b - a).map(([rawCategory, count]) => (
                                            <tr key={rawCategory} className="bg-light-card dark:bg-dark-card border-b dark:border-dark-border hover:bg-slate-50 dark:hover:bg-gray-800/80">
                                                <td className="px-4 py-2 font-mono text-xs">{rawCategory}</td>
                                                <td className="px-4 py-2 text-right">{count.toLocaleString()}</td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        list="normalized-categories-datalist"
                                                        value={categoryMappingOverrides[rawCategory] || ''}
                                                        onChange={(e) => handleCategoryOverrideChange(rawCategory, e.target.value)}
                                                        className="w-full p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700 focus:ring-light-accent dark:focus:ring-dark-accent"
                                                    />
                                                    <datalist id="normalized-categories-datalist">
                                                        {uniqueNormalizedCategories.map(cat => <option key={cat} value={cat} />)}
                                                    </datalist>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeCleaningTab === 'priorities' && priorityMappingOverrides && rawPriorityCounts && (
                         <div className="space-y-4">
                             <div className="overflow-x-auto border border-light-border dark:border-dark-border rounded-lg max-h-[50vh]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs uppercase sticky top-0">
                                        <tr>
                                            <th scope="col" className="px-4 py-3"><input type="checkbox" onChange={(e) => handleSelectAllPriorities(e.target.checked)} /></th>
                                            <th scope="col" className="px-4 py-3">Raw Priority from CSV</th>
                                            <th scope="col" className="px-4 py-3 text-right">Ticket Count</th>
                                            <th scope="col" className="px-4 py-3">Normalized Value (Editable)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700 dark:text-gray-300">
                                        {Object.entries(rawPriorityCounts).sort(([, a], [, b]) => b - a).map(([rawPriority, count]) => (
                                            <tr key={rawPriority} className="bg-light-card dark:bg-dark-card border-b dark:border-dark-border hover:bg-slate-50 dark:hover:bg-gray-800/80">
                                                <td className="px-4 py-2"><input type="checkbox" checked={selectedPriorities.has(rawPriority)} onChange={(e) => handleSelectPriority(rawPriority, e.target.checked)} /></td>
                                                <td className="px-4 py-2 font-mono text-xs">{rawPriority}</td>
                                                <td className="px-4 py-2 text-right">{count.toLocaleString()}</td>
                                                <td className="px-4 py-2">
                                                     <select
                                                        value={priorityMappingOverrides[rawPriority] || 'p3'}
                                                        onChange={(e) => handlePriorityOverrideChange(rawPriority, e.target.value)}
                                                        className="w-full p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700 focus:ring-light-accent dark:focus:ring-dark-accent"
                                                    >
                                                        {DEFAULT_TICKET_PRIORITIES.map(pri => <option key={pri} value={pri}>{pri}</option>)}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center space-x-2 p-2 bg-slate-50 dark:bg-gray-800/50 rounded-md">
                                <span className="text-sm font-medium">Merge {selectedPriorities.size} selected to:</span>
                                <select value={priorityMergeValue} onChange={(e) => setPriorityMergeValue(e.target.value)} className="p-2 border rounded-md bg-slate-50 dark:bg-gray-800 border-slate-300 dark:border-gray-700">
                                     <option value="">Select Target...</option>
                                     {DEFAULT_TICKET_PRIORITIES.map(pri => <option key={pri} value={pri}>{pri}</option>)}
                                </select>
                                <button onClick={handleMergePriorities} disabled={selectedPriorities.size === 0 || !priorityMergeValue} className="px-4 py-2 bg-light-accent text-white text-sm font-semibold rounded-md disabled:opacity-50">Merge</button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-light-border dark:border-dark-border">
                         <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border border-light-border dark:border-dark-border rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60">← Start Over</button>
                        <button onClick={() => handleApplyCleaning()} disabled={isPreparing} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">{isPreparing ? 'Applying...' : 'Apply Cleaning & Prepare Data'}</button>
                    </div>
                </div>
            )}
            
            {currentStep === 4 && (
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                    <h3 className="text-xl font-semibold mb-2">Step 4: On-Demand Model Training</h3>
                    <p className={`text-sm mb-4 ${statusInfo.color} ${statusInfo.pulse ? 'animate-pulse' : ''}`}>{statusInfo.text}</p>
                        <button onClick={handleStartTraining} disabled={!isDataPrepared || trainingStatus === 'in_progress'} className="px-6 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold rounded-lg hover:shadow-lg hover:from-sky-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none">
                        {trainingStatus === 'in_progress' ? 'Training...' : 'Start Model Training'}
                    </button>
                </div>
            )}

            {currentStep === 4 && accuracyReport && (
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl shadow-sm border border-light-border dark:border-dark-border">
                    <h3 className="text-xl font-semibold mb-1">Model Performance Report</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Based on an automated 80/20 train/test split of your data.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                        <div className="lg:col-span-1 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg">
                             <h4 className="text-lg font-bold text-light-accent dark:text-dark-accent">Overall Score</h4>
                             <p className="text-5xl font-bold my-2">{accuracyReport.overallScore.toFixed(1)}<span className="text-2xl text-gray-500 dark:text-gray-400">/100</span></p>
                             <p className="text-xs text-gray-500 dark:text-gray-400 text-center">A weighted average of prediction accuracies.</p>
                        </div>

                        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg">
                                <AccuracyGauge value={accuracyReport.categoryAccuracy} />
                                <h4 className="mt-2 font-semibold text-center">Category Prediction Accuracy</h4>
                            </div>
                            <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg">
                                <AccuracyGauge value={accuracyReport.priorityAccuracy} />
                                <h4 className="mt-2 font-semibold text-center">Priority Prediction Accuracy</h4>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-light-border dark:border-dark-border">
                         <h4 className="font-semibold mb-2">AI-Generated Insights:</h4>
                         <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            {accuracyReport.notes.map((note, index) => (
                                <li key={index}>{note}</li>
                            ))}
                         </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBaseView;