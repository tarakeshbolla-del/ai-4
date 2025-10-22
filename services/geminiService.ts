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
 * Normalizes raw values from a CSV.
 * - For 'Priority', it uses a keyword-based heuristic.
 * - For 'Category', it cleans the string by removing special characters.
 * - For other fields, it uses the Gemini API to map to standard values.
 */
export async function getNormalizedMappings(
  rawValues: string[],
  standardValues: string[],
  fieldName: string,
  defaultValue: string
): Promise<Record<string, string>> {

  // Heuristic-based normalization for ticket priorities.
  if (fieldName === 'Priority') {
    const mapping: Record<string, string> = {};

    const highPriorityKeywords = ['critical', 'urgent', 'highest', 'high', 'immediate', 'p1'];
    const mediumPriorityKeywords = ['medium', 'moderate', 'p2', 'normal'];
    // Low ('p3') is the default for anything not matching high or medium keywords.

    rawValues.forEach(rawValue => {
      const lowerRawValue = rawValue.toLowerCase();
      const numericMatch = lowerRawValue.match(/\d+/);
      const num = numericMatch ? parseInt(numericMatch[0], 10) : null;

      // Use RegExp with word boundaries (\b) to match whole words and avoid partial matches.
      if (highPriorityKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(lowerRawValue)) || num === 1) {
        mapping[rawValue] = 'p1';
      } else if (mediumPriorityKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(lowerRawValue)) || num === 2) {
        mapping[rawValue] = 'p2';
      } else {
        mapping[rawValue] = 'p3'; // Default to Low
      }
    });

    return mapping;
  }

  // Simple string cleaning for categories, as requested by the user.
  if (fieldName === 'Category') {
    const mapping: Record<string, string> = {};
    rawValues.forEach(rawValue => {
      // Eliminate special characters, keeping only alphanumeric characters and whitespace.
      const cleanedValue = rawValue
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      mapping[rawValue] = cleanedValue || defaultValue;
    });
    return mapping;
  }

  // Fallback to Gemini for any other field needing normalization.
  const prompt = `
    You are an intelligent data cleaning assistant for an IT service management system.
    Your task is to normalize a list of raw ${fieldName} values into a standard set of values.

    Standard ${fieldName}s:
    ${standardValues.join(', ')}

    Raw ${fieldName}s (input):
    ${rawValues.join(', ')}

    Analyze the raw values and map each one to the most appropriate standard value.
    If a raw value does not clearly fit any standard value, map it to "${defaultValue}".
    Your output MUST be a valid JSON object in the format {"rawValue1": "standardValue1", "rawValue2": "standardValue2", ...}.
    Provide only the JSON object in your response, with no other text, comments, or markdown formatting.
    Ensure every single raw value from the input list is included as a key in the final JSON object.
  `;
  
  try {
    const response = await geminiApiCallWithRetry<GenerateContentResponse>(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      })
    );

    // The response.text should be a JSON string.
    let parsedJson: Record<string, string>;
    try {
        // The API might return the JSON wrapped in markdown ```json ... ```
        const jsonString = response.text.replace(/^```json\s*|```\s*$/g, '').trim();
        parsedJson = JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse Gemini JSON response for normalization:", e);
        console.error("Raw response:", response.text);
        throw new Error("Invalid JSON response from AI for normalization.");
    }
    
    // Safety check: ensure all raw values are mapped and values are standard.
    const finalMapping: Record<string, string> = {};
    rawValues.forEach(rawValue => {
      if (parsedJson[rawValue] && standardValues.includes(parsedJson[rawValue])) {
        finalMapping[rawValue] = parsedJson[rawValue];
      } else if (parsedJson[rawValue]) {
        console.warn(`Gemini returned a non-standard value '${parsedJson[rawValue]}' for '${rawValue}'. Mapping to default value '${defaultValue}'.`);
        finalMapping[rawValue] = defaultValue;
      }
      else {
        // Model missed a raw value, map to default.
        finalMapping[rawValue] = defaultValue;
      }
    });

    return finalMapping;

  } catch (error) {
    console.error(`Error calling Gemini for ${fieldName} normalization:`, error);
    // On error, fall back to 1-to-1 mapping to let the user see their original values.
    console.warn(`Falling back to 1-to-1 mapping for ${fieldName} due to an API error.`);
    const fallbackMapping: Record<string, string> = {};
    rawValues.forEach(value => {
      fallbackMapping[value] = value;
    });
    return fallbackMapping;
  }
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