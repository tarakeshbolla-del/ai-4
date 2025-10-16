import type { AnalysisResultData, Kpis, RootCauseData, HeatmapDataPoint, SimilarTicket, EdaReport, TrainingStatus, SunburstNode, SentimentData, PredictiveHotspot, SlaBreachTicket, TicketVolumeForecastDataPoint, CsvHeaderMapping } from '../types';
import { TICKET_CATEGORIES as PREDEFINED_CATEGORIES, TICKET_PRIORITIES as PREDEFINED_PRIORITIES } from '../constants';
import { getAiSuggestion, getMappingSuggestion, getNormalizedMappings } from '../services/geminiService';

// --- STATE MANAGEMENT ---
let isModelTrained = false;
let currentTrainingStatus: TrainingStatus = 'idle';
let dynamicCategories = [...PREDEFINED_CATEGORIES];
let dynamicPriorities = [...PREDEFINED_PRIORITIES];


// --- DATA STORES ---
// Stores for pre-training (initial mock data)
let initialKpis: Kpis = {
  deflectionRate: 78.5,
  avgTimeToResolution: 4.2,
  firstContactResolution: 92.1,
};
const mockSimilarTickets: SimilarTicket[] = [
    { ticket_no: 'T001', problem_description: 'Cannot login to VPN, password reset link not working.', solution_text: 'The VPN uses a separate directory. Please reset your password at vpn.company.com/reset.', similarity_score: 0.95, category: 'Network' },
    { ticket_no: 'T002', problem_description: 'Login password for my computer is not being accepted after I changed it.', solution_text: 'Ensure you are connected to the office network or VPN for the new password to sync. If issue persists, contact IT.', similarity_score: 0.88, category: 'Account Management' },
    { ticket_no: 'T003', problem_description: 'I am unable to access the sales dashboard, it says "access denied".', solution_text: 'Access to the sales dashboard requires approval from your manager. Please submit an access request ticket.', similarity_score: 0.85, category: 'Software' },
];

// Stores for post-training data
let uploadedTickets: SimilarTicket[] = [];
let trainedKnowledgeBase: SimilarTicket[] = [];
let trainedKpis: Kpis | null = null;
let trainedRootCauses: RootCauseData[] = [];
let trainedHeatmapData: HeatmapDataPoint[] = [];


// Common words to ignore for better search accuracy
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
  'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m',
  'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t',
  'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t',
  'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s',
  'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves', 'is', 'my', 'issue', 'problem', 'error', 'not', 'working', 'cannot', 'unable', 'to', 'access', 'the'
]);

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const filterSimilarTickets = (query: string): SimilarTicket[] => {
    const dataSource = isModelTrained ? trainedKnowledgeBase : mockSimilarTickets;
    
    const queryTokens = query
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));

    if (queryTokens.length === 0) return [];
    
    const scoredTickets = dataSource.map(ticket => {
        const ticketText = ` ${ticket.problem_description.toLowerCase().replace(/[^\w\s]/g, '')} `;
        let score = 0;
        queryTokens.forEach(token => {
            const regex = new RegExp(`\\s${token}\\s`, 'g');
            const matches = ticketText.match(regex);
            if (matches) score += matches.length * 15;
            else if (ticketText.includes(token)) score += 5;
        });
        for (let i = 0; i < queryTokens.length - 1; i++) {
            if (ticketText.includes(`${queryTokens[i]} ${queryTokens[i+1]}`)) score += 30;
        }
        const ticketCategory = ticket.category?.toLowerCase();
        if (ticketCategory && queryTokens.some(token => ticketCategory.includes(token))) score += 40;
        const queryCategoryMatch = dynamicCategories.find(cat => query.toLowerCase().includes(cat.toLowerCase()));
        if(queryCategoryMatch && ticket.category?.toLowerCase() === queryCategoryMatch.toLowerCase()) score += 50;
        return { ...ticket, similarity_score: score };
    });

    return scoredTickets
        .filter(ticket => ticket.similarity_score > 10)
        .sort((a, b) => b.similarity_score - a.similarity_score);
};


// --- SIMULATED API FUNCTIONS ---

export const analyzeIssue = async (formData: FormData): Promise<AnalysisResultData> => {
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const priority = formData.get('priority') as string;
  const screenshotFile = formData.get('screenshot') as File | null;

  let screenshotBase64: string | undefined = undefined;
  if (screenshotFile) {
    try {
      screenshotBase64 = await fileToBase64(screenshotFile);
    } catch (error) { console.error("Failed to convert file to base64", error); }
  }

  const aiSuggestion = await getAiSuggestion(description, category, priority, screenshotBase64);
  const relevantSimilarIssues = filterSimilarTickets(description);

  return {
    predictedModule: category || 'Network',
    predictedPriority: priority || 'High',
    similarIssues: relevantSimilarIssues,
    aiSuggestion: aiSuggestion,
  };
};

export const getSimilarIssues = (query: string): Promise<SimilarTicket[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(filterSimilarTickets(query).slice(0, 2));
        }, 500);
    });
};

export const submitFeedback = (feedback: 'positive' | 'negative'): Promise<{ status: 'ok' }> => {
    console.log('API: Received feedback', feedback);
    const kpis = isModelTrained ? trainedKpis : initialKpis;
    if (kpis && feedback === 'positive') {
        kpis.deflectionRate = Math.min(100, kpis.deflectionRate + 0.1);
    }
    return new Promise(resolve => setTimeout(() => resolve({ status: 'ok' }), 300));
}

// --- DATA PROCESSING LOGIC ---

function processTrainedData() {
    if (uploadedTickets.length === 0) return;

    trainedKnowledgeBase = [...uploadedTickets];

    // 1. Calculate KPIs (simulated logic)
    trainedKpis = {
        deflectionRate: 85.2,
        avgTimeToResolution: 3.8,
        firstContactResolution: 95.0,
    };

    // 2. Calculate Root Causes from descriptions
    // Maps keywords to the main, standardized categories.
    const rootCauseKeywords: { [key: string]: string[] } = {
        'Software': ['error', 'crash', 'slow', 'freeze', 'bug', 'not responding', 'application', 'access', 'permission', 'denied', 'dashboard', 'feature', 'software'],
        'Hardware': ['printer', 'monitor', 'keyboard', 'laptop', 'mouse', 'broken', 'offline', 'jammed', 'driver', 'hardware'],
        'Network': ['vpn', 'wifi', 'network', 'connect', 'internet', 'disconnected', 'timeout', 'certificate', 'connectivity'],
        'Account Management': ['password', 'login', 'locked', 'reset', 'account', 'credential', 'username', 'expired', 'access'],
        'Database': ['database', 'sql', 'query', 'connection', 'record', 'data', 'table'],
    };
    
    const causeCounts: { [key: string]: number } = {};
    uploadedTickets.forEach(ticket => {
        const description = ticket.problem_description.toLowerCase();
        let found = false;
        // Prioritize keyword matching first for a deeper analysis
        for (const cause in rootCauseKeywords) {
            if (rootCauseKeywords[cause].some(keyword => description.includes(keyword))) {
                causeCounts[cause] = (causeCounts[cause] || 0) + 1;
                found = true;
                break;
            }
        }
        // If no keyword matches, fall back to the ticket's assigned category
        if (!found) {
            const fallbackCategory = (ticket.category && ticket.category !== 'Uncategorized' && dynamicCategories.includes(ticket.category))
                ? ticket.category
                : 'Other';
            causeCounts[fallbackCategory] = (causeCounts[fallbackCategory] || 0) + 1;
        }
    });

    trainedRootCauses = Object.entries(causeCounts)
        .map(([name, tickets]) => ({ name, tickets }))
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 6);

    // 3. Calculate Heatmap Data
    const heatmapCounts: { [key: string]: number } = {};
    uploadedTickets.forEach(ticket => {
        const key = `${ticket.category}|${ticket.priority}`;
        heatmapCounts[key] = (heatmapCounts[key] || 0) + 1;
    });
    
    // Ensure all category/priority combos exist, even if with 0 value
    trainedHeatmapData = dynamicCategories.flatMap(cat => 
        dynamicPriorities.map(pri => {
            const key = `${cat}|${pri}`;
            return { category: cat, priority: pri, value: heatmapCounts[key] || 0 };
        })
    );

    console.log('[API] Finished processing trained data. Dashboards will now use realistic data.');
}


// --- ADMIN API FUNCTIONS ---

export const getInitialDashboardData = (): Promise<{ kpis: Kpis; rootCauses: RootCauseData[]; heatmap: HeatmapDataPoint[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained && trainedKpis) {
                resolve({
                    kpis: trainedKpis,
                    rootCauses: trainedRootCauses,
                    heatmap: trainedHeatmapData,
                });
            } else {
                resolve({
                    kpis: initialKpis,
                    rootCauses: [
                        { name: 'Password Resets', tickets: 450 },
                        { name: 'VPN Connectivity', tickets: 320 },
                        { name: 'Software Access', tickets: 210 },
                        { name: 'Printer Issues', tickets: 150 },
                        { name: 'Hardware Failure', tickets: 80 },
                        { name: 'Other', tickets: 190 },
                    ],
                    heatmap: PREDEFINED_CATEGORIES.flatMap(cat => 
                        PREDEFINED_PRIORITIES.map(pri => ({
                            category: cat,
                            priority: pri,
                            value: Math.floor(Math.random() * 100)
                        }))
                    ),
                });
            }
        }, 1000);
    });
};

export const getWordCloudData = (category: string): Promise<{ word: string, value: number }[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained) {
                const words = uploadedTickets
                    .filter(t => t.problem_description)
                    .flatMap(t => t.problem_description.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/))
                    .filter(word => word.length > 3 && !STOP_WORDS.has(word));
                
                const wordCounts = words.reduce((acc, word) => {
                    acc[word] = (acc[word] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const sortedWords = Object.entries(wordCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 30)
                    .map(([word, value]) => ({ word, value }));
                resolve(sortedWords);
            } else {
                 const mockWords: Record<string, string[]> = {
                    'Password Resets': ['login', 'password', 'reset', 'account', 'locked', 'expired', 'forgot'],
                    'VPN Connectivity': ['vpn', 'connect', 'disconnect', 'slow', 'error', 'timeout', 'certificate'],
                    'Software Access': ['access', 'denied', 'permission', 'request', 'salesforce', 'jira', 'dashboard'],
                    'Printer Issues': ['printer', 'offline', 'jammed', 'toner', 'driver', 'network', 'scan'],
                    'Hardware Failure': ['laptop', 'monitor', 'keyboard', 'mouse', 'broken', 'not working', 'blue screen'],
                    'Other': ['issue', 'problem', 'help', 'email', 'system', 'slow', 'error'],
                };
                resolve((mockWords[category] || mockWords['Other']).map(word => ({
                    word,
                    value: Math.floor(Math.random() * 50) + 10
                })));
            }
        }, 700);
    });
};

export const proposeCsvMapping = async (file: File): Promise<{ headers: string[], mapping: CsvHeaderMapping, rowCount: number }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.trim().split(/\r\n|\n/);
                if (lines.length < 2) {
                    return reject(new Error("CSV file must have at least one header row and one data row."));
                }
                const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
                if (headers.length === 0) {
                    return reject(new Error("Could not parse headers from CSV file."));
                }
                
                const mapping = await getMappingSuggestion(headers);
                
                resolve({
                    headers,
                    mapping,
                    rowCount: lines.length - 1
                });
            } catch (error) {
                reject(error as Error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

export const uploadKnowledgeBase = (file: File, mapping: CsvHeaderMapping): Promise<EdaReport> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.trim().split(/\r\n|\n/);
                const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
                
                const requiredField = 'problem_description';
                if (!mapping[requiredField] || headers.indexOf(mapping[requiredField]!) === -1) {
                     return reject(new Error(`The critical field '${requiredField}' is not mapped to a valid column.`));
                }

                const headerIndexMap: Record<string, number> = {};
                for (const key in mapping) {
                    if (mapping[key]) {
                        const index = headers.indexOf(mapping[key]!);
                        if (index !== -1) {
                            headerIndexMap[key] = index;
                        }
                    }
                }

                // AI-powered data normalization for categories and priorities
                const categoryIndex = headerIndexMap['category'];
                const priorityIndex = headerIndexMap['priority'];
                
                let categoryMapping: Record<string, string> = {};
                if (categoryIndex !== undefined) {
                    const uniqueRawCategories = [...new Set(
                        lines.slice(1).map(line => {
                            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                            return (values[categoryIndex] || '').trim().replace(/"/g, '');
                        }).filter(Boolean)
                    )];
                    if (uniqueRawCategories.length > 0) {
                        categoryMapping = await getNormalizedMappings(uniqueRawCategories, dynamicCategories, 'Category', 'Uncategorized');
                    }
                }

                let priorityMapping: Record<string, string> = {};
                if (priorityIndex !== undefined) {
                    const uniqueRawPriorities = [...new Set(
                        lines.slice(1).map(line => {
                            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                            return (values[priorityIndex] || '').trim().replace(/"/g, '');
                        }).filter(Boolean)
                    )];
                    if (uniqueRawPriorities.length > 0) {
                        priorityMapping = await getNormalizedMappings(uniqueRawPriorities, dynamicPriorities, 'Priority', 'Medium');
                    }
                }
                
                uploadedTickets = lines.slice(1).map((line, index): SimilarTicket | null => {
                    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    const getVal = (key: string) => (values[headerIndexMap[key]] || '').trim().replace(/"/g, '');
                    
                    const problemDesc = getVal('problem_description');
                    if (!problemDesc) return null; // Skip rows without a problem description
                    
                    const rawCategory = getVal('category');
                    const finalCategory = categoryMapping[rawCategory] || 'Uncategorized';
                    
                    const rawPriority = getVal('priority');
                    const finalPriority = priorityMapping[rawPriority] || 'Medium';

                    return {
                        ticket_no: getVal('ticket_no') || `UPL-${index}`,
                        problem_description: problemDesc,
                        category: finalCategory,
                        priority: finalPriority,
                        solution_text: getVal('solution_text'),
                        similarity_score: 1,
                    };
                }).filter((t): t is SimilarTicket => t !== null);

                // Dynamically add new categories and priorities found by Gemini
                const allMappedCategories = new Set(Object.values(categoryMapping));
                const existingCategorySet = new Set(dynamicCategories);
                const newCategories = [...allMappedCategories].filter(c => !existingCategorySet.has(c) && c !== 'Uncategorized');
                if (newCategories.length > 0) dynamicCategories.push(...newCategories);

                const allMappedPriorities = new Set(Object.values(priorityMapping));
                const existingPrioritySet = new Set(dynamicPriorities);
                const newPriorities = [...allMappedPriorities].filter(p => !existingPrioritySet.has(p) && p !== 'Medium');
                if (newPriorities.length > 0) dynamicPriorities.push(...newPriorities);


                const categoryCounts = uploadedTickets.reduce((acc, ticket) => {
                    const category = ticket.category || 'Other';
                    acc[category] = (acc[category] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                resolve({
                    fileName: file.name,
                    fileSize: file.size,
                    rowCount: uploadedTickets.length,
                    columns: Object.entries(mapping)
                        .filter(([, headerName]) => headerName !== null && headers.includes(headerName!))
                        .map(([fieldName, headerName]) => {
                            const colIndex = headers.indexOf(headerName!);
                            const missingCount = lines.slice(1).filter(line => {
                                const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                                return !(values[colIndex] || '').trim();
                            }).length;
                            return { name: headerName!, type: 'string', missing: missingCount };
                        }),
                    categoryDistribution: Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
                });
            } catch (error) {
                reject(error as Error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

export const initiateTraining = (): Promise<{ status: 'ok' }> => {
    currentTrainingStatus = 'in_progress';
    // Reset to initial state before new training
    isModelTrained = false;
    
    setTimeout(() => {
        processTrainedData();
        currentTrainingStatus = 'completed';
        isModelTrained = true;
        console.log('[API] Model training complete. Dashboards now reflect new data.');
    }, 20000); // 20 seconds to simulate training
    return new Promise(resolve => setTimeout(() => resolve({ status: 'ok' }), 200));
}

export const getTrainingStatus = (): Promise<{ status: TrainingStatus }> => {
    return new Promise(resolve => setTimeout(() => resolve({ status: currentTrainingStatus }), 300));
}

export const getProblemClusterData = (): Promise<{ data: SunburstNode | null, error?: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
             if (isModelTrained) {
                if(trainedRootCauses.length < 2){
                    return resolve({ data: null, error: 'insufficient_data' });
                }
                const sunburstData: SunburstNode = {
                    name: "root",
                    children: trainedRootCauses
                        .filter(c => c.name !== 'Other')
                        .map(cause => ({ name: cause.name, value: cause.tickets }))
                };
                resolve({ data: sunburstData });
            } else {
                 resolve({
                    data: {
                        name: "root",
                        children: [
                            { name: "Network", children: [ { name: "VPN", value: 450 }, { name: "Wi-Fi", value: 300 } ] },
                            { name: "Software", children: [ { name: "CRM", value: 350 }, { name: "Email", value: 400 } ] },
                            { name: "Hardware", value: 250 },
                        ],
                    }
                });
            }
        }, 1500);
    });
};

export const getUserFrustrationData = (): Promise<SentimentData> => {
     return new Promise(resolve => {
        setTimeout(() => {
            const baseData = isModelTrained ? [0.2, 0.25, 0.22, 0.3, 0.35, 0.31, 0.4, 0.38] : [0.3, 0.35, 0.32, 0.4, 0.45, 0.41, 0.5, 0.48];
            resolve({
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                data: baseData,
            });
        }, 1200);
    });
};

export const getPredictiveHotspots = (): Promise<PredictiveHotspot[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained) {
                const sortedCauses = [...trainedRootCauses].sort((a,b) => b.tickets - a.tickets);
                const totalTickets = sortedCauses.reduce((sum, cause) => sum + cause.tickets, 1);
                resolve(sortedCauses.slice(0, 3).map(cause => ({
                    name: cause.name,
                    riskScore: Math.min(0.95, cause.tickets / totalTickets * 2.5),
                    trending: 'up',
                })));
            } else {
                resolve([
                    { name: 'CRM System', riskScore: 0.85, trending: 'up' },
                    { name: 'VPN Service', riskScore: 0.65, trending: 'up' },
                    { name: 'Email Server', riskScore: 0.40, trending: 'stable' },
                ]);
            }
        }, 800);
    });
};

export const getSlaBreachTickets = (): Promise<SlaBreachTicket[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([
                { ticket_no: 'T-CRIT-001', priority: 'Critical', timeToBreach: '15m' },
                { ticket_no: 'T-HIGH-045', priority: 'High', timeToBreach: '35m' },
                { ticket_no: 'T-HIGH-048', priority: 'High', timeToBreach: '55m' },
                { ticket_no: 'T-CRIT-002', priority: 'Critical', timeToBreach: '1h 10m' },
            ]);
        }, 950);
    });
};

export const getTicketVolumeForecast = (): Promise<TicketVolumeForecastDataPoint[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const data: TicketVolumeForecastDataPoint[] = [];
            const today = new Date();
            const baseVolume = isModelTrained ? 120 : 180;
            
            for (let i = 4; i > 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                data.push({
                    day: date.toLocaleString('en-US', { weekday: 'short' }),
                    actual: Math.floor(Math.random() * 50) + baseVolume,
                });
            }

            const todayActual = Math.floor(Math.random() * 50) + baseVolume + 10;
            data.push({ day: 'Today', actual: todayActual, forecast: todayActual });

            let lastForecast = todayActual;
            for (let i = 1; i <= 6; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                lastForecast = lastForecast + (Math.random() * 20 - 10);
                data.push({
                    day: date.toLocaleString('en-US', { weekday: 'short' }),
                    forecast: Math.max(baseVolume - 30, Math.floor(lastForecast)),
                });
            }
            
            resolve(data);
        }, 800);
    });
};


// Export state for socket service
export const getTrainingState = () => {
    const categoryTotals = trainedHeatmapData.reduce((acc, point) => {
        acc[point.category] = (acc[point.category] || 0) + point.value;
        return acc;
    }, {} as Record<string, number>);

    return {
        isModelTrained,
        dataDistribution: isModelTrained ? {
            categories: dynamicCategories,
            categoryWeights: dynamicCategories.map(cat => categoryTotals[cat] || 0),
            priorities: dynamicPriorities,
        } : null
    };
};