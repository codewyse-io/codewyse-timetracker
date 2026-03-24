import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';

// ── Types ──

interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string;
}

interface ConversationParticipant {
  userId: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

interface LastMessage {
  id: string;
  type: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  participants: ConversationParticipant[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
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

interface TypingIndicator {
  conversationId: string;
  userId: string;
  firstName: string;
  isTyping: boolean;
}

interface PresenceInfo {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
}

// ── State ──

interface ReadReceipt {
  userId: string;
  lastReadMessageId: string;
  readAt: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>; // conversationId → messages
  typingUsers: Record<string, string[]>; // conversationId → userIds
  presence: Record<string, 'online' | 'away' | 'offline'>; // userId → status
  readReceipts: Record<string, ReadReceipt[]>; // conversationId → receipts from other users
  loading: boolean;
  chatUsers: ChatUser[];
}

// ── Actions (discriminated union) ──

type ChatAction =
  | { readonly type: 'SET_CONVERSATIONS'; readonly conversations: Conversation[] }
  | { readonly type: 'ADD_MESSAGE'; readonly message: ChatMessage }
  | { readonly type: 'SET_MESSAGES'; readonly conversationId: string; readonly messages: ChatMessage[] }
  | { readonly type: 'PREPEND_MESSAGES'; readonly conversationId: string; readonly messages: ChatMessage[] }
  | { readonly type: 'SET_ACTIVE_CONVERSATION'; readonly conversationId: string | null }
  | { readonly type: 'SET_TYPING'; readonly indicator: TypingIndicator }
  | { readonly type: 'UPDATE_MESSAGE'; readonly message: ChatMessage }
  | { readonly type: 'DELETE_MESSAGE'; readonly messageId: string; readonly conversationId: string }
  | { readonly type: 'SET_PRESENCE'; readonly userId: string; readonly status: 'online' | 'away' | 'offline' }
  | { readonly type: 'UPDATE_UNREAD'; readonly conversationId: string; readonly count: number }
  | { readonly type: 'SET_LOADING'; readonly loading: boolean }
  | { readonly type: 'SET_CHAT_USERS'; readonly users: ChatUser[] }
  | { readonly type: 'MARK_READ'; readonly conversationId: string }
  | { readonly type: 'SET_READ_RECEIPT'; readonly conversationId: string; readonly receipt: ReadReceipt };

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  presence: {},
  readReceipts: {},
  loading: false,
  chatUsers: [],
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.conversations };

    case 'ADD_MESSAGE': {
      const convId = action.message.conversationId;
      const existing = state.messages[convId] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === action.message.id)) return state;

      const updatedConversations = state.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              lastMessage: {
                id: action.message.id,
                type: action.message.type,
                content: action.message.content,
                senderId: action.message.senderId,
                senderName: action.message.sender
                  ? `${action.message.sender.firstName} ${action.message.sender.lastName}`.trim()
                  : '',
                createdAt: action.message.createdAt,
              },
              unreadCount: convId === state.activeConversationId ? c.unreadCount : c.unreadCount + 1,
            }
          : c,
      );

      // Sort conversations by last activity
      updatedConversations.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.updatedAt;
        const bTime = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      return {
        ...state,
        messages: { ...state.messages, [convId]: [...existing, action.message] },
        conversations: updatedConversations,
      };
    }

    case 'SET_MESSAGES':
      return { ...state, messages: { ...state.messages, [action.conversationId]: action.messages } };

    case 'PREPEND_MESSAGES': {
      const existing = state.messages[action.conversationId] || [];
      return {
        ...state,
        messages: { ...state.messages, [action.conversationId]: [...action.messages, ...existing] },
      };
    }

    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversationId: action.conversationId };

    case 'SET_TYPING': {
      const convId = action.indicator.conversationId;
      const current = state.typingUsers[convId] || [];
      const updated = action.indicator.isTyping
        ? [...new Set([...current, action.indicator.userId])]
        : current.filter((id) => id !== action.indicator.userId);
      return { ...state, typingUsers: { ...state.typingUsers, [convId]: updated } };
    }

    case 'UPDATE_MESSAGE': {
      const convId = action.message.conversationId;
      const msgs = (state.messages[convId] || []).map((m) =>
        m.id === action.message.id ? action.message : m,
      );
      return { ...state, messages: { ...state.messages, [convId]: msgs } };
    }

    case 'DELETE_MESSAGE': {
      const msgs = (state.messages[action.conversationId] || []).map((m) =>
        m.id === action.messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m,
      );
      return { ...state, messages: { ...state.messages, [action.conversationId]: msgs } };
    }

    case 'SET_PRESENCE':
      return { ...state, presence: { ...state.presence, [action.userId]: action.status } };

    case 'UPDATE_UNREAD': {
      const convs = state.conversations.map((c) =>
        c.id === action.conversationId ? { ...c, unreadCount: action.count } : c,
      );
      return { ...state, conversations: convs };
    }

    case 'SET_LOADING':
      return { ...state, loading: action.loading };

    case 'SET_CHAT_USERS':
      return { ...state, chatUsers: action.users };

    case 'MARK_READ': {
      const convs = state.conversations.map((c) =>
        c.id === action.conversationId ? { ...c, unreadCount: 0 } : c,
      );
      return { ...state, conversations: convs };
    }

    case 'SET_READ_RECEIPT': {
      const convId = action.conversationId;
      const existing = state.readReceipts[convId] || [];
      // Update or add the receipt for this user
      const updated = existing.some((r) => r.userId === action.receipt.userId)
        ? existing.map((r) => r.userId === action.receipt.userId ? action.receipt : r)
        : [...existing, action.receipt];
      return { ...state, readReceipts: { ...state.readReceipts, [convId]: updated } };
    }

    default:
      return state;
  }
}

// ── Context ──

interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  sendMessage: (conversationId: string, content: string, type?: 'text' | 'file', fileData?: any) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  markAsRead: (conversationId: string, messageId: string) => void;
  loadMessages: (conversationId: string, cursor?: string) => Promise<{ hasMore: boolean }>;
  loadConversations: () => Promise<void>;
  createConversation: (type: 'direct' | 'group', participantIds: string[], name?: string) => Promise<Conversation>;
  loadChatUsers: () => Promise<void>;
  getMessageStatus: (conversationId: string, messageId: string) => 'sent' | 'delivered' | 'seen';
  totalUnread: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const { isAuthenticated, user } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const typingTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load conversations on auth
  const loadConversations = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      const res = await apiClient.get('/chat/conversations');
      dispatch({ type: 'SET_CONVERSATIONS', conversations: res.data?.data || res.data || [] });
    } catch {
      // ignore
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  const loadChatUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/chat/users');
      dispatch({ type: 'SET_CHAT_USERS', users: res.data?.data || res.data || [] });
    } catch {
      // ignore
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, cursor?: string): Promise<{ hasMore: boolean }> => {
      try {
        const params: any = { limit: '50' };
        if (cursor) params.cursor = cursor;
        const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`, { params });
        const data = res.data?.data || res.data;
        if (cursor) {
          dispatch({ type: 'PREPEND_MESSAGES', conversationId, messages: data.messages || [] });
        } else {
          dispatch({ type: 'SET_MESSAGES', conversationId, messages: data.messages || [] });
        }
        return { hasMore: data.hasMore ?? false };
      } catch {
        return { hasMore: false };
      }
    },
    [],
  );

  const sendMessage = useCallback(
    (conversationId: string, content: string, type: 'text' | 'file' = 'text', fileData?: any) => {
      if (!socket) {
        return;
      }
      if (!socket.connected) {
        return;
      }
      socket.emit(
        'chat:send-message',
        { conversationId, type, content, ...(fileData || {}) },
        (response: any) => {
          if (response?.ok && response.message) {
            dispatch({ type: 'ADD_MESSAGE', message: response.message });
          }
        },
      );
    },
    [socket],
  );

  const setTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (!socket) return;
      socket.emit('chat:typing', { conversationId, isTyping });

      // Auto-stop typing after 3 seconds
      if (isTyping) {
        if (typingTimerRef.current[conversationId]) {
          clearTimeout(typingTimerRef.current[conversationId]);
        }
        typingTimerRef.current[conversationId] = setTimeout(() => {
          socket.emit('chat:typing', { conversationId, isTyping: false });
        }, 3000);
      }
    },
    [socket],
  );

  const markAsRead = useCallback(
    (conversationId: string, messageId: string) => {
      if (!socket) return;
      socket.emit('chat:mark-read', { conversationId, messageId });
      dispatch({ type: 'MARK_READ', conversationId });
    },
    [socket],
  );

  const createConversation = useCallback(
    async (type: 'direct' | 'group', participantIds: string[], name?: string): Promise<Conversation> => {
      const res = await apiClient.post('/chat/conversations', { type, participantIds, name });
      const conversation = res.data?.data || res.data;
      await loadConversations();
      return conversation;
    },
    [loadConversations],
  );

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    loadConversations();
    const handleMessage = (message: ChatMessage) => {
      dispatch({ type: 'ADD_MESSAGE', message });
    };

    const handleTyping = (indicator: TypingIndicator) => {
      if (indicator.userId !== user?.id) {
        dispatch({ type: 'SET_TYPING', indicator });
      }
    };

    const handleReadReceipt = (receipt: { conversationId: string; userId: string; lastReadMessageId: string; readAt: string }) => {
      dispatch({
        type: 'SET_READ_RECEIPT',
        conversationId: receipt.conversationId,
        receipt: {
          userId: receipt.userId,
          lastReadMessageId: receipt.lastReadMessageId,
          readAt: receipt.readAt,
        },
      });
    };

    const handleMessageUpdated = (message: ChatMessage) => {
      dispatch({ type: 'UPDATE_MESSAGE', message });
    };

    const handleMessageDeleted = (data: { id: string; conversationId: string }) => {
      dispatch({ type: 'DELETE_MESSAGE', messageId: data.id, conversationId: data.conversationId });
    };

    const handlePresence = (presence: PresenceInfo) => {
      dispatch({ type: 'SET_PRESENCE', userId: presence.userId, status: presence.status });
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read-receipt', handleReadReceipt);
    socket.on('chat:message-updated', handleMessageUpdated);
    socket.on('chat:message-deleted', handleMessageDeleted);
    socket.on('presence:update', handlePresence);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read-receipt', handleReadReceipt);
      socket.off('chat:message-updated', handleMessageUpdated);
      socket.off('chat:message-deleted', handleMessageDeleted);
      socket.off('presence:update', handlePresence);
    };
  }, [socket, isAuthenticated, user?.id, loadConversations]);

  const totalUnread = useMemo(
    () => state.conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [state.conversations],
  );

  // Pre-compute message status map for O(1) lookup instead of O(n) per message
  const messageStatusMap = useMemo(() => {
    const statusMap: Record<string, Record<string, 'sent' | 'delivered' | 'seen'>> = {};

    for (const conversationId of Object.keys(state.messages)) {
      const messages = state.messages[conversationId] || [];
      const receipts = state.readReceipts[conversationId] || [];
      const conv = state.conversations.find((c) => c.id === conversationId);

      if (messages.length === 0) continue;

      // Build message id -> index map for O(1) index lookups
      const msgIndexMap = new Map<string, number>();
      messages.forEach((m, i) => msgIndexMap.set(m.id, i));

      // Find the highest read index across all receipts
      let highestReadIndex = -1;
      for (const receipt of receipts) {
        const readIndex = msgIndexMap.get(receipt.lastReadMessageId);
        if (readIndex !== undefined && readIndex > highestReadIndex) {
          highestReadIndex = readIndex;
        }
      }

      // Check if any other participant is online (for 'delivered' status)
      let hasOnlineParticipant = false;
      if (conv?.participants) {
        for (const p of conv.participants) {
          if (p.userId !== user?.id && state.presence[p.userId] === 'online') {
            hasOnlineParticipant = true;
            break;
          }
        }
      }

      // Build status for each message in this conversation
      const convStatus: Record<string, 'sent' | 'delivered' | 'seen'> = {};
      for (let i = 0; i < messages.length; i++) {
        if (i <= highestReadIndex) {
          convStatus[messages[i].id] = 'seen';
        } else if (hasOnlineParticipant) {
          convStatus[messages[i].id] = 'delivered';
        } else {
          convStatus[messages[i].id] = 'sent';
        }
      }
      statusMap[conversationId] = convStatus;
    }

    return statusMap;
  }, [state.readReceipts, state.messages, state.conversations, state.presence, user?.id]);

  const getMessageStatus = useCallback(
    (conversationId: string, messageId: string): 'sent' | 'delivered' | 'seen' => {
      return messageStatusMap[conversationId]?.[messageId] ?? 'sent';
    },
    [messageStatusMap],
  );

  // Memoize context value
  const value = useMemo<ChatContextValue>(() => ({
    state,
    dispatch,
    sendMessage,
    setTyping,
    markAsRead,
    loadMessages,
    loadConversations,
    createConversation,
    loadChatUsers,
    getMessageStatus,
    totalUnread,
  }), [
    state,
    dispatch,
    sendMessage,
    setTyping,
    markAsRead,
    loadMessages,
    loadConversations,
    createConversation,
    loadChatUsers,
    getMessageStatus,
    totalUnread,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
