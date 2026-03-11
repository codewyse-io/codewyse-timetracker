import { useEffect, useRef } from 'react';
import { reportIdle } from '../api/client';

const IDLE_REPORT_INTERVAL = 30_000; // Report every 30 seconds while idle

export default function IdleIndicator() {
  const idleStartRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenersSetRef = useRef(false);

  useEffect(() => {
    if (!window.electronAPI || listenersSetRef.current) return;
    listenersSetRef.current = true;

    const sendIdleReport = (startTime: string) => {
      const endTime = new Date().toISOString();
      console.log(`[IdleIndicator] Reporting idle — start: ${startTime}, end: ${endTime}`);
      reportIdle({ startTime, endTime }).catch((err) => {
        console.error('[IdleIndicator] Failed to report idle:', err?.response?.data || err.message);
      });
    };

    const startHeartbeat = (startTime: string) => {
      stopHeartbeat();
      console.log(`[IdleIndicator] Starting heartbeat — idle start: ${startTime}`);
      // Send immediately
      sendIdleReport(startTime);
      // Then send periodically
      heartbeatRef.current = setInterval(() => {
        console.log(`[IdleIndicator] Heartbeat tick — idle still ongoing`);
        sendIdleReport(startTime);
      }, IDLE_REPORT_INTERVAL);
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    window.electronAPI.onIdleDetected((data) => {
      console.log('[IdleIndicator] idle-detected event received:', data);
      // Use the actual idle start time from the detector (accounts for the threshold delay)
      idleStartRef.current = data?.startTime || new Date().toISOString();
      startHeartbeat(idleStartRef.current);
    });

    window.electronAPI.onIdleResumed((data) => {
      console.log('[IdleIndicator] idle-resumed event received:', data);
      stopHeartbeat();

      const startTime = data?.startTime || idleStartRef.current;
      const endTime = data?.endTime || new Date().toISOString();

      if (startTime) {
        console.log(`[IdleIndicator] Final idle report — start: ${startTime}, end: ${endTime}`);
        reportIdle({ startTime, endTime }).catch((err) => {
          console.error('[IdleIndicator] Failed to report final idle:', err?.response?.data || err.message);
        });
      }

      idleStartRef.current = null;
    });

    return () => {
      stopHeartbeat();
    };
  }, []);

  return null;
}
