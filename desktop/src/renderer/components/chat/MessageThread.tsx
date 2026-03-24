import React, { useRef, useEffect, useState } from 'react';
import { Button } from 'antd';
import { CloseOutlined, DownloadOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; firstName: string; lastName: string } | null;
  type: 'text' | 'file' | 'system';
  content: string;
  replyToId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  messages: Message[];
  hasMore: boolean;
  onLoadMore: () => void;
  typingUserIds: string[];
}

function DeliveryTick({ status }: { status: 'sent' | 'delivered' | 'seen' }) {
  if (status === 'sent') {
    // Single grey tick
    return <CheckOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 3 }} />;
  }
  if (status === 'delivered') {
    // Double grey tick
    return (
      <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 3, width: 14 }}>
        <CheckOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', position: 'absolute', left: 0 }} />
        <CheckOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', position: 'absolute', left: 4 }} />
      </span>
    );
  }
  // Seen — double blue tick
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 3, width: 14 }}>
      <CheckOutlined style={{ fontSize: 10, color: '#5b8def', position: 'absolute', left: 0 }} />
      <CheckOutlined style={{ fontSize: 10, color: '#5b8def', position: 'absolute', left: 4 }} />
    </span>
  );
}

export default function MessageThread({ messages, hasMore, onLoadMore, typingUserIds }: Props) {
  const { user } = useAuth();
  const { getMessageStatus } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const [preview, setPreview] = useState<{ url: string; type: 'image' | 'video' | 'pdf'; name: string } | null>(null);

  // Close lightbox on Escape
  useEffect(() => {
    if (!preview) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [preview]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toDateString();
    if (date !== currentDate) {
      currentDate = date;
      grouped.push({ date: msg.createdAt, messages: [msg] });
    } else {
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Load More */}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Button type="link" size="small" onClick={onLoadMore} style={{ fontSize: 11, color: '#7c5cfc' }}>
            Load older messages
          </Button>
        </div>
      )}

      {grouped.map((group) => (
        <React.Fragment key={group.date}>
          {/* Date Divider */}
          <div
            style={{
              textAlign: 'center',
              padding: '12px 0 6px',
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontWeight: 500,
              letterSpacing: 0.3,
            }}
          >
            {formatDateHeader(group.date)}
          </div>

          {group.messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;

            // System message
            if (msg.type === 'system') {
              return (
                <div
                  key={msg.id}
                  style={{
                    textAlign: 'center',
                    padding: '6px 0',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.3)',
                    fontStyle: 'italic',
                  }}
                >
                  {msg.content}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                  marginBottom: 4,
                }}
              >
                {/* Sender name (for others) */}
                {!isOwn && msg.sender && (
                  <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 500, marginBottom: 2, marginLeft: 4 }}>
                    {msg.sender.firstName} {msg.sender.lastName}
                  </span>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '8px 12px',
                    borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isOwn
                      ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.25), rgba(91, 141, 239, 0.2))'
                      : 'rgba(255, 255, 255, 0.06)',
                    border: isOwn
                      ? '1px solid rgba(124, 92, 252, 0.2)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    position: 'relative',
                  }}
                >
                  {msg.isDeleted ? (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                      This message was deleted
                    </span>
                  ) : msg.type === 'file' ? (
                    <div>
                      {msg.mimeType?.startsWith('image/') && msg.fileUrl ? (
                        /* Image preview — click to open lightbox */
                        <div
                          onClick={() => setPreview({ url: msg.fileUrl!, type: 'image', name: msg.fileName || 'Image' })}
                          style={{ cursor: 'pointer' }}
                        >
                          <img
                            src={msg.fileUrl}
                            alt={msg.fileName || 'Image'}
                            style={{
                              maxWidth: '100%',
                              maxHeight: 240,
                              borderRadius: 8,
                              display: 'block',
                              objectFit: 'cover',
                            }}
                          />
                        </div>
                      ) : msg.mimeType?.startsWith('video/') && msg.fileUrl ? (
                        /* Video thumbnail — click to open lightbox */
                        <div
                          onClick={() => setPreview({ url: msg.fileUrl!, type: 'video', name: msg.fileName || 'Video' })}
                          style={{
                            cursor: 'pointer',
                            position: 'relative',
                            display: 'inline-block',
                          }}
                        >
                          <video
                            src={msg.fileUrl}
                            style={{
                              maxWidth: '100%',
                              maxHeight: 240,
                              borderRadius: 8,
                              display: 'block',
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: 8,
                          }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: '50%',
                              background: 'rgba(255,255,255,0.9)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 18, color: '#0a0a0f', paddingLeft: 3,
                            }}>▶</div>
                          </div>
                        </div>
                      ) : msg.mimeType?.startsWith('audio/') && msg.fileUrl ? (
                        /* Audio / Voice note — inline player */
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          background: 'rgba(124, 92, 252, 0.08)',
                          borderRadius: 10,
                          minWidth: 200,
                        }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>🎤</span>
                          <audio
                            controls
                            src={msg.fileUrl}
                            style={{
                              flex: 1,
                              height: 32,
                              maxWidth: 220,
                              filter: 'invert(1) hue-rotate(180deg)',
                              opacity: 0.8,
                            }}
                          />
                        </div>
                      ) : msg.mimeType === 'application/pdf' && msg.fileUrl ? (
                        /* PDF — click to open lightbox */
                        <div
                          onClick={() => setPreview({ url: msg.fileUrl!, type: 'pdf', name: msg.fileName || 'Document' })}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            background: 'rgba(124, 92, 252, 0.1)',
                            borderRadius: 8,
                          }}
                        >
                          <span style={{ fontSize: 24 }}>📄</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#7c5cfc' }}>{msg.fileName}</div>
                            {msg.fileSize && (
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{formatFileSize(msg.fileSize)}</div>
                            )}
                          </div>
                        </div>
                      ) : msg.fileName ? (
                        /* Generic file download */
                        <a
                          href={msg.fileUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11,
                            color: '#7c5cfc',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            background: 'rgba(124, 92, 252, 0.1)',
                            borderRadius: 8,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>📎</span>
                          <div>
                            <div style={{ fontWeight: 500 }}>{msg.fileName}</div>
                            {msg.fileSize && (
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{formatFileSize(msg.fileSize)}</div>
                            )}
                          </div>
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {msg.content}
                    </span>
                  )}

                  {/* Time + edited indicator */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    {msg.isEdited && (
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>edited</span>
                    )}
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                      {formatMessageTime(msg.createdAt)}
                    </span>
                    {isOwn && <DeliveryTick status={getMessageStatus(msg.conversationId, msg.id)} />}
                  </div>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}

      {/* Typing indicator */}
      {typingUserIds.length > 0 && (
        <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="ai-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 11, color: '#38efb3', fontStyle: 'italic' }}>
            Someone is typing...
          </span>
        </div>
      )}

      <div ref={bottomRef} />

      {/* ── File Preview Lightbox ── */}
      {preview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Header bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.name}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }} />}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = preview.url;
                  a.download = preview.name;
                  a.target = '_blank';
                  a.click();
                }}
                style={{ width: 32, height: 32, border: 'none' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }} />}
                onClick={() => setPreview(null)}
                style={{ width: 32, height: 32, border: 'none' }}
              />
            </div>
          </div>

          {/* Content */}
          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 0 }}
            onClick={() => setPreview(null)}
          >
            {preview.type === 'image' && (
              <img
                src={preview.url}
                alt={preview.name}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
              />
            )}
            {preview.type === 'video' && (
              <video
                src={preview.url}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }}
              />
            )}
            {preview.type === 'pdf' && (
              <iframe
                src={preview.url}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#fff' }}
                title={preview.name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
