import { GoogleGenAI, Type } from "@google/genai";

// IMPORTANT: In a real application, the API key would be managed securely on a backend server,
// and this service would make requests to that server instead of directly to the Gemini API.
// For this application, we assume the API key is provided via environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


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

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // This model supports multimodal input
        contents: { parts },
    });
    
    return response.text;
    
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "I am sorry, but I was unable to generate a suggestion at this time. Please check your API key configuration and try again. If the problem persists, please proceed with creating a support ticket.";
  }
}

/**
 * Uses Gemini to suggest a mapping from user CSV headers to required fields.
 */
export async function getMappingSuggestion(userHeaders: string[]): Promise<Record<string, string | null>> {
    const requiredFields = ['ticket_no', 'problem_description', 'category', 'priority', 'solution_text', 'technician', 'request_status', 'due_by_time', 'created_time', 'responded_time', 'request_type'];
    
    const prompt = `
        Analyze the following list of CSV headers and map them to a predefined set of required fields.
        
        CSV Headers: ${JSON.stringify(userHeaders)}
        
        Required Fields: ${JSON.stringify(requiredFields)}
        
        Instructions:
        1. For each required field, find the best matching header from the user's CSV list.
        2. The 'problem_description' field is the most critical. It usually contains long text about the user's issue. Common names are 'description', 'subject', 'summary', 'issue'.
        3. 'request_status' is the current state of the ticket (e.g., 'Resolved', 'On-hold'). Match to headers like 'status' or 'request status'.
        4. 'due_by_time' is the final deadline for the ticket. Match to headers like 'DueBy Time' or 'SLA'.
        5. 'created_time' is when the ticket was created. Match to 'Created Time'.
        6. 'responded_time' is when a technician responded. Match to 'Responded Date'.
        7. 'technician' is the name of the assigned support person.
        8. If a reasonable match for a field cannot be found, the value for that field should be null.
        9. Return the mapping as a JSON object.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            ticket_no: { type: Type.STRING, nullable: true, description: "The header for a ticket ID. Null if not found." },
            problem_description: { type: Type.STRING, nullable: true, description: "The header for the main issue description. Null if not found." },
            category: { type: Type.STRING, nullable: true, description: "The header for the issue category. Null if not found." },
            priority: { type: Type.STRING, nullable: true, description: "The header for the issue priority. Null if not found." },
            solution_text: { type: Type.STRING, nullable: true, description: "The header for the ticket's solution. Null if not found." },
            technician: { type: Type.STRING, nullable: true, description: "The header for the assigned technician's name. Null if not found." },
            request_status: { type: Type.STRING, nullable: true, description: "The header for the ticket's current status. Null if not found." },
            due_by_time: { type: Type.STRING, nullable: true, description: "The header for the ticket's SLA due date/time. Null if not found." },
            created_time: { type: Type.STRING, nullable: true, description: "The header for when the ticket was created. Null if not found." },
            responded_time: { type: Type.STRING, nullable: true, description: "The header for when a technician responded. Null if not found." },
            request_type: { type: Type.STRING, nullable: true, description: "The header for the type of request. Null if not found." },
        },
    };
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonString = response.text.trim();
        const mapping = JSON.parse(jsonString);
        
        // Validate that the returned mapping values are actual user headers or null
        const validHeaders = new Set(userHeaders);
        for (const key in mapping) {
            if (mapping[key] !== null && !validHeaders.has(mapping[key])) {
                mapping[key] = null; // Invalidate if Gemini hallucinates a header
            }
        }
        return mapping;

    } catch (error) {
        console.error("Error calling Gemini API for mapping:", error);
        // Fallback to a simple heuristic if API fails
        const heuristicMapping: Record<string, string | null> = {};
        const lowerUserHeaders = userHeaders.map(h => h.toLowerCase());
        requiredFields.forEach(field => {
            const fieldSynonyms: Record<string, string[]> = {
                ticket_no: ['ticket', 'id', 'number', 'ref'],
                problem_description: ['problem', 'description', 'desc', 'summary', 'subject', 'issue', 'text'],
                category: ['category', 'module', 'area'],
                priority: ['priority', 'urgency', 'level'],
                solution_text: ['solution', 'resolution', 'fix'],
                technician: ['technician', 'agent', 'owner', 'assigned'],
                request_status: ['status'],
                due_by_time: ['due', 'sla'],
                created_time: ['created'],
                responded_time: ['responded'],
                request_type: ['type'],
            };
            let foundHeader: string | null = null;
            for(const synonym of fieldSynonyms[field] || []) {
                const index = lowerUserHeaders.findIndex(h => h.includes(synonym));
                if (index !== -1) {
                    foundHeader = userHeaders[index];
                    break;
                }
            }
            heuristicMapping[field] = foundHeader;
        });
        return heuristicMapping;
    }
}

/**
 * Uses Gemini to normalize a list of raw values against a set of standard values.
 * It can map to existing standard values, or identify and clean up new values.
 */
export async function getNormalizedMappings(
  rawValues: string[],
  standardValues: string[],
  fieldName: string,
  defaultValue: string
): Promise<Record<string, string>> {
  if (rawValues.length === 0) {
    return {};
  }

  const prompt = `
    You are an expert data cleaner for an IT support ticketing system.
    Your task is to normalize a list of raw, messy values for the "${fieldName}" field by mapping them to a standard schema.

    **Target Schema (Standard Values):** ${JSON.stringify(standardValues)}
    *This is the preferred list of values. You should map to these whenever possible.*

    **Raw Input Values to Normalize:** ${JSON.stringify(rawValues)}

    **Instructions (follow in this order of priority):**
    1.  **Map to Target Schema:** For each raw value, your primary goal is to map it to one of the "Target Schema" values. This includes handling synonyms (e.g., "VPN issues" -> "Network"), misspellings (e.g., "Hardwear" -> "Hardware"), or more specific versions (e.g., "Password Reset" -> "Account Management"). Be aggressive in matching to the existing schema.
    2.  **Create New Values (Only if Necessary):** If a raw value represents a legitimate, distinct concept that absolutely cannot fit into the existing "Target Schema" (e.g., a completely new product line like "Mobile App Support"), normalize its capitalization (e.g., "mobile app support" -> "Mobile App Support") and use that as the new value. Do this sparingly.
    3.  **Use Default for Vague/Irrelevant Data:** If a raw value is too vague, irrelevant (e.g., "N/A", "See description"), or nonsensical, map it to the default value: "${defaultValue}".
    4.  **Format:** Your response MUST be a JSON array of objects, where each object has two keys: "rawValue" and "normalizedValue".
    5.  **Completeness:** Ensure every single raw value from the input list is included exactly once in the response.
    `;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        rawValue: { type: Type.STRING },
        normalizedValue: { type: Type.STRING },
      },
      required: ['rawValue', 'normalizedValue'],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const jsonString = response.text.trim();
    const mappingArray: { rawValue: string; normalizedValue: string }[] = JSON.parse(jsonString);

    const mapping = mappingArray.reduce((acc, item) => {
      acc[item.rawValue] = item.normalizedValue;
      return acc;
    }, {} as Record<string, string>);

    return mapping;
  } catch (error) {
    console.error(`Error calling Gemini API for ${fieldName} normalization:`, error);
    // Fallback: return an empty mapping so the default values are used.
    return {};
  }
}


/**
 * Uses Gemini to generate relevant keywords from ticket descriptions, filtering out PII.
 */
export async function generateKeywords(ticketDescriptions: string[], category: string): Promise<{ word: string; value: number }[]> {
  const prompt = `
        Analyze the following IT support ticket descriptions for the category "${category}".
        Identify up to 30 of the most common and relevant technical keywords or short phrases (1-3 words).

        Ticket Descriptions Sample:
        ${ticketDescriptions.map(d => `- ${d}`).join('\n')}
    `;

    const systemInstruction = `
        You are an expert data analyst specializing in IT support tickets. Your primary goal is to extract purely technical keywords for a word cloud, which will be used by engineers to spot trends.
        Follow these instructions with extreme precision:
        1.  Focus exclusively on technical nouns, software names (e.g., 'Salesforce', 'VPN'), hardware models, specific error codes (e.g., 'Error 503'), and technical action phrases (e.g., 'data migration', 'permission denied').
        2.  AGGRESSIVELY IGNORE AND FILTER OUT all non-technical terms. This includes:
            -   All personally identifiable information (PII): names (John, Jane Doe), emails, phone numbers, usernames, company names.
            -   Generic stop words: 'the', 'is', 'a', 'it', 'and', 'to', 'for'.
            -   Common problem descriptions: 'issue', 'problem', 'error', 'not working', 'failed', 'unable'.
            -   Words related to urgency or sentiment: 'urgent', 'ASAP', 'please', 'help', 'frustrated', 'important'.
        3.  EFFECTIVELY CONSOLIDATE SYNONYMS and related concepts into a single, standardized technical term. For example, "can't connect," "connection failed," and "disconnecting" should be grouped under "Connection Issue." "Login failed" and "password error" should be grouped under "Authentication Error."
        4.  The final output must be a JSON array of objects. Each object must have a "word" (string) and "value" (a number representing its frequency or importance) key.
        5.  The list MUST be sorted by value in descending order.
        6.  Return ONLY the JSON array. Do not include any other text, markdown formatting, or explanations.
    `;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING, description: 'The extracted keyword or phrase.' },
        value: { type: Type.INTEGER, description: 'The calculated frequency or importance score.' },
      },
      required: ['word', 'value'],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const jsonString = response.text.trim();
    const keywords = JSON.parse(jsonString);
    if (Array.isArray(keywords)) {
        return keywords.slice(0, 30);
    }
  } catch (error) {
    console.error('Error calling Gemini API for keyword generation:', error);
    // Fall through to fallback
  }

  // Fallback to simple text parsing if API fails or returns invalid format
  const stopWords = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'who', 'will', 'with', 'the', 'my', 'issue', 'problem', 'error', 'not', 'working', 'cannot', 'unable', 'access'
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
 * Uses Gemini to get an estimated complexity score for a ticket.
 */
export async function getComplexityScore(description: string): Promise<number> {
    const prompt = `
        Analyze the following IT support ticket description and estimate its technical complexity on a scale of 1 to 10.
        A score of 1 is a trivial task (e.g., a simple password reset).
        A score of 10 is a highly complex task requiring deep expertise (e.g., a multi-system integration failure, debugging a core service outage).
        
        Consider factors like:
        - The number of systems or technologies mentioned.
        - The specificity of the error message.
        - The likely need for investigation versus a known procedure.
        - The potential impact described.

        Description: "${description}"
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            complexity: { 
                type: Type.INTEGER, 
                description: 'An integer from 1 to 10 representing the estimated complexity.' 
            },
        },
        required: ['complexity'],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        
        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        
        if (typeof result.complexity === 'number' && result.complexity >= 1 && result.complexity <= 10) {
            return result.complexity;
        }
        
    } catch (error) {
        console.error("Error getting complexity score from Gemini:", error);
    }
    
    // Fallback to a simple heuristic if API fails
    const len = description.length;
    if (len < 50) return 2;
    if (len < 150) return 4;
    if (len < 300) return 6;
    return 8;
}