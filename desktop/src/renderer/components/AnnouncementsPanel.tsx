import React, { useEffect, useState, useCallback } from 'react';
import { Spin } from 'antd';
import {
  SoundOutlined,
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getActiveAnnouncements } from '../api/client';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'holiday' | 'meeting' | 'memo' | 'urgent';
  priority: 'low' | 'normal' | 'high';
  author: { firstName: string; lastName: string };
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  general: { color: '#7c5cfc', bg: 'rgba(124, 92, 252, 0.1)', icon: <SoundOutlined />, label: 'General' },
  holiday: { color: '#00e676', bg: 'rgba(0, 230, 118, 0.1)', icon: <CalendarOutlined />, label: 'Holiday' },
  meeting: { color: '#00d4ff', bg: 'rgba(0, 212, 255, 0.1)', icon: <TeamOutlined />, label: 'Meeting' },
  memo: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)', icon: <FileTextOutlined />, label: 'Memo' },
  urgent: { color: '#ff5252', bg: 'rgba(255, 82, 82, 0.1)', icon: <ThunderboltOutlined />, label: 'Urgent' },
};

const PRIORITY_BORDER: Record<string, string> = {
  low: 'rgba(255,255,255,0.04)',
  normal: 'rgba(124, 92, 252, 0.15)',
  high: 'rgba(255, 82, 82, 0.25)',
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const data = await getActiveAnnouncements();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setAnnouncements(list);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetch]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 30 }}>
        <Spin size="small" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div style={{ padding: 10 }}>
        <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
          <SoundOutlined style={{ fontSize: 22, color: 'rgba(255,255,255,0.15)', marginBottom: 8, display: 'block' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No announcements</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SoundOutlined style={{ fontSize: 13, color: '#7c5cfc' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Announcements
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#7c5cfc',
            background: 'rgba(124, 92, 252, 0.12)',
            padding: '1px 7px',
            borderRadius: 10,
          }}>
            {announcements.length}
          </span>
        </div>
        <button
          onClick={() => { setLoading(true); fetch(); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <ReloadOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} />
        </button>
      </div>

      {/* Announcements */}
      {announcements.map((a) => {
        const conf = TYPE_CONFIG[a.type] || TYPE_CONFIG.general;
        const borderColor = PRIORITY_BORDER[a.priority] || PRIORITY_BORDER.normal;

        return (
          <div
            key={a.id}
            className="glass-card"
            style={{
              padding: 12,
              borderLeft: `3px solid ${conf.color}`,
              borderColor: borderColor,
              transition: 'all 0.2s',
            }}
          >
            {/* Type badge + time */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 9,
                fontWeight: 600,
                color: conf.color,
                background: conf.bg,
                padding: '2px 7px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {conf.icon}
                {conf.label}
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                {timeAgo(a.createdAt)}
              </span>
            </div>

            {/* Title */}
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              marginBottom: 4,
              lineHeight: 1.3,
            }}>
              {a.title}
            </div>

            {/* Message */}
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {a.message.length > 150 ? a.message.slice(0, 150) + '...' : a.message}
            </div>

            {/* Author */}
            <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
              — {a.author?.firstName} {a.author?.lastName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
