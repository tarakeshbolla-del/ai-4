
import type { AnalysisResultData, Kpis, RootCauseData, HeatmapDataPoint, SimilarTicket, EdaReport, TrainingStatus, SunburstNode, SentimentData } from '../types';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../constants';

// --- MOCK DATABASE ---
let kpis: Kpis = {
  deflectionRate: 78.5,
  avgTimeToResolution: 4.2,
  firstContactResolution: 92.1,
};

const mockSimilarTickets: SimilarTicket[] = [
    { ticket_no: 'T001', problem_description: 'Cannot login to VPN, password reset link not working.', solution_text: 'The VPN uses a separate directory. Please reset your password at vpn.company.com/reset.', similarity_score: 0.95 },
    { ticket_no: 'T002', problem_description: 'Login password for my computer is not being accepted after I changed it.', solution_text: 'Ensure you are connected to the office network or VPN for the new password to sync. If issue persists, contact IT.', similarity_score: 0.88 },
    { ticket_no: 'T003', problem_description: 'I am unable to access the sales dashboard, it says "access denied".', solution_text: 'Access to the sales dashboard requires approval from your manager. Please submit an access request ticket.', similarity_score: 0.85 },
];

const mockAiSuggestion = `
### Step-by-Step Solution:

It appears you are having trouble with your VPN password, which is different from your main company login. Here is a suggested course of action:

1.  **Navigate to the Correct Portal**: Open your web browser and go to \`vpn.company.com/reset\`.
2.  **Enter Your Username**: Use your standard company email address as the username.
3.  **Follow Password Reset Prompts**: The system will send a password reset link to your email. Follow the instructions in the email to set a new password.
4.  **Reconnect to VPN**: Use your new password to connect to the VPN client.

If you still face issues, please confirm you are using the correct VPN client software as specified in the IT knowledge base.
`;

// --- SIMULATED API FUNCTIONS ---

export const analyzeIssue = (formData: FormData): Promise<AnalysisResultData> => {
  console.log('API: Analyzing issue...', {
    description: formData.get('description'),
    category: formData.get('category'),
    priority: formData.get('priority'),
    screenshot: formData.get('screenshot'),
  });
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        predictedModule: formData.get('category') as string || 'Network',
        predictedPriority: formData.get('priority') as string || 'High',
        similarIssues: mockSimilarTickets,
        aiSuggestion: mockAiSuggestion,
      });
    }, 2500);
  });
};

export const getSimilarIssues = (query: string): Promise<SimilarTicket[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (query.length < 10) {
                resolve([]);
                return;
            }
            const filtered = mockSimilarTickets.filter(t => t.problem_description.toLowerCase().includes(query.toLowerCase().slice(0, 15)));
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
