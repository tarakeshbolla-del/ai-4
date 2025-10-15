
import { GoogleGenAI } from "@google/genai";
import type { AnalysisResultData } from "../types";

// IMPORTANT: This service is mocked for frontend demonstration.
// In a real application, the API key would be managed securely on a backend server,
// and this service would make requests to that server instead of directly to the Gemini API.

const MOCK_API_KEY = "mock-api-key-from-env";
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || MOCK_API_KEY });
const ai = new GoogleGenAI({ apiKey: MOCK_API_KEY });


/**
 * Generates a solution suggestion using the Gemini model.
 * In a real app, this would take more context from the user's issue.
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
    The solution should be formatted in Markdown. Assume the user has basic technical knowledge.
  `;

  try {
    // This is a mocked call. In a real scenario, you would uncomment the following lines.
    /*
    const parts = [{ text: prompt }];
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
        model: 'gemini-1.5-flash',
        contents: { parts },
    });
    
    return response.text;
    */
    
    // Returning a mock response for demonstration
    await new Promise(resolve => setTimeout(resolve, 1500));
    return `
### AI-Generated Suggested Solution

Based on your description \`${description.substring(0, 50)}...\`, here are the recommended steps to resolve the issue:

1.  **Restart the Application**: Close the application completely and restart it. This can often resolve temporary glitches.
2.  **Check Network Connection**: Ensure you have a stable internet connection. Try accessing another website to confirm.
3.  **Clear Cache and Cookies**: If this is a web-based application, clearing your browser's cache and cookies can solve login or display issues.
    *   In Chrome: Go to \`Settings\` > \`Privacy and security\` > \`Clear browsing data\`.
    *   In Firefox: Go to \`Settings\` > \`Privacy & Security\` > \`Cookies and Site Data\` > \`Clear Data\`.
4.  **Consult Knowledge Base**: Search the company's IT knowledge base for articles related to the application or error message you are seeing.

If these steps do not resolve your problem, please proceed with creating a support ticket.
    `;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "I am sorry, but I was unable to generate a suggestion at this time. Please proceed with creating a support ticket.";
  }
}
