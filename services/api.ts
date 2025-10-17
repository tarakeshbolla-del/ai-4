import type { AnalysisResultData, Kpis, RootCauseData, HeatmapDataPoint, SimilarTicket, EdaReport, TrainingStatus, SunburstNode, SentimentData, PredictiveHotspot, SlaBreachTicket, TicketVolumeForecastDataPoint, CsvHeaderMapping, OutlierReport, ModelAccuracyReport } from '../types';
import { TICKET_CATEGORIES as PREDEFINED_CATEGORIES, TICKET_PRIORITIES as PREDEFINED_PRIORITIES } from '../constants';
import { getAiSuggestion, getMappingSuggestion, getNormalizedMappings, generateKeywords } from '../services/geminiService';

// --- STATE MANAGEMENT ---
let isModelTrained = false;
let currentTrainingStatus: TrainingStatus = 'idle';
// These are used as a seed for normalization, but will be overwritten by the actual data post-training.
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
let rawParsedTickets: Record<string, string>[] = [];
let uploadedTickets: SimilarTicket[] = [];
let trainedKnowledgeBase: SimilarTicket[] = [];
let trainedKpis: Kpis | null = null;
let trainedRootCauses: RootCauseData[] = [];
let trainedHeatmapData: HeatmapDataPoint[] = [];
let modelAccuracyReport: ModelAccuracyReport | null = null;
let trainedWordCloudDataCache: Map<string, { word: string, value: number }[]> = new Map();

// New state for performance optimization
type InvertedIndex = Map<string, number[]>; // Map<token, ticket_indices[]>
let trainedInvertedIndex: InvertedIndex | null = null;


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

const filterSimilarTickets = (query: string, dataSource: SimilarTicket[] = []): SimilarTicket[] => {
    const searchData = dataSource.length > 0 ? dataSource : (isModelTrained ? trainedKnowledgeBase : mockSimilarTickets);
    
    const queryTokens = query
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));

    if (queryTokens.length === 0) return [];
    
    let candidateTickets: SimilarTicket[] = searchData;

    // OPTIMIZATION: Use inverted index if available for the given data source
    if (trainedInvertedIndex && searchData === trainedKnowledgeBase) {
        const candidateIndices = new Set<number>();
        queryTokens.forEach(token => {
            const indices = trainedInvertedIndex!.get(token);
            if (indices) {
                indices.forEach(index => candidateIndices.add(index));
            }
        });
        // If we found candidates, filter the main list. Otherwise, search the full list.
        if (candidateIndices.size > 0 && candidateIndices.size < searchData.length) {
             candidateTickets = Array.from(candidateIndices).map(index => searchData[index]);
        }
    }

    const scoredTickets = candidateTickets.map(ticket => {
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
  
  // For trained model, predict category and priority from the most similar ticket
  let predictedCategory = category || 'Network';
  let predictedPriority = priority || 'High';
  if (isModelTrained && relevantSimilarIssues.length > 0) {
      predictedCategory = relevantSimilarIssues[0].category || predictedCategory;
      predictedPriority = relevantSimilarIssues[0].priority || predictedPriority;
  }


  return {
    predictedModule: predictedCategory,
    predictedPriority: predictedPriority,
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

async function processTrainedData() {
    if (uploadedTickets.length < 10) { // Need enough data to split
        trainedKnowledgeBase = [...uploadedTickets];
        modelAccuracyReport = null;
        // Process other metrics even with small data
    } else {
        // 1. Train/Test Split (80/20)
        const shuffled = [...uploadedTickets].sort(() => 0.5 - Math.random());
        const splitIndex = Math.floor(shuffled.length * 0.8);
        const trainingSet = shuffled.slice(0, splitIndex);
        const testSet = shuffled.slice(splitIndex);
        
        trainedKnowledgeBase = trainingSet;

        // OPTIMIZATION: Build an inverted index for the training set to speed up evaluation.
        trainedInvertedIndex = new Map();
        trainingSet.forEach((ticket, index) => {
            const ticketText = `${ticket.problem_description.toLowerCase()} ${ticket.category?.toLowerCase() || ''}`;
            const tokens = Array.from(new Set( // Use Set to store unique tokens per ticket
                ticketText
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
            ));
            
            tokens.forEach(token => {
                if (!trainedInvertedIndex!.has(token)) {
                    trainedInvertedIndex!.set(token, []);
                }
                trainedInvertedIndex!.get(token)!.push(index);
            });
        });


        // 2. Evaluate model on test set
        let correctCategory = 0;
        let correctPriority = 0;
        const categoryPerformance: Record<string, {correct: number, total: number}> = {};

        testSet.forEach(testTicket => {
            // Simulate a prediction by finding the most similar ticket in the training set (now faster with index)
            const prediction = filterSimilarTickets(testTicket.problem_description, trainingSet);
            
            const predictedCategory = prediction.length > 0 ? prediction[0].category : 'Uncategorized';
            const predictedPriority = prediction.length > 0 ? prediction[0].priority : 'Medium';

            if (predictedCategory === testTicket.category) {
                correctCategory++;
            }
            if (predictedPriority === testTicket.priority) {
                correctPriority++;
            }

            // Track per-category accuracy
            const actualCategory = testTicket.category || 'Uncategorized';
            if (!categoryPerformance[actualCategory]) {
                categoryPerformance[actualCategory] = { correct: 0, total: 0 };
            }
            categoryPerformance[actualCategory].total++;
            if (predictedCategory === actualCategory) {
                categoryPerformance[actualCategory].correct++;
            }
        });

        const categoryAccuracy = (correctCategory / testSet.length) * 100;
        const priorityAccuracy = (correctPriority / testSet.length) * 100;

        // Generate AI notes
        const notes = [`Model evaluated on a test set of ${testSet.length} tickets.`];
        const wellPerforming = Object.entries(categoryPerformance).filter(([, v]) => (v.correct / v.total) > 0.85);
        const poorlyPerforming = Object.entries(categoryPerformance).filter(([, v]) => (v.correct / v.total) < 0.6);
        
        if (wellPerforming.length > 0) {
            notes.push(`Performance is strong in the '${wellPerforming.map(([k]) => k).join(', ')}' categor${wellPerforming.length > 1 ? 'ies' : 'y'}.`);
        }
        if (poorlyPerforming.length > 0) {
            notes.push(`Consider providing more data or cleaning the '${poorlyPerforming.map(([k]) => k).join(', ')}' categor${poorlyPerforming.length > 1 ? 'ies' : 'y'} for better accuracy.`);
        }

        modelAccuracyReport = {
            categoryAccuracy,
            priorityAccuracy,
            overallScore: (categoryAccuracy * 0.6) + (priorityAccuracy * 0.4),
            notes,
        };
    }
    

    // Calculate KPIs (simulated logic on the entire dataset)
    trainedKpis = {
        deflectionRate: 85.2,
        avgTimeToResolution: 3.8,
        firstContactResolution: 95.0,
    };

    // Calculate Root Causes from descriptions
    const rootCauseKeywords: { [key: string]: string[] } = {
        'Software': ['error', 'crash', 'slow', 'freeze', 'bug', 'not responding', 'application', 'access', 'permission', 'denied', 'dashboard', 'feature', 'software'],
        'Hardware': ['printer', 'monitor', 'keyboard', 'laptop', 'mouse', 'broken', 'offline', 'jammed', 'driver', 'hardware'],
        'Network': ['vpn', 'wifi', 'network', 'connect', 'internet', 'disconnected', 'timeout', 'certificate', 'connectivity'],
        'Account Management': ['password', 'login', 'locked', 'reset', 'account', 'credential', 'username', 'expired', 'access'],
        'Database': ['database', 'sql', 'query', 'connection', 'record', 'data', 'table'],
    };
    
    // FIX: Only use keyword sets for categories that actually exist in the trained data.
    const activeRootCauseKeywords: { [key: string]: string[] } = {};
    dynamicCategories.forEach(category => {
        if (rootCauseKeywords[category]) {
            activeRootCauseKeywords[category] = rootCauseKeywords[category];
        }
    });

    const causeCounts: { [key: string]: number } = {};
    uploadedTickets.forEach(ticket => {
        const description = ticket.problem_description.toLowerCase();
        let found = false;
        // Iterate through the ACTIVE keywords, not the hardcoded ones.
        for (const cause in activeRootCauseKeywords) {
            if (activeRootCauseKeywords[cause].some(keyword => description.includes(keyword))) {
                causeCounts[cause] = (causeCounts[cause] || 0) + 1;
                found = true;
                break;
            }
        }
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

    // Calculate Heatmap Data
    const heatmapCounts: { [key: string]: number } = {};
    uploadedTickets.forEach(ticket => {
        const key = `${ticket.category}|${ticket.priority}`;
        heatmapCounts[key] = (heatmapCounts[key] || 0) + 1;
    });
    
    trainedHeatmapData = dynamicCategories.flatMap(cat => 
        dynamicPriorities.map(pri => {
            const key = `${cat}|${pri}`;
            return { category: cat, priority: pri, value: heatmapCounts[key] || 0 };
        })
    );
    
    // Pre-calculate and cache word cloud data
    console.log('[API] Pre-calculating word cloud data for top root causes...');
    trainedWordCloudDataCache.clear();
    const keywordPromises = trainedRootCauses.map(async (cause) => {
        const descriptions = uploadedTickets
            .filter(t => t.category === cause.name && t.problem_description)
            .map(t => t.problem_description);
        
        if (descriptions.length > 0) {
            const shuffled = descriptions.sort(() => 0.5 - Math.random());
            const sample = shuffled.slice(0, 50); // Take a sample
            const keywords = await generateKeywords(sample, cause.name);
            trainedWordCloudDataCache.set(cause.name, keywords);
            console.log(`[API] Cached keywords for '${cause.name}'`);
        }
    });

    await Promise.all(keywordPromises);
    console.log('[API] Finished pre-calculating word cloud data.');

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
                    rootCauses: [],
                    heatmap: [],
                });
            }
        }, 1000);
    });
};

export const getWordCloudData = (category: string): Promise<{ word: string, value: number }[]> => {
    return new Promise(async (resolve) => {
        if (isModelTrained) {
            // OPTIMIZATION: Use pre-calculated cache for instant retrieval.
            if (trainedWordCloudDataCache.has(category)) {
                resolve(trainedWordCloudDataCache.get(category)!);
                return;
            }

            // Fallback for safety (e.g., if a new category appears dynamically)
            console.warn(`[API] Word cloud cache miss for category: ${category}. Generating on-demand.`);
            const descriptions = uploadedTickets
                .filter(t => t.category === category && t.problem_description)
                .map(t => t.problem_description);

            if (descriptions.length > 0) {
                const shuffled = descriptions.sort(() => 0.5 - Math.random());
                const sample = shuffled.slice(0, 50);
                const keywords = await generateKeywords(sample, category);
                trainedWordCloudDataCache.set(category, keywords); // Cache the result for next time
                resolve(keywords);
            } else {
                resolve([]);
            }
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
    });
};


export const proposeCsvMapping = async (file: File): Promise<{ headers: string[], mapping: CsvHeaderMapping, rowCount: number }> => {
    // Reset all trained and in-progress data when a new file upload is initiated.
    isModelTrained = false;
    currentTrainingStatus = 'idle';
    trainedKnowledgeBase = [];
    trainedInvertedIndex = null;
    trainedKpis = null;
    trainedRootCauses = [];
    trainedHeatmapData = [];
    trainedWordCloudDataCache.clear();
    modelAccuracyReport = null;
    rawParsedTickets = [];
    uploadedTickets = [];
    // Restore normalization helpers to their default state
    dynamicCategories = [...PREDEFINED_CATEGORIES];
    dynamicPriorities = [...PREDEFINED_PRIORITIES];

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

export const uploadKnowledgeBase = (file: File, mapping: CsvHeaderMapping): Promise<{ report: EdaReport; categoryMapping: Record<string, string>; rawCategoryCounts: Record<string, number>; }> => {
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

                // Store raw parsed tickets for final cleaning step later
                rawParsedTickets = lines.slice(1).map(line => {
                    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    const ticketData: Record<string, string> = {};
                    for (const key in headerIndexMap) {
                        ticketData[key] = (values[headerIndexMap[key]] || '').trim().replace(/"/g, '');
                    }
                    return ticketData;
                }).filter(t => t.problem_description); // Always filter out rows with no description

                const categoryIndex = headerIndexMap['category'];
                const rawCategoryCounts: Record<string, number> = {};
                if (categoryIndex !== undefined) {
                    rawParsedTickets.forEach(ticket => {
                        const rawCategory = ticket.category || '';
                        if (rawCategory) {
                            rawCategoryCounts[rawCategory] = (rawCategoryCounts[rawCategory] || 0) + 1;
                        }
                    });
                }
                
                // Get initial AI-powered normalization for categories
                const uniqueRawCategories = Object.keys(rawCategoryCounts);
                let categoryMapping: Record<string, string> = {};
                if (uniqueRawCategories.length > 0) {
                    categoryMapping = await getNormalizedMappings(uniqueRawCategories, dynamicCategories, 'Category', 'Uncategorized');
                }
                
                // --- OUTLIER DETECTION ---
                const descriptionLengths = rawParsedTickets
                    .map(t => t.problem_description?.length || 0)
                    .filter(l => l > 0);

                let outlierReport: OutlierReport;
                if (descriptionLengths.length > 0) {
                    const minLen = Math.min(...descriptionLengths);
                    const maxLen = Math.max(...descriptionLengths);
                    const avgLen = Math.round(descriptionLengths.reduce((a, b) => a + b, 0) / descriptionLengths.length);
                    
                    const SHORT_THRESHOLD = 15;
                    const LONG_THRESHOLD = 500;
                    
                    const shortOutliers = descriptionLengths.filter(l => l < SHORT_THRESHOLD).length;
                    const longOutliers = descriptionLengths.filter(l => l > LONG_THRESHOLD).length;
                    
                    const RARE_CATEGORY_THRESHOLD = Math.max(5, Math.floor(rawParsedTickets.length * 0.005));
                    
                    const rareCategories = Object.entries(rawCategoryCounts)
                        .filter(([, count]) => count < RARE_CATEGORY_THRESHOLD)
                        .map(([name, count]) => ({ name, count }))
                        .sort((a,b) => a.count - b.count);

                    outlierReport = {
                        rareCategories,
                        descriptionLength: {
                            min: minLen,
                            max: maxLen,
                            avg: avgLen,
                            shortOutlierThreshold: SHORT_THRESHOLD,
                            longOutlierThreshold: LONG_THRESHOLD,
                            shortOutliers,
                            longOutliers,
                        }
                    };
                } else {
                    outlierReport = {
                        rareCategories: [],
                        descriptionLength: { min: 0, max: 0, avg: 0, shortOutlierThreshold: 15, longOutlierThreshold: 500, shortOutliers: 0, longOutliers: 0 }
                    };
                }

                // Create a temporary set of tickets to generate the category distribution
                const tempTickets = rawParsedTickets.map((rawTicket, index) => {
                    const finalCategory = categoryMapping[rawTicket.category] || 'Uncategorized';
                    return { ...rawTicket, category: finalCategory };
                });
                
                const categoryCounts = tempTickets.reduce((acc, ticket) => {
                    const category = ticket.category || 'Other';
                    acc[category] = (acc[category] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                resolve({
                    report: {
                        fileName: file.name,
                        fileSize: file.size,
                        rowCount: rawParsedTickets.length,
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
                        outlierReport,
                    },
                    categoryMapping,
                    rawCategoryCounts,
                });

            } catch (error) {
                reject(error as Error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

export const finalizeTicketData = (finalCategoryMapping: Record<string, string>): Promise<{ cleanedRowCount: number }> => {
    return new Promise(async (resolve, reject) => {
        // Full priority normalization on the final step
        const uniqueRawPriorities = [...new Set(rawParsedTickets.map(t => t.priority).filter(Boolean))];
        let priorityMapping: Record<string, string> = {};
        if (uniqueRawPriorities.length > 0) {
            // Use PREDEFINED_PRIORITIES to guide normalization
            priorityMapping = await getNormalizedMappings(uniqueRawPriorities, PREDEFINED_PRIORITIES, 'Priority', 'Medium');
        }

        uploadedTickets = rawParsedTickets.map((rawTicket, index): SimilarTicket => {
            return {
                ticket_no: rawTicket.ticket_no || `UPL-${index}`,
                problem_description: rawTicket.problem_description,
                category: finalCategoryMapping[rawTicket.category] || 'Uncategorized',
                priority: priorityMapping[rawTicket.priority] || 'Medium',
                solution_text: rawTicket.solution_text,
                similarity_score: 1,
            };
        });

        // CRITICAL: Overwrite the dynamic lists with ONLY the categories and priorities
        // found in the actual, cleaned data. This prevents old data from persisting.
        dynamicCategories = [...new Set(uploadedTickets.map(t => t.category).filter(c => c && c !== 'Uncategorized') as string[])];
        dynamicPriorities = [...new Set(uploadedTickets.map(t => t.priority).filter(Boolean) as string[])];
        
        console.log('[API] Finalized data cleaning. Total tickets prepared:', uploadedTickets.length);
        console.log('[API] Active Categories:', dynamicCategories);
        console.log('[API] Active Priorities:', dynamicPriorities);
        resolve({ cleanedRowCount: uploadedTickets.length });
    });
};


export const initiateTraining = (): Promise<{ status: 'ok' }> => {
    currentTrainingStatus = 'in_progress';
    // Reset to initial state before new training
    isModelTrained = false;
    modelAccuracyReport = null;
    trainedInvertedIndex = null;
    
    setTimeout(async () => {
        await processTrainedData();
        currentTrainingStatus = 'completed';
        isModelTrained = true;
        console.log('[API] Model training complete. Dashboards now reflect new data.');
    }, 5000); // OPTIMIZATION: Reduced from 20s to 5s to simulate faster training.
    return new Promise(resolve => setTimeout(() => resolve({ status: 'ok' }), 200));
}

export const getTrainingStatus = (): Promise<{ status: TrainingStatus }> => {
    return new Promise(resolve => setTimeout(() => resolve({ status: currentTrainingStatus }), 300));
}

export const getModelAccuracyReport = (): Promise<ModelAccuracyReport | null> => {
    return new Promise(resolve => setTimeout(() => resolve(modelAccuracyReport), 300));
};

export const getProblemClusterData = (): Promise<{ data: SunburstNode | null, error?: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained) {
                if (trainedRootCauses.length < 2) {
                    return resolve({ data: null, error: 'insufficient_data' });
                }

                const keywordSubClusters: Record<string, Record<string, number>> = {};
                const subClusterKeywords: Record<string, string[]> = {
                    'Software': ['crm', 'email', 'access', 'permission', 'dashboard', 'feature', 'slow', 'crash', 'login', 'application'],
                    'Hardware': ['printer', 'monitor', 'keyboard', 'laptop', 'mouse', 'broken', 'offline', 'driver'],
                    'Network': ['vpn', 'wifi', 'network', 'connect', 'internet', 'disconnected', 'timeout', 'certificate'],
                    'Account Management': ['password', 'login', 'locked', 'reset', 'account', 'credential', 'expired'],
                    'Database': ['database', 'sql', 'query', 'connection', 'record', 'data', 'table'],
                };

                uploadedTickets.forEach(ticket => {
                    const category = ticket.category || 'Other';
                    if (!subClusterKeywords[category]) return;
                    
                    const description = ticket.problem_description.toLowerCase();
                    
                    subClusterKeywords[category].forEach(keyword => {
                        if (description.includes(keyword)) {
                            if (!keywordSubClusters[category]) {
                                keywordSubClusters[category] = {};
                            }
                            const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                            keywordSubClusters[category][capitalizedKeyword] = (keywordSubClusters[category][capitalizedKeyword] || 0) + 1;
                        }
                    });
                });

                const sunburstData: SunburstNode = {
                    name: "root",
                    children: trainedRootCauses
                        .filter(c => c.name !== 'Other')
                        .map(cause => {
                            const subClusters = keywordSubClusters[cause.name];
                            if (subClusters) {
                                const children = Object.entries(subClusters)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 5) // Top 5 sub-clusters
                                    .map(([name, value]) => ({ name, value }));
                                
                                if (children.length > 0) {
                                    return { name: cause.name, children };
                                }
                            }
                            return { name: cause.name, value: cause.tickets };
                        })
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
            if (isModelTrained && uploadedTickets.length >= 8) {
                const frustrationKeywords = ['urgent', 'asap', 'critical', 'down', 'immediately', 'frustrated', 'angry', 'unacceptable', 'blocker'];
                const priorityWeight: Record<string, number> = { 'Low': 0.1, 'Medium': 0.3, 'High': 0.6, 'Critical': 1.0 };
                
                const sentimentScores: number[] = [];
                const chunkSize = Math.floor(uploadedTickets.length / 8);
            
                for (let i = 0; i < 8; i++) {
                    const chunk = uploadedTickets.slice(i * chunkSize, (i + 1) * chunkSize);
                    if (chunk.length === 0) {
                        sentimentScores.push(i > 0 ? sentimentScores[i-1] : 0.2); // Avoid empty chunks, carry over last value
                        continue;
                    };
            
                    let totalScore = 0;
                    chunk.forEach(ticket => {
                        let score = priorityWeight[ticket.priority || 'Medium'] || 0.3;
                        const description = ticket.problem_description.toLowerCase();
                        frustrationKeywords.forEach(keyword => {
                            if (description.includes(keyword)) {
                                score += 0.2;
                            }
                        });
                        totalScore += Math.min(1.0, score);
                    });
            
                    const avgScore = totalScore / chunk.length;
                    sentimentScores.push(parseFloat(avgScore.toFixed(2)));
                }
                
                resolve({
                    labels: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8'],
                    data: sentimentScores,
                });

            } else {
                // Fallback to original mock
                const baseData = isModelTrained ? [0.2, 0.25, 0.22, 0.3, 0.35, 0.31, 0.4, 0.38] : [0.3, 0.35, 0.32, 0.4, 0.45, 0.41, 0.5, 0.48];
                resolve({
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                    data: baseData,
                });
            }
        }, 1200);
    });
};

export const getPredictiveHotspots = (): Promise<PredictiveHotspot[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained && uploadedTickets.length > 20) {
                const sortedCauses = [...trainedRootCauses].sort((a,b) => b.tickets - a.tickets);
                const totalTickets = sortedCauses.reduce((sum, cause) => sum + cause.tickets, 1);
                
                const midPoint = Math.floor(uploadedTickets.length / 2);
                const firstHalf = uploadedTickets.slice(0, midPoint);
                const secondHalf = uploadedTickets.slice(midPoint);
            
                const firstHalfCounts: Record<string, number> = {};
                firstHalf.forEach(t => {
                    const category = t.category || 'Other';
                    firstHalfCounts[category] = (firstHalfCounts[category] || 0) + 1;
                });
            
                const secondHalfCounts: Record<string, number> = {};
                secondHalf.forEach(t => {
                    const category = t.category || 'Other';
                    secondHalfCounts[category] = (secondHalfCounts[category] || 0) + 1;
                });
            
                const hotspots = sortedCauses.slice(0, 3).map(cause => {
                    const firstCount = firstHalfCounts[cause.name] || 0;
                    const secondCount = secondHalfCounts[cause.name] || 0;
                    
                    let trending: 'up' | 'down' | 'stable' = 'stable';
                    const diff = secondCount - firstCount;
                    // Use a small threshold to avoid flagging minor fluctuations
                    if (firstCount > 5 && diff > firstCount * 0.1) {
                        trending = 'up';
                    } else if (firstCount > 5 && diff < -firstCount * 0.1) {
                        trending = 'down';
                    }
            
                    return {
                        name: cause.name,
                        riskScore: Math.min(0.95, cause.tickets / totalTickets * 2.5),
                        trending: trending,
                    };
                });
                resolve(hotspots);
            } else if (isModelTrained) {
                // Fallback for smaller datasets
                const sortedCauses = [...trainedRootCauses].sort((a,b) => b.tickets - a.tickets);
                const totalTickets = sortedCauses.reduce((sum, cause) => sum + cause.tickets, 1);
                resolve(sortedCauses.slice(0, 3).map(cause => ({
                    name: cause.name,
                    riskScore: Math.min(0.95, cause.tickets / totalTickets * 2.5),
                    trending: 'stable', // Can't determine trend with small data
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
            if (isModelTrained) {
                const highPriorityTickets = uploadedTickets.filter(
                    t => t.priority === 'High' || t.priority === 'Critical'
                );
                
                // Shuffle and pick a few
                const shuffled = highPriorityTickets.sort(() => 0.5 - Math.random());
                const selectedTickets = shuffled.slice(0, 5);
                
                const breachTimes = ['15m', '25m', '35m', '45m', '55m', '1h 10m', '1h 30m'];
                
                const slaTickets: SlaBreachTicket[] = selectedTickets.map(ticket => ({
                    ticket_no: ticket.ticket_no,
                    priority: ticket.priority as 'High' | 'Critical',
                    timeToBreach: breachTimes[Math.floor(Math.random() * breachTimes.length)],
                }));
                
                resolve(slaTickets);
            
            } else {
                // Fallback to original mock
                resolve([
                    { ticket_no: 'T-CRIT-001', priority: 'Critical', timeToBreach: '15m' },
                    { ticket_no: 'T-HIGH-045', priority: 'High', timeToBreach: '35m' },
                    { ticket_no: 'T-HIGH-048', priority: 'High', timeToBreach: '55m' },
                    { ticket_no: 'T-CRIT-002', priority: 'Critical', timeToBreach: '1h 10m' },
                ]);
            }
        }, 950);
    });
};

export const getTicketVolumeForecast = (): Promise<TicketVolumeForecastDataPoint[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const data: TicketVolumeForecastDataPoint[] = [];
            const today = new Date();
            let baseVolume = 180; // default mock

            if (isModelTrained && uploadedTickets.length > 0) {
                // Assume the dataset represents roughly 30 days of tickets for a daily average
                const dailyAverage = Math.ceil(uploadedTickets.length / 30);
                baseVolume = Math.max(20, dailyAverage); // Ensure base volume is not too low
            }

            // Generate 4 past days of "actual" data
            for (let i = 4; i > 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                data.push({
                    day: date.toLocaleString('en-US', { weekday: 'short' }),
                    actual: Math.floor(Math.random() * (baseVolume * 0.4) - (baseVolume * 0.2) + baseVolume), // +/- 20% randomness
                });
            }

            // Today's data
            const todayActual = Math.floor(Math.random() * (baseVolume * 0.4) - (baseVolume * 0.2) + baseVolume);
            data.push({ day: 'Today', actual: todayActual, forecast: todayActual });

            // Forecast for the next 6 days
            let lastForecast = todayActual;
            for (let i = 1; i <= 6; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                // Simulate some trend and randomness
                lastForecast = lastForecast + (Math.random() * (baseVolume * 0.1) - (baseVolume * 0.05));
                data.push({
                    day: date.toLocaleString('en-US', { weekday: 'short' }),
                    forecast: Math.max(Math.floor(baseVolume * 0.7), Math.floor(lastForecast)), // ensure forecast doesn't drop too low
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