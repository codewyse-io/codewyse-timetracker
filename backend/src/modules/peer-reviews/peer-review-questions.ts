export enum PeerReviewCategory {
  PERFORMANCE = 'performance',
  RESPONSIBILITY = 'responsibility',
  KNOWLEDGE = 'knowledge',
  LEADERSHIP_COLLABORATION = 'leadership_collaboration',
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
