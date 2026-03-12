import React, { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'pulse_onboarding_completed';

interface Step {
  title: string;
  description: string;
  icon: string;
  accent: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Pulse',
    description:
      'Your AI-powered work companion. Pulse tracks your time, analyzes your productivity, and helps you work smarter. Let\'s take a quick tour of what you can do.',
    icon: '✦',
    accent: '#7c5cfc',
  },
  {
    title: 'Time Tracking',
    description:
      'Start and stop work sessions from the Dashboard. Choose Regular mode for shift-based work or Overtime for extra hours. Your elapsed time is displayed in real-time while a session is active.',
    icon: '⏱',
    accent: '#00d4ff',
  },
  {
    title: 'Idle Detection',
    description:
      'When a session is running, Pulse monitors your system activity. If you step away, idle time is automatically detected and recorded so your active hours are accurate.',
    icon: '💤',
    accent: '#ffab00',
  },
  {
    title: 'Focus Score & AI Insights',
    description:
      'Your daily focus score (0–100) is calculated from active vs idle time. Check the weekly trend chart to spot patterns. The AI coaching panel provides personalized tips to boost your productivity.',
    icon: '🎯',
    accent: '#00e676',
  },
  {
    title: 'Timeline & Session History',
    description:
      'The Dashboard shows your recent sessions at a glance. Switch to the Timeline tab for a detailed day-by-day breakdown with date filtering — view 7, 14, or 30 days of activity.',
    icon: '📊',
    accent: '#5b8def',
  },
  {
    title: 'Leave Requests',
    description:
      'Need time off? Go to the Leaves tab to submit requests. Add a subject, dates, a reason, and optional file attachments. Track the status of your requests — pending, approved, or rejected.',
    icon: '📅',
    accent: '#ff6b6b',
  },
  {
    title: 'Profile & Security',
    description:
      'View your profile details and shift information in the Profile tab. You can also change your password anytime from there to keep your account secure.',
    icon: '🔐',
    accent: '#a78bfa',
  },
  {
    title: 'You\'re All Set!',
    description:
      'Head to the Dashboard and hit Activate to start your first session. Pulse will handle the rest — tracking your time, scoring your focus, and learning your work patterns.',
    icon: '🚀',
    accent: '#7c5cfc',
  },
];

export default function OnboardingTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 200);
  };

  const handleBack = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setAnimating(false);
    }, 200);
  };

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'onb-fade-in 0.3s ease-out',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #141420 0%, #0d0d15 100%)',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          maxWidth: 420,
          width: '100%',
          overflow: 'hidden',
          boxShadow: `0 24px 80px rgba(0, 0, 0, 0.6), 0 0 40px ${current.accent}15`,
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${current.accent}, ${current.accent}88)`,
              borderRadius: 3,
              transition: 'width 0.4s ease, background 0.4s ease',
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            padding: '32px 28px 24px',
            opacity: animating ? 0 : 1,
            transform: animating ? 'translateY(8px)' : 'translateY(0)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `${current.accent}15`,
              border: `1px solid ${current.accent}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 26,
            }}
          >
            {current.icon}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.95)',
              textAlign: 'center',
              marginBottom: 10,
              letterSpacing: -0.3,
            }}
          >
            {current.title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255, 255, 255, 0.5)',
              textAlign: 'center',
              lineHeight: 1.7,
              marginBottom: 28,
              minHeight: 60,
            }}
          >
            {current.description}
          </div>

          {/* Step dots */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 24,
            }}
          >
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? current.accent : 'rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setAnimating(true);
                  setTimeout(() => {
                    setStep(i);
                    setAnimating(false);
                  }, 200);
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button
                onClick={handleBack}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                flex: isFirst ? 1 : 2,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: `linear-gradient(135deg, ${current.accent}, ${current.accent}aa)`,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: 0.3,
                boxShadow: `0 4px 16px ${current.accent}30`,
                transition: 'all 0.2s',
              }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>

          {/* Skip */}
          {!isLast && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <span
                onClick={handleFinish}
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.25)',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.5)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.25)'; }}
              >
                Skip tutorial
              </span>
            </div>
          )}
        </div>

        {/* Step counter */}
        <div
          style={{
            padding: '10px 28px 14px',
            textAlign: 'center',
            fontSize: 10,
            color: 'rgba(255, 255, 255, 0.2)',
            fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          {step + 1} of {STEPS.length}
        </div>
      </div>

      <style>{`
        @keyframes onb-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
