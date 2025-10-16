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
    const requiredFields = ['ticket_no', 'problem_description', 'category', 'priority', 'solution_text'];
    
    const prompt = `
        Analyze the following list of CSV headers and map them to a predefined set of required fields.
        
        CSV Headers: ${JSON.stringify(userHeaders)}
        
        Required Fields: ${JSON.stringify(requiredFields)}
        
        Instructions:
        1. For each required field, find the best matching header from the user's CSV list.
        2. The 'problem_description' field is the most critical. It usually contains long text about the user's issue. Common names are 'description', 'subject', 'summary', 'issue'.
        3. 'category' refers to the type of issue (e.g., 'Software', 'Hardware').
        4. 'priority' refers to the urgency (e.g., 'High', 'Low').
        5. 'ticket_no' is the unique identifier for the ticket.
        6. 'solution_text' is the resolution for the ticket.
        7. If a reasonable match for a field cannot be found, the value for that field should be null.
        8. Return the mapping as a JSON object.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            ticket_no: { type: Type.STRING, description: "The header from the user's CSV that maps to a ticket ID. Null if not found." },
            problem_description: { type: Type.STRING, description: "The header for the main issue description. Null if not found." },
            category: { type: Type.STRING, description: "The header for the issue category. Null if not found." },
            priority: { type: Type.STRING, description: "The header for the issue priority. Null if not found." },
            solution_text: { type: Type.STRING, description: "The header for the ticket's solution. Null if not found." },
        },
        required: requiredFields, 
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
                solution_text: ['solution', 'resolution', 'fix']
            };
            let foundHeader: string | null = null;
            for(const synonym of fieldSynonyms[field]) {
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
    Your task is to normalize a list of raw, messy values for the "${fieldName}" field.

    Existing Standard Values: ${JSON.stringify(standardValues)}

    Raw Values to Normalize: ${JSON.stringify(rawValues)}

    Instructions:
    1. For each raw value, determine if it's a synonym, misspelling, or a more specific version of one of the "Existing Standard Values".
    2. If it is, map it to the corresponding standard value. (e.g., "software access" -> "Software", "P1" -> "Critical").
    3. If a raw value represents a legitimate, distinct new category that is not on the list (e.g., "Mobile Support"), then normalize its capitalization and use it as the new value (e.g., "mobile support" -> "Mobile Support").
    4. If a raw value is vague, irrelevant, or doesn't fit, map it to "${defaultValue}".
    5. Your response MUST be a JSON array of objects, where each object has two keys: "rawValue" and "normalizedValue".
    6. Ensure every raw value from the input list is included in the response.
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