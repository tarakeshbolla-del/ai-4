import React, { useState, useRef, useEffect, useCallback } from 'react';
import { proposeCsvMapping, uploadKnowledgeBase, initiateTraining, getTrainingStatus } from '../../services/api';
import type { EdaReport, TrainingStatus, CsvHeaderMapping } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import CategoryDistributionChart from './charts/CategoryDistributionChart';
import MissingValuesChart from './charts/MissingValuesChart';

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


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            // Reset everything on new file selection
            setEdaReport(null);
            setUploadError(null);
            setMappingData(null);
            setCurrentMapping(null);
            setTrainingStatus('idle');
        }
    };

    const handleProposeMapping = async () => {
        if (!file) return;
        setIsMapping(true);
        setEdaReport(null);
        setUploadError(null);
        setMappingData(null);

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
            const report = await uploadKnowledgeBase(file, currentMapping);
            setEdaReport(report);
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
    
    // Fix: Define the handleStartTraining function to be called on button click.
    const handleStartTraining = async () => {
        if (trainingStatus === 'in_progress') return;

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
        }
    }, [trainingStatus]);

    useEffect(() => {
        const interval = setInterval(pollStatus, 3000);
        return () => clearInterval(interval);
    }, [pollStatus]);

    const getStatusMessage = () => {
        switch (trainingStatus) {
            case 'in_progress':
                return { text: 'Training in Progress... Dashboards will update upon completion.', color: 'text-yellow-500', pulse: true };
            case 'completed':
                return { text: '✅ Training Complete. Dashboards are now reflecting the new data.', color: 'text-green-500', pulse: false };
            case 'failed':
                 return { text: '❌ Training Failed. Please check the logs.', color: 'text-red-500', pulse: false };
            default:
                return { text: 'Model training is ready to start.', color: 'text-gray-500 dark:text-gray-400', pulse: false };
        }
    };
    const statusInfo = getStatusMessage();

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">Knowledge Base Management</h2>
            
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Upload New Knowledge Base (CSV)</h3>
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
                    <h3 className="text-xl font-semibold">Confirm Column Mapping</h3>
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
                            <p><strong>File Size:</strong> <span className="font-mono">{(edaReport.fileSize / 1024).toFixed(2)} KB</span></p>
                            <p><strong>Valid Rows:</strong> <span className="font-mono">{edaReport.rowCount.toLocaleString()}</span></p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                         <div>
                            <h4 className="font-semibold mb-2 text-center">Category Distribution</h4>
                            <CategoryDistributionChart data={edaReport.categoryDistribution} />
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-center">Missing Values per Column</h4>
                            <MissingValuesChart columns={edaReport.columns} rowCount={edaReport.rowCount} />
                        </div>
                    </div>

                     <div>
                        <h4 className="font-semibold mb-2">Mapped Dataset Columns</h4>
                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Column Name</th>
                                        <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Data Type</th>
                                        <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Missing Values</th>
                                        <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Missing (%)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700 dark:text-gray-300">
                                    {edaReport.columns.map((col, index) => (
                                        <tr key={col.name} className={`bg-white dark:bg-gray-800/60 ${index === edaReport.columns.length - 1 ? '' : 'border-b dark:border-gray-700'} hover:bg-gray-50 dark:hover:bg-gray-700/80`}>
                                            <td className="px-4 py-3 font-mono">{col.name}</td>
                                            <td className="px-4 py-3">{col.type}</td>
                                            <td className="px-4 py-3">{col.missing.toLocaleString()}</td>
                                            <td className="px-4 py-3">{((col.missing / edaReport.rowCount) * 100).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-2">On-Demand Model Training</h3>
                        <p className={`text-sm mb-4 ${statusInfo.color} ${statusInfo.pulse ? 'animate-pulse' : ''}`}>{statusInfo.text}</p>
                         <button
                            onClick={handleStartTraining}
                            disabled={trainingStatus === 'in_progress'}
                            className="px-6 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {trainingStatus === 'in_progress' ? 'Training...' : 'Start Model Training'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBaseView;