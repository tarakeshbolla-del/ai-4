
import { GoogleGenAI } from "@google/genai";

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