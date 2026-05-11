import { useEffect, useState, useCallback, useMemo } from 'react';
import { Spin, message, Select } from 'antd';
import {
  TeamOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  TrophyOutlined,
  FormOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getActivePeerReview,
  getAllPeerReviewQuestions,
  getPeerReviewDraft,
  submitPeerReview,
  getPeerReviewLeaderboard,
  listPeerReviewSurveys,
  getMyTeams,
} from '../api/client';

type Category =
  | 'performance'
  | 'responsibility'
  | 'knowledge'
  | 'leadership_collaboration'
  | 'hr_responsiveness'
  | 'hr_empathy'
  | 'hr_fairness'
  | 'hr_communication';

type ReviewKind = 'team' | 'hr';

const TEAM_CATEGORIES: Category[] = [
  'performance',
  'responsibility',
  'knowledge',
  'leadership_collaboration',
];
const HR_CATEGORIES: Category[] = [
  'hr_responsiveness',
  'hr_empathy',
  'hr_fairness',
  'hr_communication',
];

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

interface LeaderboardRow {
  reviewee: { id: string; firstName: string; lastName: string };
  reviewerCount: number;
  overallAverage: number;
  categoryAverages: Record<Category, number>;
}

interface LeaderboardData {
  survey: Survey;
  results: LeaderboardRow[];
  myEntry: LeaderboardRow | null;
  myRank: number | null;
}

const CATEGORY_LABEL: Record<Category, string> = {
  performance: 'Performance',
  responsibility: 'Responsibility',
  knowledge: 'Knowledge',
  leadership_collaboration: 'Leadership & Collab.',
  hr_responsiveness: 'Responsiveness',
  hr_empathy: 'Empathy & Support',
  hr_fairness: 'Process & Fairness',
  hr_communication: 'Communication',
};

const CATEGORY_COLOR: Record<Category, string> = {
  performance: '#7c5cfc',
  responsibility: '#5b8def',
  knowledge: '#10b981',
  leadership_collaboration: '#f59e0b',
  hr_responsiveness: '#ec4899',
  hr_empathy: '#22d3ee',
  hr_fairness: '#8b5cf6',
  hr_communication: '#a3e635',
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
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function daysLeft(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

type View = 'leaderboard' | 'survey';

export default function PeerReviewPanel() {
  // Top-level view (leaderboard | survey)
  const [view, setView] = useState<View>('leaderboard');

  // Survey state
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [hrReviewees, setHrReviewees] = useState<Teammate[]>([]);
  const [myTeams, setMyTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamQuestions, setTeamQuestions] = useState<Question[]>([]);
  const [hrQuestions, setHrQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<{ person: Teammate; kind: ReviewKind } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Leaderboard state
  const [lbLoading, setLbLoading] = useState(true);
  const [lb, setLb] = useState<LeaderboardData | null>(null);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [pickedSurveyId, setPickedSurveyId] = useState<string | undefined>(undefined);

  const loadActiveSurvey = useCallback(async () => {
    setSurveyLoading(true);
    try {
      const [activeRes, questionsRes, teamsRes] = await Promise.all([
        getActivePeerReview(),
        getAllPeerReviewQuestions(),
        getMyTeams().catch(() => null),
      ]);
      const active = activeRes?.data ?? activeRes;
      const qs = questionsRes?.data ?? questionsRes;
      const teams = teamsRes?.data ?? teamsRes;
      setTeamQuestions(Array.isArray(qs?.team) ? qs.team : []);
      setHrQuestions(Array.isArray(qs?.hr) ? qs.hr : []);
      if (active && active.survey) {
        setSurvey(active.survey);
        setTeammates(active.teammates || []);
        setHrReviewees(active.hrReviewees || []);
      } else {
        setSurvey(null);
        setTeammates([]);
        setHrReviewees([]);
      }
      setMyTeams(
        Array.isArray(teams?.teams)
          ? teams.teams.map((t: any) => ({ id: t.id, name: t.name }))
          : [],
      );
    } catch {
      // silent — survey is optional now
    } finally {
      setSurveyLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async (surveyId?: string) => {
    setLbLoading(true);
    try {
      const [lbRes, surveysRes] = await Promise.all([
        getPeerReviewLeaderboard(surveyId),
        listPeerReviewSurveys(),
      ]);
      const data = lbRes?.data ?? lbRes;
      const surveys = surveysRes?.data ?? surveysRes;
      setLb(data || null);
      setAllSurveys(Array.isArray(surveys) ? surveys : []);
      if (data?.survey?.id && !surveyId) setPickedSurveyId(data.survey.id);
    } catch {
      setLb(null);
    } finally {
      setLbLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveSurvey();
    loadLeaderboard();
  }, [loadActiveSurvey, loadLeaderboard]);

  const activeQuestions = useMemo(() => {
    if (selected?.kind === 'hr') return hrQuestions;
    return teamQuestions;
  }, [selected?.kind, teamQuestions, hrQuestions]);

  const activeCategories: Category[] =
    selected?.kind === 'hr' ? HR_CATEGORIES : TEAM_CATEGORIES;

  const grouped = useMemo(() => {
    const map: Partial<Record<Category, Question[]>> = {};
    for (const c of activeCategories) map[c] = [];
    for (const q of activeQuestions) {
      if (map[q.category]) map[q.category]!.push(q);
    }
    return map as Record<Category, Question[]>;
  }, [activeQuestions, activeCategories]);

  const allAnswered =
    activeQuestions.length > 0 && activeQuestions.every((q) => scores[q.key] >= 1);
  const allMax = allAnswered && activeQuestions.every((q) => scores[q.key] === 5);
  const allMin = allAnswered && activeQuestions.every((q) => scores[q.key] === 1);

  const openReview = async (t: Teammate, kind: ReviewKind) => {
    setSelected({ person: t, kind });
    setScores({});
    setComment('');
    if (!survey) return;
    if (t.responseId) {
      try {
        const draftRes = await getPeerReviewDraft(survey.id, t.id, kind);
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
        // ignore
      }
    }
  };

  const submit = async () => {
    if (!survey || !selected) return;
    const expectedCount = activeQuestions.length;
    if (!allAnswered) {
      message.warning(`Please answer all ${expectedCount} questions.`);
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
        answers: activeQuestions.map((q) => ({ questionKey: q.key, score: scores[q.key] })),
        comment: comment.trim() || undefined,
      };
      await submitPeerReview(survey.id, selected.person.id, payload, selected.kind);
      message.success(
        `${selected.kind === 'hr' ? 'HR review' : 'Review'} for ${selected.person.firstName} submitted`,
      );
      setSelected(null);
      setScores({});
      setComment('');
      await Promise.all([loadActiveSurvey(), loadLeaderboard(pickedSurveyId)]);
    } catch (err: any) {
      const detail =
        err?.response?.data?.message || err?.message || 'Failed to submit review';
      message.error(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Survey detail form ──
  if (selected) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setSelected(null)} style={backBtn}>
            <ArrowLeftOutlined /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
              {selected.kind === 'hr' ? 'HR Review' : 'Reviewing'} {selected.person.firstName}{' '}
              {selected.person.lastName}
            </div>
            {selected.person.designation && (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                {selected.person.designation}
              </div>
            )}
            {selected.kind === 'hr' && (
              <div
                style={{
                  display: 'inline-flex',
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.05,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(236, 72, 153, 0.15)',
                  color: '#f9a8d4',
                }}
              >
                HR Questionnaire
              </div>
            )}
          </div>
        </div>

        {activeCategories.map(
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

  // ── Main panel: tab switcher + content ──
  return (
    <div style={{ padding: 20 }}>
      {/* Sub-tab switcher */}
      <div
        style={{
          display: 'inline-flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: 4,
          gap: 2,
          marginBottom: 16,
        }}
      >
        {([
          { key: 'leaderboard' as View, label: 'Leaderboard', icon: <TrophyOutlined /> },
          { key: 'survey' as View, label: 'Survey', icon: <FormOutlined /> },
        ]).map((tab) => {
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: active ? 'rgba(124, 92, 252, 0.18)' : 'transparent',
                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {view === 'leaderboard' ? (
        <LeaderboardView
          loading={lbLoading}
          data={lb}
          allSurveys={allSurveys}
          pickedSurveyId={pickedSurveyId}
          onPickSurvey={(id) => {
            setPickedSurveyId(id);
            loadLeaderboard(id);
          }}
        />
      ) : (
        <SurveyView
          loading={surveyLoading}
          survey={survey}
          teammates={teammates}
          hrReviewees={hrReviewees}
          myTeams={myTeams}
          onOpenReview={openReview}
          onRefresh={loadActiveSurvey}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Leaderboard sub-view
// ──────────────────────────────────────────────

function LeaderboardView({
  loading,
  data,
  allSurveys,
  pickedSurveyId,
  onPickSurvey,
}: {
  loading: boolean;
  data: LeaderboardData | null;
  allSurveys: Survey[];
  pickedSurveyId?: string;
  onPickSurvey: (id: string) => void;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={panelStyle}>
        <TrophyOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 12 }} />
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          No reviews yet
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          Once teammates submit their peer reviews, the leaderboard appears here.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ ...panelStyle, padding: 14, marginBottom: 14, textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
              Peer Review Leaderboard
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
              {formatPeriod(data.survey.periodMonth)} &middot; {data.survey.status === 'open' ? 'Live results' : 'Final'}
            </div>
          </div>
          {allSurveys.length > 1 && (
            <Select
              size="small"
              value={pickedSurveyId}
              style={{ minWidth: 180 }}
              onChange={(v) => onPickSurvey(v)}
              options={allSurveys.map((s) => ({
                value: s.id,
                label: `${formatPeriod(s.periodMonth)}${s.status === 'open' ? ' • Live' : ''}`,
              }))}
            />
          )}
        </div>
      </div>

      {/* Your rank */}
      {data.myEntry && data.myRank && (
        <div
          style={{
            ...panelStyle,
            padding: 14,
            marginBottom: 14,
            textAlign: 'left',
            background:
              'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(91, 141, 239, 0.08))',
            borderColor: 'rgba(124, 92, 252, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: 'rgba(196, 181, 253, 0.85)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.05 }}>
                Your rank
              </div>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                #{data.myRank}{' '}
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
                  of {data.results.length}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.05 }}>
                Overall
              </div>
              <div style={{ color: '#c4b5fd', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                {data.myEntry.overallAverage.toFixed(2)}
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500 }}>/5</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.results.length === 0 ? (
        <div style={panelStyle}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            No submitted reviews for this survey yet.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.results.map((row, idx) => (
            <LeaderboardRow
              key={row.reviewee.id}
              rank={idx + 1}
              row={row}
              isMe={data.myEntry?.reviewee.id === row.reviewee.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeaderboardRow({
  rank,
  row,
  isMe,
}: {
  rank: number;
  row: LeaderboardRow;
  isMe: boolean;
}) {
  const medalColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#c4c4ce' : rank === 3 ? '#d97706' : null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: isMe
          ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(91, 141, 239, 0.06))'
          : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isMe ? 'rgba(124, 92, 252, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: medalColor ? `${medalColor}25` : 'rgba(255,255,255,0.04)',
          border: medalColor ? `1px solid ${medalColor}50` : '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: medalColor || 'rgba(255,255,255,0.55)',
          flexShrink: 0,
        }}
      >
        {medalColor ? <TrophyOutlined /> : rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
          {row.reviewee.firstName} {row.reviewee.lastName}{' '}
          {isMe && (
            <span style={{ color: '#c4b5fd', fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
              YOU
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 4,
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            flexWrap: 'wrap',
          }}
        >
          {(['performance', 'responsibility', 'knowledge', 'leadership_collaboration'] as Category[]).map((c) => (
            <span key={c} style={{ color: CATEGORY_COLOR[c] }}>
              {CATEGORY_LABEL[c]}: <strong>{row.categoryAverages[c].toFixed(2)}</strong>
            </span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
          {row.overallAverage.toFixed(2)}
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 500 }}>/5</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
          {row.reviewerCount} reviewer{row.reviewerCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Survey sub-view
// ──────────────────────────────────────────────

function SurveyView({
  loading,
  survey,
  teammates,
  hrReviewees,
  myTeams,
  onOpenReview,
  onRefresh,
}: {
  loading: boolean;
  survey: Survey | null;
  teammates: Teammate[];
  hrReviewees: Teammate[];
  myTeams: { id: string; name: string }[];
  onOpenReview: (t: Teammate, kind: ReviewKind) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin />
      </div>
    );
  }

  if (!survey) {
    return (
      <div style={panelStyle}>
        <FormOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 12 }} />
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          No active peer review
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          A new peer review opens at the start of each month and stays open for 7 days.
          Check back then to rate your teammates.
        </div>
        <button onClick={onRefresh} style={{ ...refreshBtn, marginTop: 14 }}>
          <ReloadOutlined /> Refresh
        </button>
      </div>
    );
  }

  const remaining = daysLeft(survey.closesAt);
  const completedCount = teammates.filter((t) => t.status === 'submitted').length;

  return (
    <div>
      <div style={{ ...panelStyle, padding: 16, marginBottom: 14, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
              Survey — {formatPeriod(survey.periodMonth)}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
              {completedCount}/{teammates.length} teammates rated &middot; closes{' '}
              {new Date(survey.closesAt).toLocaleDateString()}
            </div>
            {myTeams.length > 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                Your team{myTeams.length > 1 ? 's' : ''}:{' '}
                {myTeams.map((t) => t.name).join(', ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={onRefresh} title="Refresh" style={refreshBtn}>
              <ReloadOutlined />
            </button>
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
      </div>

      {/* Section header — Team reviews */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#a78bfa',
          letterSpacing: 0.06,
          textTransform: 'uppercase',
        }}>
          Team Reviews
        </span>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {teammates.length} teammate{teammates.length === 1 ? '' : 's'}
        </span>
      </div>

      {teammates.length === 0 ? (
        <div style={panelStyle}>
          <TeamOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 12 }} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            No teammates to review
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5 }}>
            {myTeams.length === 0 ? (
              <>You haven't been added to any team yet. Ask an admin to assign you to a team.</>
            ) : (
              <>
                You're in <strong>{myTeams.map((t) => t.name).join(', ')}</strong>, but no
                other <strong>active</strong> teammates were found. Teammates who haven't
                accepted their invitation yet won't appear. Try the refresh button after
                they sign in.
              </>
            )}
          </div>
          <button onClick={onRefresh} style={{ ...refreshBtn, marginTop: 14 }}>
            <ReloadOutlined /> Refresh
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {teammates.map((t) => {
            const submitted = t.status === 'submitted';
            return (
              <button
                key={t.id}
                onClick={() => !submitted && onOpenReview(t, 'team')}
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

      {/* HR Reviews section — shown only when there are HR people to review */}
      {hrReviewees.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '22px 0 8px' }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#f9a8d4',
              letterSpacing: 0.06,
              textTransform: 'uppercase',
            }}>
              HR Reviews
            </span>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {hrReviewees.length} HR member{hrReviewees.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 10 }}>
            Different questionnaire focused on responsiveness, empathy, fairness, and communication.
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {hrReviewees.map((t) => {
              const submitted = t.status === 'submitted';
              return (
                <button
                  key={`hr-${t.id}`}
                  onClick={() => !submitted && onOpenReview(t, 'hr')}
                  disabled={submitted}
                  style={{
                    ...rowStyle,
                    cursor: submitted ? 'default' : 'pointer',
                    opacity: submitted ? 0.6 : 1,
                    borderColor: 'rgba(236, 72, 153, 0.18)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background:
                        'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.18))',
                      border: '1px solid rgba(236, 72, 153, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#f9a8d4',
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
                    <div
                      style={{
                        color: 'rgba(249, 168, 212, 0.6)',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.05,
                      }}
                    >
                      HR{t.designation ? ` · ${t.designation}` : ''}
                    </div>
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
                        background: 'rgba(236, 72, 153, 0.12)',
                        color: '#f9a8d4',
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
        </>
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

const refreshBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.65)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
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
