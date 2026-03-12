import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import { StarOutlined, BulbOutlined } from '@ant-design/icons';
import { getCoachingTips } from '../api/client';
import { CoachingTip } from '../types';

const categoryColors: Record<string, string> = {
  productivity: '#7c5cfc',
  time_usage: '#ffab00',
  workload: '#ff4d4f',
  focus: '#00e676',
  balance: '#00d4ff',
};

const categoryGlows: Record<string, string> = {
  productivity: 'rgba(124, 92, 252, 0.12)',
  time_usage: 'rgba(255, 171, 0, 0.12)',
  workload: 'rgba(255, 77, 79, 0.12)',
  focus: 'rgba(0, 230, 118, 0.12)',
  balance: 'rgba(0, 212, 255, 0.12)',
};

const categoryLabels: Record<string, string> = {
  productivity: 'Productivity',
  time_usage: 'Time Usage',
  workload: 'Workload',
  focus: 'Focus',
  balance: 'Balance',
};

export default function CoachingPanel() {
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTips = async () => {
      try {
        const response = await getCoachingTips();
        const data = response.data?.items || response.data || response.items || response || [];
        setTips(Array.isArray(data) ? data : []);
      } catch {
        setTips([]);
      } finally {
        setLoading(false);
      }
    };
    loadTips();

    // Refresh on session changes and periodically
    const handleSessionChange = () => loadTips();
    window.addEventListener('session-changed', handleSessionChange);
    const interval = setInterval(loadTips, 15_000);

    return () => {
      window.removeEventListener('session-changed', handleSessionChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="glass-card" style={{ padding: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <StarOutlined style={{ fontSize: 14, opacity: 0.6, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.95)', fontFamily: "'Space Grotesk', 'Inter', sans-serif", minWidth: 0 }}>
          Pulse Insights
        </span>
        <span className="ai-dot" style={{ width: 6, height: 6, marginLeft: 'auto', flexShrink: 0 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
      ) : tips.length === 0 ? (
        /* Empty state */
        <div style={{
          textAlign: 'center',
          padding: '20px 12px',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(124, 92, 252, 0.1)',
            border: '1px solid rgba(124, 92, 252, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            animation: 'breathe 3s ease-in-out infinite',
          }}>
            <BulbOutlined style={{ fontSize: 18, opacity: 0.6 }} />
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            Pulse is learning your patterns...
            <br />
            insights coming soon
          </span>
        </div>
      ) : (
        /* Tips */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          {tips.map((tip) => {
            const catColor = categoryColors[tip.category] || '#7c5cfc';
            const catGlow = categoryGlows[tip.category] || 'rgba(124, 92, 252, 0.12)';
            return (
              <div
                key={tip.id}
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  minWidth: 0,
                  background: `linear-gradient(135deg, ${catGlow}, rgba(255,255,255,0.015))`,
                  border: `1px solid ${catColor}18`,
                  transition: 'transform 0.2s ease, border-color 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${catColor}40`;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${catColor}18`;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  height: 2,
                  background: `linear-gradient(90deg, ${catColor}, transparent)`,
                  opacity: 0.6,
                }} />

                <div style={{ padding: '10px 12px' }}>
                  {/* Category + observation row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: catGlow,
                      border: `1px solid ${catColor}20`,
                      fontSize: 9,
                      fontWeight: 700,
                      color: catColor,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: catColor,
                        flexShrink: 0,
                      }} />
                      {categoryLabels[tip.category] || tip.category}
                    </span>
                  </div>

                  {/* Observation */}
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.6,
                    wordBreak: 'break-word' as const,
                    overflowWrap: 'break-word' as const,
                  }}>
                    {tip.observation}
                  </div>

                  {/* Recommendation */}
                  <div style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <BulbOutlined style={{
                      fontSize: 12,
                      color: '#a78bfa',
                      marginTop: 2,
                      flexShrink: 0,
                    }} />
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.55,
                      wordBreak: 'break-word' as const,
                      overflowWrap: 'break-word' as const,
                    }}>
                      {tip.recommendation}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
