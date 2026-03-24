import { useEffect, useRef } from 'react';
import { reportIdle } from '../api/client';

const IDLE_REPORT_INTERVAL = 30_000; // Report every 30 seconds while idle

export default function IdleIndicator() {
  const idleStartRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubDetectedRef = useRef<(() => void) | null>(null);
  const unsubResumedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    const sendIdleReport = (startTime: string) => {
      const endTime = new Date().toISOString();
      // idle report: startTime → endTime
      reportIdle({ startTime, endTime }).catch((err) => {
        console.error('[IdleIndicator] Failed to report idle:', err?.response?.data || err.message);
      });
    };

    const startHeartbeat = (startTime: string) => {
      stopHeartbeat();
      // heartbeat started
      // Send immediately
      sendIdleReport(startTime);
      // Then send periodically
      heartbeatRef.current = setInterval(() => {
        sendIdleReport(startTime);
      }, IDLE_REPORT_INTERVAL);
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    unsubDetectedRef.current = window.electronAPI.onIdleDetected((data) => {
      // idle detected
      // Use the actual idle start time from the detector (accounts for the threshold delay)
      idleStartRef.current = data?.startTime || new Date().toISOString();
      startHeartbeat(idleStartRef.current);
    });

    unsubResumedRef.current = window.electronAPI.onIdleResumed((data) => {
      // idle resumed
      stopHeartbeat();

      const startTime = data?.startTime || idleStartRef.current;
      const endTime = data?.endTime || new Date().toISOString();

      if (startTime) {
        // final idle report
        reportIdle({ startTime, endTime }).catch((err) => {
          console.error('[IdleIndicator] Failed to report final idle:', err?.response?.data || err.message);
        });
      }

      idleStartRef.current = null;
    });

    return () => {
      stopHeartbeat();
      unsubDetectedRef.current?.();
      unsubResumedRef.current?.();
    };
  }, []);

  return null;
}
