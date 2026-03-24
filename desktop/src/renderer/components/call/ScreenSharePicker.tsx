import React, { useState, useEffect } from 'react';
import { Modal, Spin } from 'antd';

interface Source {
  id: string;
  name: string;
  thumbnail: string;
}

interface Props {
  open: boolean;
  onSelect: (sourceId: string) => void;
  onClose: () => void;
}

export default function ScreenSharePicker({ open, onSelect, onClose }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    window.electronAPI
      .getDesktopSources()
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={520}
      zIndex={10000}
      style={{
        top: 40,
      }}
      styles={{
        body: {
          background: 'rgba(16, 16, 24, 0.98)',
          borderRadius: 16,
          padding: 0,
        },
      }}
      closable={false}
    >
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 16 }}>
          Choose what to share
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {sources.map((source) => (
              <div
                key={source.id}
                onClick={() => onSelect(source.id)}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.08)',
                  transition: 'border-color 0.15s',
                  background: 'rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                {source.thumbnail ? (
                  <img
                    src={source.thumbnail}
                    alt={source.name}
                    style={{ width: '100%', height: 120, objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: 120,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(124, 92, 252, 0.08)',
                    fontSize: 28, color: 'rgba(255,255,255,0.2)',
                  }}>
                    {source.name.includes('Screen') ? '🖥' : '🪟'}
                  </div>
                )}
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.7)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {source.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && sources.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            No screens or windows available
          </div>
        )}
      </div>
    </Modal>
  );
}
