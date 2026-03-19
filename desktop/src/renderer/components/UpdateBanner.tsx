import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CloudDownloadOutlined, CheckCircleOutlined, SyncOutlined, RocketOutlined } from '@ant-design/icons';

type UpdateState = 'hidden' | 'downloading' | 'ready';

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('hidden');
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const unsubsRef = useRef<((() => void) | undefined)[]>([]);

  useEffect(() => {
    const u1 = window.electronAPI?.onUpdateAvailable?.((info) => {
      setVersion(info.version);
      setState('downloading');
      setPercent(0);
      // Auto-start download
      window.electronAPI?.downloadUpdate?.();
    });
    const u2 = window.electronAPI?.onUpdateDownloadProgress?.((progress) => {
      setState('downloading');
      setPercent(progress.percent);
    });
    const u3 = window.electronAPI?.onUpdateDownloaded?.(() => {
      setState('ready');
      setShowModal(true);
    });
    const u4 = window.electronAPI?.onUpdateError?.(() => {
      setState('hidden');
    });

    unsubsRef.current = [u1, u2, u3, u4];

    return () => {
      unsubsRef.current.forEach((unsub) => unsub?.());
    };
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate?.();
  }, []);

  const handleLater = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <>
      {/* Download progress banner */}
      {state === 'downloading' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          background: 'linear-gradient(90deg, rgba(124, 92, 252, 0.12), rgba(0, 212, 255, 0.08))',
          borderBottom: '1px solid rgba(124, 92, 252, 0.15)',
          flexShrink: 0,
          gap: 8,
          minHeight: 32,
        }}>
          <SyncOutlined spin style={{ fontSize: 12, color: '#7c5cfc', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Downloading v{version}...
          </span>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', maxWidth: 160 }}>
            <div style={{
              width: `${percent}%`,
              height: '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #7c5cfc, #00d4ff)',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{percent}%</span>
        </div>
      )}

      {/* Persistent banner when ready but modal dismissed */}
      {state === 'ready' && !showModal && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'linear-gradient(90deg, rgba(0, 230, 118, 0.1), rgba(0, 212, 255, 0.08))',
          borderBottom: '1px solid rgba(0, 230, 118, 0.15)',
          flexShrink: 0,
          gap: 8,
          minHeight: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ fontSize: 13, color: '#00e676', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
              v{version} ready — restart to update
            </span>
          </div>
          <button
            onClick={handleInstall}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid rgba(0, 230, 118, 0.3)',
              background: 'rgba(0, 230, 118, 0.12)',
              color: '#00e676',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Restart Now
          </button>
        </div>
      )}

      {/* Modal overlay when download completes */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: '#14141f',
            border: '1px solid rgba(124, 92, 252, 0.2)',
            borderRadius: 16,
            padding: '28px 32px',
            maxWidth: 360,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 92, 252, 0.1)',
          }}>
            {/* Icon */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(0, 212, 255, 0.1))',
              border: '1px solid rgba(124, 92, 252, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <RocketOutlined style={{ fontSize: 22, color: '#7c5cfc' }} />
            </div>

            <h3 style={{
              margin: '0 0 6px',
              fontSize: 16,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: -0.3,
            }}>
              Update Ready
            </h3>
            <p style={{
              margin: '0 0 20px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.5,
            }}>
              Pulse <span style={{ color: '#7c5cfc', fontWeight: 600 }}>v{version}</span> has been downloaded.
              Restart the app to apply the update.
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleLater}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Later
              </button>
              <button
                onClick={handleInstall}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c5cfc 0%, #00d4ff 100%)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124, 92, 252, 0.3)',
                  transition: 'all 0.2s',
                }}
              >
                Restart & Update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
