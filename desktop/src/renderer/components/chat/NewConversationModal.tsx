import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useChat } from '../../contexts/ChatContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NewConversationModal({ open, onClose }: Props) {
  const { loadChatUsers, createConversation, state, dispatch } = useChat();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const isGroup = selectedIds.length > 1;

  useEffect(() => {
    if (open) {
      loadChatUsers();
      setSearch('');
      setSelectedIds([]);
      setGroupName('');
    }
  }, [open, loadChatUsers]);

  const filtered = state.chatUsers.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const type = isGroup ? 'group' : 'direct';
      const conv = await createConversation(type, selectedIds, isGroup ? groupName : undefined);
      dispatch({ type: 'SET_ACTIVE_CONVERSATION', conversationId: conv.id });
      onClose();
    } catch {
      // Could show error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={380}
      styles={{
        body: {
          background: 'rgba(16, 16, 24, 0.98)',
          borderRadius: 16,
          padding: 0,
        },
      }}
      closable={false}
    >
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 16 }}>
          New Conversation
        </div>

        <Input
          placeholder="Search users..."
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.25)' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            marginBottom: 12,
          }}
        />

        {isGroup && (
          <Input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              marginBottom: 12,
            }}
          />
        )}

        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {filtered.map((u) => (
            <div
              key={u.id}
              onClick={() => toggleUser(u.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 8px',
                borderRadius: 8,
                cursor: 'pointer',
                background: selectedIds.includes(u.id) ? 'rgba(124, 92, 252, 0.1)' : 'transparent',
                transition: 'background 0.15s',
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (!selectedIds.includes(u.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (!selectedIds.includes(u.id)) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Checkbox checked={selectedIds.includes(u.id)} />
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(91, 141, 239, 0.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#a78bfa',
                }}
              >
                {`${u.firstName?.charAt(0) || ''}${u.lastName?.charAt(0) || ''}`.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                  {u.firstName} {u.lastName}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  {u.designation || u.email}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
              No users found
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={onClose} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={handleCreate}
            loading={loading}
            disabled={selectedIds.length === 0}
            style={{ borderRadius: 8, background: '#7c5cfc', border: 'none' }}
          >
            {isGroup ? 'Create Group' : 'Start Chat'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
