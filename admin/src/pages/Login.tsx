import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { LockOutlined, MailOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.email, values.password);
      navigate('/');
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a12',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Floating orb */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          top: '-120px',
          right: '-100px',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          animation: 'orb-float-1 15s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)',
          bottom: '-80px',
          left: '-80px',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          animation: 'orb-float-2 18s ease-in-out infinite',
        }}
      />

      {/* Login card */}
      <div
        style={{
          width: 400,
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          padding: '40px 36px 36px',
          position: 'relative',
          zIndex: 1,
          animation: 'fadeInUp 0.5s ease-out',
        }}
      >
        {/* Top accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            right: '20%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)',
          }}
        />

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
            }}
          >
            <ThunderboltOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <Title
            level={2}
            style={{
              color: '#ffffff',
              margin: 0,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              fontSize: 24,
            }}
          >
            PulseTrack
          </Title>
          <Text
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 13,
              marginTop: 4,
              display: 'block',
            }}
          >
            Sign in to your admin dashboard
          </Text>
        </div>

        {/* Error */}
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{
              marginBottom: 20,
              borderRadius: 12,
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.15)',
            }}
          />
        )}

        {/* Form */}
        <Form<LoginFormValues>
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            style={{ marginBottom: 14 }}
            rules={[
              { required: true, message: 'Enter your email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.2)', marginRight: 8 }} />}
              placeholder="Email address"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                color: '#fff',
                height: 46,
                fontSize: 14,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            style={{ marginBottom: 24 }}
            rules={[{ required: true, message: 'Enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.2)', marginRight: 8 }} />}
              placeholder="Password"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                color: '#fff',
                height: 46,
                fontSize: 14,
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 46,
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 24,
          }}
        >
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'rgba(99,102,241,0.5)',
            }}
          />
          <Text
            style={{
              color: 'rgba(255,255,255,0.15)',
              fontSize: 11,
              letterSpacing: '0.3px',
            }}
          >
            Powered By CodeWyse
          </Text>
        </div>
      </div>

      <style>{`
        .ant-input, .ant-input-password input, .ant-input-affix-wrapper input {
          color: #fff !important;
        }
        .ant-input::placeholder, .ant-input-password input::placeholder, .ant-input-affix-wrapper input::placeholder {
          color: rgba(255,255,255,0.25) !important;
        }
        .ant-input-affix-wrapper {
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        .ant-input-affix-wrapper:hover, .ant-input-affix-wrapper:focus, .ant-input-affix-wrapper-focused {
          border-color: rgba(99,102,241,0.4) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08) !important;
        }
        .ant-input-password .ant-input-suffix .anticon {
          color: rgba(255,255,255,0.2) !important;
        }
      `}</style>
    </div>
  );
}
