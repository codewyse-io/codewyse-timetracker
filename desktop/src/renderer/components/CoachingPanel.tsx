import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
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
  }, []);

  return (
    <div className="glass-card" style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, opacity: 0.6 }}>&#9733;</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          Pulse Insights
        </span>
        <span className="ai-dot" style={{ width: 6, height: 6, marginLeft: 'auto' }} />
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
            <span style={{ fontSize: 18, opacity: 0.6 }}>&#10024;</span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            Pulse is learning your patterns...
            <br />
            insights coming soon
          </span>
        </div>
      ) : (
        /* Tips as AI message bubbles */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tips.map((tip) => {
            const catColor = categoryColors[tip.category] || '#7c5cfc';
            const catGlow = categoryGlows[tip.category] || 'rgba(124, 92, 252, 0.12)';
            return (
              <div
                key={tip.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  transition: 'border-color 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${catColor}30`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                {/* Category tag */}
                <div style={{ marginBottom: 8 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: catGlow,
                    border: `1px solid ${catColor}25`,
                    fontSize: 9,
                    fontWeight: 600,
                    color: catColor,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}>
                    {categoryLabels[tip.category] || tip.category}
                  </span>
                </div>

                {/* Observation — AI speaking */}
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.55,
                  marginBottom: 8,
                }}>
                  {tip.observation}
                </div>

                {/* Recommendation — accent box */}
                <div style={{
                  background: 'rgba(124, 92, 252, 0.06)',
                  border: '1px solid rgba(124, 92, 252, 0.1)',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}>
                  <div style={{
                    fontSize: 9,
                    color: '#7c5cfc',
                    fontWeight: 600,
                    letterSpacing: 0.8,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                  }}>
                    RECOMMENDATION
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.7)',
                    lineHeight: 1.5,
                  }}>
                    {tip.recommendation}
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
