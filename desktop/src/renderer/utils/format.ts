export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * For active sessions, compute live durations from startTime to now.
 * For completed sessions, return the stored values as-is.
 */
export function getLiveDurations(session: {
  status?: string;
  startTime: string;
  totalDuration: number;
  activeDuration: number;
  idleDuration: number;
}): { totalDuration: number; activeDuration: number; idleDuration: number } {
  if (session.status === 'active') {
    const totalDuration = Math.floor(
      (Date.now() - new Date(session.startTime).getTime()) / 1000,
    );
    const idleDuration = session.idleDuration || 0;
    const activeDuration = Math.max(0, totalDuration - idleDuration);
    return { totalDuration, activeDuration, idleDuration };
  }
  return {
    totalDuration: session.totalDuration || 0,
    activeDuration: session.activeDuration || 0,
    idleDuration: session.idleDuration || 0,
  };
}

export function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
