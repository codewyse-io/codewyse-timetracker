import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Spin,
  InputNumber,
  Segmented,
  DatePicker,
  message,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import type { WorkSession } from '../types';
import { timeTrackingApi } from '../api/time-tracking.api';
import { usersApi } from '../api/users.api';
import { formatCurrency, formatDuration } from '../utils/format';

interface DailyRow {
  date: string; // YYYY-MM-DD
  displayDate: string;
  totalDuration: number;
  activeDuration: number;
  idleDuration: number;
  sessionCount: number;
  sessionIds: string[]; // for editing — we'll update the largest session
  sessions: WorkSession[];
}

export default function PayrollDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialStart = searchParams.get('startDate') || dayjs().startOf('week').format('YYYY-MM-DD');
  const hourlyRate = parseFloat(searchParams.get('rate') || '0');

  type ViewMode = 'Weekly' | 'Monthly';
  const [viewMode, setViewMode] = useState<ViewMode>('Weekly');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs(initialStart));

  const startDate = viewMode === 'Weekly'
    ? selectedDate.startOf('week').format('YYYY-MM-DD')
    : selectedDate.startOf('month').format('YYYY-MM-DD');
  const endDate = viewMode === 'Weekly'
    ? selectedDate.endOf('week').format('YYYY-MM-DD')
    : selectedDate.endOf('month').format('YYYY-MM-DD');

  const [userName, setUserName] = useState('');
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await timeTrackingApi.getSessions({
        userId,
        startDate,
        endDate,
        limit: 200,
      });
      setSessions(res.data?.data || []);
    } catch {
      message.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!userId) return;
    usersApi.getUsers({ limit: 200 }).then((res) => {
      const users = res.data?.data || [];
      const user = users.find((u: any) => u.id === userId);
      if (user) setUserName(`${user.firstName} ${user.lastName}`);
    }).catch(() => {});
  }, [userId]);

  // Aggregate sessions by date
  const dailyRows: DailyRow[] = [];
  const dateMap = new Map<string, DailyRow>();

  for (const ses of sessions) {
    const date = dayjs(ses.startTime).format('YYYY-MM-DD');
    if (!dateMap.has(date)) {
      dateMap.set(date, {
        date,
        displayDate: dayjs(ses.startTime).format('ddd, MMM D, YYYY'),
        totalDuration: 0,
        activeDuration: 0,
        idleDuration: 0,
        sessionCount: 0,
        sessionIds: [],
        sessions: [],
      });
    }
    const row = dateMap.get(date)!;
    row.totalDuration += ses.totalDuration || 0;
    row.activeDuration += ses.activeDuration || 0;
    row.idleDuration += ses.idleDuration || 0;
    row.sessionCount += 1;
    row.sessionIds.push(ses.id);
    row.sessions.push(ses);
  }

  // Sort by date descending
  dateMap.forEach((v) => dailyRows.push(v));
  dailyRows.sort((a, b) => b.date.localeCompare(a.date));

  const totalActive = dailyRows.reduce((s, r) => s + r.activeDuration, 0);
  const totalIdle = dailyRows.reduce((s, r) => s + r.idleDuration, 0);
  const totalPayable = (totalActive / 3600) * hourlyRate;

  const handleSaveEdit = useCallback(async (row: DailyRow, newActiveSeconds: number) => {
    setSaving(true);
    try {
      // Distribute the new active time across sessions proportionally
      const currentTotal = row.activeDuration || 1;
      const ratio = newActiveSeconds / currentTotal;

      for (const ses of row.sessions) {
        if (ses.status !== 'completed') continue;
        const newSesActive = Math.round((ses.activeDuration || 0) * ratio);
        const clamped = Math.max(0, Math.min(newSesActive, ses.totalDuration));
        await timeTrackingApi.updateSession(ses.id, clamped);
      }

      message.success('Hours updated for ' + row.displayDate);
      setEditingDate(null);
      fetchSessions();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update hours');
    } finally {
      setSaving(false);
    }
  }, [fetchSessions]);

  const periodLabel = dayjs(startDate).format('MMM D') + ' — ' + dayjs(endDate).format('MMM D, YYYY');

  const columns: ColumnsType<DailyRow> = [
    {
      title: 'Date',
      key: 'date',
      width: 180,
      render: (_, row) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>
          {row.displayDate}
        </span>
      ),
    },
    {
      title: 'Sessions',
      key: 'sessions',
      width: 80,
      align: 'center' as const,
      render: (_, row) => (
        <span style={{
          background: 'var(--surface-sunken)',
          padding: '2px 10px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          {row.sessionCount}
        </span>
      ),
    },
    {
      title: 'Total Time',
      key: 'total',
      width: 120,
      render: (_, row) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {formatDuration(row.totalDuration)}
        </span>
      ),
    },
    {
      title: 'Active Time',
      key: 'active',
      width: 200,
      render: (_, row) => {
        if (editingDate === row.date) {
          const hours = Math.floor(editValue / 3600);
          const mins = Math.floor((editValue % 3600) / 60);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <InputNumber
                size="small"
                min={0}
                max={Math.floor(row.totalDuration / 3600)}
                value={hours}
                onChange={(h) => setEditValue(((h ?? 0) * 3600) + (mins * 60))}
                style={{ width: 50 }}
                controls={false}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>h</span>
              <InputNumber
                size="small"
                min={0}
                max={59}
                value={mins}
                onChange={(m) => setEditValue((hours * 3600) + ((m ?? 0) * 60))}
                style={{ width: 50 }}
                controls={false}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>m</span>
              <Button
                size="small"
                type="primary"
                loading={saving}
                onClick={() => handleSaveEdit(row, editValue)}
                style={{ fontSize: 11, padding: '0 8px', height: 24 }}
              >
                Save
              </Button>
              <Button
                size="small"
                onClick={() => setEditingDate(null)}
                style={{ fontSize: 11, padding: '0 6px', height: 24 }}
              >
                Cancel
              </Button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
              {formatDuration(row.activeDuration)}
            </span>
            <EditOutlined
              onClick={() => {
                setEditingDate(row.date);
                setEditValue(row.activeDuration);
              }}
              style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}
            />
          </div>
        );
      },
    },
    {
      title: 'Idle Time',
      key: 'idle',
      width: 100,
      render: (_, row) => (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {formatDuration(row.idleDuration)}
        </span>
      ),
    },
    {
      title: 'Payable',
      key: 'payable',
      width: 100,
      render: (_, row) => (
        <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
          {formatCurrency((row.activeDuration / 3600) * hourlyRate)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/payroll')}
            style={{ color: 'var(--text-secondary)' }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {userName || 'Loading...'}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{periodLabel}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Segmented
            options={['Weekly', 'Monthly']}
            value={viewMode}
            onChange={(val) => setViewMode(val as ViewMode)}
          />
          <DatePicker
            picker={viewMode === 'Weekly' ? 'week' : 'month'}
            value={selectedDate}
            onChange={(date) => { if (date) setSelectedDate(date); }}
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Active', value: formatDuration(totalActive), color: '#10b981' },
          { label: 'Total Idle', value: formatDuration(totalIdle), color: 'var(--text-secondary)' },
          { label: 'Working Days', value: String(dailyRows.length), color: '#6366f1' },
          { label: 'Total Sessions', value: String(sessions.length), color: '#3b82f6' },
          { label: 'Payable', value: formatCurrency(totalPayable), color: '#10b981' },
          { label: 'Rate', value: formatCurrency(hourlyRate) + '/hr', color: '#8b5cf6' },
        ].map((item) => (
          <Card
            key={item.label}
            style={{
              flex: '1 1 140px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xs)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
              {item.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Daily Breakdown Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <Card
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-xs)',
          }}
          styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' } }}
        >
          <div style={{ padding: '20px 22px 12px' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Daily Breakdown
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Click the edit icon to adjust active hours for any day
            </p>
          </div>
          <Table
            dataSource={dailyRows}
            columns={columns}
            rowKey="date"
            pagination={false}
            locale={{
              emptyText: <div style={{ padding: 40, color: 'var(--text-muted)' }}>No sessions found for this period</div>,
            }}
            summary={() => {
              if (dailyRows.length === 0) return null;
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>Total</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    <span style={{ fontWeight: 600, color: '#166534' }}>{sessions.length}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>
                      {formatDuration(dailyRows.reduce((s, r) => s + r.totalDuration, 0))}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>
                      {formatDuration(totalActive)}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                      {formatDuration(totalIdle)}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <span style={{ fontWeight: 700, color: '#10b981', fontSize: 15 }}>
                      {formatCurrency(totalPayable)}
                    </span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
}
