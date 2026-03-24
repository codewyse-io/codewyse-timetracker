import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  FullscreenExitOutlined,
  ExpandOutlined,
  PhoneOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useCall } from '../../contexts/CallContext';
import { useAuth } from '../../contexts/AuthContext';
import CallControls from './CallControls';
import ScreenSharePicker from './ScreenSharePicker';
import AddPeoplePicker from './AddPeoplePicker';

// ── Ringing tone generator using Web Audio API ──
function useRingtone(isRinging: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRinging) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      return;
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const playTone = () => {
      if (ctx.state === 'closed') return;

      // Two-tone ring: 440Hz then 480Hz
      const playNote = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + startOffset + 0.05);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + startOffset + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration);
      };

      // Ring pattern: two short tones, pause
      playNote(440, 0, 0.4);
      playNote(480, 0, 0.4);
      playNote(440, 0.6, 0.4);
      playNote(480, 0.6, 0.4);
    };

    playTone();
    intervalRef.current = setInterval(playTone, 3000); // repeat every 3s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      ctx.close();
    };
  }, [isRinging]);
}

function VideoTile({
  stream,
  muted,
  mirrored,
  label,
  isSmall,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  label?: string;
  isSmall?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) video.srcObject = stream;
    return () => { if (video) video.srcObject = null; };
  }, [stream]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: isSmall ? 12 : 8,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        width: '100%',
        height: '100%',
      }}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: mirrored ? 'scaleX(-1)' : undefined,
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {(() => {
            const c = getAvatarColor(label || '?');
            return (
              <div style={{
                width: isSmall ? 40 : 72,
                height: isSmall ? 40 : 72,
                borderRadius: '50%',
                background: c.bg,
                border: `2px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSmall ? 14 : 24,
                fontWeight: 700,
                color: c.text,
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {getInitials(label || '?')}
              </div>
            );
          })()}
          {!isSmall && label && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              {label}
            </span>
          )}
        </div>
      )}
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 8,
            fontSize: 10,
            color: 'rgba(255,255,255,0.8)',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w.charAt(0)).join('').toUpperCase().substring(0, 2) || '?';
}

// Consistent avatar colors — same name always gets the same color
const AVATAR_COLORS = [
  { bg: 'rgba(124, 92, 252, 0.30)', border: 'rgba(124, 92, 252, 0.40)', text: '#a78bfa' },  // purple
  { bg: 'rgba(56, 189, 248, 0.25)', border: 'rgba(56, 189, 248, 0.35)', text: '#7dd3fc' },   // sky blue
  { bg: 'rgba(251, 146, 60, 0.25)', border: 'rgba(251, 146, 60, 0.35)', text: '#fdba74' },   // orange
  { bg: 'rgba(52, 211, 153, 0.25)', border: 'rgba(52, 211, 153, 0.35)', text: '#6ee7b7' },   // emerald
  { bg: 'rgba(244, 114, 182, 0.25)', border: 'rgba(244, 114, 182, 0.35)', text: '#f9a8d4' }, // pink
  { bg: 'rgba(250, 204, 21, 0.25)', border: 'rgba(250, 204, 21, 0.35)', text: '#fde047' },   // yellow
  { bg: 'rgba(129, 140, 248, 0.25)', border: 'rgba(129, 140, 248, 0.35)', text: '#a5b4fc' }, // indigo
  { bg: 'rgba(45, 212, 191, 0.25)', border: 'rgba(45, 212, 191, 0.35)', text: '#5eead4' },   // teal
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const NO_ANSWER_TIMEOUT_MS = 90_000; // 1 minute 30 seconds

function formatCallDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function CallWindow() {
  const { state, showScreenPicker, setShowScreenPicker, startScreenShareWithSource, stopScreenShare, isDetached, detachCall, attachCall, endCall, showAddPeople, setShowAddPeople } = useCall();
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const [showNoAnswer, setShowNoAnswer] = useState(false);

  const myName = user ? `${user.firstName} ${user.lastName}`.trim() : 'You';

  const isRinging = state.activeCall?.state === 'ringing';
  const isOutgoingRinging = !!(state.activeCall?.isOutgoing && isRinging);
  const isIncomingRinging = !!(!state.activeCall?.isOutgoing && isRinging);

  // Play ringing sound
  useRingtone(isRinging || false);

  // Call duration timer
  useEffect(() => {
    if (state.activeCall?.state !== 'connected') {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [state.activeCall?.state]);

  // No-answer timeout — show dialog after 1m30s of outgoing ringing
  useEffect(() => {
    setShowNoAnswer(false);
    if (!isOutgoingRinging) return;

    const timer = setTimeout(() => {
      setShowNoAnswer(true);
    }, NO_ANSWER_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isOutgoingRinging]);

  // Reset no-answer dialog when call state changes
  useEffect(() => {
    if (state.activeCall?.state !== 'ringing') {
      setShowNoAnswer(false);
    }
  }, [state.activeCall?.state]);

  if (!state.activeCall) return null;

  const isVideo = state.activeCall.type === 'video';
  const isConnected = state.activeCall.state === 'connected';
  const isConnecting = state.activeCall.state === 'connecting';
  const isSfu = state.activeCall.sfuMode;

  const remoteEntries = Object.entries(state.remoteStreams);
  const participantCount = remoteEntries.length + 1;

  const gridCols = participantCount <= 2 ? 1 : participantCount <= 4 ? 2 : 3;
  const gridRows = Math.ceil(participantCount / gridCols);

  const remoteName = Object.values(state.participantNames)[0] || state.activeCall.callerName || '';

  const statusText = isOutgoingRinging
    ? 'Calling...'
    : isConnecting
      ? 'Connecting...'
      : isConnected
        ? formatCallDuration(elapsed)
        : isIncomingRinging
          ? 'Ringing...'
          : '';

  const subtitleText = isSfu
    ? `Group ${isVideo ? 'Video' : 'Voice'} Call${isConnected ? ` · ${participantCount}` : ''}`
    : remoteName || (isVideo ? 'Video Call' : 'Voice Call');

  // ── Mini / Detached mode ──
  if (isDetached) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 280,
          height: 180,
          background: 'rgba(10, 10, 15, 0.95)',
          borderRadius: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(124, 92, 252, 0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Mini header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.3)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isConnected ? '#38efb3' : '#faad14',
              boxShadow: isConnected ? '0 0 6px rgba(56, 239, 176, 0.5)' : undefined,
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {subtitleText}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
              {statusText}
            </span>
          </div>
          <button
            onClick={attachCall}
            title="Expand to full view"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          >
            <FullscreenExitOutlined style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Mini presenting indicator */}
        {state.isScreenSharing && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '3px 8px', background: 'rgba(56, 239, 176, 0.1)',
            borderBottom: '1px solid rgba(56, 239, 176, 0.15)', flexShrink: 0,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#38efb3', animation: 'dot-pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: '#38efb3' }}>Presenting</span>
          </div>
        )}

        {/* Mini content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '4px 12px' }}>
          {isVideo ? (
            <div style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
              <VideoTile
                stream={remoteEntries[0]?.[1] || state.localStream}
                muted={!remoteEntries[0]}
                label={remoteEntries[0] ? (state.participantNames[remoteEntries[0][0]] || remoteName) : myName}
                isSmall
              />
            </div>
          ) : (
            <>
              <MiniAvatar label={myName} isActive={!state.isMuted} />
              {remoteEntries.length > 0
                ? remoteEntries.map(([userId]) => (
                    <MiniAvatar key={userId} label={state.participantNames[userId] || '?'} />
                  ))
                : <MiniAvatar label={remoteName || '?'} />
              }
            </>
          )}
        </div>

        {/* Mini controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 12px', flexShrink: 0 }}>
          <CallControls mini />
        </div>
      </div>
    );
  }

  // ── Full-screen mode ──
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#0a0a0f',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Status bar */}
      <div
        style={{
          padding: '12px 16px',
          textAlign: 'center',
          flexShrink: 0,
          background: 'rgba(0,0,0,0.3)',
          // @ts-ignore
          WebkitAppRegion: 'drag',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          {statusText}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {subtitleText}
        </div>

        {/* Detach button */}
        <button
          onClick={detachCall}
          title="Minimize to mini view"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: '4px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        >
          <ExpandOutlined style={{ fontSize: 14 }} />
        </button>
      </div>

      {/* Presenting banner */}
      {state.isScreenSharing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(56, 239, 176, 0.1)',
            borderBottom: '1px solid rgba(56, 239, 176, 0.2)',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#38efb3',
            boxShadow: '0 0 8px rgba(56, 239, 176, 0.6)',
            animation: 'dot-pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#38efb3' }}>
            You are presenting
          </span>
          <button
            onClick={stopScreenShare}
            style={{
              marginLeft: 8,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(255, 77, 79, 0.15)',
              border: '1px solid rgba(255, 77, 79, 0.3)',
              borderRadius: 6,
              color: '#ff4d4f',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.15)'; }}
          >
            Stop presenting
          </button>
        </div>
      )}

      {/* Video / Audio area */}
      <div style={{ flex: 1, minHeight: 0, padding: 8, position: 'relative' }}>
        {/* Screen share takes center stage when active */}
        {state.isScreenSharing && state.screenStream ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <VideoTile stream={state.screenStream} muted label="Your screen" />
            {/* Participants strip at bottom */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                right: 8,
                display: 'flex',
                gap: 6,
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 120, height: 80, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                <VideoTile stream={state.localStream} muted mirrored label={myName} isSmall />
              </div>
              {remoteEntries.map(([userId, stream]) => (
                <div key={userId} style={{ width: 120, height: 80, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                  <VideoTile stream={stream} label={state.participantNames[userId] || userId.substring(0, 8)} isSmall />
                </div>
              ))}
            </div>
          </div>
        ) : isVideo ? (
          isSfu ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                gap: 6,
                width: '100%',
                height: '100%',
              }}
            >
              <VideoTile stream={state.localStream} muted mirrored label={myName} />
              {remoteEntries.map(([userId, stream]) => (
                <VideoTile
                  key={userId}
                  stream={stream}
                  label={state.participantNames[userId] || userId.substring(0, 8)}
                />
              ))}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <VideoTile
                stream={remoteEntries[0]?.[1] || null}
                label={
                  remoteEntries[0]
                    ? (state.participantNames[remoteEntries[0][0]] || state.activeCall.callerName || 'Remote')
                    : (remoteName || 'Connecting...')
                }
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  width: 150,
                  height: 112,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
              >
                <VideoTile stream={state.localStream} muted mirrored label={myName} isSmall />
              </div>
            </div>
          )
        ) : (
          /* Audio call — Meet-style centered layout */
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Center: callee avatar (large) with ripple rings */}
            {(() => {
              const calleeName = remoteEntries.length > 0
                ? (state.participantNames[remoteEntries[0][0]] || remoteName || '?')
                : (Object.values(state.participantNames)[0] || state.activeCall.callerName || '?');
              const calleeColor = getAvatarColor(calleeName);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  {/* Avatar with ripple rings */}
                  <div style={{ position: 'relative', width: 100, height: 100 }}>
                    {/* Ripple rings — centered on avatar, uses callee's color */}
                    {!!isRinging && (
                      <>
                        {[0, 0.6, 1.2].map((delay, i) => (
                          <div key={i} style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            border: `2px solid ${calleeColor.border}`,
                            opacity: 0.6 - i * 0.15,
                            animation: `ring-expand 2.5s ease-out infinite ${delay}s`,
                            pointerEvents: 'none',
                          }} />
                        ))}
                      </>
                    )}
                    {/* Avatar circle */}
                    <div style={{
                      position: 'relative',
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: calleeColor.bg,
                      border: `3px solid ${calleeColor.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                      fontWeight: 700,
                      color: calleeColor.text,
                      fontFamily: "'Space Grotesk', sans-serif",
                      zIndex: 1,
                      animation: isConnected ? 'breathe 3s ease-in-out infinite' : undefined,
                    }}>
                      {getInitials(calleeName)}
                    </div>
                  </div>
                  {/* Name */}
                  <span style={{
                    fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                    zIndex: 1,
                  }}>
                    {calleeName}
                  </span>
                  {/* Status hint under name */}
                  {isRinging && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -8, zIndex: 1 }}>
                      {isOutgoingRinging ? 'Ringing…' : 'Incoming call'}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Bottom-left: your own small avatar (Meet-style self-view) */}
            {(() => {
              const myColor = getAvatarColor(myName);
              return (
                <div style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 24,
                  padding: '6px 12px 6px 6px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: myColor.bg,
                    border: `2px solid ${state.isMuted ? 'rgba(255,77,79,0.4)' : myColor.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: myColor.text,
                    fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {getInitials(myName)}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                {myName}
              </span>
              {state.isMuted && (
                <span style={{ fontSize: 9, color: '#ff4d4f', fontWeight: 600 }}>MUTED</span>
              )}
            </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, paddingBottom: 12 }}>
        <CallControls />
      </div>

      {/* Screen Share Picker */}
      <ScreenSharePicker
        open={showScreenPicker}
        onSelect={(sourceId) => startScreenShareWithSource(sourceId)}
        onClose={() => setShowScreenPicker(false)}
      />

      {/* Add People Picker */}
      <AddPeoplePicker
        open={showAddPeople}
        onClose={() => setShowAddPeople(false)}
      />

      {/* No Answer Dialog — shown after 1m30s of outgoing ringing */}
      {showNoAnswer && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
        >
          <div
            style={{
              background: 'rgba(16, 16, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '28px 32px',
              textAlign: 'center',
              maxWidth: 320,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255, 77, 79, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <PhoneOutlined style={{ fontSize: 24, color: '#ff4d4f', transform: 'rotate(135deg)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>
              No answer
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 20, lineHeight: 1.5 }}>
              {remoteName || 'The other person'} isn't picking up. Would you like to keep trying or end the call?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowNoAnswer(false)}
                style={{
                  padding: '8px 20px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                Keep trying
              </button>
              <button
                onClick={endCall}
                style={{
                  padding: '8px 20px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'rgba(255, 77, 79, 0.15)',
                  border: '1px solid rgba(255, 77, 79, 0.3)',
                  borderRadius: 8,
                  color: '#ff4d4f',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.15)'; }}
              >
                End call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniAvatar({ label, isActive }: { label: string; isActive?: boolean }) {
  const initials = getInitials(label);
  const c = getAvatarColor(label);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: c.bg,
          border: `2px solid ${isActive === false ? 'rgba(255,77,79,0.4)' : c.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
          color: c.text,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {initials}
      </div>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', maxWidth: 60, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}
