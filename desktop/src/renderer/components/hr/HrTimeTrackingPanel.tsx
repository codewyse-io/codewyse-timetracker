import { useEffect, useState, useCallback } from 'react';
import { Spin, message, Select, DatePicker } from 'antd';
import {
  ClockCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getAllSessions, getAllActiveSessions, getAllUsersForHr } from '../../api/client';

const { RangePicker } = DatePicker;

interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface WorkSession {
  id: string;
  userId: string;
  user?: SessionUser | null;
  startTime: string;
  endTime: string | null;
  totalDuration: number;
  activeDuration: number;
  idleDuration: number;
  status: 'active' | 'completed';
  mode?: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string): string {
  return dayjs(iso).format('MMM D, YYYY');
}

function fmtTime(iso: string): string {
  return dayjs(iso).format('h:mm A');
}

type Tab = 'active' | 'history';

export default function HrTimeTrackingPanel() {
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<WorkSession[]>([]);
  const [history, setHistory] = useState<WorkSession[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'active') {
        const res = await getAllActiveSessions();
        const data = res?.data ?? res;
        setActive(Array.isArray(data) ? data : []);
      } else {
        const params: Record<string, string | number | undefined> = { page: 1, limit: 200 };
        if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
        if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');
        if (userId) params.userId = userId;
        const res = await getAllSessions(params);
        const data = res?.data?.data ?? res?.data ?? [];
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      message.error(`Failed to load sessions: ${err?.response?.data?.message || err?.message || 'unknown'}`);
    } finally {
      setLoading(false);
    }
  }, [tab, dateRange, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getAllUsersForHr()
      .then((res) => {
        const data = res?.data ?? res;
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsers([]));
  }, []);

  const exportCsv = () => {
    const rows: WorkSession[] = tab === 'active' ? active : history;
    if (rows.length === 0) {
      message.warning('Nothing to export');
      return;
    }
    const headers = ['Employee', 'Date', 'Start', 'End', 'Total', 'Active', 'Idle', 'Type', 'Status'];
    const csv = [
      headers.join(','),
      ...rows.map((s) => [
        s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId,
        fmtDate(s.startTime),
        fmtTime(s.startTime),
        s.endTime ? fmtTime(s.endTime) : 'In Progress',
        formatDuration(s.totalDuration),
        formatDuration(s.activeDuration),
        formatDuration(s.idleDuration),
        s.mode || 'regular',
        s.status,
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Tab bar */}
      <div style={tabBar}>
        {([
          { key: 'active' as Tab, label: 'Active Sessions', icon: <PlayCircleOutlined /> },
          { key: 'history' as Tab, label: 'Session History', icon: <HistoryOutlined /> },
        ]).map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...tabBtn,
                background: isActive ? 'rgba(124, 92, 252, 0.18)' : 'transparent',
                color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
              }}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {tab === 'history' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <RangePicker
                size="small"
                value={dateRange as [Dayjs, Dayjs] | null}
                onChange={(d) => setDateRange(d as [Dayjs | null, Dayjs | null] | null)}
              />
              <Select
                size="small"
                style={{ minWidth: 200 }}
                value={userId}
                placeholder="Filter by employee"
                allowClear
                showSearch
                optionFilterProp="label"
                onChange={(v) => setUserId(v)}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.firstName} ${u.lastName}`,
                }))}
              />
            </div>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
              {active.length} active session{active.length === 1 ? '' : 's'} right now
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={load} style={btnSecondary} title="Refresh">
              <ReloadOutlined spin={loading} /> Refresh
            </button>
            <button onClick={exportCsv} style={btnPrimary}>
              <DownloadOutlined /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin />
        </div>
      ) : tab === 'active' ? (
        <SessionsTable
          rows={active}
          emptyText="No active sessions right now."
          columns={['employee', 'start', 'duration', 'idle']}
        />
      ) : (
        <SessionsTable
          rows={history}
          emptyText="No sessions for the selected filters."
          columns={['employee', 'date', 'start', 'end', 'total', 'active', 'idle', 'type']}
        />
      )}
    </div>
  );
}

function SessionsTable({
  rows,
  emptyText,
  columns,
}: {
  rows: WorkSession[];
  emptyText: string;
  columns: string[];
}) {
  if (rows.length === 0) {
    return (
      <div style={{ ...panelStyle, textAlign: 'center', padding: 32 }}>
        <ClockCircleOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 10 }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{emptyText}</span>
      </div>
    );
  }

  const headerLabels: Record<string, string> = {
    employee: 'Employee',
    date: 'Date',
    start: 'Start',
    end: 'End',
    total: 'Total',
    active: 'Active',
    idle: 'Idle',
    type: 'Type',
    duration: 'Duration',
    status: 'Status',
  };

  return (
    <div style={{ ...panelStyle, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.05,
                  fontWeight: 700,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {headerLabels[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              {columns.includes('employee') && (
                <td style={cell}>
                  <span style={{ fontWeight: 600, color: '#fff' }}>
                    {s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId.slice(0, 8)}
                  </span>
                </td>
              )}
              {columns.includes('date') && <td style={cell}>{fmtDate(s.startTime)}</td>}
              {columns.includes('start') && <td style={cell}>{fmtTime(s.startTime)}</td>}
              {columns.includes('end') && (
                <td style={cell}>
                  {s.endTime ? (
                    fmtTime(s.endTime)
                  ) : (
                    <span style={{ color: '#34d399', fontWeight: 600 }}>In Progress</span>
                  )}
                </td>
              )}
              {columns.includes('total') && (
                <td style={cell}>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{formatDuration(s.totalDuration)}</span>
                </td>
              )}
              {columns.includes('duration') && (
                <td style={cell}>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{formatDuration(s.totalDuration)}</span>
                </td>
              )}
              {columns.includes('active') && (
                <td style={cell}>
                  <span style={{ color: '#34d399', fontWeight: 500 }}>{formatDuration(s.activeDuration)}</span>
                </td>
              )}
              {columns.includes('idle') && (
                <td style={cell}>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>{formatDuration(s.idleDuration)}</span>
                </td>
              )}
              {columns.includes('type') && (
                <td style={cell}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background:
                        s.mode === 'overtime' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 92, 252, 0.15)',
                      color: s.mode === 'overtime' ? '#fbbf24' : '#c4b5fd',
                    }}
                  >
                    {s.mode || 'regular'}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 12,
  marginBottom: 14,
};

const tabBar: React.CSSProperties = {
  display: 'inline-flex',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 10,
  padding: 4,
  gap: 2,
  marginBottom: 14,
};

const tabBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  transition: 'all 0.15s ease',
};

const cell: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'rgba(255,255,255,0.75)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #7c5cfc, #5b8def)',
  border: 'none',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};
