import { useEffect, useState, useCallback, useMemo } from 'react';
import { Spin, message } from 'antd';
import {
  TeamOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  getActivePeerReview,
  getPeerReviewQuestions,
  getPeerReviewDraft,
  submitPeerReview,
} from '../api/client';

type Category =
  | 'performance'
  | 'responsibility'
  | 'knowledge'
  | 'leadership_collaboration';

interface Question {
  key: string;
  category: Category;
  prompt: string;
}

interface Teammate {
  id: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  responseId: string | null;
  status: 'draft' | 'submitted' | null;
}

interface Survey {
  id: string;
  periodMonth: string;
  opensAt: string;
  closesAt: string;
  status: 'open' | 'closed';
}

const CATEGORY_LABEL: Record<Category, string> = {
  performance: 'Performance',
  responsibility: 'Responsibility',
  knowledge: 'Knowledge',
  leadership_collaboration: 'Leadership & Collaboration',
};

const CATEGORY_COLOR: Record<Category, string> = {
  performance: '#7c5cfc',
  responsibility: '#5b8def',
  knowledge: '#10b981',
  leadership_collaboration: '#f59e0b',
};

const SCALE_LABELS = [
  '',
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
];

function formatPeriod(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function daysLeft(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function PeerReviewPanel() {
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Teammate | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, questionsRes] = await Promise.all([
        getActivePeerReview(),
        getPeerReviewQuestions(),
      ]);
      const active = activeRes?.data ?? activeRes;
      const qs = questionsRes?.data ?? questionsRes;
      setQuestions(Array.isArray(qs) ? qs : []);
      if (active && active.survey) {
        setSurvey(active.survey);
        setTeammates(active.teammates || []);
      } else {
        setSurvey(null);
        setTeammates([]);
      }
    } catch {
      message.error('Failed to load peer reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<Category, Question[]> = {
      performance: [],
      responsibility: [],
      knowledge: [],
      leadership_collaboration: [],
    };
    for (const q of questions) {
      if (map[q.category]) map[q.category].push(q);
    }
    return map;
  }, [questions]);

  const allAnswered = questions.length > 0 && questions.every((q) => scores[q.key] >= 1);
  const allMax = allAnswered && questions.every((q) => scores[q.key] === 5);
  const allMin = allAnswered && questions.every((q) => scores[q.key] === 1);

  const openTeammate = async (t: Teammate) => {
    setSelected(t);
    setScores({});
    setComment('');
    if (!survey) return;
    if (t.responseId) {
      try {
        const draftRes = await getPeerReviewDraft(survey.id, t.id);
        const draft = draftRes?.data ?? draftRes;
        if (draft) {
          const s: Record<string, number> = {};
          for (const a of draft.answers || []) {
            s[a.questionKey] = a.score;
          }
          setScores(s);
          setComment(draft.comment || '');
        }
      } catch {
        // ignore — fresh form
      }
    }
  };

  const submit = async () => {
    if (!survey || !selected) return;
    if (!allAnswered) {
      message.warning(`Please answer all ${questions.length} questions.`);
      return;
    }
    if (allMax) {
      message.error('All-5s submissions are not allowed. Please rate honestly.');
      return;
    }
    if (allMin) {
      message.error('All-1s submissions are not allowed. Please rate honestly.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        answers: questions.map((q) => ({ questionKey: q.key, score: scores[q.key] })),
        comment: comment.trim() || undefined,
      };
      await submitPeerReview(survey.id, selected.id, payload);
      message.success(`Review for ${selected.firstName} submitted`);
      setSelected(null);
      setScores({});
      setComment('');
      await load();
    } catch (err: any) {
      const detail =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to submit review';
      message.error(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Empty state — no active survey ──
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin />
      </div>
    );
  }

  if (!survey) {
    return (
      <div style={{ padding: 20 }}>
        <div style={panelStyle}>
          <TeamOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 12 }} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            No active peer review
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            A new peer review opens at the start of each month and stays open for 7 days.
          </div>
        </div>
      </div>
    );
  }

  // ── Detail form ──
  if (selected) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setSelected(null)} style={backBtn}>
            <ArrowLeftOutlined /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
              Reviewing {selected.firstName} {selected.lastName}
            </div>
            {selected.designation && (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                {selected.designation}
              </div>
            )}
          </div>
        </div>

        {(['performance', 'responsibility', 'knowledge', 'leadership_collaboration'] as Category[]).map(
          (cat) => (
            <div key={cat} style={{ ...panelStyle, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: CATEGORY_COLOR[cat],
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: CATEGORY_COLOR[cat],
                    letterSpacing: 0.05,
                    textTransform: 'uppercase',
                  }}
                >
                  {CATEGORY_LABEL[cat]}
                </span>
              </div>
              {grouped[cat].map((q) => (
                <QuestionRow
                  key={q.key}
                  prompt={q.prompt}
                  value={scores[q.key] || 0}
                  onChange={(v) => setScores((p) => ({ ...p, [q.key]: v }))}
                  color={CATEGORY_COLOR[cat]}
                />
              ))}
            </div>
          ),
        )}

        <div style={{ ...panelStyle, padding: 16, marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.05,
              marginBottom: 8,
            }}
          >
            Optional comment
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share any additional context (visible only to admins)..."
            rows={3}
            maxLength={2000}
            style={textAreaStyle}
          />
        </div>

        {(allMax || allMin) && (
          <div
            style={{
              ...panelStyle,
              padding: 12,
              marginBottom: 12,
              borderColor: 'rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#fca5a5',
              fontSize: 12,
            }}
          >
            {allMax
              ? 'All ratings cannot be the maximum value — please rate honestly with some differentiation.'
              : 'All ratings cannot be the minimum value — please rate honestly with some differentiation.'}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !allAnswered || allMax || allMin}
          style={{
            ...primaryBtn,
            opacity: submitting || !allAnswered || allMax || allMin ? 0.5 : 1,
            cursor: submitting || !allAnswered || allMax || allMin ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    );
  }

  // ── Teammate list ──
  const remaining = daysLeft(survey.closesAt);
  const completedCount = teammates.filter((t) => t.status === 'submitted').length;
  return (
    <div style={{ padding: 20 }}>
      <div style={{ ...panelStyle, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
              Peer Review — {formatPeriod(survey.periodMonth)}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
              {completedCount}/{teammates.length} teammates rated &middot; closes{' '}
              {new Date(survey.closesAt).toLocaleDateString()}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              background:
                remaining <= 2
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(124, 92, 252, 0.12)',
              border: `1px solid ${
                remaining <= 2 ? 'rgba(239,68,68,0.35)' : 'rgba(124,92,252,0.3)'
              }`,
              color: remaining <= 2 ? '#fca5a5' : '#c4b5fd',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <ClockCircleOutlined />
            {remaining} day{remaining !== 1 ? 's' : ''} left
          </div>
        </div>
      </div>

      {teammates.length === 0 ? (
        <div style={panelStyle}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            No active teammates to review.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {teammates.map((t) => {
            const submitted = t.status === 'submitted';
            return (
              <button
                key={t.id}
                onClick={() => !submitted && openTeammate(t)}
                disabled={submitted}
                style={{
                  ...rowStyle,
                  cursor: submitted ? 'default' : 'pointer',
                  opacity: submitted ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background:
                      'linear-gradient(135deg, rgba(124, 92, 252, 0.25), rgba(91, 141, 239, 0.18))',
                    border: '1px solid rgba(124, 92, 252, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#a78bfa',
                    flexShrink: 0,
                  }}
                >
                  {(t.firstName[0] || '') + (t.lastName[0] || '')}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div
                    style={{
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.firstName} {t.lastName}
                  </div>
                  {t.designation && (
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.designation}
                    </div>
                  )}
                </div>
                {submitted ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#34d399',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircleFilled />
                    Submitted
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: 'rgba(124, 92, 252, 0.12)',
                      color: '#c4b5fd',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    Pending
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuestionRow({
  prompt,
  value,
  onChange,
  color,
}: {
  prompt: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 8 }}>{prompt}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                flex: 1,
                minWidth: 64,
                padding: '8px 6px',
                borderRadius: 8,
                border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${color}22` : 'rgba(255,255,255,0.02)',
                color: active ? color : 'rgba(255,255,255,0.5)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                lineHeight: 1.3,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{n}</div>
              <div style={{ fontSize: 9, opacity: 0.85 }}>{SCALE_LABELS[n]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 20,
  textAlign: 'center' as const,
};

const backBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 12,
  cursor: 'pointer',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  width: '100%',
  transition: 'all 0.15s ease',
};

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: 10,
  color: 'rgba(255,255,255,0.85)',
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  resize: 'vertical' as const,
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #7c5cfc, #5b8def)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
