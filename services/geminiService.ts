import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// IMPORTANT: In a real application, the API key would be managed securely on a backend server,
// and this service would make requests to that server instead of directly to the Gemini API.
// For this application, we assume the API key is provided via environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * A wrapper for Gemini API calls that implements retry logic with exponential backoff
 * for rate limit errors (429).
 */
const geminiApiCallWithRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await apiCall();
    } catch (error: any) {
      attempt++;
      // Check for rate limit error indicators in the error message.
      const errorMessage = (error?.message || error?.toString() || '').toLowerCase();
      if ((errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('resource_exhausted')) && attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; 
        console.warn(`Gemini API rate limit exceeded. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // For non-retriable errors or after max retries, re-throw.
        throw error;
      }
    }
  }
};


/**
 * Generates a solution suggestion using the Gemini model.
 */
export async function getAiSuggestion(
  description: string,
  category?: string,
  priority?: string,
  screenshotBase64?: string
): Promise<string> {
  const prompt = `
    A user is experiencing the following IT issue.
    Description: "${description}"
    ${category ? `Category: "${category}"` : ''}
    ${priority ? `Priority: "${priority}"` : ''}

    Based on this information and potential context from the attached screenshot, provide a clear, step-by-step solution for the user.
    If a screenshot is provided, analyze it carefully as the primary source of information. For example, if it shows an error message, identify the exact error and provide a specific solution. If it shows a user interface, describe what the user should do in that interface. The text description might be minimal, so rely heavily on the image if it exists.
    Format the solution in Markdown. Assume the user has basic technical knowledge.
  `;

  try {
    const parts: any[] = [{ text: prompt }];
    if (screenshotBase64 && screenshotBase64.startsWith('data:image/')) {
        const [meta, data] = screenshotBase64.split(',');
        const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
        parts.push({
            inlineData: {
                mimeType,
                data
            }
        });
    }

    const response = await geminiApiCallWithRetry<GenerateContentResponse>(() => 
        ai.models.generateContent({
            model: 'gemini-2.5-flash', // This model supports multimodal input
            contents: { parts },
        })
    );
    
    return response.text;
    
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "I am sorry, but I was unable to generate a suggestion at this time. Please check your API key configuration and try again. If the problem persists, please proceed with creating a support ticket.";
  }
}

/**
 * Uses a heuristic to suggest a mapping from user CSV headers to required fields.
 */
export async function getMappingSuggestion(userHeaders: string[]): Promise<Record<string, string | null>> {
    const requiredFields = ['ticket_no', 'problem_description', 'category', 'solution_text', 'technician', 'request_status', 'due_by_time', 'created_time', 'responded_time', 'request_type'];
    
    // Heuristic-based mapping as requested to avoid Gemini API calls.
    const heuristicMapping: Record<string, string | null> = {};
    const lowerUserHeaders = userHeaders.map(h => h.toLowerCase().replace(/_/g, ' ')); // Normalize headers for better matching
    
    requiredFields.forEach(field => {
        const fieldSynonyms: Record<string, string[]> = {
            ticket_no: ['ticket no', 'ticket id', 'request id', 'id', 'number', 'ref'],
            problem_description: ['problem description', 'description', 'desc', 'summary', 'subject', 'issue', 'text'],
            category: ['category', 'module', 'area'],
            solution_text: ['solution text', 'solution', 'resolution', 'fix'],
            technician: ['technician', 'agent', 'owner', 'assigned to'],
            request_status: ['request status', 'status'],
            due_by_time: ['dueby time', 'due by', 'due date', 'sla'],
            created_time: ['created time', 'created date', 'created'],
            responded_time: ['responded time', 'responded date', 'responded'],
            request_type: ['request type', 'type'],
        };

        let foundHeader: string | null = null;
        for (const synonym of fieldSynonyms[field] || [field.replace(/_/g, ' ')]) {
            // Prefer exact match first, then partial match
            const exactMatchIndex = lowerUserHeaders.findIndex(h => h === synonym);
            if (exactMatchIndex !== -1) {
                foundHeader = userHeaders[exactMatchIndex];
                break;
            }
            const partialMatchIndex = lowerUserHeaders.findIndex(h => h.includes(synonym));
            if (partialMatchIndex !== -1) {
                foundHeader = userHeaders[partialMatchIndex];
                break;
            }
        }
        heuristicMapping[field] = foundHeader;
    });

    return heuristicMapping;
}

/**
 * Performs a simple 1-to-1 mapping for raw values without calling an API.
 */
export async function getNormalizedMappings(
  rawValues: string[],
  standardValues: string[],
  fieldName: string,
  defaultValue: string
): Promise<Record<string, string>> {
  // As requested, this function now performs a simple 1-to-1 mapping
  // without calling the Gemini API to avoid rate limiting.
  const oneToOneMapping: Record<string, string> = {};
  rawValues.forEach(value => {
    oneToOneMapping[value] = value;
  });
  return oneToOneMapping;
}


/**
 * Generates relevant keywords from ticket descriptions using simple text parsing.
 */
export async function generateKeywords(ticketDescriptions: string[], category: string): Promise<{ word: string; value: number }[]> {
  // Using simple text parsing as requested to avoid Gemini API calls.
  const stopWords = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'who', 'will', 'with', 'the', 'my', 'issue', 'problem', 'error', 'not', 'working', 'cannot', 'unable', 'access', 'please', 'help'
  ]);

  const words = ticketDescriptions
    .flatMap(d => d.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/))
    .filter(word => word.length > 3 && !/^\d+$/.test(word) && !stopWords.has(word));

  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([word, value]) => ({ word, value }));
}

/**
 * Uses a heuristic to get an estimated complexity score for a ticket.
 */
export async function getComplexityScore(description: string): Promise<number> {
    // Using a simple length-based heuristic as requested to avoid Gemini API calls.
    const len = description.length;
    if (len < 50) return 2;
    if (len < 150) return 4;
    if (len < 300) return 6;
    return 8;
}