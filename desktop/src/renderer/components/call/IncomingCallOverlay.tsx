import React from 'react';
import { Button } from 'antd';
import { PhoneOutlined, CloseOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { useCall } from '../../contexts/CallContext';

export default function IncomingCallOverlay() {
  const { state, acceptCall, declineCall } = useCall();

  if (!state.incomingCall) return null;

  const { type, fromName } = state.incomingCall;
  const isVideo = type === 'video';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          padding: 40,
        }}
      >
        {/* Pulsing avatar */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.3), rgba(91, 141, 239, 0.25))',
              border: '2px solid rgba(124, 92, 252, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#a78bfa',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {fromName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: '2px solid rgba(124, 92, 252, 0.3)',
              animation: 'ring-expand 2s ease-out infinite',
            }}
          />
        </div>

        {/* Caller info */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
            {fromName}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Incoming {isVideo ? 'Video' : 'Voice'} Call
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 24 }}>
          <Button
            type="primary"
            shape="circle"
            icon={<CloseOutlined style={{ fontSize: 18 }} />}
            onClick={declineCall}
            style={{
              width: 56,
              height: 56,
              background: '#ff4d4f',
              border: 'none',
              boxShadow: '0 0 20px rgba(255, 77, 79, 0.3)',
            }}
          />
          <Button
            type="primary"
            shape="circle"
            icon={isVideo ? <VideoCameraOutlined style={{ fontSize: 18 }} /> : <PhoneOutlined style={{ fontSize: 18 }} />}
            onClick={acceptCall}
            style={{
              width: 56,
              height: 56,
              background: '#38efb3',
              border: 'none',
              boxShadow: '0 0 20px rgba(56, 239, 176, 0.3)',
              color: '#0a0a0f',
            }}
          />
        </div>
      </div>
    </div>
  );
}
