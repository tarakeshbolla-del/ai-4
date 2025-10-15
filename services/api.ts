
import type { AnalysisResultData, Kpis, RootCauseData, HeatmapDataPoint, SimilarTicket, EdaReport, TrainingStatus, SunburstNode, SentimentData, PredictiveHotspot, SlaBreachTicket, TicketVolumeForecastDataPoint } from '../types';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../constants';
import { getAiSuggestion } from '../services/geminiService';

// --- MOCK DATABASE ---
let kpis: Kpis = {
  deflectionRate: 78.5,
  avgTimeToResolution: 4.2,
  firstContactResolution: 92.1,
};

const mockSimilarTickets: SimilarTicket[] = [
    { ticket_no: 'T001', problem_description: 'Cannot login to VPN, password reset link not working.', solution_text: 'The VPN uses a separate directory. Please reset your password at vpn.company.com/reset.', similarity_score: 0.95, category: 'Network' },
    { ticket_no: 'T002', problem_description: 'Login password for my computer is not being accepted after I changed it.', solution_text: 'Ensure you are connected to the office network or VPN for the new password to sync. If issue persists, contact IT.', similarity_score: 0.88, category: 'Account Management' },
    { ticket_no: 'T003', problem_description: 'I am unable to access the sales dashboard, it says "access denied".', solution_text: 'Access to the sales dashboard requires approval from your manager. Please submit an access request ticket.', similarity_score: 0.85, category: 'Software' },
];

// This represents the knowledge base after the model has been "trained"
const trainedKnowledgeBase: SimilarTicket[] = [
    // Account Management
    { ticket_no: 'KB001', problem_description: 'User forgot their password and is locked out of their account.', solution_text: 'Use the "Forgot Password" link on the login page. An email will be sent with reset instructions.', similarity_score: 0.9, category: 'Account Management' },
    { ticket_no: 'KB002', problem_description: 'Two-factor authentication (2FA) code is not being received.', solution_text: 'Check your spam folder. If not there, try restarting your phone. If it persists, ask IT to re-sync your 2FA token.', similarity_score: 0.9, category: 'Account Management' },
    { ticket_no: 'KB003', problem_description: 'Account is locked after too many failed login attempts.', solution_text: 'The account will automatically unlock after 30 minutes. Alternatively, you can reset your password to unlock it immediately.', similarity_score: 0.9, category: 'Account Management' },

    // Software
    { ticket_no: 'KB004', problem_description: 'Error message "MSVCP140.dll was not found" when starting Adobe Photoshop.', solution_text: 'This error indicates a missing Microsoft Visual C++ Redistributable. Please download and install it from the Microsoft website.', similarity_score: 0.9, category: 'Software' },
    { ticket_no: 'KB005', problem_description: 'Microsoft Excel is running very slow and freezes frequently.', solution_text: 'Disable unnecessary add-ins via File > Options > Add-ins. Also, check for large pivot tables or conditional formatting rules that may be slowing it down.', similarity_score: 0.9, category: 'Software' },
    { ticket_no: 'KB006', problem_description: 'Cannot access shared folder, permission denied error.', solution_text: 'This requires access rights. Please create a new ticket requesting access to the specific shared folder, including approval from your manager.', similarity_score: 0.9, category: 'Software' },
    { ticket_no: 'KB007', problem_description: 'Salesforce is not loading, stuck on the login screen.', solution_text: 'Clear your browser cache and cookies. Try an incognito window. If the issue remains, check the Salesforce status page for outages.', similarity_score: 0.9, category: 'Software' },

    // Hardware
    { ticket_no: 'KB008', problem_description: 'My laptop battery is draining very quickly.', solution_text: 'Check for power-hungry applications in Task Manager. Lower screen brightness and ensure the power plan is set to "Balanced" or "Power Saver".', similarity_score: 0.9, category: 'Hardware' },
    { ticket_no: 'KB009', problem_description: 'External monitor is not detected by my laptop.', solution_text: 'Ensure the HDMI/DisplayPort cable is securely connected on both ends. Try updating your graphics drivers from the manufacturer\'s website.', similarity_score: 0.9, category: 'Hardware' },
    { ticket_no: 'KB010', problem_description: 'The printer is offline and I cannot print.', solution_text: 'Check if the printer is powered on and connected to the network. Restart the printer. If it is a network printer, ensure you are on the correct Wi-Fi or VPN.', similarity_score: 0.9, category: 'Hardware' },

    // Network
    { ticket_no: 'KB011', problem_description: 'The office Wi-Fi connection is very slow and unstable.', solution_text: 'Try moving closer to a wireless access point. Disconnect and reconnect to the network. If possible, use a wired Ethernet connection for better stability.', similarity_score: 0.9, category: 'Network' },
    { ticket_no: 'KB012', problem_description: 'VPN client fails to connect with a "certificate validation failure" error.', solution_text: 'This usually means the VPN client certificate has expired. Please run the "Update VPN Certificate" utility from the software center.', similarity_score: 0.9, category: 'Network' },
    { ticket_no: 'KB013', problem_description: 'Cannot access internal websites, getting a DNS error.', solution_text: 'Disconnect from the VPN and reconnect to refresh your network settings. If that fails, try flushing your DNS cache by opening Command Prompt and running `ipconfig /flushdns`.', similarity_score: 0.9, category: 'Network' },
    
    // Database
    { ticket_no: 'KB014', problem_description: 'Getting a "connection timeout" error when trying to connect to the SQL database.', solution_text: 'Verify the database server name and port are correct. Check if there is a firewall blocking the connection. Ensure you are on the company VPN if accessing remotely.', similarity_score: 0.9, category: 'Database' },
    { ticket_no: 'KB015', problem_description: 'My SQL query is running extremely slow.', solution_text: 'Analyze the query execution plan to identify bottlenecks. Ensure tables are properly indexed, especially on columns used in WHERE clauses and JOINs.', similarity_score: 0.9, category: 'Database' },
];

let isModelTrained = false;

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

// Helper function to find similar tickets with a more accurate scoring model
const filterSimilarTickets = (query: string): SimilarTicket[] => {
    const dataSource = isModelTrained ? trainedKnowledgeBase : mockSimilarTickets;
    console.log(`[API] Searching for similar tickets. Model trained: ${isModelTrained}. Datasource size: ${dataSource.length}`);
    
    const queryTokens = query
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));

    if (queryTokens.length === 0) {
        return [];
    }
    
    const scoredTickets = dataSource.map(ticket => {
        const ticketText = ` ${ticket.problem_description.toLowerCase().replace(/[^\w\s]/g, '')} `;
        let score = 0;

        // 1. Keyword matching score
        queryTokens.forEach(token => {
            const regex = new RegExp(`\\s${token}\\s`, 'g'); // match whole word
            const matches = ticketText.match(regex);
            if (matches) {
                score += matches.length * 15; // Higher score for multiple whole-word occurrences
            } else if (ticketText.includes(token)) {
                 score += 5; // Lower score for partial match
            }
        });
        
        // 2. Phrase matching score (bigrams)
        for (let i = 0; i < queryTokens.length - 1; i++) {
            const bigram = `${queryTokens[i]} ${queryTokens[i+1]}`;
            if (ticketText.includes(bigram)) {
                score += 30; // Significant bonus for matching a phrase
            }
        }

        // 3. Category matching boost
        const ticketCategory = ticket.category?.toLowerCase();
        if (ticketCategory && queryTokens.some(token => ticketCategory.includes(token))) {
            score += 40; // High score for matching a keyword in category
        }
        
        // 4. Exact match boost on category from query
        const queryCategoryMatch = TICKET_CATEGORIES.find(cat => query.toLowerCase().includes(cat.toLowerCase()));
        if(queryCategoryMatch && ticket.category?.toLowerCase() === queryCategoryMatch.toLowerCase()){
            score += 50; // Very high score for explicit category match
        }


        return { ...ticket, similarity_score: score };
    });

    return scoredTickets
        .filter(ticket => ticket.similarity_score > 10) // Increase threshold to reduce noise
        .sort((a, b) => b.similarity_score - a.similarity_score);
};


// --- SIMULATED API FUNCTIONS ---

export const analyzeIssue = async (formData: FormData): Promise<AnalysisResultData> => {
  console.log('API: Analyzing issue...', {
    description: formData.get('description'),
    category: formData.get('category'),
    priority: formData.get('priority'),
    screenshot: formData.get('screenshot'),
  });

  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const priority = formData.get('priority') as string;
  const screenshotFile = formData.get('screenshot') as File | null;

  let screenshotBase64: string | undefined = undefined;
  if (screenshotFile) {
    try {
      screenshotBase64 = await fileToBase64(screenshotFile);
    } catch (error) {
      console.error("Failed to convert file to base64", error);
    }
  }

  // Get the AI suggestion, which will now use the screenshot if provided.
  const aiSuggestion = await getAiSuggestion(description, category, priority, screenshotBase64);
  
  // Use the shared filtering logic to find relevant issues
  const relevantSimilarIssues = filterSimilarTickets(description);

  // Return a combined result with other mock data.
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
            // Use the shared filtering logic for the live search
            const filtered = filterSimilarTickets(query);
            resolve(filtered.slice(0, 2));
        }, 500);
    });
};

export const submitFeedback = (feedback: 'positive' | 'negative'): Promise<{ status: 'ok' }> => {
    console.log('API: Received feedback', feedback);
    if (feedback === 'positive') {
        kpis.deflectionRate = Math.min(100, kpis.deflectionRate + 0.1);
    }
    // Simulate other KPI changes
    kpis.avgTimeToResolution = Math.max(1, kpis.avgTimeToResolution - 0.05);
    kpis.firstContactResolution = Math.min(100, kpis.firstContactResolution + 0.02);
    return new Promise(resolve => setTimeout(() => resolve({ status: 'ok' }), 300));
}

// --- ADMIN API FUNCTIONS ---

export const getInitialDashboardData = (): Promise<{ kpis: Kpis; rootCauses: RootCauseData[]; heatmap: HeatmapDataPoint[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                kpis,
                rootCauses: [
                    { name: 'Password Resets', tickets: 450 },
                    { name: 'VPN Connectivity', tickets: 320 },
                    { name: 'Software Access', tickets: 210 },
                    { name: 'Printer Issues', tickets: 150 },
                    { name: 'Hardware Failure', tickets: 80 },
                    { name: 'Other', tickets: 190 },
                ],
                heatmap: TICKET_CATEGORIES.flatMap(cat => 
                    TICKET_PRIORITIES.map(pri => ({
                        category: cat,
                        priority: pri,
                        value: Math.floor(Math.random() * 100)
                    }))
                ),
            });
        }, 1000);
    });
};

export const getWordCloudData = (category: string): Promise<{ word: string, value: number }[]> => {
    console.log(`API: Fetching word cloud data for ${category}`);
    const words: Record<string, string[]> = {
        'Password Resets': ['login', 'password', 'reset', 'account', 'locked', 'expired', 'forgot'],
        'VPN Connectivity': ['vpn', 'connect', 'disconnect', 'slow', 'error', 'timeout', 'certificate'],
        'Software Access': ['access', 'denied', 'permission', 'request', 'salesforce', 'jira', 'dashboard'],
        'Printer Issues': ['printer', 'offline', 'jammed', 'toner', 'driver', 'network', 'scan'],
        'Hardware Failure': ['laptop', 'monitor', 'keyboard', 'mouse', 'broken', 'not working', 'blue screen'],
        'Other': ['issue', 'problem', 'help', 'email', 'system', 'slow', 'error'],
    };
    return new Promise(resolve => {
        setTimeout(() => {
            resolve((words[category] || words['Other']).map(word => ({
                word,
                value: Math.floor(Math.random() * 50) + 10
            })));
        }, 700);
    });
};

export const uploadKnowledgeBase = (file: File): Promise<EdaReport> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                fileName: file.name,
                fileSize: file.size,
                rowCount: 15432,
                columns: [
                    { name: 'ticket_no', type: 'string', missing: 0 },
                    { name: 'date', type: 'datetime', missing: 5 },
                    { name: 'problem_description', type: 'string', missing: 12 },
                    { name: 'category', type: 'categorical', missing: 0 },
                    { name: 'priority', type: 'categorical', missing: 0 },
                    { name: 'solution_text', type: 'string', missing: 88 },
                ],
                categoryDistribution: [
                    { name: 'Software', value: 6210 },
                    { name: 'Network', value: 4321 },
                    { name: 'Hardware', value: 2100 },
                    { name: 'Account Management', value: 1801 },
                    { name: 'Database', value: 1000 },
                ],
            });
        }, 2000);
    });
};

let currentTrainingStatus: TrainingStatus = 'idle';
export const initiateTraining = (): Promise<{ status: 'ok' }> => {
    currentTrainingStatus = 'in_progress';
    setTimeout(() => {
        currentTrainingStatus = 'completed';
        isModelTrained = true; // Set the flag here
        console.log('[API] Model training complete. Knowledge base updated.');
    }, 20000); // 20 seconds to simulate training
    return new Promise(resolve => setTimeout(() => resolve({ status: 'ok' }), 200));
}

export const getTrainingStatus = (): Promise<{ status: TrainingStatus }> => {
    return new Promise(resolve => setTimeout(() => resolve({ status: currentTrainingStatus }), 300));
}

export const getProblemClusterData = (): Promise<{ data: SunburstNode | null, error?: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            // Simulate insufficient data case
            // resolve({ data: null, error: 'insufficient_data' });

            // Simulate success case
            resolve({
                data: {
                    name: "root",
                    children: [
                        {
                            name: "Network",
                            children: [
                                { name: "VPN", value: 450 },
                                { name: "Wi-Fi", value: 300 },
                                { name: "Firewall", value: 150 },
                            ],
                        },
                        {
                            name: "Software",
                            children: [
                                { name: "CRM", children: [{name: "Login", value: 200}, {name: "Reports", value: 150}] },
                                { name: "Email", value: 400 },
                            ],
                        },
                         { name: "Hardware", value: 250 },
                    ],
                }
            });
        }, 1500);
    });
};

export const getUserFrustrationData = (): Promise<SentimentData> => {
     return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                data: [0.3, 0.35, 0.32, 0.4, 0.45, 0.41, 0.5, 0.48],
            });
        }, 1200);
    });
};

export const getPredictiveHotspots = (): Promise<PredictiveHotspot[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([
                { name: 'CRM System', riskScore: 0.85, trending: 'up' },
                { name: 'VPN Service', riskScore: 0.65, trending: 'up' },
                { name: 'Email Server', riskScore: 0.40, trending: 'stable' },
            ]);
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
            
            // Last 4 days (actual)
            for (let i = 4; i > 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                data.push({
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    actual: Math.floor(Math.random() * 50) + 180, // 180-230
                });
            }

            // Today (actual) + start of forecast
            const todayActual = Math.floor(Math.random() * 50) + 190;
            data.push({
                day: 'Today',
                actual: todayActual,
                forecast: todayActual, // Forecast starts from today's actual
            });

            // Next 6 days (forecast)
            let lastForecast = todayActual;
            for (let i = 1; i <= 6; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                 lastForecast = lastForecast + (Math.random() * 20 - 10); // Fluctuate
                data.push({
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    forecast: Math.max(150, Math.floor(lastForecast)), // ensure not negative
                });
            }
            
            resolve(data);
        }, 800);
    });
};
