import React, { useState, useMemo, useCallback } from 'react';
import { Input, Button, Tooltip, Badge } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onNewConversation: () => void;
}

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg|ico|heic|heif|avif)$/i;
const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|3gp)$/i;
const AUDIO_EXTS = /\.(mp3|wav|ogg|aac|flac|wma|m4a|webm)$/i;
const VOICE_NOTE = /^voice-note-/i;

function formatPreview(msg: { type: string; content: string }): string {
  if (msg.type === 'text') return msg.content;
  const name = msg.content || '';
  if (VOICE_NOTE.test(name)) return '🎤 Voice note';
  if (IMAGE_EXTS.test(name)) return '📷 Image';
  if (VIDEO_EXTS.test(name)) return '🎥 Video';
  if (AUDIO_EXTS.test(name)) return '🎵 Audio';
  return '📎 Document';
}

export default function ConversationList({ onNewConversation }: Props) {
  const { state, dispatch } = useChat();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => state.conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (c.name?.toLowerCase().includes(q)) return true;
    return c.participants.some(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
    );
  }), [state.conversations, search]);

  const getDisplayName = useCallback((conv: typeof state.conversations[0]) => {
    if (conv.type === 'group') return conv.name || 'Group Chat';
    const other = conv.participants.find((p) => p.userId !== user?.id);
    return other ? `${other.firstName} ${other.lastName}`.trim() : 'Chat';
  }, [user?.id]);

  const getInitials = useCallback((conv: typeof state.conversations[0]) => {
    if (conv.type === 'group') return 'G';
    const other = conv.participants.find((p) => p.userId !== user?.id);
    if (!other) return '?';
    return `${other.firstName?.charAt(0) || ''}${other.lastName?.charAt(0) || ''}`.toUpperCase();
  }, [user?.id]);

  const getPresenceColor = useCallback((conv: typeof state.conversations[0]) => {
    if (conv.type === 'group') return null;
    const other = conv.participants.find((p) => p.userId !== user?.id);
    if (!other) return null;
    const status = state.presence[other.userId];
    if (status === 'online') return '#38efb3';
    if (status === 'away') return '#faad14';
    return null;
  }, [user?.id, state.presence]);

  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '12px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: "'Space Grotesk', sans-serif" }}>
          Messages
        </span>
        <Tooltip title="New Conversation">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined style={{ color: '#7c5cfc', fontSize: 14 }} />}
            onClick={onNewConversation}
            style={{ width: 28, height: 28, border: 'none' }}
          />
        </Tooltip>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <Input
          placeholder="Search..."
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            height: 32,
            fontSize: 12,
          }}
          allowClear
        />
      </div>

      {/* Conversation Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
        {filtered.map((conv) => {
          const isActive = state.activeConversationId === conv.id;
          const presenceColor = getPresenceColor(conv);

          return (
            <div
              key={conv.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_CONVERSATION', conversationId: conv.id })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(91, 141, 239, 0.1))'
                  : 'transparent',
                transition: 'background 0.15s ease',
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget.style.background = 'rgba(255,255,255,0.04)');
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget.style.background = 'transparent');
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.3), rgba(91, 141, 239, 0.25))'
                      : 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(91, 141, 239, 0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#a78bfa',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {getInitials(conv)}
                </div>
                {presenceColor && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: presenceColor,
                      border: '2px solid #0a0a0f',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: conv.unreadCount > 0 ? 600 : 500,
                      color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.85)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {getDisplayName(conv)}
                  </span>
                  {conv.lastMessage && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginLeft: 4 }}>
                      {formatTime(conv.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: conv.unreadCount > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
                        fontWeight: conv.unreadCount > 0 ? 500 : 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {formatPreview(conv.lastMessage)}
                    </span>
                    {conv.unreadCount > 0 && (
                      <Badge
                        count={conv.unreadCount}
                        size="small"
                        style={{ backgroundColor: '#7c5cfc', fontSize: 9, minWidth: 16, height: 16 }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            {search ? 'No conversations found' : 'No conversations yet'}
          </div>
        )}
      </div>
    </>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return 'now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const days = Math.floor(diff / 86400_000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
