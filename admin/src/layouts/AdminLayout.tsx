import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Dropdown,
  Avatar,
  Typography,
  ConfigProvider,
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ScheduleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BarChartOutlined,
  FileTextOutlined,
  BulbOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
  BellOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/users', icon: <TeamOutlined />, label: 'Team Members' },
  { key: '/shifts', icon: <ScheduleOutlined />, label: 'Shifts' },
  { key: '/time-tracking', icon: <ClockCircleOutlined />, label: 'Time Tracking' },
  { key: '/payroll', icon: <DollarOutlined />, label: 'Payroll' },
  { key: '/kpis', icon: <BarChartOutlined />, label: 'KPIs' },
  { key: '/reports', icon: <FileTextOutlined />, label: 'Reports' },
  { key: '/leave-requests', icon: <CalendarOutlined />, label: 'Leave Requests' },
  { key: '/ai-insights', icon: <BulbOutlined />, label: 'AI Insights' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Team Members',
  '/shifts': 'Shifts',
  '/time-tracking': 'Time Tracking',
  '/payroll': 'Payroll',
  '/kpis': 'KPIs',
  '/reports': 'Reports',
  '/leave-requests': 'Leave Requests',
  '/ai-insights': 'AI Insights',
};

const pageSubtitles: Record<string, string> = {
  '/': 'Welcome back! Here\'s your overview.',
  '/users': 'Manage your team and their roles',
  '/shifts': 'Configure work schedules',
  '/time-tracking': 'Monitor sessions and activity',
  '/payroll': 'Track compensation and billing',
  '/kpis': 'Performance metrics & targets',
  '/reports': 'Weekly performance summaries',
  '/leave-requests': 'Review and manage employee leave requests',
  '/ai-insights': 'AI-powered analysis & coaching',
};

const SIDEBAR_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 72;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleLogout,
    },
  ];

  const selectedKey = location.pathname === '/' ? '/' : '/' + location.pathname.split('/')[1];
  const pageTitle = pageTitles[selectedKey] ?? 'Dashboard';
  const pageSubtitle = pageSubtitles[selectedKey] ?? '';

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 10,
          colorBgContainer: '#ffffff',
          fontSize: 14,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Menu: {
            darkItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(255, 255, 255, 0.08)',
            darkItemHoverBg: 'rgba(255, 255, 255, 0.05)',
            darkItemSelectedColor: '#ffffff',
            darkItemColor: 'rgba(255, 255, 255, 0.55)',
            itemBorderRadius: 10,
            itemMarginInline: 8,
            itemHeight: 44,
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        {/* Sidebar */}
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          width={SIDEBAR_WIDTH}
          breakpoint="lg"
          onBreakpoint={(broken) => {
            if (broken) setCollapsed(true);
          }}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            background: '#0c0c14',
            zIndex: 100,
            transition: 'width 0.2s cubic-bezier(0.2, 0, 0, 1)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Logo area */}
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              transition: 'padding 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ThunderboltOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text
                    strong
                    style={{
                      color: '#ffffff',
                      fontSize: 16,
                      letterSpacing: '-0.3px',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                    }}
                  >
                    PulseTrack
                  </Text>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.25)',
                      fontSize: 10,
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase' as const,
                      fontWeight: 500,
                    }}
                  >
                    Admin
                  </Text>
                </div>
              )}
            </div>
          </div>

          {/* Navigation menu */}
          <div style={{ padding: '12px 8px', flex: 1 }}>
            {!collapsed && (
              <div style={{
                padding: '0 12px',
                marginBottom: 8,
              }}>
                <Text style={{
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                }}>
                  Menu
                </Text>
              </div>
            )}
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={handleMenuClick}
              inlineCollapsed={collapsed}
              style={{
                background: 'transparent',
                border: 'none',
              }}
              theme="dark"
            />
          </div>

          {/* Sidebar footer */}
          {!collapsed && (
            <div style={{ padding: '12px 16px 16px' }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <UserOutlined style={{ color: '#fff', fontSize: 13 }} />
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'block',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user?.firstName} {user?.lastName}
                  </Text>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.25)',
                      fontSize: 10,
                      display: 'block',
                      lineHeight: 1.3,
                    }}
                  >
                    Administrator
                  </Text>
                </div>
              </div>
            </div>
          )}
        </Sider>

        {/* Main content area */}
        <Layout
          style={{
            marginLeft: sidebarWidth,
            transition: 'margin-left 0.2s cubic-bezier(0.2, 0, 0, 1)',
            background: 'var(--surface-page)',
            minHeight: '100vh',
          }}
        >
          {/* Header */}
          <Header
            style={{
              padding: '0 32px',
              background: 'var(--surface-overlay)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-light)',
              position: 'sticky',
              top: 0,
              zIndex: 99,
              height: 64,
            }}
          >
            {/* Left: toggle + page title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: 15,
                  width: 36,
                  height: 36,
                  color: 'var(--text-secondary)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-sunken)',
                  border: 'none',
                }}
              />
              <div>
                <Text
                  strong
                  style={{
                    fontSize: 18,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.3px',
                    display: 'block',
                    lineHeight: 1.2,
                  }}
                >
                  {pageTitle}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    display: 'block',
                    lineHeight: 1.3,
                  }}
                >
                  {pageSubtitle}
                </Text>
              </div>
            </div>

            {/* Right: actions + user */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Button
                type="text"
                icon={<BellOutlined />}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <div style={{ width: 1, height: 20, background: 'var(--border-default)', margin: '0 8px' }} />
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    padding: '4px 8px 4px 4px',
                    borderRadius: 12,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-sunken)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    }}
                    size={32}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                    <Text strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {user?.firstName} {user?.lastName}
                    </Text>
                    <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>Administrator</Text>
                  </div>
                </div>
              </Dropdown>
            </div>
          </Header>

          {/* Page content */}
          <Content
            style={{
              padding: 32,
              minHeight: 'calc(100vh - 64px)',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
