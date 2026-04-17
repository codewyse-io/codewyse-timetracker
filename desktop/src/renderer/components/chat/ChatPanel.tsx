import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import NewConversationModal from './NewConversationModal';
import { useCall } from '../../contexts/CallContext';
import { PhoneOutlined, VideoCameraOutlined, TeamOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';

export default function ChatPanel() {
  const { state, dispatch, loadMessages, markAsRead, renameConversation } = useChat();
  const { user } = useAuth();
  const { initiateCall } = useCall();
  const [showNewConv, setShowNewConv] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Inline rename for group chats
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const activeConv = state.conversations.find((c) => c.id === state.activeConversationId);
  const activeMessages = state.activeConversationId ? state.messages[state.activeConversationId] || [] : [];
  const typingUserIds = state.activeConversationId ? state.typingUsers[state.activeConversationId] || [] : [];
  const hasActiveConv = !!(state.activeConversationId && activeConv);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!state.activeConversationId) return;
    loadMessages(state.activeConversationId).then((res) => setHasMore(res.hasMore));
  }, [state.activeConversationId, loadMessages]);

  // Mark as read when viewing conversation
  useEffect(() => {
    if (!state.activeConversationId || activeMessages.length === 0) return;
    const lastMsg = activeMessages[activeMessages.length - 1];
    if (lastMsg) {
      markAsRead(state.activeConversationId, lastMsg.id);
    }
  }, [state.activeConversationId, activeMessages.length, markAsRead]);

  const handleLoadMore = async () => {
    if (!state.activeConversationId || activeMessages.length === 0) return;
    const cursor = activeMessages[0].id;
    const res = await loadMessages(state.activeConversationId, cursor);
    setHasMore(res.hasMore);
  };

  const getConversationDisplayName = () => {
    if (!activeConv) return '';
    if (activeConv.type === 'group') return activeConv.name || 'Group Chat';
    const other = activeConv.participants.find((p) => p.userId !== user?.id);
    return other ? `${other.firstName} ${other.lastName}`.trim() : 'Chat';
  };

  const handleBack = () => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', conversationId: null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0 }}>

      {/* ── Conversation List View ── */}
      {!hasActiveConv && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ConversationList onNewConversation={() => setShowNewConv(true)} />
        </div>
      )}

      {/* ── Active Chat View ── */}
      {hasActiveConv && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Header */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }} />}
                onClick={handleBack}
                style={{ width: 32, height: 32, border: 'none', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                {renaming && activeConv?.type === 'group' ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={async () => {
                      const trimmed = renameDraft.trim();
                      if (trimmed && trimmed !== (activeConv?.name || '') && activeConv) {
                        try {
                          await renameConversation(activeConv.id, trimmed);
                        } catch {
                          // revert silently
                        }
                      }
                      setRenaming(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { setRenaming(false); }
                    }}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.95)',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(124, 92, 252, 0.4)',
                      borderRadius: 6,
                      outline: 'none',
                      padding: '4px 8px',
                      width: '100%',
                      maxWidth: 320,
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <div
                    onClick={() => {
                      if (activeConv?.type === 'group') {
                        setRenameDraft(activeConv.name || 'Group Chat');
                        setRenaming(true);
                      }
                    }}
                    title={activeConv?.type === 'group' ? 'Click to rename group' : undefined}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.9)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: activeConv?.type === 'group' ? 'pointer' : 'default',
                    }}
                  >
                    {getConversationDisplayName()}
                  </div>
                )}
                {typingUserIds.length > 0 && (
                  <div style={{ fontSize: 10, color: '#38efb3', fontStyle: 'italic' }}>typing...</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <Tooltip title={activeConv!.type === 'group' ? 'Group Voice Call' : 'Voice Call'}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    activeConv!.type === 'group'
                      ? <TeamOutlined style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }} />
                      : <PhoneOutlined style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }} />
                  }
                  onClick={() => {
                    const others = activeConv!.participants.filter((p) => p.userId !== user?.id);
                    const targetIds = others.map((p) => p.userId);
                    if (targetIds.length > 0) initiateCall(targetIds, 'audio', others);
                  }}
                  style={{ width: 30, height: 30, border: 'none' }}
                />
              </Tooltip>
              <Tooltip title={activeConv!.type === 'group' ? 'Group Video Call' : 'Video Call'}>
                <Button
                  type="text"
                  size="small"
                  icon={<VideoCameraOutlined style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }} />}
                  onClick={() => {
                    const others = activeConv!.participants.filter((p) => p.userId !== user?.id);
                    const targetIds = others.map((p) => p.userId);
                    if (targetIds.length > 0) initiateCall(targetIds, 'video', others);
                  }}
                  style={{ width: 30, height: 30, border: 'none' }}
                />
              </Tooltip>
            </div>
          </div>

          {/* Messages */}
          <MessageThread
            messages={activeMessages}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            typingUserIds={typingUserIds}
          />

          {/* Input */}
          <MessageInput conversationId={state.activeConversationId!} />
        </div>
      )}

      <NewConversationModal open={showNewConv} onClose={() => setShowNewConv(false)} />
    </div>
  );
}
