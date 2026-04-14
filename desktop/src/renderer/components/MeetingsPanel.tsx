import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Modal, Input, DatePicker, Spin, Empty, Collapse, Tag, message } from 'antd';
import {
  PlusOutlined,
  SyncOutlined,
  DisconnectOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  StopOutlined,
  EyeOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  GoogleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getGoogleCalendarAuthUrl,
  getGoogleCalendarStatus,
  disconnectGoogleCalendar,
  syncGoogleCalendar,
  getMeetings,
  createMeeting,
  startMeetingRecording,
  stopMeetingRecording,
  getMeetingDetail,
  getMeetingRecordingUrl,
  deleteMeeting,
} from '../api/client';
import { Meeting, GoogleCalendarStatus } from '../types';
import { useSocket } from '../contexts/SocketContext';

const STATUS_COLORS: Record<Meeting['status'], string> = {
  scheduled: '#1677ff',
  bot_joining: '#faad14',
  recording: '#ff4d4f',
  processing: '#fa8c16',
  completed: '#52c41a',
  failed: '#ff4d4f',
};

const STATUS_LABELS: Record<Meeting['status'], string> = {
  scheduled: 'Scheduled',
  bot_joining: 'Bot Joining',
  recording: 'Recording',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

const PLATFORM_LABELS: Record<Meeting['platform'], string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Teams',
  other: 'Other',
};

const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 16,
};

export default function MeetingsPanel() {
  const { socket } = useSocket();

  // Google Calendar state
  const [calStatus, setCalStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calLoading, setCalLoading] = useState(false);

  // Meetings state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dateFilter, setDateFilter] = useState<dayjs.Dayjs | null>(dayjs());
  const limit = 10;

  // Active tab: 'scheduled' (upcoming + in-progress) vs 'transcribed' (completed with transcript)
  const [activeTab, setActiveTab] = useState<'scheduled' | 'transcribed'>('scheduled');

  // Join meeting modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  // Live transcript
  const [liveTranscript, setLiveTranscript] = useState<{ meetingId: string; speaker: string; text: string; timestamp: string }[]>([]);
  const liveTranscriptRef = useRef<HTMLDivElement>(null);

  // Fetch calendar status
  const fetchCalStatus = useCallback(async () => {
    try {
      const res = await getGoogleCalendarStatus();
      setCalStatus(res.data || res);
    } catch {
      setCalStatus({ connected: false });
    }
  }, []);

  // Fetch meetings with pagination and date filter
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (dateFilter) {
        params.startDate = dateFilter.startOf('day').toISOString();
        params.endDate = dateFilter.endOf('day').toISOString();
      }
      const res = await getMeetings(params);
      const data = res.data || res;
      setMeetings(Array.isArray(data) ? data : data.data || []);
      setTotal(data.total || (Array.isArray(data) ? data.length : 0));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, dateFilter]);

  useEffect(() => {
    fetchCalStatus();
    fetchMeetings();
  }, [fetchCalStatus, fetchMeetings]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data: { meetingId: string; status: Meeting['status'] }) => {
      setMeetings((prev) =>
        prev.map((m) => (m.id === data.meetingId ? { ...m, status: data.status } : m)),
      );
    };

    const handleCompleted = (data: { meetingId: string }) => {
      // Refresh the specific meeting
      getMeetingDetail(data.meetingId)
        .then((res) => {
          const updated: Meeting = res.data || res;
          setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        })
        .catch(() => {});
    };

    const handleLiveTranscript = (data: { meetingId: string; speaker: string; text: string; timestamp: string }) => {
      setLiveTranscript((prev) => [...prev.slice(-200), data]); // keep last 200 entries
      // Auto-scroll
      setTimeout(() => {
        if (liveTranscriptRef.current) {
          liveTranscriptRef.current.scrollTop = liveTranscriptRef.current.scrollHeight;
        }
      }, 50);
    };

    socket.on('meeting:status', handleStatus);
    socket.on('meeting:completed', handleCompleted);
    socket.on('meeting:live-transcript', handleLiveTranscript);

    return () => {
      socket.off('meeting:status', handleStatus);
      socket.off('meeting:completed', handleCompleted);
      socket.off('meeting:live-transcript', handleLiveTranscript);
    };
  }, [socket]);

  // Google Calendar actions
  const handleConnect = async () => {
    console.log('[MeetingsPanel] handleConnect clicked');
    setCalLoading(true);
    try {
      const res = await getGoogleCalendarAuthUrl();
      console.log('[MeetingsPanel] getAuthUrl response:', res);

      // Try every possible shape: { url }, { data: { url } }, { success, data: { url } }
      const url = res?.url || res?.data?.url || res?.data?.data?.url;
      console.log('[MeetingsPanel] Extracted URL:', url);

      if (!url) {
        message.error('No auth URL returned from server');
        setCalLoading(false);
        return;
      }

      // Open in system browser
      if (window.electronAPI?.openExternal) {
        console.log('[MeetingsPanel] Opening via electronAPI.openExternal');
        await window.electronAPI.openExternal(url);
      } else {
        console.log('[MeetingsPanel] Falling back to window.open');
        window.open(url, '_blank');
      }

      message.info('Complete the Google sign-in in your browser. This will auto-detect when you return.');

      // Poll for connection status after user completes OAuth
      const pollInterval = setInterval(async () => {
        try {
          const status = await getGoogleCalendarStatus();
          const s = status?.data || status;
          if (s?.connected) {
            clearInterval(pollInterval);
            setCalStatus(s);
            setCalLoading(false);
            message.success('Google Calendar connected!');
            fetchMeetings();
          }
        } catch (err) {
          console.error('[MeetingsPanel] Status poll failed:', err);
        }
      }, 3000);

      // Stop polling after 2 minutes
      setTimeout(() => { clearInterval(pollInterval); setCalLoading(false); }, 120000);
    } catch (err: any) {
      console.error('[MeetingsPanel] handleConnect error:', err);
      message.error(`Failed to get auth URL: ${err?.message || 'unknown error'}`);
      setCalLoading(false);
    }
  };

  const handleSync = async () => {
    setCalLoading(true);
    try {
      await syncGoogleCalendar();
      message.success('Calendar synced');
      fetchMeetings();
    } catch {
      message.error('Sync failed');
    } finally {
      setCalLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setCalLoading(true);
    try {
      await disconnectGoogleCalendar();
      setCalStatus({ connected: false });
      message.success('Disconnected');
    } catch {
      message.error('Failed to disconnect');
    } finally {
      setCalLoading(false);
    }
  };

  // Meeting CRUD — create + immediately start recording
  const handleCreate = async () => {
    if (!formUrl.trim()) return;
    setSubmitting(true);
    try {
      // Auto-generate title from URL
      let title = 'Meeting';
      if (formUrl.includes('meet.google.com')) title = 'Google Meet';
      else if (formUrl.includes('zoom.us')) title = 'Zoom Meeting';
      else if (formUrl.includes('teams.microsoft.com')) title = 'Teams Meeting';

      const res = await createMeeting({ title, meetingUrl: formUrl });
      const meeting = res.data || res;
      setModalOpen(false);
      setFormUrl('');
      message.success('Joining meeting...');

      // Immediately start recording
      if (meeting?.id) {
        await startMeetingRecording(meeting.id);
      }
      fetchMeetings();
    } catch {
      message.error('Failed to join meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecord = async (id: string) => {
    try {
      await startMeetingRecording(id);
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'bot_joining' as const } : m)));
      message.success('Recording started');
    } catch {
      message.error('Failed to start recording');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopMeetingRecording(id);
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'processing' as const } : m)));
      message.success('Recording stopped');
    } catch {
      message.error('Failed to stop recording');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      message.success('Meeting deleted');
    } catch {
      message.error('Failed to delete meeting');
    }
  };

  const handleViewDetail = async (meeting: Meeting) => {
    setDetailLoading(true);
    setSelectedMeeting(meeting);
    setRecordingUrl(null);
    try {
      const res = await getMeetingDetail(meeting.id);
      setSelectedMeeting(res.data || res);
    } catch {
      // use existing data
    }
    // Fetch recording URL
    try {
      const res = await getMeetingRecordingUrl(meeting.id);
      setRecordingUrl(res.url || res.data?.url || null);
    } catch {
      // no recording
    }
    setDetailLoading(false);
  };

  // ── Detail View ──
  if (selectedMeeting) {
    return (
      <div style={{ padding: 16, fontFamily: "'Inter', sans-serif" }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => setSelectedMeeting(null)}
          style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16, padding: '4px 8px' }}
        >
          Back to Meetings
        </Button>

        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title */}
            <div style={{ ...glassCard }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600 }}>
                {selectedMeeting.title}
              </h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tag color={STATUS_COLORS[selectedMeeting.status]}>{STATUS_LABELS[selectedMeeting.status]}</Tag>
                <Tag>{PLATFORM_LABELS[selectedMeeting.platform]}</Tag>
                {selectedMeeting.durationSeconds && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {Math.round(selectedMeeting.durationSeconds / 60)} min
                  </span>
                )}
                {selectedMeeting.participants && selectedMeeting.participants.length > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {selectedMeeting.participants.length} participant(s)
                  </span>
                )}
              </div>
            </div>

            {/* AI Summary */}
            {selectedMeeting.summary && (
              <div style={{ ...glassCard, borderColor: 'rgba(124, 92, 252, 0.2)' }}>
                <h3 style={{ color: '#a78bfa', margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
                  AI Summary
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedMeeting.summary}
                </p>
              </div>
            )}

            {/* Action Items */}
            {selectedMeeting.actionItems && selectedMeeting.actionItems.length > 0 && (
              <div style={{ ...glassCard }}>
                <h3 style={{ color: '#a78bfa', margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
                  Action Items
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedMeeting.actionItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckCircleOutlined style={{ color: 'rgba(124, 92, 252, 0.6)', marginTop: 3, flexShrink: 0 }} />
                      <div>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{item.task}</span>
                        {item.assignee && (
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 8 }}>
                            -- {item.assignee}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript */}
            {selectedMeeting.transcriptText && (
              <div style={{ ...glassCard }}>
                <h3 style={{ color: '#a78bfa', margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
                  Transcript
                </h3>
                <div
                  style={{
                    maxHeight: 400,
                    overflowY: 'auto',
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {selectedMeeting.transcriptText.split('\n\n').filter(Boolean).map((block, idx) => {
                    const colonIdx = block.indexOf(':');
                    const speaker = colonIdx > -1 ? block.substring(0, colonIdx).trim() : '';
                    const text = colonIdx > -1 ? block.substring(colonIdx + 1).trim() : block;
                    const speakerColors = ['#a78bfa', '#38efb3', '#f59e0b', '#fb7185', '#67e8f9', '#fdba74'];
                    const speakerNum = parseInt(speaker.replace(/\D/g, '') || '0', 10);
                    const color = speakerColors[speakerNum % speakerColors.length];
                    return (
                      <div key={idx} style={{ marginBottom: 12 }}>
                        {speaker && (
                          <div style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 3,
                          }}>
                            {speaker}
                          </div>
                        )}
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.7 }}>
                          {text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recording Player */}
            {recordingUrl && (
              <div style={{ ...glassCard }}>
                <h3 style={{ color: '#a78bfa', margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
                  Recording
                </h3>
                <video
                  controls
                  src={recordingUrl}
                  style={{ width: '100%', borderRadius: 8, maxHeight: 360, background: '#000' }}
                />
              </div>
            )}

            {/* Error */}
            {selectedMeeting.errorMessage && (
              <div style={{ ...glassCard, borderColor: 'rgba(255, 77, 79, 0.3)' }}>
                <h3 style={{ color: '#ff4d4f', margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
                  Error
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: 13 }}>
                  {selectedMeeting.errorMessage}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div style={{ padding: 16, fontFamily: "'Inter', sans-serif" }}>
      {/* Google Calendar Banner */}
      {calStatus && !calStatus.connected && (
        <div
          style={{
            ...glassCard,
            marginBottom: 12,
            borderColor: 'rgba(22, 119, 255, 0.3)',
            background: 'rgba(22, 119, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GoogleOutlined style={{ color: '#1677ff', fontSize: 16 }} />
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              Connect Google Calendar to auto-import meetings
            </span>
          </div>
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            loading={calLoading}
            onClick={handleConnect}
          >
            Connect Google Calendar
          </Button>
        </div>
      )}

      {calStatus && calStatus.connected && (
        <div
          style={{
            ...glassCard,
            marginBottom: 12,
            borderColor: 'rgba(82, 196, 26, 0.3)',
            background: 'rgba(82, 196, 26, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GoogleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              Connected: {calStatus.email}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              icon={<SyncOutlined />}
              loading={calLoading}
              onClick={handleSync}
            >
              Sync
            </Button>
            <Button
              size="small"
              danger
              icon={<DisconnectOutlined />}
              loading={calLoading}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(['scheduled', 'transcribed'] as const).map((tab) => {
            const count =
              tab === 'scheduled'
                ? meetings.filter((m) => m.status !== 'completed').length
                : meetings.filter((m) => m.status === 'completed').length;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: active ? 'rgba(124,92,252,0.18)' : 'transparent',
                  border: active ? '1px solid rgba(124,92,252,0.35)' : '1px solid transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'scheduled' ? 'Scheduled' : 'Transcribed'}
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: active ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                      background: active ? 'rgba(124,92,252,0.2)' : 'rgba(255,255,255,0.05)',
                      borderRadius: 12,
                      padding: '2px 8px',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatePicker
            value={dateFilter}
            onChange={(d) => { setDateFilter(d); setPage(1); }}
            allowClear
            placeholder="Filter by date"
            size="small"
            style={{ borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            size="small"
            style={{
              background: 'linear-gradient(135deg, #7c5cfc, #5b8def)',
              border: 'none',
              borderRadius: 8,
            }}
          >
            Join Meeting
          </Button>
        </div>
      </div>

      {/* Meetings List — filtered by active tab */}
      {(() => {
        const visible =
          activeTab === 'scheduled'
            ? meetings.filter((m) => m.status !== 'completed')
            : meetings.filter((m) => m.status === 'completed');

        if (loading) {
          return (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          );
        }

        if (visible.length === 0) {
          return (
            <Empty
              description={
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {activeTab === 'scheduled'
                    ? 'No scheduled meetings'
                    : 'No transcribed meetings yet'}
                </span>
              }
              style={{ padding: 40 }}
            />
          );
        }

        return (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 14,
            }}
          >
            {visible.map((meeting) => (
          <React.Fragment key={meeting.id}>
            <div
              style={{
                ...glassCard,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 140,
                position: 'relative',
                borderTop: `3px solid ${STATUS_COLORS[meeting.status]}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <span
                    style={{
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {meeting.title}
                  </span>
                  <Tag
                    style={{
                      fontSize: 10,
                      lineHeight: '16px',
                      padding: '0 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                      margin: 0,
                    }}
                  >
                    {PLATFORM_LABELS[meeting.platform]}
                  </Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {meeting.scheduledStart && (
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                      {dayjs(meeting.scheduledStart).format('MMM D, h:mm A')}
                    </span>
                  )}
                  <Tag
                    color={STATUS_COLORS[meeting.status]}
                    style={{
                      fontSize: 10,
                      lineHeight: '16px',
                      padding: '0 6px',
                      borderRadius: 4,
                      margin: 0,
                      ...(meeting.status === 'recording'
                        ? { animation: 'pulse-recording 1.5s ease-in-out infinite' }
                        : {}),
                    }}
                  >
                    {STATUS_LABELS[meeting.status]}
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  flexShrink: 0,
                  justifyContent: 'flex-end',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: 10,
                }}
              >
                {meeting.status === 'scheduled' && (
                  <Button
                    type="text"
                    size="small"
                    icon={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
                    onClick={() => handleRecord(meeting.id)}
                    title="Start Recording"
                  />
                )}
                {(meeting.status === 'recording' || meeting.status === 'bot_joining') && (
                  <Button
                    type="text"
                    size="small"
                    icon={<StopOutlined style={{ color: '#ff4d4f' }} />}
                    onClick={() => handleStop(meeting.id)}
                    title="Stop Recording"
                  />
                )}
                {meeting.status === 'completed' && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined style={{ color: '#a78bfa' }} />}
                    onClick={() => handleViewDetail(meeting)}
                    title="View Details"
                  />
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                  onClick={() => handleDelete(meeting.id)}
                  title="Delete"
                />
              </div>
            </div>
            {/* Live transcript for recording meetings */}
            {meeting.status === 'recording' && (
              <div
                ref={liveTranscriptRef}
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#ff4d4f',
                    animation: 'pulse-recording 1.5s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Live Transcript
                  </span>
                </div>
                {liveTranscript
                  .filter((t) => t.meetingId === meeting.id)
                  .map((entry, idx) => (
                    <div key={idx} style={{ marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: entry.speaker === 'Speaker 0' ? '#a78bfa' : entry.speaker === 'Speaker 1' ? '#38efb3' : '#f59e0b',
                        marginRight: 6,
                      }}>
                        {entry.speaker}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                        {entry.text}
                      </span>
                    </div>
                  ))}
                {liveTranscript.filter((t) => t.meetingId === meeting.id).length === 0 && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                    Waiting for audio...
                  </span>
                )}
              </div>
            )}
          </React.Fragment>
          ))}
          </div>
        );
      })()}

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <Button
            size="small"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)' }}
          >
            ← Prev
          </Button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <Button
            size="small"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)' }}
          >
            Next →
          </Button>
        </div>
      )}

      {/* Join Meeting Modal */}
      <Modal
        title={<span style={{ color: '#fff', fontWeight: 700 }}>Join Meeting</span>}
        open={modalOpen}
        centered
        onCancel={() => { setModalOpen(false); setFormUrl(''); }}
        onOk={handleCreate}
        confirmLoading={submitting}
        okText={submitting ? 'Joining...' : 'Join & Record'}
        okButtonProps={{
          disabled: !formUrl.trim(),
          style: { background: 'linear-gradient(135deg, #7c5cfc, #5b8def)', border: 'none', borderRadius: 8, fontWeight: 600 },
        }}
        cancelButtonProps={{
          style: { borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.7)' },
        }}
        styles={{
          mask: { background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' },
          wrapper: {},
          header: { background: '#0f0f1a', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' },
          body: { background: '#0f0f1a', padding: '20px 24px' },
          footer: { background: '#0f0f1a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 24px' },
        }}
        closable
        closeIcon={<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>✕</span>}
      >
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
          Paste the meeting link and the bot will join automatically to record and transcribe.
        </p>
        <Input
          placeholder="https://meet.google.com/abc-defg-hij"
          value={formUrl}
          onChange={(e) => setFormUrl(e.target.value)}
          onPressEnter={handleCreate}
          size="large"
          autoFocus
          styles={{
            input: { color: '#fff', fontSize: 14 },
          }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#fff',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => { e.target.parentElement!.style.borderColor = '#7c5cfc'; }}
          onBlur={(e) => { e.target.parentElement!.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </Modal>

      {/* Pulse animation for recording status */}
      <style>{`
        @keyframes pulse-recording {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
