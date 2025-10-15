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

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Helper function to filter tickets based on a query string
const filterSimilarTickets = (query: string): SimilarTicket[] => {
    const queryWords = query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3);

    if (queryWords.length === 0) {
        return [];
    }

    const filtered = mockSimilarTickets.filter(ticket => {
        const ticketText = ticket.problem_description.toLowerCase();
        return queryWords.some(word => ticketText.includes(word));
    });

    return filtered;
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