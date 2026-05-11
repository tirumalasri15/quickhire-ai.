import { GoogleGenAI, Type } from "@google/genai";
import { Question, InterviewFeedback, Answer, CompanyInsight, JobRecommendation } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Missing VITE_GEMINI_API_KEY in environment');
}

const ai = new GoogleGenAI({ apiKey });

export const getCompanyInsights = async (company: string, role: string): Promise<CompanyInsight> => {
  const prompt = `Research and provide deep professional insights for ${company} specifically for a ${role} position.
  Include:
  1. Primary focus areas/values during interviews at this company.
  2. Potential historical interview questions often asked at ${company} for ${role} roles.
  3. A summary of the company culture.
  Return as a JSON object.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          pastQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          companyCulture: { type: Type.STRING }
        },
        required: ['focusAreas', 'pastQuestions', 'companyCulture']
      }
    }
  });

  if (!response.text) throw new Error("Failed to get company insights");
  return JSON.parse(response.text);
};

export const generateInterviewQuestions = async (role: string, company?: string, insights?: CompanyInsight): Promise<Question[]> => {
  let prompt = `Generate 6 diverse mock interview questions for a ${role} position. 
  Include a mix of technical, behavioral (STAR format), situational, and role-specific questions.`;

  if (company && insights) {
    prompt += `\nTailor these questions for ${company}. 
    Focus on these areas: ${insights.focusAreas.join(', ')}. 
    Reference these types of past questions if relevant: ${insights.pastQuestions.join(', ')}.`;
  }

  prompt += `\nReturn the output as a JSON array of objects with 'id', 'text', and 'type' fields.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            type: { 
              type: Type.STRING,
              enum: ['technical', 'behavioral', 'situational', 'role-specific']
            }
          },
          required: ['id', 'text', 'type']
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate questions");
  }

  return JSON.parse(response.text);
};

export const generateFeedback = async (role: string, answers: Answer[]): Promise<InterviewFeedback> => {
  const interviewData = answers.map(a => `Q: ${a.questionText}\nA: ${a.answerText}`).join('\n\n');
  
  const prompt = `You are an expert career coach and hiring manager. Evaluate this mock interview for a ${role} role. 
  
  Interview Transcript:
  ${interviewData}

  Provide a structured feedback report in JSON format following this schema:
  - overallScore: number (1-10)
  - strengths: array of strings (3 items)
  - weaknesses: array of strings (3 items)
  - proTips: array of strings (5 items)
  - improvementActions: array of strings (3 items)
  - bestAnswer: object { quote: string, reason: string }
  - nextSteps: array of strings (2 items)`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          proTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvementActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          bestAnswer: {
            type: Type.OBJECT,
            properties: {
              quote: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ['quote', 'reason']
          },
          nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['overallScore', 'strengths', 'weaknesses', 'proTips', 'improvementActions', 'bestAnswer', 'nextSteps']
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate feedback");
  }

  return JSON.parse(response.text);
};

export const getJobRecommendations = async (role: string, feedback: InterviewFeedback): Promise<JobRecommendation[]> => {
  const prompt = `Based on a mock interview for ${role} where the candidate scored ${feedback.overallScore}/10.
  Strengths: ${feedback.strengths.join(', ')}
  Weaknesses: ${feedback.weaknesses.join(', ')}
  Recommend 3 specific job opportunities (Company and Role) that would be a good fit or a good challenge.
  Return as a JSON array of objects.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            role: { type: Type.STRING },
            company: { type: Type.STRING },
            alignmentScore: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ['id', 'role', 'company', 'alignmentScore', 'reasoning']
        }
      }
    }
  });

  if (!response.text) throw new Error("Failed to get job recommendations");
  return JSON.parse(response.text);
};
