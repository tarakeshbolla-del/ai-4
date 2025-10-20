import type { AnalysisResultData, Kpis, RootCauseData, HeatmapDataPoint, SimilarTicket, EdaReport, TrainingStatus, SunburstNode, SentimentData, PredictiveHotspot, SlaBreachTicket, TicketVolumeForecastDataPoint, CsvHeaderMapping, OutlierReport, ModelAccuracyReport, TechnicianWorkloadData, TicketStatusData, AvgResolutionTimeData, SlaRiskTicket } from '../types';
import { DEFAULT_TICKET_CATEGORIES, DEFAULT_TICKET_PRIORITIES } from '../constants';
import { getAiSuggestion, getMappingSuggestion, getNormalizedMappings, generateKeywords, getComplexityScore } from '../services/geminiService';
import { socketService } from './socketService';

// --- STATE MANAGEMENT ---
let isModelTrained = false;
let currentTrainingStatus: TrainingStatus = 'idle';
// These are used as a seed for normalization, but will be overwritten by the actual data post-training.
let dynamicCategories = [...DEFAULT_TICKET_CATEGORIES];
let dynamicPriorities = [...DEFAULT_TICKET_PRIORITIES];


// --- UI DATA FUNCTIONS ---
export const getDynamicCategories = (): Promise<string[]> => {
    return Promise.resolve(dynamicCategories);
};

export const getDynamicPriorities = (): Promise<string[]> => {
    return Promise.resolve(dynamicPriorities);
};

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
let liveSlaTickets: SlaBreachTicket[] = [];

// New state for performance optimization
type InvertedIndex = Map<string, number[]>; // Map<token, ticket_indices[]>
let trainedInvertedIndex: InvertedIndex | null = null;
// New state for advanced relevance scoring
let trainedIdfMap: Map<string, number> | null = null;
// New cache for AI-calculated complexity scores to avoid redundant API calls
const complexityCache = new Map<string, number>();


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

// Helper to tokenize text
const tokenize = (text: string): string[] => {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));
};


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
    const queryTokens = tokenize(query);

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
        if (candidateIndices.size > 0 && candidateIndices.size < searchData.length) {
             candidateTickets = Array.from(candidateIndices).map(index => searchData[index]);
        }
    }

    const scoredTickets = candidateTickets.map(ticket => {
        let score = 0;
        const ticketText = ` ${ticket.problem_description.toLowerCase().replace(/[^\w\s]/g, '')} `;

        // --- SCORING LOGIC ---
        if (isModelTrained && trainedIdfMap) {
            // ADVANCED SCORING: TF-IDF with logarithmic TF scaling + Heuristics
            const ticketTokens = tokenize(ticket.problem_description); // Use same tokenizer as training
            
            queryTokens.forEach(token => {
                const tf = ticketTokens.filter(t => t === token).length;
                if (tf > 0) {
                    // Use logarithmic term frequency to dampen the effect of high-frequency words.
                    const weightedTf = 1 + Math.log(tf);
                    
                    // Inverse Document Frequency (IDF): from pre-calculated map.
                    // Add smoothing (add 1 to denominator) to handle rare words better.
                    // Default to max IDF if a query token is new (very rare and important).
                    const idf = trainedIdfMap!.get(token) || Math.log(1 + (trainedKnowledgeBase.length / 1));
                    
                    score += weightedTf * idf;
                }
            });
        } else {
            // SIMPLE SCORING: Heuristic-based
            queryTokens.forEach(token => {
                const regex = new RegExp(`\\s${token}\\s`, 'g');
                if (ticketText.match(regex)) score += 15;
                else if (ticketText.includes(token)) score += 5;
            });
        }
        
        // Phrase and Category Bonus (applies to both scoring models)
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
        .filter(ticket => ticket.similarity_score > 0) // Changed from 10 to 0 to be more inclusive with TF-IDF
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
            resolve(filterSimilarTickets(query).slice(0, 3));
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

export const createNewTicket = (description: string, predictedCategory: string, predictedPriority: string): Promise<{ status: 'ok', ticket: SlaBreachTicket | null }> => {
    return new Promise(resolve => {
        // When a new ticket is created, update the heatmap data if the model is trained.
        if (isModelTrained && trainedHeatmapData.length > 0) {
            const index = trainedHeatmapData.findIndex(d => d.category === predictedCategory && d.priority === predictedPriority);
            if (index > -1) {
                // Increment the value in the backend data store
                trainedHeatmapData[index].value += 1;
                // Create an update payload to send to the client.
                // The value is 1, representing the single new ticket.
                const heatmapUpdate: HeatmapDataPoint = {
                    category: predictedCategory,
                    priority: predictedPriority,
                    value: 1 
                };
                // Emit the live update via the socket service
                socketService.emitHeatmapUpdate(heatmapUpdate);
            }
        }

        if (predictedPriority === 'High' || predictedPriority === 'Critical' || predictedPriority === 'p1') {
            const newTicket: SlaBreachTicket = {
                ticket_no: `LIVE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                priority: 'High', // Keep High/Critical for display purposes, but logic could use p1
                timeToBreach: predictedPriority === 'Critical' || predictedPriority === 'p1' ? '59m' : '3h 59m'
            };
            liveSlaTickets.unshift(newTicket);
            socketService.emitNewTicket(newTicket);
            resolve({ status: 'ok', ticket: newTicket });
        } else {
            console.log(`[API] Low/Medium priority ticket created ('${description.substring(0, 30)}...'), not added to SLA ticker.`);
            resolve({ status: 'ok', ticket: null });
        }
    });
}

// --- DATA PROCESSING LOGIC ---

// --- FIX: Dynamic library loader ---
let xlsxLoaded: Promise<void> | null = null;
const loadXlsx = () => {
  if (typeof (window as any).XLSX !== 'undefined') {
    return Promise.resolve();
  }
  if (xlsxLoaded) {
    return xlsxLoaded;
  }
  xlsxLoaded = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve();
    script.onerror = () => {
      console.error("Failed to load XLSX library from CDN.");
      reject(new Error("Failed to load the XLSX library from CDN."));
    };
    document.head.appendChild(script);
  });
  return xlsxLoaded;
};

const parseFileToRows = async (file: File): Promise<{headers: string[], lines: string[]}> => {
    return new Promise(async (resolve, reject) => {
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                const lines = text.trim().split(/\r\n|\n/);
                 if (lines.length < 2) {
                    return reject(new Error("File must have at least one header row and one data row."));
                }
                const headers = lines[0]?.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/"/g, '')) || [];
                if (headers.length === 0) {
                    return reject(new Error("Could not parse headers from file."));
                }
                resolve({ headers, lines });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            try {
                await loadXlsx();
                const XLSX = (window as any).XLSX;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = new Uint8Array(event.target?.result as ArrayBuffer);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const csv = XLSX.utils.sheet_to_csv(worksheet, { RS: '\n' });
                        const lines = csv.trim().split(/\n/);
                         if (lines.length < 2) {
                            return reject(new Error("Excel file must have at least one header row and one data row."));
                        }
                        const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
                        if (headers.length === 0) {
                            return reject(new Error("Could not parse headers from Excel file."));
                        }
                        resolve({ headers, lines });
                    } catch (err) {
                        console.error("Error parsing Excel file:", err);
                        reject(new Error("Failed to parse Excel file. It might be corrupted or in an unsupported format."));
                    }
                };
                reader.onerror = (error) => reject(error);
                reader.readAsArrayBuffer(file);
            } catch (error) {
                reject(error);
            }
        } else {
            reject(new Error("Unsupported file type. Please upload a CSV or XLSX file."));
        }
    });
};


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

        // 2. Build Inverted Index and TF-IDF Models on the Training Set
        trainedInvertedIndex = new Map();
        const docFreq: Map<string, number> = new Map();
        const N = trainingSet.length;

        trainingSet.forEach((ticket, index) => {
            const ticketText = `${ticket.problem_description.toLowerCase()} ${ticket.category?.toLowerCase() || ''}`;
            const tokens = tokenize(ticketText);
            const uniqueTokens = Array.from(new Set(tokens));
            
            // Build inverted index
            uniqueTokens.forEach(token => {
                if (!trainedInvertedIndex!.has(token)) {
                    trainedInvertedIndex!.set(token, []);
                }
                trainedInvertedIndex!.get(token)!.push(index);
            });

            // Build document frequency map for IDF
            uniqueTokens.forEach(token => {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
            });
        });

        // Calculate and store IDF values with smoothing
        trainedIdfMap = new Map();
        for (const [token, count] of docFreq.entries()) {
            // Add 1 to N for smoothing, preventing division by zero for terms in all docs
            const idf = Math.log(1 + ((N + 1) / (count + 1)));
            trainedIdfMap.set(token, idf);
        }
        console.log(`[API] Built TF-IDF model with ${trainedIdfMap.size} unique terms.`);


        // 3. Evaluate model on test set
        let correctCategory = 0;
        let correctPriority = 0;
        const categoryPerformance: Record<string, {correct: number, total: number}> = {};

        testSet.forEach(testTicket => {
            // Simulate a prediction by finding the most similar ticket in the training set (now faster with index and TF-IDF)
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
        .sort((a, b) => b.tickets - a.tickets);

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
    
    // Pre-calculate and cache word cloud data sequentially to avoid rate limiting
    console.log('[API] Pre-calculating word cloud data for top root causes...');
    trainedWordCloudDataCache.clear();
    for (const cause of trainedRootCauses) {
        const descriptions = uploadedTickets
            .filter(t => t.category === cause.name && t.problem_description)
            .map(t => t.problem_description);
        
        if (descriptions.length > 0) {
            const shuffled = descriptions.sort(() => 0.5 - Math.random());
            const sample = shuffled.slice(0, 50); // Take a sample
            try {
                const keywords = await generateKeywords(sample, cause.name);
                trainedWordCloudDataCache.set(cause.name, keywords);
                console.log(`[API] Cached keywords for '${cause.name}'`);
                // Add a small delay between each call
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`[API] Failed to generate keywords for '${cause.name}'.`, error);
            }
        }
    }

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

export const getTicketsByCategoryAndPriority = (category: string, priority: string): Promise<SimilarTicket[]> => {
    return new Promise(resolve => {
        if (!isModelTrained) {
            resolve([]);
        } else {
            const filtered = uploadedTickets.filter(
                ticket => ticket.category === category && ticket.priority === priority
            );
            resolve(filtered);
        }
    });
};


export const proposeCsvMapping = async (file: File): Promise<{ headers: string[], mapping: CsvHeaderMapping, rowCount: number }> => {
    // Reset all trained and in-progress data when a new file upload is initiated.
    isModelTrained = false;
    currentTrainingStatus = 'idle';
    trainedKnowledgeBase = [];
    trainedInvertedIndex = null;
    trainedIdfMap = null;
    trainedKpis = null;
    trainedRootCauses = [];
    trainedHeatmapData = [];
    trainedWordCloudDataCache.clear();
    modelAccuracyReport = null;
    rawParsedTickets = [];
    uploadedTickets = [];
    liveSlaTickets = [];
    complexityCache.clear();
    // Restore normalization helpers to their default state
    dynamicCategories = [...DEFAULT_TICKET_CATEGORIES];
    dynamicPriorities = [...DEFAULT_TICKET_PRIORITIES];

    try {
        const { headers, lines } = await parseFileToRows(file);
        const mapping = await getMappingSuggestion(headers);
        return {
            headers,
            mapping,
            rowCount: lines.length - 1
        };
    } catch (error) {
        console.error("Mapping proposal failed", error);
        throw error; // Re-throw to be caught by the component
    }
};

export const uploadKnowledgeBase = async (
  file: File,
  mapping: CsvHeaderMapping
): Promise<{
  report: EdaReport;
  categoryMapping: Record<string, string>;
  rawCategoryCounts: Record<string, number>;
  priorityMapping: Record<string, string>;
  rawPriorityCounts: Record<string, number>;
}> => {
    try {
        const { headers, lines } = await parseFileToRows(file);
        
        const requiredField = 'problem_description';
        if (!mapping[requiredField] || headers.indexOf(mapping[requiredField]!) === -1) {
            throw new Error(`The critical field '${requiredField}' is not mapped to a valid column.`);
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

        const rawCategoryCounts: Record<string, number> = {};
        rawParsedTickets.forEach(ticket => {
            const rawCategory = ticket.category || '';
            if (rawCategory) {
                rawCategoryCounts[rawCategory] = (rawCategoryCounts[rawCategory] || 0) + 1;
            }
        });
        
        const rawPriorityCounts: Record<string, number> = {};
            rawParsedTickets.forEach(ticket => {
            const rawPriority = ticket.priority || '';
            if (rawPriority) {
                rawPriorityCounts[rawPriority] = (rawPriorityCounts[rawPriority] || 0) + 1;
            }
        });

        // USER REQUEST: Do not normalize categories. Create a 1-to-1 mapping instead.
        const uniqueRawCategories = Object.keys(rawCategoryCounts);
        const categoryMapping: Record<string, string> = {};
        if (uniqueRawCategories.length > 0) {
            uniqueRawCategories.forEach(cat => {
                categoryMapping[cat] = cat;
            });
        }

        const uniqueRawPriorities = Object.keys(rawPriorityCounts);
        let priorityMapping: Record<string, string> = {};
        if (uniqueRawPriorities.length > 0) {
            priorityMapping = await getNormalizedMappings(uniqueRawPriorities, dynamicPriorities, 'Priority', 'Medium');
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

        return {
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
            priorityMapping,
            rawPriorityCounts,
        };

    } catch (error) {
        throw error as Error;
    }
};

const calculatePriorityFromSLA = (createdTimeStr?: string, dueTimeStr?: string): string => {
    // p3 is the default/lowest priority
    const defaultPriority = 'p3';

    if (!createdTimeStr || !dueTimeStr) {
        return defaultPriority;
    }
    const created = new Date(createdTimeStr);
    const due = new Date(dueTimeStr);

    if (isNaN(created.getTime()) || isNaN(due.getTime())) {
        return defaultPriority; // Invalid date format
    }

    const diffMs = due.getTime() - created.getTime();

    // If it's already past due or due within an hour, it's highest priority
    if (diffMs <= (60 * 60 * 1000)) {
        return 'p1';
    }
    
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 8) {
        return 'p1';
    } else if (diffHours <= 24) {
        return 'p2';
    } else {
        return 'p3';
    }
};

export const finalizeTicketData = (
    finalCategoryMapping: Record<string, string>,
    finalPriorityMapping: Record<string, string>
): Promise<{ cleanedRowCount: number }> => {
    return new Promise(async (resolve, reject) => {
        uploadedTickets = rawParsedTickets.map((rawTicket, index): SimilarTicket => {
            const calculatedPriority = calculatePriorityFromSLA(rawTicket.created_time, rawTicket.due_by_time);
            return {
                ticket_no: rawTicket.ticket_no || `UPL-${index}`,
                problem_description: rawTicket.problem_description,
                category: finalCategoryMapping[rawTicket.category] || 'Uncategorized',
                priority: calculatedPriority,
                solution_text: rawTicket.solution_text,
                technician: rawTicket.technician,
                request_status: rawTicket.request_status,
                due_by_time: rawTicket.due_by_time,
                created_time: rawTicket.created_time,
                responded_time: rawTicket.responded_time,
                request_type: rawTicket.request_type,
                similarity_score: 1, // Default score, will be recalculated on search
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
    trainedIdfMap = null;
    complexityCache.clear();
    
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
                const priorityWeight: Record<string, number> = { 'p3': 0.1, 'p2': 0.5, 'p1': 1.0 };
                
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
                        let score = priorityWeight[ticket.priority || 'p3'] || 0.1;
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
            let baseTickets: SlaBreachTicket[] = [];
            if (isModelTrained) {
                const highPriorityTickets = uploadedTickets.filter(
                    t => t.priority === 'p1'
                );
                
                const shuffled = highPriorityTickets.sort(() => 0.5 - Math.random());
                const selectedTickets = shuffled.slice(0, 5);
                
                const breachTimes = ['15m', '25m', '35m', '45m', '55m', '1h 10m', '1h 30m'];
                
                baseTickets = selectedTickets.map(ticket => ({
                    ticket_no: ticket.ticket_no,
                    priority: 'Critical',
                    timeToBreach: breachTimes[Math.floor(Math.random() * breachTimes.length)],
                }));
            } else {
                baseTickets = [
                    { ticket_no: 'T-CRIT-001', priority: 'Critical', timeToBreach: '15m' },
                    { ticket_no: 'T-HIGH-045', priority: 'High', timeToBreach: '35m' },
                    { ticket_no: 'T-HIGH-048', priority: 'High', timeToBreach: '55m' },
                    { ticket_no: 'T-CRIT-002', priority: 'Critical', timeToBreach: '1h 10m' },
                ];
            }
            const allTickets = [...liveSlaTickets, ...baseTickets];
            const uniqueTickets = Array.from(new Map(allTickets.map(t => [t.ticket_no, t])).values());
            resolve(uniqueTickets);
        }, 950);
    });
};

export const getSlaRiskTickets = async (): Promise<SlaRiskTicket[]> => {
    if (!isModelTrained || uploadedTickets.length === 0) {
        return [];
    }

    const openTickets = uploadedTickets.filter(t => t.request_status && !['Resolved', 'Closed'].includes(t.request_status));

    const now = new Date();
    
    // Calculate time remaining for all open tickets with a due date
    const ticketsWithTime = openTickets.map(ticket => {
        if (!ticket.due_by_time) return null;
        const dueDate = new Date(ticket.due_by_time);
        if (isNaN(dueDate.getTime())) return null; // Invalid date
        const diffMs = dueDate.getTime() - now.getTime();
        return { ticket, diffMs };
    }).filter(item => item !== null);

    // Sort by soonest due date to prioritize analysis
    ticketsWithTime.sort((a, b) => a!.diffMs - b!.diffMs);

    // Get complexity scores for the top 20 most urgent tickets, sequentially to avoid rate limits.
    const urgentTickets = ticketsWithTime.slice(0, 20);
    for (const item of urgentTickets) {
        if (!item) continue;
        const { ticket } = item;
        if (complexityCache.has(ticket.ticket_no)) {
            continue; // Already cached
        }
        try {
            const score = await getComplexityScore(ticket.problem_description);
            complexityCache.set(ticket.ticket_no, score);
            // Add a small delay between API calls to respect rate limits.
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`Failed to get complexity for ${ticket.ticket_no}`, error);
            complexityCache.set(ticket.ticket_no, 5); // Default on error
        }
    }

    const riskTickets = ticketsWithTime.map(item => {
        if (!item) return null;
        const { ticket, diffMs } = item;
        
        // Time factor (0 to 1): 1 if overdue, decreasing as time increases. Maxes out at 7 days.
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const timeFactor = 1 - Math.min(Math.max(0, diffMs), sevenDaysMs) / sevenDaysMs;

        // Complexity factor (0 to 1)
        const complexity = complexityCache.get(ticket.ticket_no) || 5; // Default to medium complexity
        const complexityFactor = complexity / 10;
        
        // Combined risk score
        const riskScore = (timeFactor * 0.7) + (complexityFactor * 0.3);

        // Format timeRemaining string
        const minutes = Math.floor(Math.abs(diffMs) / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        let timeRemaining = '';
        if (days > 0) timeRemaining = `${days}d ${hours % 24}h`;
        else if (hours > 0) timeRemaining = `${hours}h ${minutes % 60}m`;
        else timeRemaining = `${minutes}m`;
        
        if (diffMs < 0) timeRemaining = `-${timeRemaining}`;

        return {
            ticket_no: ticket.ticket_no,
            problem_snippet: ticket.problem_description.substring(0, 70) + '...',
            technician: ticket.technician || 'Unassigned',
            timeRemaining,
            riskScore,
        };
    }).filter(item => item !== null) as SlaRiskTicket[];
    
    // Sort by final risk score and return top results
    return riskTickets.sort((a, b) => b.riskScore - a.riskScore).slice(0, 8);
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

// --- FIX: ADD MISSING ANALYTICS API FUNCTIONS ---
export const getTechnicianWorkload = (): Promise<TechnicianWorkloadData[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained && uploadedTickets.length > 0) {
                const workload: Record<string, number> = {};
                
                uploadedTickets.forEach((ticket) => {
                    const technician = ticket.technician || 'Unassigned';
                    if (technician && technician.trim() !== '' && technician !== 'Not Assigned') {
                         workload[technician] = (workload[technician] || 0) + 1;
                    }
                });

                const data = Object.entries(workload)
                    .map(([name, tickets]) => ({ name, tickets }))
                    .sort((a, b) => b.tickets - a.tickets)
                    .slice(0, 10); // show top 10
                resolve(data);

            } else {
                // Mock data
                resolve([
                    { name: 'Alice', tickets: 25 },
                    { name: 'Bob', tickets: 18 },
                    { name: 'Charlie', tickets: 32 },
                    { name: 'Diana', tickets: 15 },
                    { name: 'Eve', tickets: 28 },
                ]);
            }
        }, 700);
    });
};

export const getTicketStatusDistribution = (): Promise<TicketStatusData[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
             if (isModelTrained && uploadedTickets.length > 0) {
                const statusCounts: Record<string, number> = {};
                
                uploadedTickets.forEach((ticket) => {
                    const status = ticket.request_status || 'Unknown';
                     if (status && status.trim() !== '') {
                        statusCounts[status] = (statusCounts[status] || 0) + 1;
                    }
                });

                const data = Object.entries(statusCounts)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value);
                resolve(data);
             } else {
                resolve([
                    { name: 'Open', value: 85 },
                    { name: 'In Progress', value: 42 },
                    { name: 'Resolved', value: 250 },
                    { name: 'Closed', value: 600 },
                    { name: 'Pending', value: 25 },
                ]);
             }
        }, 600);
    });
};

export const getAvgResolutionTimeByCategory = (): Promise<AvgResolutionTimeData[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (isModelTrained && dynamicCategories.length > 0) {
                const data = dynamicCategories.map(category => {
                    let baseHours = 4; // default
                    if (category.toLowerCase().includes('hardware')) baseHours = 8;
                    if (category.toLowerCase().includes('database')) baseHours = 12;
                    if (category.toLowerCase().includes('account')) baseHours = 1;
                    if (category.toLowerCase().includes('network')) baseHours = 6;
                    
                    return {
                        name: category,
                        'Avg Hours': parseFloat((baseHours + (Math.random() * 4 - 2)).toFixed(1)) // Add some jitter
                    };
                });
                resolve(data);
            } else {
                resolve([
                    { name: 'Software', 'Avg Hours': 4.5 },
                    { name: 'Hardware', 'Avg Hours': 8.2 },
                    { name: 'Network', 'Avg Hours': 6.1 },
                    { name: 'Account Management', 'Avg Hours': 1.8 },
                    { name: 'Database', 'Avg Hours': 12.5 },
                ]);
            }
        }, 850);
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