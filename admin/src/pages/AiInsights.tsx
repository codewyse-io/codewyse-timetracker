import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Tabs,
  Row,
  Col,
  Select,
  Button,
  Tag,
  Space,
  Timeline,
  Spin,
  Empty,
  message,
} from 'antd';
import {
  BulbOutlined,
  ThunderboltOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import type { AiInsight, CoachingTip, User } from '../types';
import {
  insightsApi,
  type EmployeeCoachingGroup,
} from '../api/insights.api';
import apiClient from '../api/client';
import { formatDate } from '../utils/format';

const INSIGHT_TYPE_CONFIG: Record<
  string,
  { color: string; label: string; borderColor: string; bg: string; textColor: string }
> = {
  productivity: { color: 'green', label: 'Productivity', borderColor: '#10b981', bg: '#f0fdf4', textColor: '#166534' },
  time_usage: { color: 'blue', label: 'Time Usage', borderColor: '#3b82f6', bg: '#eff6ff', textColor: '#1e40af' },
  pattern: { color: 'purple', label: 'Pattern', borderColor: '#8b5cf6', bg: '#f5f3ff', textColor: '#6d28d9' },
  team: { color: 'cyan', label: 'Team', borderColor: '#06b6d4', bg: '#ecfeff', textColor: '#155e75' },
};

const COACHING_CATEGORY_CONFIG: Record<
  string,
  { color: string; label: string; borderColor: string }
> = {
  productivity: { color: 'blue', label: 'Productivity', borderColor: '#3b82f6' },
  time_usage: { color: 'orange', label: 'Time Usage', borderColor: '#f59e0b' },
  workload: { color: 'red', label: 'Workload', borderColor: '#ef4444' },
};

function InsightCard({ insight }: { insight: AiInsight }) {
  const config = INSIGHT_TYPE_CONFIG[insight.type] || {
    color: 'default',
    label: insight.type,
    borderColor: 'var(--border-default)',
    bg: 'var(--surface-sunken)',
    textColor: 'var(--text-secondary)',
  };

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderLeft: `4px solid ${config.borderColor}`,
        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
        padding: '16px 18px',
        marginBottom: 12,
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-xs)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Top Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span
          style={{
            background: config.bg,
            color: config.textColor,
            border: `1px solid ${config.borderColor}30`,
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {config.label}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {formatDate(insight.generatedAt)}
        </span>
      </div>

      {/* Insight Text */}
      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: insight.recommendation ? 12 : 0 }}>
        <BulbOutlined style={{ marginRight: 7, color: '#f59e0b', fontSize: 15 }} />
        {insight.insight}
      </div>

      {/* Recommendation */}
      {insight.recommendation && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: 13,
            color: '#166534',
            lineHeight: 1.5,
          }}
        >
          <ThunderboltOutlined style={{ marginRight: 7, color: '#10b981' }} />
          <strong>Recommendation:</strong> {insight.recommendation}
        </div>
      )}
    </div>
  );
}

function TeamInsightsTab() {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const params = typeFilter
        ? { type: typeFilter as AiInsight['type'] }
        : undefined;
      const res = await insightsApi.getTeamInsights(params);
      setInsights(res.data);
    } catch {
      message.error('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await insightsApi.generateInsights();
      message.success('Insights generation started');
      setTimeout(fetchInsights, 2000);
    } catch {
      message.error('Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {/* Filter & Action Row */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>Type:</span>
            <button
              onClick={() => setTypeFilter(undefined)}
              style={{
                padding: '4px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                background: !typeFilter ? 'var(--primary)' : 'var(--surface-sunken)',
                color: !typeFilter ? '#fff' : 'var(--text-secondary)',
              }}
            >
              All
            </button>
            {Object.entries(INSIGHT_TYPE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  background: typeFilter === key ? cfg.borderColor : 'var(--surface-sunken)',
                  color: typeFilter === key ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </Col>
        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<SyncOutlined spin={generating} />}
            loading={generating}
            onClick={handleGenerate}
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              borderColor: 'var(--primary)',
              fontWeight: 500,
              height: 36,
            }}
          >
            Generate New Insights
          </Button>
        </Col>
      </Row>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : insights.length === 0 ? (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '48px 0',
            textAlign: 'center',
          }}
        >
          <BulbOutlined style={{ fontSize: 40, color: 'var(--border-light)', marginBottom: 12, display: 'block' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>No insights available yet</div>
          <div style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 4 }}>
            Click "Generate New Insights" to analyze your team's data
          </div>
        </div>
      ) : (
        insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))
      )}
    </div>
  );
}

function CoachingOverviewTab() {
  const [groups, setGroups] = useState<EmployeeCoachingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await insightsApi.getTeamCoaching();
        setGroups(res.data);
      } catch {
        message.error('Failed to load coaching data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '48px 0',
          textAlign: 'center',
        }}
      >
        <Empty description="No coaching tips available" />
      </div>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {groups.map((group) => (
        <Col xs={24} lg={12} key={group.userId}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {group.user.firstName[0]}{group.user.lastName[0]}
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                  {group.user.firstName} {group.user.lastName}
                </span>
              </div>
            }
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xs)',
            }}
            bodyStyle={{ padding: 16 }}
            headStyle={{ borderBottom: '1px solid var(--border-light)', padding: '12px 16px' }}
          >
            {group.tips.length === 0 ? (
              <Empty description="No tips" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {group.tips.map((tip) => {
                  const cfg =
                    COACHING_CATEGORY_CONFIG[tip.category] || {
                      color: 'default',
                      label: tip.category,
                      borderColor: 'var(--border-light)',
                    };
                  return (
                    <div
                      key={tip.id}
                      style={{
                        background: 'var(--surface-page)',
                        border: '1px solid var(--border-light)',
                        borderLeft: `3px solid ${cfg.borderColor}`,
                        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            background: `${cfg.borderColor}15`,
                            color: cfg.borderColor,
                            borderRadius: 5,
                            padding: '1px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {cfg.label}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {formatDate(tip.generatedAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
                        {tip.observation}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 5,
                        }}
                      >
                        <ThunderboltOutlined style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{tip.recommendation}</span>
                      </div>
                    </div>
                  );
                })}
              </Space>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function IndividualViewTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    undefined
  );
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [coaching, setCoaching] = useState<CoachingTip[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/users', { params: { limit: 200 } });
        const raw = (res as any).data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setUsers(list);
      } catch {
        // Users unavailable
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setInsights([]);
      setCoaching([]);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await insightsApi.getEmployeeInsights(selectedUserId);
        setInsights(res.data.insights);
        setCoaching(res.data.coaching);
      } catch {
        message.error('Failed to load employee insights');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedUserId]);

  return (
    <div>
      {/* Employee Selector */}
      <div style={{ marginBottom: 20 }}>
        <Select
          style={{ width: 320, borderRadius: 'var(--radius-sm)' }}
          placeholder="Select an employee to view their insights..."
          showSearch
          optionFilterProp="label"
          allowClear
          value={selectedUserId}
          onChange={setSelectedUserId}
          options={users.map((u) => ({
            value: u.id,
            label: `${u.firstName} ${u.lastName}`,
          }))}
        />
      </div>

      {!selectedUserId ? (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '60px 0',
            textAlign: 'center',
          }}
        >
          <BulbOutlined style={{ fontSize: 40, color: 'var(--border-light)', marginBottom: 14, display: 'block' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 500 }}>Select an employee</div>
          <div style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 4 }}>
            Choose an employee above to view their AI insights and coaching tips
          </div>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {/* Insights Column */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BulbOutlined style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Insights</span>
                  {insights.length > 0 && (
                    <span
                      style={{
                        background: 'var(--primary)',
                        color: '#fff',
                        borderRadius: 'var(--radius-md)',
                        padding: '1px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {insights.length}
                    </span>
                  )}
                </div>
              }
              style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-xs)',
              }}
              bodyStyle={{ padding: '16px' }}
              headStyle={{ borderBottom: '1px solid var(--border-light)', padding: '14px 16px' }}
            >
              {insights.length === 0 ? (
                <Empty description="No insights available" />
              ) : (
                insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))
              )}
            </Card>
          </Col>

          {/* Coaching Timeline Column */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ThunderboltOutlined style={{ color: '#10b981' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Coaching Timeline</span>
                  {coaching.length > 0 && (
                    <span
                      style={{
                        background: '#10b981',
                        color: '#fff',
                        borderRadius: 'var(--radius-md)',
                        padding: '1px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {coaching.length}
                    </span>
                  )}
                </div>
              }
              style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-xs)',
              }}
              bodyStyle={{ padding: '20px 16px' }}
              headStyle={{ borderBottom: '1px solid var(--border-light)', padding: '14px 16px' }}
            >
              {coaching.length === 0 ? (
                <Empty description="No coaching tips" />
              ) : (
                <Timeline
                  items={coaching.map((tip) => {
                    const cfg =
                      COACHING_CATEGORY_CONFIG[tip.category] || {
                        color: 'default',
                        label: tip.category,
                        borderColor: 'var(--text-muted)',
                      };
                    return {
                      key: tip.id,
                      color: cfg.borderColor,
                      children: (
                        <div style={{ paddingBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span
                              style={{
                                background: `${cfg.borderColor}15`,
                                color: cfg.borderColor,
                                borderRadius: 5,
                                padding: '1px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.05em',
                              }}
                            >
                              {cfg.label}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              {formatDate(tip.generatedAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                            {tip.observation}
                          </div>
                          <div
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: 'var(--radius-sm)',
                              padding: '7px 10px',
                              fontSize: 12,
                              color: '#166534',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                            }}
                          >
                            <ThunderboltOutlined style={{ color: '#10b981', marginTop: 1, flexShrink: 0 }} />
                            <span>{tip.recommendation}</span>
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default function AiInsightsPage() {
  const [activeTab, setActiveTab] = useState('team');

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      <Card
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="ai-insights-tabs"
          items={[
            {
              key: 'team',
              label: 'Team Insights',
              children: <TeamInsightsTab />,
            },
            {
              key: 'coaching',
              label: 'Coaching Overview',
              children: <CoachingOverviewTab />,
            },
            {
              key: 'individual',
              label: 'Individual View',
              children: <IndividualViewTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
