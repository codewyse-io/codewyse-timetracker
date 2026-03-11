import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from 'antd';
import { startSession, stopSession, getCurrentSession, getTrackingSettings } from '../api/client';
import { formatElapsedTime } from '../utils/format';
import { WorkSession } from '../types';

const AI_STATUS_MESSAGES = [
  'Analyzing workflow patterns...',
  'Processing focus metrics...',
  'Optimizing your productivity...',
  'Identifying deep focus zones...',
  'Mapping your peak hours...',
  'Learning your rhythm...',
];

type SessionMode = 'regular' | 'overtime';

export default function Timer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [mode, setMode] = useState<SessionMode>('regular');
  const [errorState, setErrorState] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback((fromTime: Date) => {
    clearTimer();
    startTimeRef.current = fromTime;
    intervalRef.current = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - fromTime.getTime()) / 1000);
      setElapsed(diff);
    }, 1000);
  }, [clearTimer]);

  const showError = useCallback((msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setErrorState({ show: true, message: msg });
    errorTimeoutRef.current = setTimeout(() => {
      setErrorState({ show: false, message: '' });
    }, 5000);
  }, []);

  // Cycle AI status messages when running
  useEffect(() => {
    if (isRunning) {
      statusIntervalRef.current = setInterval(() => {
        setStatusIndex((prev) => (prev + 1) % AI_STATUS_MESSAGES.length);
      }, 3000);
    } else {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    }
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [isRunning]);

  // Load current session on mount
  useEffect(() => {
    const loadCurrentSession = async () => {
      try {
        const response = await getCurrentSession();
        const current = response.data || response;
        if (current && current.startTime && !current.endTime) {
          setSession(current);
          setIsRunning(true);
          if (current.mode) setMode(current.mode);
          startTimer(new Date(current.startTime));
        }
      } catch {
        // No active session
      }
    };
    loadCurrentSession();
    return () => {
      clearTimer();
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [startTimer, clearTimer]);

  const handleStart = async () => {
    setLoading(true);
    setErrorState({ show: false, message: '' });
    try {
      const response = await startSession(mode);
      const newSession = response.data || response;
      setSession(newSession);
      setIsRunning(true);
      startTimer(new Date(newSession.startTime));

      // Apply idle threshold from shift settings
      try {
        const settings = await getTrackingSettings();
        await window.electronAPI.setIdleThreshold(settings.idleThresholdSeconds);
      } catch {
        // non-critical — keep existing threshold
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to activate Pulse';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setErrorState({ show: false, message: '' });
    try {
      await stopSession();
      setIsRunning(false);
      clearTimer();
      setElapsed(0);
      setSession(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to end session';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isOvertime = mode === 'overtime';

  const errorOverlay = errorState.show ? createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        cursor: 'pointer',
        animation: 'error-fade-in 0.3s ease-out',
      }}
      onClick={() => setErrorState({ show: false, message: '' })}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '36px 32px 28px',
          maxWidth: 340,
          width: '100%',
          textAlign: 'center',
          animation: 'error-shake 0.5s ease-out',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 60, 60, 0.1)',
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff4d4f, #e8222e)',
            boxShadow: '0 8px 24px rgba(255, 45, 45, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', animation: 'breathe 2s ease-in-out infinite',
          }}
        >
          <span style={{ fontSize: 26, color: '#fff', fontWeight: 800, lineHeight: 1 }}>!</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', marginBottom: 8, letterSpacing: -0.5 }}>
          Session Blocked
        </div>
        <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 20 }}>
          {errorState.message}
        </div>
        <button
          onClick={() => setErrorState({ show: false, message: '' })}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #ff4d4f, #e8222e)', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3,
            boxShadow: '0 4px 16px rgba(255, 45, 45, 0.3)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          Dismiss
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {errorOverlay}
      <div
        className="glass-card"
        style={{
          padding: '16px 12px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
      {/* Unified horizontal layout — same structure for standby and active */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', position: 'relative' }}>
        {/* Left: Orb + text info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, zIndex: 1 }}>
          {/* Orb */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: isRunning
                ? isOvertime
                  ? 'radial-gradient(circle at 40% 40%, #ffc857, #ffab00 50%, #e68a00 100%)'
                  : 'radial-gradient(circle at 40% 40%, #a78bfa, #7c5cfc 50%, #5b3cc4 100%)'
                : 'radial-gradient(circle at 40% 40%, rgba(124, 92, 252, 0.25), rgba(124, 92, 252, 0.08) 100%)',
              boxShadow: isRunning
                ? isOvertime
                  ? '0 0 30px rgba(255, 171, 0, 0.5), inset 0 -3px 10px rgba(255, 200, 0, 0.3)'
                  : '0 0 30px rgba(124, 92, 252, 0.5), inset 0 -3px 10px rgba(0, 212, 255, 0.3)'
                : '0 0 20px rgba(124, 92, 252, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isRunning ? 'breathe 3s ease-in-out infinite' : 'breathe 5s ease-in-out infinite',
              transition: 'all 0.6s ease',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: isRunning
                  ? isOvertime
                    ? 'radial-gradient(circle, #ffe066, rgba(255, 200, 0, 0.4))'
                    : 'radial-gradient(circle, #00d4ff, rgba(0, 212, 255, 0.4))'
                  : 'radial-gradient(circle, rgba(124, 92, 252, 0.5), rgba(124, 92, 252, 0.1))',
                boxShadow: isRunning
                  ? isOvertime ? '0 0 10px rgba(255, 200, 0, 0.8)' : '0 0 10px rgba(0, 212, 255, 0.8)'
                  : '0 0 6px rgba(124, 92, 252, 0.3)',
                transition: 'all 0.6s ease',
              }} />
            </div>
          </div>

          {/* Text info */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontSize: 14, fontWeight: 600, letterSpacing: -0.3,
                color: isRunning
                  ? isOvertime ? '#ffab00' : 'rgba(255, 255, 255, 0.85)'
                  : 'rgba(255, 255, 255, 0.55)',
                transition: 'color 0.3s ease',
              }}>
                {isRunning
                  ? isOvertime ? 'Overtime active' : 'Pulse is active'
                  : 'Pulse is ready'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 12,
                background: isRunning
                  ? isOvertime ? 'rgba(255, 171, 0, 0.1)' : 'rgba(0, 230, 118, 0.1)'
                  : 'rgba(255, 171, 0, 0.1)',
                border: `1px solid ${isRunning
                  ? isOvertime ? 'rgba(255, 171, 0, 0.2)' : 'rgba(0, 230, 118, 0.2)'
                  : 'rgba(255, 171, 0, 0.2)'}`,
                fontSize: 9, fontWeight: 600,
                color: isRunning
                  ? isOvertime ? '#ffab00' : '#00e676'
                  : '#ffab00',
                letterSpacing: 0.5, textTransform: 'uppercase' as const,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: isRunning
                    ? isOvertime ? '#ffab00' : '#00e676'
                    : '#ffab00',
                  boxShadow: isRunning
                    ? isOvertime ? '0 0 6px rgba(255, 171, 0, 0.6)' : '0 0 6px rgba(0, 230, 118, 0.6)'
                    : '0 0 6px rgba(255, 171, 0, 0.6)',
                }} />
                {isRunning ? (isOvertime ? 'Overtime' : 'Active') : 'Standby'}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.25)' }}>
              {isRunning
                ? AI_STATUS_MESSAGES[statusIndex]
                : mode === 'overtime' ? 'Overtime mode \u2014 no shift required' : 'Select a mode and activate to begin tracking'}
            </span>
          </div>
        </div>

        {/* Center: elapsed time — absolutely centered in the row */}
        {isRunning && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{
              fontSize: 28, fontWeight: 700, letterSpacing: 2,
              color: isOvertime ? '#ffab00' : 'rgba(255, 255, 255, 0.85)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: "'Inter', sans-serif",
            }}>
              {formatElapsedTime(elapsed)}
            </span>
          </div>
        )}

        {/* Right: controls — pushed to the end */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto', zIndex: 1 }}>
          {!isRunning && (
            <div style={{
              display: 'inline-flex', background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 2, gap: 2,
            }}>
              {(['regular', 'overtime'] as SessionMode[]).map((m) => {
                const isActive = mode === m;
                const isOT = m === 'overtime';
                return (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 10, fontWeight: 600, letterSpacing: 0.3, textTransform: 'capitalize',
                    transition: 'all 0.25s ease',
                    background: isActive
                      ? isOT ? 'linear-gradient(135deg, rgba(255, 171, 0, 0.2), rgba(255, 120, 0, 0.15))'
                             : 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(91, 141, 239, 0.15))'
                      : 'transparent',
                    color: isActive ? (isOT ? '#ffab00' : '#7c5cfc') : 'rgba(255, 255, 255, 0.3)',
                    boxShadow: isActive
                      ? isOT ? '0 0 12px rgba(255, 171, 0, 0.15)' : '0 0 12px rgba(124, 92, 252, 0.15)'
                      : 'none',
                  }}>
                    {m === 'regular' ? 'Regular' : 'Overtime'}
                  </button>
                );
              })}
            </div>
          )}
          <Button type="primary" shape="round" loading={loading}
            onClick={isRunning ? handleStop : handleStart}
            style={{
              height: 34, paddingInline: 24, fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
              border: 'none',
              background: isRunning
                ? 'rgba(255, 255, 255, 0.06)'
                : isOvertime
                  ? 'linear-gradient(135deg, #ffab00 0%, #ff7800 100%)'
                  : 'linear-gradient(135deg, #7c5cfc 0%, #00d4ff 100%)',
              color: isRunning ? 'rgba(255, 255, 255, 0.6)' : '#fff',
              boxShadow: isRunning ? 'none'
                : isOvertime ? '0 4px 20px rgba(255, 171, 0, 0.35)' : '0 4px 20px rgba(124, 92, 252, 0.35)',
              transition: 'all 0.3s ease',
            }}
          >
            {isRunning ? 'End Session' : 'Activate'}
          </Button>
        </div>
      </div>

      {/* Error shake animation */}
      <style>{`
        @keyframes error-shake {
          0% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(5px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        @keyframes error-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      </div>
    </>
  );
}
