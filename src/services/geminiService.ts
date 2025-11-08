import { GoogleGenAI, Type } from "@google/genai";
import type { CandidateData, GeminiModel } from '../types';

// Initialize the Google GenAI client with the API key from environment variables.
// In Vite projects, environment variables must be prefixed with VITE_ to be exposed to the client.
const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) {
  throw new Error('VITE_API_KEY environment variable is not set');
}
const ai = new GoogleGenAI({ apiKey });
const candidateSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Full name of the candidate." },
    workHistory: {
      type: Type.ARRAY,
      description: "List of the candidate's last 5 work experiences.",
      items: {
        type: Type.OBJECT,
        properties: {
          jobTitle: { type: Type.STRING, description: "The job title." },
          company: { type: Type.STRING, description: "The company name." },
          dates: { type: Type.STRING, description: "Employment dates in MM/YYYY - MM/YYYY format (e.g., '01/2020 - Present')." },
        },
        required: ["jobTitle", "company"],
      },
    },
    education: {
      type: Type.ARRAY,
      description: "List of all educational qualifications.",
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.STRING, description: "The degree or qualification obtained." },
          institution: { type: Type.STRING, description: "The name of the educational institution." },
          dates: { type: Type.STRING, description: "Dates of study in MM/YYYY - MM/YYYY format (e.g., '09/2015 - 06/2019')." },
        },
        required: ["degree", "institution"],
      },
    },
  },
  required: ["name", "workHistory", "education"],
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const extractCandidateFromText = async (cvText: string, model: GeminiModel): Promise<CandidateData> => {
  const prompt = `
You are an expert HR assistant responsible for parsing CVs.
Analyze the following text from a single candidate's CV and extract their information.
The CV is from a LinkedIn profile and is likely in English, but may contain Finnish terms.
Respond ONLY with a single valid JSON object adhering to the provided schema.

CV Text:
---
${cvText}
---

Extract the following:
1. The full name of the candidate.
2. Their last 5 work experiences, including job title and company name. If there are fewer than 5, extract all of them. Dates should be in MM/YYYY - MM/YYYY format. IMPORTANT: Exclude any roles where the job title is 'Board Member' or similar non-operational advisory positions.
3. All of their educational experiences, including the degree or qualification and the name of the institution. Dates should be in MM/YYYY - MM/YYYY format.
`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: model, // Use the selected model
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: candidateSchema,
        }
      });
if (!response.text) {
  throw new Error('No text content in response from Gemini API');
}
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as CandidateData; // Success, exit loop and return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Gemini extraction attempt ${attempt} failed with model ${model}:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayTime = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delayTime / 1000}s...`);
        await delay(delayTime);
      }
    }
  }

  // If loop completes, all retries have failed.
  console.error(`All Gemini extraction retries failed for CV snippet with model ${model}:`, cvText.substring(0, 500) + '...');
  throw new Error(`Failed to parse CV data after ${maxRetries} attempts. Last error: ${lastError?.message}`);
};