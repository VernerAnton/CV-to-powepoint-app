import { GoogleGenAI, Type } from "@google/genai";
import type { CandidateData } from '../types';

const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) {
  throw new Error("VITE_API_KEY environment variable not set. Please add it to your .env.local file.");
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

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export const extractCandidateFromText = async (
  cvText: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<CandidateData> => {
  const prompt = `
You are an expert HR assistant responsible for parsing CVs.
Analyze the following text from a single candidate's CV and extract their information.
The CV is from a LinkedIn profile and is likely in English, but may contain Finnish terms.
Respond ONLY with a single valid JSON object adhering to the provided schema.

IMPORTANT: Exclude any work experiences where the job title contains "Board Member" (case-insensitive).

CV Text:
---
${cvText}
---

Extract the following:
1. The full name of the candidate.
2. Their last 5 work experiences, including job title and company name. Exclude positions containing "Board Member". If there are fewer than 5, extract all of them. Dates should be in MM/YYYY - MM/YYYY format.
3. All of their educational experiences, including the degree or qualification and the name of the institution. Dates should be in MM/YYYY - MM/YYYY format.
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: candidateSchema,
      }
    });

    const jsonText = response.text.trim();
    const data = JSON.parse(jsonText) as CandidateData;

    // Additional client-side filter for Board Member positions (belt-and-suspenders approach)
    data.workHistory = data.workHistory.filter(
      job => !job.jobTitle.toLowerCase().includes('board member')
    );

    return data;
  } catch (error) {
    console.error("Error extracting CV info with Gemini:", error);
    console.error("Failed on CV text snippet:", cvText.substring(0, 500) + '...');
    throw new Error("Failed to parse CV data from AI response.");
  }
};