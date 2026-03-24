import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useChat } from '../../contexts/ChatContext';
import { useCall } from '../../contexts/CallContext';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddPeoplePicker({ open, onClose }: Props) {
  const { state: chatState, loadChatUsers } = useChat();
  const { state: callState, addParticipants } = useCall();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      loadChatUsers();
      setSearch('');
      setSelected(new Map());
    }
  }, [open, loadChatUsers]);

  // Filter out users already in the call and the current user
  const currentParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    if (user) ids.add(user.id);
    if (callState.activeCall) {
      // participantNames keys are the user IDs we know about
      Object.keys(callState.participantNames).forEach(id => ids.add(id));
    }
    return ids;
  }, [user, callState.activeCall, callState.participantNames]);

  const filtered = useMemo(() => {
    return chatState.chatUsers.filter(u => {
      if (currentParticipantIds.has(u.id)) return false;
      if (selected.has(u.id)) return true;
      if (!search) return true;
      const q = search.toLowerCase();
      return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q);
    });
  }, [chatState.chatUsers, currentParticipantIds, search, selected]);

  const handleInvite = () => {
    if (selected.size === 0) return;
    const names: Record<string, string> = {};
    selected.forEach((name, id) => { names[id] = name; });
    addParticipants(Array.from(selected.keys()), names);
    onClose();
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={360}
      zIndex={10002}
      style={{ top: 60 }}
      styles={{
        body: { background: 'rgba(16, 16, 24, 0.98)', borderRadius: 16, padding: 0 },
      }}
      closable={false}
    >
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 12 }}>
          Add people to call
        </div>

        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.85)',
            marginBottom: 12,
          }}
        />

        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
              No users available
            </div>
          )}
          {filtered.map(u => {
            const isSelected = selected.has(u.id);
            const name = `${u.firstName} ${u.lastName}`;
            return (
              <div
                key={u.id}
                onClick={() => {
                  setSelected(prev => {
                    const next = new Map(prev);
                    if (next.has(u.id)) next.delete(u.id);
                    else next.set(u.id, name);
                    return next;
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(124, 92, 252, 0.12)' : 'transparent',
                  border: isSelected ? '1px solid rgba(124, 92, 252, 0.3)' : '1px solid transparent',
                  marginBottom: 4,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(124, 92, 252, 0.2)',
                  border: '1px solid rgba(124, 92, 252, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#a78bfa',
                  flexShrink: 0,
                }}>
                  {getInitials(u.firstName, u.lastName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.designation || u.email}
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#7c5cfc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff', flexShrink: 0,
                  }}>
                    &#10003;
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Invite button */}
        <button
          onClick={handleInvite}
          disabled={selected.size === 0}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '8px 0',
            fontSize: 12,
            fontWeight: 600,
            background: selected.size > 0 ? '#7c5cfc' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 8,
            color: selected.size > 0 ? '#fff' : 'rgba(255,255,255,0.25)',
            cursor: selected.size > 0 ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          {selected.size > 0 ? `Add ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Select people to add'}
        </button>
      </div>
    </Modal>
  );
}
