export enum PeerReviewCategory {
  PERFORMANCE = 'performance',
  RESPONSIBILITY = 'responsibility',
  KNOWLEDGE = 'knowledge',
  LEADERSHIP_COLLABORATION = 'leadership_collaboration',
  HR_RESPONSIVENESS = 'hr_responsiveness',
  HR_EMPATHY = 'hr_empathy',
  HR_FAIRNESS = 'hr_fairness',
  HR_COMMUNICATION = 'hr_communication',
}

export interface PeerReviewQuestion {
  key: string;
  category: PeerReviewCategory;
  prompt: string;
}

export const PEER_REVIEW_QUESTIONS: PeerReviewQuestion[] = [
  // ── Performance ──
  { key: 'perf_1', category: PeerReviewCategory.PERFORMANCE, prompt: 'Consistently delivers high-quality work on time.' },
  { key: 'perf_2', category: PeerReviewCategory.PERFORMANCE, prompt: 'Maintains a strong level of productivity throughout the day.' },
  { key: 'perf_3', category: PeerReviewCategory.PERFORMANCE, prompt: 'Output meets or exceeds expectations for the role.' },
  { key: 'perf_4', category: PeerReviewCategory.PERFORMANCE, prompt: 'Handles workload effectively without compromising quality.' },
  { key: 'perf_5', category: PeerReviewCategory.PERFORMANCE, prompt: 'Adapts well to shifting priorities and delivers under pressure.' },

  // ── Responsibility ──
  { key: 'resp_1', category: PeerReviewCategory.RESPONSIBILITY, prompt: 'Takes ownership of assigned tasks from start to finish.' },
  { key: 'resp_2', category: PeerReviewCategory.RESPONSIBILITY, prompt: 'Is reliable and follows through on commitments.' },
  { key: 'resp_3', category: PeerReviewCategory.RESPONSIBILITY, prompt: 'Acknowledges mistakes and works to correct them.' },
  { key: 'resp_4', category: PeerReviewCategory.RESPONSIBILITY, prompt: 'Communicates proactively about progress and blockers.' },
  { key: 'resp_5', category: PeerReviewCategory.RESPONSIBILITY, prompt: 'Respects deadlines and team agreements.' },

  // ── Knowledge ──
  { key: 'know_1', category: PeerReviewCategory.KNOWLEDGE, prompt: 'Demonstrates strong understanding of their domain.' },
  { key: 'know_2', category: PeerReviewCategory.KNOWLEDGE, prompt: 'Applies technical/professional skills effectively to solve problems.' },
  { key: 'know_3', category: PeerReviewCategory.KNOWLEDGE, prompt: 'Stays current with relevant tools, practices, and trends.' },
  { key: 'know_4', category: PeerReviewCategory.KNOWLEDGE, prompt: 'Shares knowledge willingly with the rest of the team.' },
  { key: 'know_5', category: PeerReviewCategory.KNOWLEDGE, prompt: 'Asks thoughtful questions and learns quickly from feedback.' },

  // ── Leadership & Collaboration ──
  { key: 'lead_1', category: PeerReviewCategory.LEADERSHIP_COLLABORATION, prompt: 'Communicates clearly and respectfully with teammates.' },
  { key: 'lead_2', category: PeerReviewCategory.LEADERSHIP_COLLABORATION, prompt: 'Supports and mentors others when possible.' },
  { key: 'lead_3', category: PeerReviewCategory.LEADERSHIP_COLLABORATION, prompt: 'Contributes constructively to team discussions and decisions.' },
  { key: 'lead_4', category: PeerReviewCategory.LEADERSHIP_COLLABORATION, prompt: 'Helps create a positive, inclusive team environment.' },
  { key: 'lead_5', category: PeerReviewCategory.LEADERSHIP_COLLABORATION, prompt: 'Steps up to take initiative when the team needs it.' },
];

export const QUESTION_KEYS = new Set(PEER_REVIEW_QUESTIONS.map((q) => q.key));
export const QUESTION_MAP = new Map(
  PEER_REVIEW_QUESTIONS.map((q) => [q.key, q] as const),
);

// ── HR review questions (different category set + prompts) ──
export const HR_REVIEW_QUESTIONS: PeerReviewQuestion[] = [
  // Responsiveness
  { key: 'hr_resp_1', category: PeerReviewCategory.HR_RESPONSIVENESS, prompt: 'Responds to my requests and questions within a reasonable timeframe.' },
  { key: 'hr_resp_2', category: PeerReviewCategory.HR_RESPONSIVENESS, prompt: 'Follows up on open issues until they are resolved.' },
  { key: 'hr_resp_3', category: PeerReviewCategory.HR_RESPONSIVENESS, prompt: 'Is available when I need help with HR-related matters.' },
  { key: 'hr_resp_4', category: PeerReviewCategory.HR_RESPONSIVENESS, prompt: 'Acknowledges receipt of requests promptly, even if a resolution takes time.' },
  { key: 'hr_resp_5', category: PeerReviewCategory.HR_RESPONSIVENESS, prompt: 'Handles urgent issues with appropriate urgency.' },

  // Empathy & Support
  { key: 'hr_emp_1', category: PeerReviewCategory.HR_EMPATHY, prompt: 'Listens with empathy when I raise concerns.' },
  { key: 'hr_emp_2', category: PeerReviewCategory.HR_EMPATHY, prompt: 'Makes me feel comfortable bringing personal or sensitive matters.' },
  { key: 'hr_emp_3', category: PeerReviewCategory.HR_EMPATHY, prompt: 'Respects confidentiality when handling private information.' },
  { key: 'hr_emp_4', category: PeerReviewCategory.HR_EMPATHY, prompt: 'Treats me with dignity and respect in all interactions.' },
  { key: 'hr_emp_5', category: PeerReviewCategory.HR_EMPATHY, prompt: 'Supports me effectively during difficult workplace situations.' },

  // Process & Fairness
  { key: 'hr_fair_1', category: PeerReviewCategory.HR_FAIRNESS, prompt: 'Applies HR policies consistently and without favoritism.' },
  { key: 'hr_fair_2', category: PeerReviewCategory.HR_FAIRNESS, prompt: 'Explains the rationale behind decisions when they affect me.' },
  { key: 'hr_fair_3', category: PeerReviewCategory.HR_FAIRNESS, prompt: 'Gives me a fair chance to be heard in disputes or disagreements.' },
  { key: 'hr_fair_4', category: PeerReviewCategory.HR_FAIRNESS, prompt: 'Handles sensitive issues with appropriate professionalism.' },
  { key: 'hr_fair_5', category: PeerReviewCategory.HR_FAIRNESS, prompt: 'Holds people accountable evenly, regardless of role or seniority.' },

  // Communication
  { key: 'hr_comm_1', category: PeerReviewCategory.HR_COMMUNICATION, prompt: 'Communicates HR policies and changes clearly.' },
  { key: 'hr_comm_2', category: PeerReviewCategory.HR_COMMUNICATION, prompt: 'Provides clear guidance on benefits, leave, and compensation processes.' },
  { key: 'hr_comm_3', category: PeerReviewCategory.HR_COMMUNICATION, prompt: 'Is approachable and easy to talk to.' },
  { key: 'hr_comm_4', category: PeerReviewCategory.HR_COMMUNICATION, prompt: 'Keeps me informed about updates that affect me.' },
  { key: 'hr_comm_5', category: PeerReviewCategory.HR_COMMUNICATION, prompt: 'Writes and speaks in a way that is easy to understand.' },
];

export const HR_QUESTION_MAP = new Map(
  HR_REVIEW_QUESTIONS.map((q) => [q.key, q] as const),
);

export function getQuestionMap(kind: 'team' | 'hr'): Map<string, PeerReviewQuestion> {
  return kind === 'hr' ? HR_QUESTION_MAP : QUESTION_MAP;
}

export function getQuestionsForKind(kind: 'team' | 'hr'): PeerReviewQuestion[] {
  return kind === 'hr' ? HR_REVIEW_QUESTIONS : PEER_REVIEW_QUESTIONS;
}
