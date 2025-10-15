
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadKnowledgeBase, initiateTraining, getTrainingStatus } from '../../services/api';
import type { EdaReport, TrainingStatus } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';

const KnowledgeBaseView: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [edaReport, setEdaReport] = useState<EdaReport | null>(null);
    const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setEdaReport(null); // Reset report on new file selection
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setEdaReport(null);
        try {
            const report = await uploadKnowledgeBase(file);
            setEdaReport(report);
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleStartTraining = async () => {
        await initiateTraining();
        setTrainingStatus('in_progress');
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
                return { text: 'Training in Progress...', color: 'text-yellow-500', pulse: true };
            case 'completed':
                return { text: '✅ Training Complete. The model is up to date.', color: 'text-green-500', pulse: false };
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
                <button
                    onClick={handleUpload}
                    disabled={!file || isUploading}
                    className="mt-4 px-6 py-2 bg-light-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isUploading ? 'Uploading...' : 'Upload & Analyze'}
                </button>
            </div>

            {isUploading && <div className="flex justify-center"><LoadingSpinner /></div>}

            {edaReport && (
                <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
                    <h3 className="text-lg font-semibold">Exploratory Data Analysis Report</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <p><strong>File Name:</strong> {edaReport.fileName}</p>
                        <p><strong>File Size:</strong> {(edaReport.fileSize / 1024).toFixed(2)} KB</p>
                        <p><strong>Total Rows:</strong> {edaReport.rowCount}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Columns</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {edaReport.columns.map(col => (
                                <li key={col.name}>
                                    <strong>{col.name}</strong> ({col.type}) - {col.missing} missing values
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2">Category Distribution</h4>
                        <div className="space-y-1 text-sm">
                         {edaReport.categoryDistribution.map(cat => (
                            <div key={cat.name} className="flex items-center">
                                <span className="w-40">{cat.name}</span>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-light-accent h-2.5 rounded-full" style={{ width: `${(cat.value / edaReport.rowCount) * 100}%` }}></div>
                                </div>
                                <span className="ml-2 w-16 text-right">{cat.value}</span>
                            </div>
                        ))}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
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
