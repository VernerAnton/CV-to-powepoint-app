
export interface WorkExperience {
  jobTitle: string;
  company: string;
  dates: string;
}

export interface Education {
  degree: string;
  institution: string;
  dates: string;
}

export interface CandidateData {
  name: string;
  workHistory: WorkExperience[];
  education: Education[];
}

export type ProcessingStatus = 'idle' | 'parsing' | 'extracting' | 'generating' | 'done' | 'error';
