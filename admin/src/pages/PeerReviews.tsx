import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Empty,
  Spin,
  Modal,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  TeamOutlined,
  StarFilled,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  peerReviewsApi,
  type PeerReviewCategory,
  type PeerReviewSurveySummary,
  type PeerReviewResult,
  type PeerReviewResultsResponse,
} from '../api/peer-reviews.api';

const CATEGORY_LABEL: Record<PeerReviewCategory, string> = {
  performance: 'Performance',
  responsibility: 'Responsibility',
  knowledge: 'Knowledge',
  leadership_collaboration: 'Leadership & Collaboration',
};

const CATEGORY_COLOR: Record<PeerReviewCategory, string> = {
  performance: '#6366f1',
  responsibility: '#3b82f6',
  knowledge: '#10b981',
  leadership_collaboration: '#f59e0b',
};

function formatPeriod(yyyyMM: string): string {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-').map(Number);
  return dayjs(new Date(y, (m || 1) - 1, 1)).format('MMMM YYYY');
}

function ScoreCell({ value }: { value: number }) {
  const color =
    value >= 4 ? '#10b981' : value >= 3 ? '#f59e0b' : value > 0 ? '#ef4444' : 'var(--text-muted)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontWeight: 600 }}>
      <StarFilled style={{ fontSize: 11 }} />
      {value > 0 ? value.toFixed(2) : '—'}
    </span>
  );
}

export default function PeerReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<PeerReviewSurveySummary[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [results, setResults] = useState<PeerReviewResultsResponse | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [questionMap, setQuestionMap] = useState<Map<string, string>>(new Map());
  const [drillReviewee, setDrillReviewee] = useState<PeerReviewResult | null>(null);
  const [opening, setOpening] = useState(false);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const [surveysRes, questionsRes] = await Promise.all([
        peerReviewsApi.listSurveys(),
        peerReviewsApi.getQuestions(),
      ]);
      setSurveys(surveysRes.data || []);
      const map = new Map<string, string>();
      for (const q of questionsRes.data || []) {
        map.set(q.key, q.prompt);
      }
      setQuestionMap(map);
    } catch {
      message.error('Failed to load peer-review surveys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const loadResults = useCallback(async (surveyId: string) => {
    setResultsLoading(true);
    try {
      const res = await peerReviewsApi.getResults(surveyId);
      setResults(res.data);
    } catch {
      message.error('Failed to load survey results');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSurveyId) loadResults(selectedSurveyId);
    else setResults(null);
  }, [selectedSurveyId, loadResults]);

  const handleOpenSurvey = useCallback(async () => {
    Modal.confirm({
      title: 'Open a peer-review survey now?',
      content:
        'This opens a survey for last month covering all active team members. It will remain open for 7 days. The desktop app will show the survey within a few minutes.',
      okText: 'Open survey',
      cancelText: 'Cancel',
      onOk: async () => {
        setOpening(true);
        try {
          await peerReviewsApi.openSurvey({});
          message.success('Survey opened. Employees can start submitting reviews.');
          await loadSurveys();
        } catch (err: any) {
          const detail =
            err?.response?.data?.message || err?.message || 'Failed to open survey';
          message.error(Array.isArray(detail) ? detail.join(', ') : detail);
        } finally {
          setOpening(false);
        }
      },
    });
  }, [loadSurveys]);

  const surveyColumns: ColumnsType<PeerReviewSurveySummary> = useMemo(
    () => [
      {
        title: 'Period',
        dataIndex: 'periodMonth',
        key: 'period',
        render: (val: string) => (
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
            {formatPeriod(val)}
          </span>
        ),
      },
      {
        title: 'Window',
        key: 'window',
        render: (_, r) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {dayjs(r.opensAt).format('MMM D')} → {dayjs(r.closesAt).format('MMM D, YYYY')}
          </span>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (val: string) => (
          <Tag color={val === 'open' ? 'green' : 'default'} style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
            {val}
          </Tag>
        ),
      },
      {
        title: 'Participants',
        dataIndex: 'participantCount',
        key: 'participantCount',
        render: (v: number) => <span style={{ fontWeight: 500 }}>{v}</span>,
      },
      {
        title: 'Total Responses',
        dataIndex: 'responseCount',
        key: 'responseCount',
        render: (v: number) => <span style={{ fontWeight: 500 }}>{v}</span>,
      },
      {
        title: '',
        key: 'view',
        align: 'right',
        render: (_, r) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => setSelectedSurveyId(r.id)}>
            View Results
          </Button>
        ),
      },
    ],
    [],
  );

  const resultColumns: ColumnsType<PeerReviewResult> = useMemo(
    () => [
      {
        title: 'Employee',
        key: 'reviewee',
        render: (_, r) => (
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {r.reviewee.firstName} {r.reviewee.lastName}
          </span>
        ),
      },
      {
        title: 'Reviewers',
        dataIndex: 'reviewerCount',
        key: 'reviewerCount',
        render: (v: number) => (
          <span
            style={{
              background: 'rgba(99,102,241,0.08)',
              color: 'var(--primary)',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {v}
          </span>
        ),
      },
      {
        title: 'Overall',
        dataIndex: 'overallAverage',
        key: 'overall',
        sorter: (a, b) => a.overallAverage - b.overallAverage,
        defaultSortOrder: 'descend',
        render: (v: number) => <ScoreCell value={v} />,
      },
      {
        title: 'Performance',
        key: 'performance',
        render: (_, r) => <ScoreCell value={r.categoryAverages.performance} />,
      },
      {
        title: 'Responsibility',
        key: 'responsibility',
        render: (_, r) => <ScoreCell value={r.categoryAverages.responsibility} />,
      },
      {
        title: 'Knowledge',
        key: 'knowledge',
        render: (_, r) => <ScoreCell value={r.categoryAverages.knowledge} />,
      },
      {
        title: 'Leadership & Collab.',
        key: 'leadership',
        render: (_, r) => <ScoreCell value={r.categoryAverages.leadership_collaboration} />,
      },
      {
        title: '',
        key: 'drill',
        align: 'right',
        render: (_, r) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => setDrillReviewee(r)}>
            Details
          </Button>
        ),
      },
    ],
    [],
  );

  // ── Survey list ──
  if (!selectedSurveyId) {
    return (
      <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={opening}
            onClick={handleOpenSurvey}
            style={{
              borderRadius: 10,
              background: 'var(--primary)',
              borderColor: 'var(--primary)',
              fontWeight: 500,
            }}
          >
            Open Survey Now
          </Button>
        </div>
        <Card
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-xs)',
          }}
          bodyStyle={{ padding: 16 }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
              <Spin size="large" />
            </div>
          ) : surveys.length === 0 ? (
            <Empty
              image={
                <TeamOutlined style={{ fontSize: 48, color: 'var(--border-light)' }} />
              }
              description={
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
                    No peer-review surveys yet
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    Surveys open automatically at the start of every month, or click "Open Survey Now" above to start one immediately.
                  </div>
                </div>
              }
            />
          ) : (
            <Table
              dataSource={surveys}
              columns={surveyColumns}
              rowKey="id"
              rowClassName={() => 'modern-row'}
              pagination={{ pageSize: 12 }}
            />
          )}
        </Card>
      </div>
    );
  }

  // ── Survey results ──
  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              setSelectedSurveyId(null);
              setResults(null);
            }}
            style={{ borderRadius: 10 }}
          >
            Back
          </Button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {results ? formatPeriod(results.survey.periodMonth) : 'Survey'}
            </div>
            {results && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {results.results.length} employee{results.results.length !== 1 ? 's' : ''} rated &middot; closes {dayjs(results.survey.closesAt).format('MMM D, YYYY')}
              </div>
            )}
          </div>
        </div>
      </div>

      <Card
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        {resultsLoading || !results ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <Spin size="large" />
          </div>
        ) : results.results.length === 0 ? (
          <Empty description="No submitted responses yet" />
        ) : (
          <Table
            dataSource={results.results}
            columns={resultColumns}
            rowKey={(r) => r.reviewee.id}
            rowClassName={() => 'modern-row'}
            pagination={{ pageSize: 20 }}
          />
        )}
      </Card>

      <Modal
        open={!!drillReviewee}
        title={
          drillReviewee
            ? `${drillReviewee.reviewee.firstName} ${drillReviewee.reviewee.lastName} — individual reviews`
            : ''
        }
        onCancel={() => setDrillReviewee(null)}
        footer={null}
        width={780}
      >
        {drillReviewee && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {drillReviewee.responses.map((resp) => (
              <Card
                key={resp.id}
                size="small"
                style={{ marginBottom: 12, borderRadius: 'var(--radius-md)' }}
                bodyStyle={{ padding: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {resp.reviewer.firstName} {resp.reviewer.lastName}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {resp.submittedAt ? dayjs(resp.submittedAt).format('MMM D, YYYY h:mm A') : '—'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '4px 12px',
                    fontSize: 12,
                  }}
                >
                  {resp.answers.map((a) => (
                    <Row
                      key={a.questionKey}
                      prompt={questionMap.get(a.questionKey) || a.questionKey}
                      category={a.category}
                      score={a.score}
                    />
                  ))}
                </div>
                {resp.comment && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: 'var(--surface-sunken)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                    }}
                  >
                    "{resp.comment}"
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({
  prompt,
  category,
  score,
}: {
  prompt: string;
  category: PeerReviewCategory;
  score: number;
}) {
  const color = CATEGORY_COLOR[category];
  return (
    <>
      <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            background: color,
            flexShrink: 0,
          }}
          title={CATEGORY_LABEL[category]}
        />
        <span>{prompt}</span>
      </div>
      <div style={{ fontWeight: 600, color, textAlign: 'right' }}>{score}/5</div>
    </>
  );
}
