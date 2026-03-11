import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { getMe } from '../api/client';
import { User } from '../types';

export default function ProfilePanel() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(authUser);
  const [loading, setLoading] = useState(true);

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

  // Format shift time in the shift's own timezone
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

  return (
    <div style={{ display: 'grid', gap: 10, padding: 10 }}>
      {/* Profile Card */}
      <div
        className="glass-card"
        style={{
          padding: '24px 16px',
          textAlign: 'center',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c5cfc 0%, #00d4ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 32px rgba(124, 92, 252, 0.3)',
            position: 'relative',
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: 1,
            }}
          >
            {initials}
          </span>
          {/* Online dot */}
          <div
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#00e676',
              border: '2.5px solid #0a0a0f',
              boxShadow: '0 0 8px rgba(0, 230, 118, 0.5)',
            }}
          />
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: 4,
            letterSpacing: -0.3,
          }}
        >
          {user.firstName} {user.lastName}
        </div>

        {/* Role badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: 'rgba(124, 92, 252, 0.1)',
            border: '1px solid rgba(124, 92, 252, 0.2)',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#7c5cfc',
              boxShadow: '0 0 6px rgba(124, 92, 252, 0.5)',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#7c5cfc',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {user.role === 'admin' ? 'Admin' : 'Employee'}
          </span>
        </div>

        {user.designation && (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.4)',
              marginTop: 4,
            }}
          >
            {user.designation}
          </div>
        )}
      </div>

      {/* Details Card */}
      <div className="glass-card" style={{ padding: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.5 }}>&#9881;</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            Profile Details
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {infoRows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.015)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 500,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: row.color || 'rgba(255, 255, 255, 0.75)',
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
    </div>
  );
}
