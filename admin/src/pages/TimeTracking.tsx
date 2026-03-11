import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  DatePicker,
  Select,
  Row,
  Col,
  Space,
  Badge,
  Button,
  message,
} from 'antd';
import { DownloadOutlined, ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import type { WorkSession, User } from '../types';
import { timeTrackingApi } from '../api/time-tracking.api';
import { formatDuration, formatDate, formatTime } from '../utils/format';
import { downloadCsv } from '../utils/export';
import apiClient from '../api/client';

const { RangePicker } = DatePicker;

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

  return (
    <span
      style={{
        fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
        fontSize: 13,
        color: '#10b981',
        fontWeight: 600,
        textShadow: 'none',
        letterSpacing: '0.04em',
      }}
    >
      {display}
    </span>
  );
}

function ActiveSessionsTab() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActive = useCallback(async () => {
    try {
      const res = await timeTrackingApi.getActiveSessions();
      setSessions(res.data);
    } catch {
      message.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 30000);
    return () => clearInterval(interval);
  }, [fetchActive]);

  const columns: ColumnsType<WorkSession> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, record) => (
        <Space>
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Badge status="processing" color="#10b981" />
          </span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {record.user
              ? `${record.user.firstName} ${record.user.lastName}`
              : record.userId}
          </span>
        </Space>
      ),
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (val: string) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {formatDate(val)} {formatTime(val)}
        </span>
      ),
    },
    {
      title: 'Live Duration',
      key: 'duration',
      render: (_, record) => <LiveDuration startTime={record.startTime} />,
    },
    {
      title: 'Idle Time',
      dataIndex: 'idleDuration',
      key: 'idleDuration',
      render: (val: number) => (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDuration(val || 0)}</span>
      ),
    },
  ];

  return (
    <div>
      {sessions.length === 0 && !loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: 'var(--text-muted)',
          }}
        >
          <ClockCircleOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          <div style={{ fontSize: 15 }}>No active sessions right now</div>
        </div>
      )}
      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: ' ' }}
        rowClassName={() => 'modern-row'}
        style={{ display: sessions.length === 0 && !loading ? 'none' : undefined }}
      />
    </div>
  );
}

function SessionHistoryTab() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<User[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit,
      };
      if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');
      if (userId) params.userId = userId;

      const res = await timeTrackingApi.getSessions(params);
      setSessions(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load session history');
    } finally {
      setLoading(false);
    }
  }, [page, limit, dateRange, userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/users', { params: { limit: 200 } });
        const raw = (res as any).data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setUsers(list);
      } catch {
        // User filter unavailable
      }
    })();
  }, []);

  const handleExportCsv = () => {
    if (sessions.length === 0) {
      message.warning('No data to export');
      return;
    }
    const headers = [
      'Employee',
      'Date',
      'Start Time',
      'End Time',
      'Total Duration',
      'Active Duration',
      'Idle Duration',
    ];
    const rows = sessions.map((s) => [
      s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId,
      formatDate(s.startTime),
      formatTime(s.startTime),
      s.endTime ? formatTime(s.endTime) : 'In Progress',
      formatDuration(s.totalDuration || 0),
      formatDuration(s.activeDuration || 0),
      formatDuration(s.idleDuration || 0),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    downloadCsv(csv, `sessions-${dayjs().format('YYYY-MM-DD')}.csv`);
  };

  const columns: ColumnsType<WorkSession> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, record) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {record.user
            ? `${record.user.firstName} ${record.user.lastName}`
            : record.userId}
        </span>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'startTime',
      key: 'date',
      render: (val: string) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDate(val)}</span>
      ),
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (val: string) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatTime(val)}</span>
      ),
    },
    {
      title: 'End Time',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (val: string | null) => (
        <span style={{ color: val ? 'var(--text-secondary)' : '#10b981', fontSize: 13, fontWeight: val ? 400 : 500 }}>
          {val ? formatTime(val) : 'In Progress'}
        </span>
      ),
    },
    {
      title: 'Total Duration',
      dataIndex: 'totalDuration',
      key: 'totalDuration',
      render: (val: number) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatDuration(val || 0)}</span>
      ),
    },
    {
      title: 'Active Duration',
      dataIndex: 'activeDuration',
      key: 'activeDuration',
      render: (val: number) => (
        <span style={{ color: '#10b981', fontWeight: 500 }}>{formatDuration(val || 0)}</span>
      ),
    },
    {
      title: 'Idle Duration',
      dataIndex: 'idleDuration',
      key: 'idleDuration',
      render: (val: number) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDuration(val || 0)}</span>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 20,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10}>
            <RangePicker
              style={{
                width: '100%',
                borderRadius: 8,
              }}
              onChange={(dates) => {
                setDateRange(
                  dates as [Dayjs | null, Dayjs | null] | null
                );
                setPage(1);
              }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select
              style={{ width: '100%', borderRadius: 8 }}
              placeholder="Filter by employee"
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={(val) => {
                setUserId(val);
                setPage(1);
              }}
              options={users.map((u) => ({
                value: u.id,
                label: `${u.firstName} ${u.lastName}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={6} style={{ textAlign: 'right' }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportCsv}
              style={{
                borderRadius: 10,
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
                fontWeight: 500,
              }}
            >
              Export CSV
            </Button>
          </Col>
        </Row>
      </div>
      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        rowClassName={() => 'modern-row'}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `Total ${t} sessions`,
        }}
      />
    </div>
  );
}

export default function TimeTrackingPage() {
  const [activeTab, setActiveTab] = useState('active');

  return (
    <div style={{ padding: 0, animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Custom Tab Nav */}
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--surface-sunken)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 20,
          gap: 2,
        }}
      >
        {[
          { key: 'active', label: 'Active Sessions', icon: <ClockCircleOutlined /> },
          { key: 'history', label: 'Session History', icon: <HistoryOutlined /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.18s ease',
              background: activeTab === tab.key ? 'var(--surface-card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <Card
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
          background: 'var(--surface-card)',
        }}
        bodyStyle={{ padding: 24 }}
      >
        {activeTab === 'active' ? <ActiveSessionsTab /> : <SessionHistoryTab />}
      </Card>
    </div>
  );
}
