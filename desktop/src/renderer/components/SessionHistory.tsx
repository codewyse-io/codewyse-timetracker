import React, { useState, useEffect } from 'react';
import { Spin, Collapse } from 'antd';
import { PlayCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { getSessions } from '../api/client';
import { WorkSession } from '../types';
import { formatTime, formatDuration } from '../utils/format';

interface DayGroup {
  date: string;
  label: string;
  sessions: WorkSession[];
  totalDuration: number;
  activeDuration: number;
}

function toDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (date.toDateString() === today.toDateString()) return `Today \u2014 ${dateLabel}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday \u2014 ${dateLabel}`;
  return `${dayName} \u2014 ${dateLabel}`;
}

function toDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

export default function SessionHistory() {
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 6);
        const startDate = weekAgo.toISOString().split('T')[0];
        const response = await getSessions({ startDate, limit: 100 });
        // Backend wraps: { success, data: { data: [...], total, ... } }
        const payload = response.data || response;
        const raw = Array.isArray(payload) ? payload : (payload.data || payload);
        const sessions: WorkSession[] = Array.isArray(raw) ? raw : [];

        // Group by date
        const map = new Map<string, WorkSession[]>();
        sessions.forEach((s) => {
          const key = toDateKey(s.startTime);
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(s);
        });

        const grouped: DayGroup[] = Array.from(map.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([date, sess]) => ({
            date,
            label: toDayLabel(date),
            sessions: sess.sort(
              (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
            ),
            totalDuration: sess.reduce((a, s) => a + (s.totalDuration || 0), 0),
            activeDuration: sess.reduce((a, s) => a + (s.activeDuration || 0), 0),
          }));

        setGroups(grouped);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    loadSessions();

    const interval = setInterval(loadSessions, 60_000);

    // Refresh immediately when a session starts or stops
    const handleSessionChange = () => loadSessions();
    window.addEventListener('session-changed', handleSessionChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('session-changed', handleSessionChange);
    };
  }, []);

  const totalAll = groups.reduce((a, g) => a + g.totalDuration, 0);
  const activeAll = groups.reduce((a, g) => a + g.activeDuration, 0);
  const sessionCount = groups.reduce((a, g) => a + g.sessions.length, 0);

  const collapseItems = groups.map((group, idx) => ({
    key: group.date,
    label: (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: idx === 0 ? '#7c5cfc' : 'rgba(255, 255, 255, 0.15)',
            boxShadow: idx === 0 ? '0 0 8px rgba(124, 92, 252, 0.5)' : 'none',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: idx === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
          }}>
            {group.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <MetricPill label="Total" value={formatDuration(group.totalDuration)} small />
          <MetricPill label="Active" value={formatDuration(group.activeDuration)} color="#00e676" small />
        </div>
      </div>
    ),
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {group.sessions.map((session) => {
          const isActive = session.status === 'active';
          const isOT = session.mode === 'overtime';
          const accentColor = isActive ? '#00e676' : isOT ? '#ffab00' : 'rgba(255,255,255,0.08)';
          return (
            <div
              key={session.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: 10,
                padding: '8px 10px',
                boxShadow: isActive ? '0 0 12px rgba(0, 230, 118, 0.08)' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                  {isActive && <span className="ai-dot" />}
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                    {formatTime(session.startTime)}
                    {session.endTime ? ` \u2014 ${formatTime(session.endTime)}` : ''}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 9, color: '#00e676', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      LIVE
                    </span>
                  )}
                  {isOT && (
                    <span style={{
                      fontSize: 9, color: '#ffab00', fontWeight: 600, letterSpacing: 0.5,
                      textTransform: 'uppercase', padding: '1px 6px', borderRadius: 4,
                      background: 'rgba(255, 171, 0, 0.1)', border: '1px solid rgba(255, 171, 0, 0.2)',
                    }}>
                      OT
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 11,
                  color: isActive ? '#00e676' : 'rgba(255,255,255,0.45)',
                  fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>
                  {formatDuration(session.totalDuration)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  Active: {formatDuration(session.activeDuration)}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  Idle: {formatDuration(session.idleDuration)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    ),
  }));

  return (
    <div className="glass-card" style={{ padding: 12 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <HistoryOutlined style={{ fontSize: 13, opacity: 0.5 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          Activity Log
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
          <MetricPill label="Sessions" value={String(sessionCount)} small />
          <MetricPill label="Total" value={formatDuration(totalAll)} small />
          <MetricPill label="Active" value={formatDuration(activeAll)} color="#00e676" small />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <PlayCircleOutlined style={{ fontSize: 16, opacity: 0.3 }} />
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
            No activity recorded yet
            <br />
            activate Pulse to begin
          </span>
        </div>
      ) : (
        <Collapse
          ghost
          size="small"
          defaultActiveKey={groups.length > 0 ? [groups[0].date] : []}
          items={collapseItems}
          className="pulse-collapse"
        />
      )}

      <style>{`
        .pulse-collapse .ant-collapse-header {
          color: rgba(255,255,255,0.5) !important;
          padding: 8px 0 !important;
        }
        .pulse-collapse .ant-collapse-content-box {
          padding: 4px 0 8px !important;
        }
        .pulse-collapse .ant-collapse-item {
          border-bottom: 1px solid rgba(255,255,255,0.04) !important;
        }
        .pulse-collapse .ant-collapse-item:last-child {
          border-bottom: none !important;
        }
      `}</style>
    </div>
  );
}

function MetricPill({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '2px 7px' : '4px 10px', borderRadius: 20,
      background: color ? `${color}10` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${color ? `${color}20` : 'rgba(255,255,255,0.06)'}`,
    }}>
      <span style={{
        fontSize: small ? 8 : 9, color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase', letterSpacing: 0.3,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: small ? 9 : 10, fontWeight: 600,
        color: color || 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  );
}
