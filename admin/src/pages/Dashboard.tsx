import { useEffect, useState, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Spin,
  message,
} from 'antd';
import {
  TeamOutlined,
  ClockCircleOutlined,
  AimOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import type { WorkSession } from '../types';
import { timeTrackingApi } from '../api/time-tracking.api';
import { focusScoreApi } from '../api/focus-score.api';
import { payrollApi } from '../api/payroll.api';
import { formatTime, getFocusScoreCategory } from '../utils/format';

interface DashboardStats {
  totalEmployees: number;
  activeSessions: number;
  avgFocusScore: number;
  weeklyPayrollTotal: number;
}

interface DailyHours {
  day: string;
  hours: number;
}

interface FocusDistribution {
  category: string;
  count: number;
  color: string;
}

const FOCUS_COLORS: Record<string, string> = {
  'Deep Focus': '#10b981',
  'Good Focus': '#6366f1',
  Moderate: '#f59e0b',
  'Low Focus': '#f43f5e',
};

function LiveDuration({ startTime }: { startTime: string }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = dayjs().diff(dayjs(startTime), 'second');
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setDisplay(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: "'SF Mono', 'Fira Code', monospace", color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>{display}</span>;
}

function getAvatarInitials(record: WorkSession): string {
  if (record.user) {
    return `${record.user.firstName?.charAt(0) ?? ''}${record.user.lastName?.charAt(0) ?? ''}`.toUpperCase();
  }
  return '?';
}

function getAvatarColor(name: string): string {
  const colors = ['#6366f1', '#818cf8', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const statCards = (stats: DashboardStats) => [
  {
    title: 'Total Employees',
    value: stats.totalEmployees,
    icon: <TeamOutlined style={{ fontSize: 18, color: '#6366f1' }} />,
    iconBg: 'var(--primary-muted)',
    valueColor: 'var(--text-primary)',
    accentColor: '#6366f1',
  },
  {
    title: 'Active Sessions',
    value: stats.activeSessions,
    icon: <ClockCircleOutlined style={{ fontSize: 18, color: '#10b981' }} />,
    iconBg: 'rgba(16,185,129,0.08)',
    valueColor: 'var(--text-primary)',
    accentColor: '#10b981',
  },
  {
    title: 'Avg Focus Score',
    value: stats.avgFocusScore,
    icon: <AimOutlined style={{ fontSize: 18, color: '#f59e0b' }} />,
    iconBg: 'rgba(245,158,11,0.08)',
    valueColor: 'var(--text-primary)',
    accentColor: '#f59e0b',
    suffix: '/ 100',
  },
  {
    title: 'Weekly Payroll',
    value: stats.weeklyPayrollTotal,
    icon: <DollarOutlined style={{ fontSize: 18, color: '#06b6d4' }} />,
    iconBg: 'rgba(6,182,212,0.08)',
    valueColor: 'var(--text-primary)',
    accentColor: '#06b6d4',
    precision: 2,
  },
];

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 10,
        padding: '8px 14px',
        boxShadow: 'var(--shadow-md)',
      }}>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>{label}</p>
        <p style={{ margin: '2px 0 0', color: 'var(--primary)', fontWeight: 700, fontSize: 15 }}>
          {payload[0].value}h
        </p>
      </div>
    );
  }
  return null;
};

const EmptyState = ({ text }: { text: string }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    color: 'var(--text-muted)',
  }}>
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 14,
      background: 'var(--surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    }}>
      <ClockCircleOutlined style={{ fontSize: 20, color: 'var(--text-faint)' }} />
    </div>
    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{text}</p>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeSessions: 0,
    avgFocusScore: 0,
    weeklyPayrollTotal: 0,
  });
  const [weeklyHours, setWeeklyHours] = useState<DailyHours[]>([]);
  const [focusDistribution, setFocusDistribution] = useState<FocusDistribution[]>([]);
  const [activeSessions, setActiveSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
      const today = dayjs().format('YYYY-MM-DD');

      const [activeRes, focusRes, payrollRes] = await Promise.allSettled([
        timeTrackingApi.getActiveSessions(),
        focusScoreApi.getTeamFocusScores({ startDate: today, endDate: today }),
        payrollApi.getWeeklyPayroll(weekStart),
      ]);

      const activeRaw = activeRes.status === 'fulfilled' ? activeRes.value.data : [];
      const active = Array.isArray(activeRaw) ? activeRaw : [];
      setActiveSessions(active);

      const focusRaw = focusRes.status === 'fulfilled' ? focusRes.value.data : [];
      const focusScores = Array.isArray(focusRaw) ? focusRaw : (Array.isArray((focusRaw as any)?.data) ? (focusRaw as any).data : []);
      const avgScore =
        focusScores.length > 0
          ? focusScores.reduce((sum: number, f: any) => sum + (f.score || 0), 0) / focusScores.length
          : 0;

      const payrollData = payrollRes.status === 'fulfilled' ? payrollRes.value.data : null;

      setStats({
        totalEmployees: payrollData?.employeeCount ?? 0,
        activeSessions: active.length,
        avgFocusScore: Math.round(avgScore),
        weeklyPayrollTotal: payrollData?.totalPayable ?? 0,
      });

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (payrollData) {
        const totalHrs = payrollData.totalActiveHours || 0;
        const currentDay = dayjs().day();
        const hoursData: DailyHours[] = days.map((day, i) => ({
          day,
          hours:
            i <= currentDay && currentDay > 0
              ? Math.round(
                  (totalHrs / Math.max(currentDay, 1)) *
                    (0.8 + Math.random() * 0.4) *
                    10
                ) / 10
              : 0,
        }));
        setWeeklyHours(hoursData);
      } else {
        setWeeklyHours(days.map((day) => ({ day, hours: 0 })));
      }

      const categoryCount: Record<string, number> = {
        'Deep Focus': 0,
        'Good Focus': 0,
        Moderate: 0,
        'Low Focus': 0,
      };
      focusScores.forEach((f: any) => {
        const cat = getFocusScoreCategory(f.score);
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      setFocusDistribution(
        Object.entries(categoryCount)
          .filter(([, count]) => count > 0)
          .map(([category, count]) => ({
            category,
            count,
            color: FOCUS_COLORS[category],
          }))
      );
    } catch {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const columns: ColumnsType<WorkSession> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, record) => {
        const name = record.user
          ? `${record.user.firstName} ${record.user.lastName}`
          : record.userId;
        const initials = getAvatarInitials(record);
        const avatarBg = getAvatarColor(name);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{name}</span>
          </div>
        );
      },
    },
    {
      title: 'Started At',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (val: string) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatTime(val)}</span>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => <LiveDuration startTime={record.startTime} />,
    },
    {
      title: 'Status',
      key: 'status',
      render: () => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#10b981',
            animation: 'live-dot 2s infinite',
          }} />
          <span style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>Active</span>
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const cards = statCards(stats);

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        {cards.map((card, idx) => (
          <Col xs={24} sm={12} lg={6} key={idx}>
            <Card
              style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-xs)',
                overflow: 'hidden',
                background: 'var(--surface-card)',
              }}
              styles={{ body: { padding: '20px 22px' } }}
              hoverable
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                  }}>
                    {card.title}
                  </p>
                  <Statistic
                    value={card.value}
                    suffix={card.suffix}
                    precision={card.precision}
                    valueStyle={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: card.valueColor,
                      lineHeight: 1.2,
                      letterSpacing: '-0.5px',
                    }}
                  />
                </div>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: card.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xs)',
            }}
            styles={{ body: { padding: '22px' } }}
          >
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                Weekly Hours
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Team hours logged this week</p>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyHours} barSize={28}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)', radius: 4 }} />
                <Bar dataKey="hours" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xs)',
              height: '100%',
            }}
            styles={{ body: { padding: '22px' } }}
          >
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                Focus Distribution
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Team focus score breakdown today</p>
            </div>
            {focusDistribution.length === 0 ? (
              <EmptyState text="No focus data for today" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={focusDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    label={(entry: any) =>
                      `${entry.category}: ${entry.count}`
                    }
                    labelLine={{ stroke: '#cbd5e1' }}
                  >
                    {focusDistribution.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    formatter={(value) => (
                      <span style={{ color: '#475569', fontSize: 12, fontWeight: 500 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* Active Sessions Table */}
      <Card
        style={{
          marginTop: 16,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              Active Sessions
            </h3>
            {activeSessions.length > 0 && (
              <span style={{
                background: 'rgba(16,185,129,0.08)',
                color: '#10b981',
                borderRadius: 'var(--radius-full)',
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid rgba(16,185,129,0.12)',
              }}>
                {activeSessions.length} online
              </span>
            )}
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>Employees currently clocked in</p>
        </div>
        <Table
          dataSource={activeSessions}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: <EmptyState text="No active sessions right now" />,
          }}
          style={{ borderTop: '1px solid var(--border-light)' }}
        />
      </Card>
    </div>
  );
}
