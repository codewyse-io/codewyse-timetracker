import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Tooltip } from 'antd';
import {
  LogoutOutlined,
  MinusOutlined,
  CloseOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  CalendarOutlined,
  SoundOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
import UpdateBanner from '../components/UpdateBanner';
import AnnouncementsPanel from '../components/AnnouncementsPanel';

const { Content } = Layout;

type TabKey = 'dashboard' | 'timeline' | 'leaves' | 'announcements' | 'profile';

const NAV_ITEMS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: 'timeline', label: 'Timeline', icon: <FieldTimeOutlined /> },
  { key: 'leaves', label: 'Leaves', icon: <CalendarOutlined /> },
  { key: 'announcements', label: 'Notices', icon: <SoundOutlined /> },
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

const SIDEBAR_EXPANDED = 180;
const SIDEBAR_COLLAPSED = 54;

export default function Home() {
  const { user: authUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const handleMinimize = () => {
    window.electronAPI.minimizeToTray();
  };

  const handleQuit = () => {
    window.electronAPI.quitApp();
  };

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '';

  return (
    <Layout style={{ height: '100vh', background: '#0a0a0f', overflow: 'hidden' }}>
      <OnboardingTutorial />
      <UpdateBanner />

      {/* Title Bar — drag region + window controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: 32,
          flexShrink: 0,
          background: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          paddingRight: 4,
          // @ts-ignore
          WebkitAppRegion: 'drag',
        }}
      >
        <div style={{ display: 'flex', gap: 0, flexShrink: 0, WebkitAppRegion: 'no-drag' } as any}>
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={handleMinimize}
            style={{ width: 36, height: 32, border: 'none', borderRadius: 0 }}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={handleQuit}
            style={{ width: 36, height: 32, border: 'none', borderRadius: 0 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <div
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Brand */}
          <div
            style={{
              padding: collapsed ? '16px 0' : '16px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#7c5cfc',
                boxShadow: '0 0 10px rgba(124, 92, 252, 0.6)',
                flexShrink: 0,
              }}
            />
            {!collapsed && (
              <span
                className="ai-gradient-text"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                Pulse
              </span>
            )}
          </div>

          {/* Nav Items */}
          <div style={{ flex: 1, padding: collapsed ? '8px 6px' : '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              const btn = (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: collapsed ? '10px 0' : '9px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: 0.1,
                    transition: 'all 0.2s ease',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(91, 141, 239, 0.1))'
                      : 'transparent',
                    color: isActive ? '#a78bfa' : 'rgba(255, 255, 255, 0.45)',
                    boxShadow: isActive ? '0 0 20px rgba(124, 92, 252, 0.08)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{
                    fontSize: 16,
                    lineHeight: 1,
                    display: 'flex',
                    flexShrink: 0,
                    color: isActive ? '#a78bfa' : 'rgba(255, 255, 255, 0.4)',
                  }}>
                    {item.icon}
                  </span>
                  {!collapsed && item.label}
                </button>
              );
              return collapsed ? (
                <Tooltip key={item.key} title={item.label} placement="right">
                  {btn}
                </Tooltip>
              ) : (
                <React.Fragment key={item.key}>{btn}</React.Fragment>
              );
            })}
          </div>

          {/* Bottom: Clock + User + Collapse toggle */}
          <div
            style={{
              padding: collapsed ? '10px 6px' : '10px 10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flexShrink: 0,
            }}
          >
            {/* Clock */}
            {!collapsed && clockTime && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, padding: '0 4px' }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
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

            {/* User avatar + name — click to open profile */}
            {user && (
              <Tooltip title={collapsed ? 'Profile' : ''} placement="right">
                <div
                  onClick={() => setActiveTab('profile')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: collapsed ? '6px 0' : '6px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    borderRadius: 10,
                    transition: 'background 0.2s ease',
                    background: activeTab === 'profile'
                      ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(91, 141, 239, 0.08))'
                      : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'profile') (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'profile') (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: activeTab === 'profile'
                      ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.3), rgba(91, 141, 239, 0.25))'
                      : 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(91, 141, 239, 0.15))',
                    border: `1px solid ${activeTab === 'profile' ? 'rgba(124, 92, 252, 0.3)' : 'rgba(124, 92, 252, 0.15)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#a78bfa',
                    flexShrink: 0,
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    transition: 'all 0.2s ease',
                  }}>
                    {initials}
                  </div>
                  {!collapsed && (
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: activeTab === 'profile' ? '#a78bfa' : 'rgba(255, 255, 255, 0.85)',
                        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        transition: 'color 0.2s ease',
                      }}>
                        {user.firstName} {user.lastName}
                      </div>
                      {user.designation && (
                        <div style={{
                          fontSize: 10,
                          color: 'rgba(255, 255, 255, 0.3)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {user.designation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Tooltip>
            )}

            {/* Collapse toggle + Logout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              justifyContent: collapsed ? 'center' : 'space-between',
            }}>
              <Tooltip title={collapsed ? 'Expand' : 'Collapse'} placement="right">
                <Button
                  type="text"
                  size="small"
                  icon={collapsed
                    ? <MenuUnfoldOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }} />
                    : <MenuFoldOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }} />
                  }
                  onClick={() => setCollapsed(!collapsed)}
                  style={{ width: 30, height: 30, border: 'none' }}
                />
              </Tooltip>
              {!collapsed && (
                <Tooltip title="Logout" placement="right">
                  <Button
                    type="text"
                    size="small"
                    icon={<LogoutOutlined style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }} />}
                    onClick={logout}
                    style={{ width: 30, height: 30, border: 'none' }}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
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
            {activeTab === 'announcements' && <AnnouncementsPanel />}
            {activeTab === 'profile' && <ProfilePanel />}
          </Content>
        </div>
      </div>
    </Layout>
  );
}
