import React, { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import { SettingOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { getMe, changePassword } from '../api/client';
import { User } from '../types';

export default function ProfilePanel() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(authUser);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await getMe();
        setUser(response.data || response);
      } catch {
        setUser(authUser);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [authUser]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="small" />
      </div>
    );
  }

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();

  const formatShiftValue = (): string => {
    const shift = user.shift;
    if (!shift) return 'No shift assigned';
    const formatShiftTime = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };
    const tz = shift.timezone || 'UTC';
    const shortTz = (() => {
      try {
        return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
          .formatToParts(new Date())
          .find((p) => p.type === 'timeZoneName')?.value || tz;
      } catch {
        return tz;
      }
    })();
    return `${formatShiftTime(shift.startTime)} – ${formatShiftTime(shift.endTime)} (${shortTz})`;
  };

  const infoRows: { label: string; value: string; color?: string }[] = [
    { label: 'Email', value: user.email },
    { label: 'Role', value: user.role === 'admin' ? 'Administrator' : 'Employee' },
    { label: 'Designation', value: user.designation || 'Not set' },
    {
      label: 'Status',
      value: user.status.charAt(0).toUpperCase() + user.status.slice(1),
      color:
        user.status === 'active'
          ? '#00e676'
          : user.status === 'invited'
            ? '#ffab00'
            : 'rgba(255,255,255,0.4)',
    },
    {
      label: 'Shift',
      value: formatShiftValue(),
      color: user.shift ? '#00d4ff' : 'rgba(255,255,255,0.3)',
    },
    ...(user.createdAt
      ? [{
          label: 'Member Since',
          value: new Date(user.createdAt).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          }),
        }]
      : []),
  ];

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      message.error('Please fill in all fields');
      return;
    }
    if (newPassword.length < 8) {
      message.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      message.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 36px 9px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
  };

  const eyeStyle: React.CSSProperties = {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10 }}>
      {/* Left Column: Profile + Details */}
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: '1 1 250px', minWidth: 250, maxWidth: '100%' }}>
        {/* Avatar + Name */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c5cfc 0%, #00d4ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
              boxShadow: '0 8px 32px rgba(124, 92, 252, 0.3)',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>
              {initials}
            </span>
            <div
              style={{
                position: 'absolute',
                bottom: 1,
                right: 1,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#00e676',
                border: '2px solid #0a0a0f',
                boxShadow: '0 0 8px rgba(0, 230, 118, 0.5)',
              }}
            />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.firstName} {user.lastName}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 20,
              background: 'rgba(124, 92, 252, 0.1)',
              border: '1px solid rgba(124, 92, 252, 0.2)',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c5cfc', boxShadow: '0 0 6px rgba(124, 92, 252, 0.5)' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#7c5cfc', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {user.role === 'admin' ? 'Admin' : 'Employee'}
            </span>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <SettingOutlined style={{ fontSize: 12, opacity: 0.5 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Profile Details</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {infoRows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 8px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.015)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
              }}
            >
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: row.color || 'rgba(255,255,255,0.75)',
                  fontWeight: 600,
                  textAlign: 'right',
                  maxWidth: '60%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Change Password */}
      <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: '1 1 250px', minWidth: 250, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <LockOutlined style={{ fontSize: 12, opacity: 0.5 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Change Password</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 4, display: 'block' }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={inputStyle}
                placeholder="Enter current password"
              />
              <span style={eyeStyle} onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 4, display: 'block' }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
                placeholder="Min 8 characters"
              />
              <span style={eyeStyle} onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 4, display: 'block' }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="Re-enter new password"
              />
              <span style={eyeStyle} onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={changingPassword}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #7c5cfc 0%, #00d4ff 100%)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: changingPassword ? 'not-allowed' : 'pointer',
            opacity: changingPassword ? 0.6 : 1,
            letterSpacing: 0.3,
            boxShadow: '0 4px 16px rgba(124, 92, 252, 0.3)',
            transition: 'opacity 0.2s, transform 0.15s',
          }}
        >
          {changingPassword ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}
