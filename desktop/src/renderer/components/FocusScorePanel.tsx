import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Space, Spin } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getFocusScore } from '../api/client';
import { FocusScore } from '../types';
import { formatDuration, formatDate } from '../utils/format';

const { Text } = Typography;

function getScoreColor(score: number): string {
  if (score >= 90) return '#00e676';
  if (score >= 75) return '#7c5cfc';
  if (score >= 60) return '#ffab00';
  return '#ff4d4f';
}

function getScoreCategory(score: number): string {
  if (score >= 90) return 'Peak Performance';
  if (score >= 75) return 'Optimal Flow';
  if (score >= 60) return 'Steady State';
  return 'Warming Up';
}

function getCategoryGlow(score: number): string {
  if (score >= 90) return 'rgba(0, 230, 118, 0.15)';
  if (score >= 75) return 'rgba(124, 92, 252, 0.15)';
  if (score >= 60) return 'rgba(255, 171, 0, 0.15)';
  return 'rgba(255, 77, 79, 0.15)';
}

export default function FocusScorePanel() {
  const [focusData, setFocusData] = useState<FocusScore | null>(null);
  const [weeklyData, setWeeklyData] = useState<FocusScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFocusData = async () => {
      try {
        const [response, weekResponse] = await Promise.all([
          getFocusScore('daily'),
          getFocusScore('weekly'),
        ]);

        const data = response.data || response;
        if (Array.isArray(data) && data.length > 0) {
          setFocusData(data[0]);
        } else if (data && !Array.isArray(data)) {
          setFocusData(data);
        }

        const weekData = weekResponse.data || weekResponse;
        setWeeklyData(Array.isArray(weekData) ? weekData : []);
      } catch {
        // Focus data not available
      } finally {
        setLoading(false);
      }
    };
    loadFocusData();

    // Refresh on session changes and periodically while active
    const handleSessionChange = () => loadFocusData();
    window.addEventListener('session-changed', handleSessionChange);
    const interval = setInterval(loadFocusData, 120_000);

    return () => {
      window.removeEventListener('session-changed', handleSessionChange);
      clearInterval(interval);
    };
  }, []);

  const score = Math.round(Number(focusData?.score) || 0);
  const category = focusData?.category ? getScoreCategory(
    focusData.category === 'deep_focus' ? 90 :
    focusData.category === 'good_focus' ? 75 :
    focusData.category === 'moderate' ? 60 : 30
  ) : getScoreCategory(score);
  const color = getScoreColor(score);
  const activeTime = focusData?.totalActiveTime ?? 0;
  const loggedTime = focusData?.totalLoggedTime ?? 1;
  const activePercent = Math.round((activeTime / loggedTime) * 100) || 0;

  const chartData = useMemo(() => weeklyData.map((d) => ({
    date: formatDate(d.date),
    score: d.score,
  })), [weeklyData]);

  // SVG circular gauge calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <ThunderboltOutlined style={{ fontSize: 14, opacity: 0.6 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.95)', fontFamily: "'Space Grotesk', 'Inter', sans-serif", minWidth: 0, flex: 1 }}>
          AI Analysis
        </span>
        {score > 0 && (
          <div style={{
            padding: '3px 10px',
            borderRadius: 20,
            background: getCategoryGlow(score),
            border: `1px solid ${color}30`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: 0.5 }}>
              {category}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Circular Gauge */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="100%" height="100%" viewBox="0 0 96 96">
            {/* Background ring */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="6"
            />
            {/* Score ring */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 48 48)"
              style={{
                filter: `drop-shadow(0 0 8px ${color}80)`,
                transition: 'stroke-dashoffset 1s ease-out',
              }}
            />
          </svg>
          {/* Score number in center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}>
            <span
              style={{ fontSize: score >= 100 ? 18 : 22, fontWeight: 700, lineHeight: 1, color }}
            >
              {score}
            </span>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Active vs Idle bar */}
          <div style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>
              ACTIVE VS IDLE
            </Text>
          </div>
          <div style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
            marginBottom: 6,
          }}>
            <div style={{
              width: `${activePercent}%`,
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${color}, ${color}99)`,
              boxShadow: `0 0 10px ${color}40`,
              transition: 'width 1s ease-out',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
              Active: {formatDuration(activeTime)}
            </Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
              Total: {formatDuration(loggedTime)}
            </Text>
          </div>
        </div>
      </div>

      {/* Weekly Chart */}
      {chartData.length > 1 && (
        <div style={{ marginTop: 12, height: 70, width: '100%', overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 10,
                  background: 'rgba(15, 15, 25, 0.95)',
                  border: '1px solid rgba(124, 92, 252, 0.2)',
                  color: 'rgba(255,255,255,0.85)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
                formatter={(value: any) => [`${value}`, 'Score']}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#7c5cfc"
                strokeWidth={2}
                dot={{ r: 3, fill: '#7c5cfc', stroke: '#7c5cfc' }}
                activeDot={{ r: 5, fill: '#7c5cfc', stroke: '#0a0a0f', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
