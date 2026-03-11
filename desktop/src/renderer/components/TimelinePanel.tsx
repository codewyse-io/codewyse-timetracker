import React, { useState, useEffect, useCallback } from 'react';
import { Spin } from 'antd';
import { getSessions } from '../api/client';
import { WorkSession } from '../types';
import { formatTime, formatDuration } from '../utils/format';

interface GroupedDay {
  date: string;
  label: string;
  sessions: WorkSession[];
  totalDuration: number;
  activeDuration: number;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function toDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD
}

export default function TimelinePanel() {
  const [groups, setGroups] = useState<GroupedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString('en-CA');
  });
  const [toDate, setToDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSessions({
        startDate: fromDate,
        endDate: toDate,
        limit: 100,
      });
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

      const grouped: GroupedDay[] = Array.from(map.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, sess]) => ({
          date,
          label: formatDateLabel(date),
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
  }, [fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAll = groups.reduce((a, g) => a + g.totalDuration, 0);
  const activeAll = groups.reduce((a, g) => a + g.activeDuration, 0);

  return (
    <div style={{ display: 'grid', gap: 10, padding: 10 }}>
      {/* Filter Card */}
      <div className="glass-card" style={{ padding: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.5 }}>&#128337;</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            Timeline
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <SummaryPill label="Total" value={formatDuration(totalAll)} />
            <SummaryPill label="Active" value={formatDuration(activeAll)} color="#00e676" />
          </div>
        </div>

        {/* Date filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateInput label="From" value={fromDate} onChange={setFromDate} />
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>&#8594;</span>
          <DateInput label="To" value={toDate} onChange={setToDate} />
          {/* Quick filters */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <QuickFilter
              label="7d"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 6);
                setFromDate(d.toLocaleDateString('en-CA'));
                setToDate(new Date().toLocaleDateString('en-CA'));
              }}
            />
            <QuickFilter
              label="14d"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 13);
                setFromDate(d.toLocaleDateString('en-CA'));
                setToDate(new Date().toLocaleDateString('en-CA'));
              }}
            />
            <QuickFilter
              label="30d"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 29);
                setFromDate(d.toLocaleDateString('en-CA'));
                setToDate(new Date().toLocaleDateString('en-CA'));
              }}
            />
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin size="small" />
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card" style={{ padding: '28px 16px', textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <span style={{ fontSize: 16, opacity: 0.3 }}>&#128197;</span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
            No sessions found
            <br />
            for the selected date range
          </span>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="glass-card" style={{ padding: 12 }}>
            {/* Day Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background:
                      group.label === 'Today'
                        ? '#7c5cfc'
                        : 'rgba(255, 255, 255, 0.15)',
                    boxShadow:
                      group.label === 'Today'
                        ? '0 0 8px rgba(124, 92, 252, 0.5)'
                        : 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      group.label === 'Today'
                        ? 'rgba(255,255,255,0.9)'
                        : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {group.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.25)',
                  }}
                >
                  {group.date}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <SummaryPill
                  label="Total"
                  value={formatDuration(group.totalDuration)}
                  small
                />
                <SummaryPill
                  label="Active"
                  value={formatDuration(group.activeDuration)}
                  color="#00e676"
                  small
                />
                <SummaryPill
                  label="Sessions"
                  value={String(group.sessions.length)}
                  small
                />
              </div>
            </div>

            {/* Session entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.sessions.map((session) => {
                const isActive = session.status === 'active';
                const isOT = session.mode === 'overtime';
                const accentColor = isActive
                  ? '#00e676'
                  : isOT
                    ? '#ffab00'
                    : 'rgba(255,255,255,0.08)';

                return (
                  <div
                    key={session.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderLeft: `3px solid ${accentColor}`,
                      borderRadius: 10,
                      padding: '8px 10px',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          flexWrap: 'wrap',
                        }}
                      >
                        {isActive && <span className="ai-dot" />}
                        <span
                          style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.75)',
                            fontWeight: 500,
                          }}
                        >
                          {formatTime(session.startTime)}
                          {session.endTime
                            ? ` \u2014 ${formatTime(session.endTime)}`
                            : ''}
                        </span>
                        {isActive && (
                          <span
                            style={{
                              fontSize: 9,
                              color: '#00e676',
                              fontWeight: 600,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                            }}
                          >
                            LIVE
                          </span>
                        )}
                        {isOT && (
                          <span
                            style={{
                              fontSize: 9,
                              color: '#ffab00',
                              fontWeight: 600,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(255, 171, 0, 0.1)',
                              border: '1px solid rgba(255, 171, 0, 0.2)',
                            }}
                          >
                            OT
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: isActive
                            ? '#00e676'
                            : 'rgba(255,255,255,0.45)',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {formatDuration(session.totalDuration)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.35)',
                        }}
                      >
                        Active: {formatDuration(session.activeDuration)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.25)',
                        }}
                      >
                        Idle: {formatDuration(session.idleDuration)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* Inline date input */
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
          padding: '5px 8px',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          outline: 'none',
          cursor: 'pointer',
          colorScheme: 'dark',
        }}
      />
    </div>
  );
}

/* Quick filter button */
function QuickFilter({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(255, 255, 255, 0.03)',
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 10,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: 0.3,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(124, 92, 252, 0.12)';
        (e.currentTarget as HTMLElement).style.color = '#7c5cfc';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 92, 252, 0.2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
        (e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.45)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.06)';
      }}
    >
      {label}
    </button>
  );
}

/* Summary pill */
function SummaryPill({
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
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: small ? '2px 7px' : '4px 10px',
        borderRadius: 20,
        background: color ? `${color}10` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${color ? `${color}20` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <span
        style={{
          fontSize: small ? 8 : 9,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: small ? 9 : 10,
          fontWeight: 600,
          color: color || 'rgba(255,255,255,0.7)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}
