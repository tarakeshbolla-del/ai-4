import React, { useState, useRef, useEffect, useCallback } from 'react';
import { proposeCsvMapping, uploadKnowledgeBase, initiateTraining, getTrainingStatus, finalizeTicketData, getModelAccuracyReport } from '../../services/api';
import type { EdaReport, TrainingStatus, CsvHeaderMapping, ModelAccuracyReport } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import CategoryDistributionChart from './charts/CategoryDistributionChart';
import MissingValuesChart from './charts/MissingValuesChart';
import AccuracyGauge from './charts/AccuracyGauge';

// A mapping of internal field names to user-friendly labels and descriptions.
const REQUIRED_FIELDS: Record<string, { label: string, description: string, critical?: boolean }> = {
  problem_description: { label: "Problem Description", description: "The main text describing the user's issue.", critical: true },
  category: { label: "Category", description: "The type of issue (e.g., Software, Hardware)." },
  solution_text: { label: "Solution Text", description: "The resolution steps for the ticket." },
  ticket_no: { label: "Ticket ID", description: "A unique identifier for the ticket." },
  priority: { label: "Priority", description: "The urgency of the ticket (e.g., High, Low)." },
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

    // New state for the data cleaning step
    const [categoryMappingOverrides, setCategoryMappingOverrides] = useState<Record<string, string> | null>(null);
    const [rawCategoryCounts, setRawCategoryCounts] = useState<Record<string, number> | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isDataPrepared, setIsDataPrepared] = useState(false);
    const [accuracyReport, setAccuracyReport] = useState<ModelAccuracyReport | null>(null);


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
            setIsDataPrepared(false);
            setAccuracyReport(null);
        }
    };

    const handleProposeMapping = async () => {
        if (!file) return;
        setIsMapping(true);
        setEdaReport(null);
        setUploadError(null);
        setMappingData(null);
        setCategoryMappingOverrides(null);
        setIsDataPrepared(false);
        setAccuracyReport(null);

        try {
            const result = await proposeCsvMapping(file);
            setMappingData(result);
            setCurrentMapping(result.mapping);
        } catch (error: any) {
            console.error("Mapping proposal failed", error);
            setUploadError(error.message || "Failed to read CSV file. Please check its format.");
        } finally {
            setIsMapping(false);
        }
    };

    const handleConfirmAndAnalyze = async () => {
        if (!file || !currentMapping) return;

        setIsUploading(true);
        setEdaReport(null);
        setUploadError(null);
        try {
            const { report, categoryMapping, rawCategoryCounts } = await uploadKnowledgeBase(file, currentMapping);
            setEdaReport(report);
            setCategoryMappingOverrides(categoryMapping);
            setRawCategoryCounts(rawCategoryCounts);
            setMappingData(null); // Hide mapping UI after success
            setCurrentMapping(null);
        } catch (error: any) {
            console.error("Upload failed", error);
            setUploadError(error.message || "Failed to parse CSV with the provided mapping.");
        } finally {
            setIsUploading(false);
        }
    };
    
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

    const handleApplyCleaning = async () => {
        if (!categoryMappingOverrides) return;
        setIsPreparing(true);
        try {
            await finalizeTicketData(categoryMappingOverrides);
            setIsDataPrepared(true);
            setCategoryMappingOverrides(null); // Hide the cleaning UI
            setRawCategoryCounts(null);
        } catch (error) {
            console.error("Failed to apply cleaning", error);
            setUploadError("An error occurred during data preparation.");
        } finally {
            setIsPreparing(false);
        }
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

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Knowledge Base Management</h2>
            
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Step 1: Upload New Knowledge Base (CSV)</h3>
                <div className="flex items-center space-x-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border rounded-md">
                        Choose File
                    </button>
                    <span className="text-gray-500 dark:text-gray-400">{file ? file.name : 'No file chosen'}</span>
                </div>
                 {uploadError && !mappingData && (
                    <p className="mt-4 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
                )}
                <button
                    onClick={handleProposeMapping}
                    disabled={!file || isMapping || isUploading}
                    className="mt-4 px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isMapping ? 'Analyzing Headers...' : 'Upload & Map Headers'}
                </button>
            </div>

            {isMapping && <div className="flex justify-center"><LoadingSpinner /></div>}
            
            {mappingData && currentMapping && (
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
                    <h3 className="text-xl font-semibold">Step 2: Confirm Column Mapping</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        We've analyzed your CSV headers and proposed a mapping to our standard fields. Please review and correct if necessary.
                        The <span className="font-bold text-red-500">Problem Description</span> field is required.
                    </p>
                    <div className="space-y-4">
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
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                     >
                                        <option>-- Not Mapped --</option>
                                        {mappingData.headers.map(header => <option key={header} value={header}>{header}</option>)}
                                     </select>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button 
                            onClick={() => { setMappingData(null); setCurrentMapping(null); }}
                            className="px-4 py-2 border rounded-md text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmAndAnalyze}
                            disabled={!currentMapping.problem_description || isUploading}
                            className="px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? 'Analyzing Data...' : `Confirm & Analyze ${mappingData.rowCount.toLocaleString()} Rows`}
                        </button>
                    </div>
                </div>
            )}


            {isUploading && !edaReport && <div className="flex justify-center"><LoadingSpinner /></div>}
            {uploadError && edaReport === null && !mappingData && (
                 <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative" role="alert">
                    <strong className="font-bold">Upload Failed: </strong>
                    <span className="block sm:inline">{uploadError}</span>
                </div>
            )}

            {edaReport && (
                 <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-8">
                    <div>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Exploratory Data Analysis Report</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300">
                            <p><strong>File Name:</strong> <span className="font-mono">{edaReport.fileName}</span></p>
                            {/* FIX: Explicitly cast `edaReport.fileSize` to a Number to resolve a TypeScript error where it was not being recognized as a numeric type for an arithmetic operation. */}
                            <p><strong>File Size:</strong> <span className="font-mono">{(Number(edaReport.fileSize) / 1024).toFixed(2)} KB</span></p>
                            <p><strong>Valid Rows:</strong> <span className="font-mono">{edaReport.rowCount.toLocaleString()}</span></p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <h3 className="text-lg font-semibold mb-4">Data Quality &amp; Outlier Report</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200">Description Text Analysis</h4>
                                <ul className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                    <li className="flex justify-between"><span>Avg. Length:</span> <span className="font-mono">{edaReport.outlierReport.descriptionLength.avg} chars</span></li>
                                    <li className="flex justify-between"><span>Min / Max Length:</span> <span className="font-mono">{edaReport.outlierReport.descriptionLength.min} / {edaReport.outlierReport.descriptionLength.max}</span></li>
                                    <li className="flex justify-between items-center text-yellow-700 dark:text-yellow-400">
                                        <span className="flex items-center">
                                            <svg className="w-4 h-4 inline mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            Short Descriptions (&lt;{edaReport.outlierReport.descriptionLength.shortOutlierThreshold} chars)
                                        </span> 
                                        <span className="font-mono font-bold">{edaReport.outlierReport.descriptionLength.shortOutliers.toLocaleString()}</span>
                                    </li>
                                    <li className="flex justify-between items-center text-blue-700 dark:text-blue-400">
                                        <span className="flex items-center">
                                            <svg className="w-4 h-4 inline mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Long Descriptions (&gt;{edaReport.outlierReport.descriptionLength.longOutlierThreshold} chars)
                                        </span> 
                                        <span className="font-mono font-bold">{edaReport.outlierReport.descriptionLength.longOutliers.toLocaleString()}</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200">Rare Category Analysis</h4>
                                {edaReport.outlierReport.rareCategories.length > 0 ? (
                                    <>
                                        <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                                            Found <span className="font-bold">{edaReport.outlierReport.rareCategories.length}</span> categories with very few tickets. Consider merging them into broader categories in the next step.
                                        </p>
                                        <div className="mt-3 text-xs font-mono text-gray-500 dark:text-gray-500 max-h-24 overflow-y-auto pr-2">
                                            {edaReport.outlierReport.rareCategories.map(cat => (
                                            <div key={cat.name} className="flex justify-between">
                                                <span className="truncate" title={cat.name}>{cat.name}</span>
                                                <span>{cat.count} tickets</span>
                                            </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">No rare categories detected. The category distribution looks good.</p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-center mt-4 text-gray-500 dark:text-gray-500">
                           Outliers can indicate data quality issues but are not necessarily problematic. No immediate action is required for text length outliers. Rare categories should be addressed in Step 3.
                        </p>
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

            {categoryMappingOverrides && rawCategoryCounts && (
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
                    <h3 className="text-xl font-semibold">Step 3: Clean & Normalize Categories</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Review the AI-powered normalization of ticket categories. You can rename or merge categories by editing the "Normalized Value" field. This ensures data consistency before training.
                    </p>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-96">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Raw Category from CSV</th>
                                    <th scope="col" className="px-4 py-3 font-semibold tracking-wider text-right">Ticket Count</th>
                                    <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Normalized Value (Editable)</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700 dark:text-gray-300">
                                {Object.entries(rawCategoryCounts).sort(([, a], [, b]) => b - a).map(([rawCategory, count]) => (
                                    <tr key={rawCategory} className="bg-white dark:bg-gray-800/60 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/80">
                                        <td className="px-4 py-2 font-mono text-xs">{rawCategory}</td>
                                        <td className="px-4 py-2 text-right">{count.toLocaleString()}</td>
                                        <td className="px-4 py-2">
                                            <input 
                                                type="text"
                                                value={categoryMappingOverrides[rawCategory] || ''}
                                                onChange={(e) => handleCategoryOverrideChange(rawCategory, e.target.value)}
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleApplyCleaning}
                            disabled={isPreparing}
                            className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {isPreparing ? 'Applying...' : 'Apply Cleaning & Prepare Data'}
                        </button>
                    </div>
                </div>
            )}
            
            {edaReport && (
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-2">Step 4: On-Demand Model Training</h3>
                    <p className={`text-sm mb-4 ${statusInfo.color} ${statusInfo.pulse ? 'animate-pulse' : ''}`}>{statusInfo.text}</p>
                        <button
                        onClick={handleStartTraining}
                        disabled={!isDataPrepared || trainingStatus === 'in_progress'}
                        className="px-6 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {trainingStatus === 'in_progress' ? 'Training...' : 'Start Model Training'}
                    </button>
                </div>
            )}

            {accuracyReport && (
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold mb-1">Model Performance Report</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Based on an automated 80/20 train/test split of your data.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                        <div className="lg:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                             <h4 className="text-lg font-bold text-light-accent dark:text-dark-accent">Overall Score</h4>
                             <p className="text-5xl font-bold my-2">{accuracyReport.overallScore.toFixed(1)}<span className="text-2xl text-gray-500 dark:text-gray-400">/100</span></p>
                             <p className="text-xs text-gray-500 dark:text-gray-400 text-center">A weighted average of prediction accuracies.</p>
                        </div>

                        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex flex-col items-center">
                                <AccuracyGauge value={accuracyReport.categoryAccuracy} />
                                <h4 className="mt-2 font-semibold text-center">Category Prediction Accuracy</h4>
                            </div>
                            <div className="flex flex-col items-center">
                                <AccuracyGauge value={accuracyReport.priorityAccuracy} />
                                <h4 className="mt-2 font-semibold text-center">Priority Prediction Accuracy</h4>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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