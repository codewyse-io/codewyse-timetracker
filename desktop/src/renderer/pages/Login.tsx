import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, MinusOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const { login, error } = useAuth();
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const onFinish = async (values: { email: string; password: string; remember: boolean }) => {
    setLoading(true);
    setLocalError(null);
    try {
      await login(values.email, values.password);
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0f',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
          userSelect: 'none',
          // @ts-ignore
          WebkitAppRegion: 'drag',
        }}
      >
        <div style={{ display: 'flex', gap: 0, flexShrink: 0, WebkitAppRegion: 'no-drag' } as any}>
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={() => window.electronAPI.minimizeToTray()}
            style={{ width: 36, height: 32, border: 'none', borderRadius: 0 }}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />}
            onClick={() => window.electronAPI.quitApp()}
            style={{ width: 36, height: 32, border: 'none', borderRadius: 0 }}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(12px, 3vw, 16px)',
        }}
      >
      {/* Ambient background orbs */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: 'clamp(120px, 30vw, 250px)',
          height: 'clamp(120px, 30vw, 250px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 92, 252, 0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'orb-drift 12s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '8%',
          width: 'clamp(150px, 35vw, 300px)',
          height: 'clamp(150px, 35vw, 300px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 239, 176, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'orb-drift 15s ease-in-out infinite 3s',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '55%',
          right: '35%',
          width: 'clamp(90px, 22vw, 180px)',
          height: 'clamp(90px, 22vw, 180px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(91, 141, 239, 0.09) 0%, transparent 70%)',
          filter: 'blur(50px)',
          animation: 'orb-drift 18s ease-in-out infinite 6s',
          pointerEvents: 'none',
        }}
      />

      {/* Login card */}
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 'clamp(24px, 5vw, 40px)',
          position: 'relative',
          animation: 'breathe 6s ease-in-out infinite',
        }}
      >
        {/* Glow border effect */}
        <div
          style={{
            position: 'absolute',
            inset: -1,
            borderRadius: 17,
            background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), transparent 40%, transparent 60%, rgba(56, 239, 176, 0.1))',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />

        <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center', marginBottom: 8 }}>
          {/* AI Pulse indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ position: 'relative', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c5cfc, #38efb3)',
                  boxShadow: '0 0 20px rgba(124, 92, 252, 0.4)',
                }}
              />
              <div className="pulse-ring" />
              <div className="pulse-ring" style={{ animationDelay: '0.7s' }} />
            </div>
          </div>

          <Title
            level={2}
            className="ai-gradient-text"
            style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em', fontSize: 'clamp(22px, 4vw, 30px)', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
          >
            PulseTrack
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 'clamp(11px, 1.8vw, 13px)', letterSpacing: '0.04em' }}>
            Your AI Work Companion
          </Text>
        </Space>

        {(error || localError) && (
          <Alert
            message={error || localError}
            type="error"
            showIcon
            closable
            style={{
              marginTop: 20,
              marginBottom: 4,
              background: 'rgba(255, 77, 79, 0.06)',
              border: '1px solid rgba(255, 77, 79, 0.15)',
              borderRadius: 10,
            }}
            onClose={() => setLocalError(null)}
          />
        )}

        <Form
          name="login"
          onFinish={onFinish}
          style={{ marginTop: 'clamp(16px, 4vw, 28px)' }}
          initialValues={{ remember: true }}
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.25)' }} />}
              placeholder="Email"
              autoFocus
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                height: 'clamp(40px, 6vw, 46px)',
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.25)' }} />}
              placeholder="Password"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                height: 'clamp(40px, 6vw, 46px)',
              }}
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked">
            <Checkbox style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Remember me</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 'clamp(40px, 6vw, 46px)',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #7c5cfc 0%, #5b8def 100%)',
                border: 'none',
                fontWeight: 600,
                fontSize: 'clamp(12px, 1.8vw, 14px)',
                letterSpacing: '0.02em',
                boxShadow: '0 4px 20px rgba(124, 92, 252, 0.3)',
                transition: 'all 0.3s ease',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        {/* Bottom subtle branding */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 'clamp(16px, 4vw, 28px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: 'clamp(9px, 1.5vw, 11px)', letterSpacing: '0.06em' }}>
            Powered by CodeWyse
          </Text>
        </div>
      </div>

      <style>{`
        .ant-input, .ant-input-password input, .ant-input-affix-wrapper input {
          color: #fff !important;
        }
        .ant-input::placeholder, .ant-input-password input::placeholder, .ant-input-affix-wrapper input::placeholder {
          color: rgba(255,255,255,0.35) !important;
        }
        .ant-input-affix-wrapper {
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        .ant-input-affix-wrapper:hover, .ant-input-affix-wrapper:focus, .ant-input-affix-wrapper-focused {
          border-color: rgba(124,92,252,0.5) !important;
        }
        .ant-input-password .ant-input-suffix .anticon {
          color: rgba(255,255,255,0.3) !important;
        }
      `}</style>
      </div>
    </div>
  );
}
