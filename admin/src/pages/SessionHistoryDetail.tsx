import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  DatePicker,
  Popconfirm,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import type { WorkSession } from '../types';
import { timeTrackingApi } from '../api/time-tracking.api';
import apiClient from '../api/client';
import { formatDuration, formatDate, formatTime } from '../utils/format';

const { RangePicker } = DatePicker;

export default function SessionHistoryDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [employeeName, setEmployeeName] = useState('');

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        userId,
        page: 1,
        limit: 200,
      };
      if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');

      const res = await timeTrackingApi.getSessions(params);
      const data = res.data?.data || [];
      setSessions(data);
      if (data.length > 0 && data[0].user) {
        setEmployeeName(`${data[0].user.firstName} ${data[0].user.lastName}`);
      } else if (data.length === 0) {
        try {
          const userRes = await apiClient.get(`/users/${userId}`);
          const u = (userRes as any).data;
          if (u?.firstName) setEmployeeName(`${u.firstName} ${u.lastName}`);
        } catch {
          // fallback name not available
        }
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.message ||
        err?.message ||
        'Unknown error';
      console.error('[SessionHistoryDetail] load failed:', err);
      message.error(`Failed to load sessions: ${Array.isArray(detail) ? detail.join(', ') : detail}`);
    } finally {
      setLoading(false);
    }
  }, [userId, dateRange]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      await timeTrackingApi.deleteSession(sessionId);
      message.success('Session deleted');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      message.error('Failed to delete session');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPdf = () => {
    if (sessions.length === 0) {
      message.warning('No sessions to export');
      return;
    }

    const totalDuration = sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const totalActive = sessions.reduce((sum, s) => sum + (s.activeDuration || 0), 0);
    const totalIdle = sessions.reduce((sum, s) => sum + (s.idleDuration || 0), 0);
    const regularCount = sessions.filter((s) => (s.mode || 'regular') === 'regular').length;
    const overtimeCount = sessions.filter((s) => s.mode === 'overtime').length;

    const rangeLabel =
      dateRange?.[0] && dateRange?.[1]
        ? `${dateRange[0].format('MMM D, YYYY')} – ${dateRange[1].format('MMM D, YYYY')}`
        : 'All sessions';

    const rowsHtml = sessions
      .map((s) => {
        const mode = s.mode || 'regular';
        const modeColor = mode === 'overtime' ? '#f59e0b' : '#6366f1';
        return `
          <tr>
            <td>${formatDate(s.startTime)}</td>
            <td>${formatTime(s.startTime)}</td>
            <td>${s.endTime ? formatTime(s.endTime) : 'In Progress'}</td>
            <td><span style="background:${modeColor}15;color:${modeColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${mode}</span></td>
            <td>${formatDuration(s.totalDuration || 0)}</td>
            <td style="color:#10b981;">${formatDuration(s.activeDuration || 0)}</td>
            <td style="color:#6b7280;">${formatDuration(s.idleDuration || 0)}</td>
            <td>${s.status}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sessions - ${employeeName || 'Employee'}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 32px;
      color: #111827;
      margin: 0;
    }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
    .meta { display: flex; gap: 32px; margin-bottom: 24px; flex-wrap: wrap; }
    .meta-item { font-size: 12px; }
    .meta-item .label { color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 2px; }
    .meta-item .value { font-size: 16px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead { background: #f9fafb; }
    th { text-align: left; padding: 10px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    tr:nth-child(even) td { background: #fafbfc; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 16px; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <h1>Session History</h1>
  <div class="subtitle">${employeeName || 'Employee'} &middot; ${rangeLabel}</div>
  <div class="meta">
    <div class="meta-item">
      <div class="label">Total Sessions</div>
      <div class="value">${sessions.length}</div>
    </div>
    <div class="meta-item">
      <div class="label">Regular</div>
      <div class="value">${regularCount}</div>
    </div>
    <div class="meta-item">
      <div class="label">Overtime</div>
      <div class="value">${overtimeCount}</div>
    </div>
    <div class="meta-item">
      <div class="label">Total Duration</div>
      <div class="value">${formatDuration(totalDuration)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Active</div>
      <div class="value" style="color:#10b981;">${formatDuration(totalActive)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Idle</div>
      <div class="value" style="color:#6b7280;">${formatDuration(totalIdle)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Start</th>
        <th>End</th>
        <th>Type</th>
        <th>Total</th>
        <th>Active</th>
        <th>Idle</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">Generated ${dayjs().format('MMM D, YYYY h:mm A')}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      message.error('Pop-up blocked. Please allow pop-ups to download the PDF.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const totalDuration = sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
  const totalActive = sessions.reduce((sum, s) => sum + (s.activeDuration || 0), 0);
  const totalIdle = sessions.reduce((sum, s) => sum + (s.idleDuration || 0), 0);

  const columns: ColumnsType<WorkSession> = [
    {
      title: 'Date',
      dataIndex: 'startTime',
      key: 'date',
      render: (val: string) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDate(val)}</span>
      ),
      sorter: (a, b) => (a.startTime > b.startTime ? 1 : -1),
      defaultSortOrder: 'descend',
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
      title: 'Type',
      dataIndex: 'mode',
      key: 'mode',
      filters: [
        { text: 'Regular', value: 'regular' },
        { text: 'Overtime', value: 'overtime' },
      ],
      onFilter: (value, record) => (record.mode || 'regular') === value,
      render: (val: string | undefined) => {
        const mode = val || 'regular';
        const isOvertime = mode === 'overtime';
        return (
          <Tag
            color={isOvertime ? 'orange' : 'blue'}
            style={{
              borderRadius: 6,
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: 11,
              letterSpacing: '0.04em',
            }}
          >
            {mode}
          </Tag>
        );
      },
    },
    {
      title: 'Total Duration',
      dataIndex: 'totalDuration',
      key: 'totalDuration',
      render: (val: number) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{formatDuration(val || 0)}</span>
      ),
      sorter: (a, b) => (a.totalDuration || 0) - (b.totalDuration || 0),
    },
    {
      title: 'Active',
      dataIndex: 'activeDuration',
      key: 'activeDuration',
      render: (val: number) => (
        <span style={{ color: '#10b981', fontWeight: 500 }}>{formatDuration(val || 0)}</span>
      ),
    },
    {
      title: 'Idle',
      dataIndex: 'idleDuration',
      key: 'idleDuration',
      render: (val: number) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDuration(val || 0)}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: val === 'active' ? '#10b981' : 'var(--text-muted)',
          }}
        >
          {val}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Delete session"
          description="This will permanently remove the session. Continue?"
          onConfirm={() => handleDelete(record.id)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="Delete session">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
              size="small"
            />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/time-tracking')}
            style={{ borderRadius: 10 }}
          >
            Back
          </Button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {employeeName || 'Employee Sessions'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              All work sessions for this employee
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <RangePicker
            style={{ borderRadius: 8 }}
            value={dateRange as [Dayjs, Dayjs] | null}
            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
          />
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={handleDownloadPdf}
            style={{
              borderRadius: 10,
              background: 'var(--primary)',
              borderColor: 'var(--primary)',
              fontWeight: 500,
            }}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total Sessions" value={String(sessions.length)} />
        <StatCard
          label="Regular"
          value={String(sessions.filter((s) => (s.mode || 'regular') === 'regular').length)}
          color="#6366f1"
        />
        <StatCard
          label="Overtime"
          value={String(sessions.filter((s) => s.mode === 'overtime').length)}
          color="#f59e0b"
        />
        <StatCard label="Total Duration" value={formatDuration(totalDuration)} />
        <StatCard label="Active" value={formatDuration(totalActive)} color="#10b981" />
        <StatCard label="Idle" value={formatDuration(totalIdle)} color="#6b7280" />
      </div>

      <Card
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
          background: 'var(--surface-card)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        <Table
          dataSource={sessions}
          columns={columns}
          rowKey="id"
          loading={loading}
          rowClassName={() => 'modern-row'}
          pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `Total ${t} sessions` }}
        />
      </Card>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: color || 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}
      >
        {value}
      </div>
    </div>
  );
}
