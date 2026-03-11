import dayjs from 'dayjs';

export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(isoString: string): string {
  return dayjs(isoString).format('MMM D, YYYY');
}

export function formatTime(isoString: string): string {
  return dayjs(isoString).format('h:mm A');
}

export function getFocusScoreColor(score: number): string {
  if (score >= 85) return '#52c41a'; // green
  if (score >= 70) return '#1890ff'; // blue
  if (score >= 50) return '#fa8c16'; // orange
  return '#f5222d'; // red
}

export function getFocusScoreCategory(score: number): string {
  if (score >= 85) return 'Deep Focus';
  if (score >= 70) return 'Good Focus';
  if (score >= 50) return 'Moderate';
  return 'Low Focus';
}
