import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button } from 'antd';
import {
  LogoutOutlined,
  MinusOutlined,
  CloseOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { getMe } from '../api/client';
import { User } from '../types';
import Timer from '../components/Timer';
import SessionHistory from '../components/SessionHistory';
import FocusScorePanel from '../components/FocusScorePanel';
import CoachingPanel from '../components/CoachingPanel';
import IdleIndicator from '../components/IdleIndicator';
import TimelinePanel from '../components/TimelinePanel';
import ProfilePanel from '../components/ProfilePanel';
import LeaveRequestPanel from '../components/LeaveRequestPanel';
import OnboardingTutorial from '../components/OnboardingTutorial';

const { Content } = Layout;

type TabKey = 'dashboard' | 'timeline' | 'leaves' | 'profile';

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  timeline: <FieldTimeOutlined />,
  leaves: <CalendarOutlined />,
  profile: <UserOutlined />,
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'leaves', label: 'Leaves' },
  { key: 'profile', label: 'Profile' },
];

function useLiveClock(timezone?: string) {
  const [time, setTime] = useState('');
  const [tz, setTz] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const opts: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        ...(timezone ? { timeZone: timezone } : {}),
      };
      setTime(now.toLocaleTimeString('en-US', opts));

      const tzOpts: Intl.DateTimeFormatOptions = {
        timeZoneName: 'short',
        ...(timezone ? { timeZone: timezone } : {}),
      };
      const tzLabel = new Intl.DateTimeFormat('en-US', tzOpts)
        .formatToParts(now)
        .find((p) => p.type === 'timeZoneName')?.value || '';
      setTz(tzLabel);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  return { time, tz };
}

export default function Home() {
  const { user: authUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [fullUser, setFullUser] = useState<User | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getMe().then((res) => {
      setFullUser(res.data || res);
    }).catch(() => {});
  }, []);

  const user = fullUser || authUser;
  const shiftTimezone = fullUser?.shift?.timezone;
  const { time: clockTime, tz: clockTz } = useLiveClock(shiftTimezone);

  const handleMinimize = () => {
    window.electronAPI.minimizeToTray();
  };

  const handleQuit = () => {
    window.electronAPI.quitApp();
  };

  return (
    <Layout style={{ height: '100vh', background: '#0a0a0f', overflow: 'hidden' }}>
      <OnboardingTutorial />
      {/* Header */}
      <div
        style={{
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 40,
          flexShrink: 0,
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          // @ts-ignore - Electron-specific CSS property
          WebkitAppRegion: 'drag',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            className="ai-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#7c5cfc',
              boxShadow: '0 0 8px rgba(124, 92, 252, 0.6)',
              flexShrink: 0,
            }}
          />
          <span
            className="ai-gradient-text"
            style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}
          >
            Pulse
          </span>
        </div>

        {/* Window Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={handleMinimize}
            style={{ width: 28, height: 28, border: 'none' }}
          />
          <Button
            type="text"
            size="small"
            icon={<LogoutOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={logout}
            style={{ width: 28, height: 28, border: 'none' }}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={handleQuit}
            style={{ width: 28, height: 28, border: 'none' }}
          />
        </div>
      </div>

      {/* Tab Navigation Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          flexShrink: 0,
          background: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
          gap: 8,
        }}
      >
        {/* Left: User Name - Designation */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {user && (
            <span
              style={{
                fontSize: 11,
                color: 'rgba(255, 255, 255, 0.55)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {user.firstName} {user.lastName}
              {user.designation && (
                <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontWeight: 400 }}>
                  {' '}&mdash; {user.designation}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Center: Tabs */}
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: 2,
            gap: 2,
            flexShrink: 0,
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  transition: 'all 0.25s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(91, 141, 239, 0.15))'
                    : 'transparent',
                  color: isActive ? '#7c5cfc' : 'rgba(255, 255, 255, 0.3)',
                  boxShadow: isActive ? '0 0 12px rgba(124, 92, 252, 0.15)' : 'none',
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1, display: 'flex' }}>{TAB_ICONS[tab.key]}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: Clock + Timezone */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
          {clockTime && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.55)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {clockTime}
              </span>
              {clockTz && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: 'rgba(124, 92, 252, 0.6)',
                  letterSpacing: 0.3,
                }}>
                  {clockTz}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <IdleIndicator />

      <Content
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          background: '#0a0a0f',
          flex: 1,
          minHeight: 0,
        }}
      >
        {activeTab === 'dashboard' && (
          <div style={{ padding: 10, display: 'grid', gap: 10 }}>
            <Timer />
            <FocusScorePanel />
            <SessionHistory />
            <CoachingPanel />
          </div>
        )}
        {activeTab === 'timeline' && <TimelinePanel />}
        {activeTab === 'leaves' && <LeaveRequestPanel />}
        {activeTab === 'profile' && <ProfilePanel />}
      </Content>
    </Layout>
  );
}
