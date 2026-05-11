export enum InterviewPhase {
  WELCOME = 'WELCOME',
  COMPANY_SEARCH = 'COMPANY_SEARCH',
  LOADING_QUESTIONS = 'LOADING_QUESTIONS',
  INTERVIEWING = 'INTERVIEWING',
  GENERATING_FEEDBACK = 'GENERATING_FEEDBACK',
  FEEDBACK = 'FEEDBACK',
  HISTORY = 'HISTORY'
}

export interface Question {
  id: string;
  text: string;
  type: 'technical' | 'behavioral' | 'situational' | 'role-specific';
}

export interface Answer {
  questionId: string;
  questionText: string;
  answerText: string;
}

export interface InterviewFeedback {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  proTips: string[];
  improvementActions: string[];
  bestAnswer: {
    quote: string;
    reason: string;
  };
  nextSteps: string[];
}

export interface CompanyInsight {
  focusAreas: string[];
  pastQuestions: string[];
  companyCulture: string;
}

export interface JobRecommendation {
  id: string;
  role: string;
  company: string;
  alignmentScore: number;
  reasoning: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  role: string;
  company?: string;
  timestamp: any; // Firestore Timestamp
  answers: Answer[];
  feedback: InterviewFeedback;
}
