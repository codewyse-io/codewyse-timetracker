import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';
type MediatorDevice = import('mediasoup-client').types.Device;
type Transport = import('mediasoup-client').types.Transport;
type Producer = import('mediasoup-client').types.Producer;
type Consumer = import('mediasoup-client').types.Consumer;

// ── Types ──

interface CallParticipant {
  userId: string;
  firstName: string;
  lastName: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

interface CallSession {
  id: string;
  type: 'audio' | 'video';
  state: 'ringing' | 'connecting' | 'connected' | 'ended';
  initiatorId: string;
  participants: CallParticipant[];
  isOutgoing: boolean;
  callerName: string;
  sfuMode: boolean;
}

// ── State ──

interface CallState {
  activeCall: CallSession | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>; // userId → stream
  participantNames: Record<string, string>; // userId → "First Last"
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  incomingCall: { callId: string; type: 'audio' | 'video'; fromUserId: string; fromName: string; sfuMode: boolean } | null;
}

// ── Actions (discriminated union) ──

type CallAction =
  | { readonly type: 'SET_INCOMING_CALL'; readonly call: CallState['incomingCall'] }
  | { readonly type: 'SET_ACTIVE_CALL'; readonly call: CallSession | null }
  | { readonly type: 'SET_LOCAL_STREAM'; readonly stream: MediaStream | null }
  | { readonly type: 'ADD_REMOTE_STREAM'; readonly userId: string; readonly stream: MediaStream }
  | { readonly type: 'REMOVE_REMOTE_STREAM'; readonly userId: string }
  | { readonly type: 'SET_CALL_STATE'; readonly state: CallSession['state'] }
  | { readonly type: 'TOGGLE_MUTE'; readonly isMuted: boolean }
  | { readonly type: 'TOGGLE_VIDEO'; readonly isVideoEnabled: boolean }
  | { readonly type: 'SET_SCREEN_SHARING'; readonly isScreenSharing: boolean; readonly screenStream?: MediaStream | null }
  | { readonly type: 'SET_PARTICIPANT_NAMES'; readonly names: Record<string, string> }
  | { readonly type: 'CLEAR_CALL' };

const initialState: CallState = {
  activeCall: null,
  localStream: null,
  screenStream: null,
  remoteStreams: {},
  participantNames: {},
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
  incomingCall: null,
};

function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'SET_INCOMING_CALL':
      return { ...state, incomingCall: action.call };
    case 'SET_ACTIVE_CALL':
      return { ...state, activeCall: action.call, incomingCall: null };
    case 'SET_LOCAL_STREAM':
      return { ...state, localStream: action.stream };
    case 'ADD_REMOTE_STREAM':
      return { ...state, remoteStreams: { ...state.remoteStreams, [action.userId]: action.stream } };
    case 'REMOVE_REMOTE_STREAM': {
      const { [action.userId]: _, ...rest } = state.remoteStreams;
      return { ...state, remoteStreams: rest };
    }
    case 'SET_CALL_STATE':
      return state.activeCall ? { ...state, activeCall: { ...state.activeCall, state: action.state } } : state;
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: action.isMuted };
    case 'TOGGLE_VIDEO':
      return { ...state, isVideoEnabled: action.isVideoEnabled };
    case 'SET_SCREEN_SHARING':
      return { ...state, isScreenSharing: action.isScreenSharing, screenStream: action.screenStream ?? (action.isScreenSharing ? state.screenStream : null) };
    case 'SET_PARTICIPANT_NAMES':
      return { ...state, participantNames: { ...state.participantNames, ...action.names } };
    case 'CLEAR_CALL': {
      return { ...initialState };
    }
    default:
      return state;
  }
}

// ── Context ──

interface ParticipantInfo {
  userId: string;
  firstName: string;
  lastName: string;
}

interface CallContextValue {
  state: CallState;
  initiateCall: (targetUserIds: string[], type: 'audio' | 'video', participants?: ParticipantInfo[]) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  startScreenShare: () => void;
  startScreenShareWithSource: (sourceId: string) => Promise<void>;
  stopScreenShare: () => void;
  showScreenPicker: boolean;
  setShowScreenPicker: (show: boolean) => void;
  isDetached: boolean;
  detachCall: () => void;
  attachCall: () => void;
  addParticipants: (userIds: string[], names?: Record<string, string>) => void;
  showAddPeople: boolean;
  setShowAddPeople: (show: boolean) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const { isAuthenticated, user } = useAuth();
  const [state, dispatch] = useReducer(callReducer, initialState);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [isDetached, setIsDetached] = useState(false);

  // P2P refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ]);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteStreamsRef = useRef(state.remoteStreams);
  const localStreamRef = useRef(state.localStream);
  const screenStreamRef = useRef(state.screenStream);

  // SFU refs
  const deviceRef = useRef<MediatorDevice | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const sfuModeRef = useRef(false);

  // Keep stream refs in sync with state so endCallCleanup never reads stale closures
  useEffect(() => { remoteStreamsRef.current = state.remoteStreams; }, [state.remoteStreams]);
  useEffect(() => { localStreamRef.current = state.localStream; }, [state.localStream]);
  useEffect(() => { screenStreamRef.current = state.screenStream; }, [state.screenStream]);

  // Ref to always point to the latest endCallCleanup (defined below)
  const endCallCleanupRef = useRef<() => void>(() => {});

  // Fetch ICE servers on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get('/call/ice-servers').then((res) => {
      const data = res.data?.data || res.data;
      if (data?.iceServers) iceServersRef.current = data.iceServers;
    }).catch(() => {});
  }, [isAuthenticated]);

  // ── P2P helpers ──

  const createPeerConnection = useCallback((callId: string) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:signal', {
          kind: 'ice-candidate',
          callId,
          candidate: event.candidate.toJSON(),
          fromUserId: user?.id,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        dispatch({ type: 'ADD_REMOTE_STREAM', userId: 'remote', stream });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        // Clear any pending disconnect timer if the connection recovered
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      } else if (pc.connectionState === 'disconnected') {
        // Give 10 seconds for the connection to recover before cleaning up
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            disconnectTimerRef.current = null;
            if (pc.connectionState !== 'connected') {
              endCallCleanupRef.current();
            }
          }, 10_000);
        }
      } else if (pc.connectionState === 'failed') {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        endCallCleanupRef.current();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, user?.id]);

  // Flush any ICE candidates that arrived before remote description was set
  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[Call] Failed to add buffered ICE candidate:', err);
      }
    }
  }, []);

  // ── SFU helpers ──

  const joinSfuRoom = useCallback(async (callId: string, localStream: MediaStream) => {
    if (!socket) return;

    // 1. Get router RTP capabilities
    const capRes: any = await new Promise((resolve) =>
      socket.emit('sfu:get-router-capabilities', { callId }, resolve),
    );
    if (!capRes.ok) throw new Error(capRes.error);

    // 2. Load device (dynamic import to avoid bundling ~250KB when calls are unused)
    const { Device } = await import('mediasoup-client');
    const device = new Device();
    await device.load({ routerRtpCapabilities: capRes.rtpCapabilities });
    deviceRef.current = device;

    // 3. Create send transport
    const sendRes: any = await new Promise((resolve) =>
      socket.emit('sfu:create-transport', { callId, direction: 'send' }, resolve),
    );
    if (!sendRes.ok) throw new Error(sendRes.error);

    const sendTransport = device.createSendTransport({
      id: sendRes.transport.id,
      iceParameters: sendRes.transport.iceParameters,
      iceCandidates: sendRes.transport.iceCandidates,
      dtlsParameters: sendRes.transport.dtlsParameters,
    });

    sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('sfu:connect-transport', { callId, direction: 'send', dtlsParameters }, (res: any) => {
        if (res.ok) callback();
        else errback(new Error(res.error));
      });
    });

    sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      socket.emit('sfu:produce', { callId, kind, rtpParameters, appData }, (res: any) => {
        if (res.ok) callback({ id: res.producerId });
        else errback(new Error(res.error));
      });
    });

    sendTransportRef.current = sendTransport;

    // 4. Create recv transport
    const recvRes: any = await new Promise((resolve) =>
      socket.emit('sfu:create-transport', { callId, direction: 'recv' }, resolve),
    );
    if (!recvRes.ok) throw new Error(recvRes.error);

    const recvTransport = device.createRecvTransport({
      id: recvRes.transport.id,
      iceParameters: recvRes.transport.iceParameters,
      iceCandidates: recvRes.transport.iceCandidates,
      dtlsParameters: recvRes.transport.dtlsParameters,
    });

    recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('sfu:connect-transport', { callId, direction: 'recv', dtlsParameters }, (res: any) => {
        if (res.ok) callback();
        else errback(new Error(res.error));
      });
    });

    recvTransportRef.current = recvTransport;

    // 5. Produce local tracks
    for (const track of localStream.getTracks()) {
      const producer = await sendTransport.produce({ track });
      producersRef.current.set(producer.id, producer);
    }

    // 6. Consume existing producers from other peers
    const prodRes: any = await new Promise((resolve) =>
      socket.emit('sfu:get-producers', { callId }, resolve),
    );
    if (prodRes.ok && prodRes.producers) {
      for (const p of prodRes.producers) {
        await consumeProducer(callId, p.producerId, p.userId);
      }
    }

    dispatch({ type: 'SET_CALL_STATE', state: 'connected' });
  }, [socket]);

  const consumeProducer = useCallback(async (callId: string, producerId: string, producerUserId: string) => {
    if (!socket || !deviceRef.current || !recvTransportRef.current) return;

    const res: any = await new Promise((resolve) =>
      socket.emit('sfu:consume', {
        callId,
        producerId,
        rtpCapabilities: deviceRef.current!.rtpCapabilities,
      }, resolve),
    );

    if (!res.ok) return;

    const consumer = await recvTransportRef.current.consume({
      id: res.consumerId,
      producerId: res.producerId,
      kind: res.kind,
      rtpParameters: res.rtpParameters,
    });

    consumersRef.current.set(consumer.id, consumer);

    // Resume the consumer on the server
    socket.emit('sfu:resume-consumer', { callId, consumerId: consumer.id }, () => {});

    // Add/update remote stream for this user — always create a new MediaStream
    // so the object reference changes and React triggers a re-render
    const existing = remoteStreamsRef.current[producerUserId];
    const tracks = existing ? [...existing.getTracks(), consumer.track] : [consumer.track];
    const newStream = new MediaStream(tracks);
    dispatch({ type: 'ADD_REMOTE_STREAM', userId: producerUserId, stream: newStream });
  }, [socket]);

  // ── Cleanup ──

  const endCallCleanup = useCallback(() => {
    // Stop all media tracks before resetting state (use refs to avoid stale closures)
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(remoteStreamsRef.current).forEach((s) => s.getTracks().forEach((t) => t.stop()));

    // Clear disconnect timer if active
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    // P2P cleanup
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // SFU cleanup
    for (const producer of producersRef.current.values()) {
      producer.close();
    }
    producersRef.current.clear();

    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();

    sendTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current?.close();
    recvTransportRef.current = null;
    deviceRef.current = null;
    sfuModeRef.current = false;

    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;

    dispatch({ type: 'CLEAR_CALL' });
  }, []);

  // Keep endCallCleanupRef in sync so createPeerConnection never calls a stale closure
  useEffect(() => { endCallCleanupRef.current = endCallCleanup; }, [endCallCleanup]);

  // ── Public API ──

  const initiateCall = useCallback(async (targetUserIds: string[], type: 'audio' | 'video', participants?: ParticipantInfo[]) => {
    if (!socket || state.activeCall) return;

    // Store participant names for display
    if (participants) {
      const names: Record<string, string> = {};
      for (const p of participants) {
        names[p.userId] = `${p.firstName} ${p.lastName}`.trim();
      }
      dispatch({ type: 'SET_PARTICIPANT_NAMES', names });
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
    dispatch({ type: 'SET_LOCAL_STREAM', stream });

    socket.emit(
      'call:initiate',
      { targetUserIds, type },
      async (response: { ok: boolean; callId?: string; sfuMode?: boolean; error?: string }) => {
        if (!response.ok) {
          stream.getTracks().forEach((t) => t.stop());
          dispatch({ type: 'CLEAR_CALL' });
          return;
        }

        const callId = response.callId!;
        const sfuMode = response.sfuMode ?? false;
        sfuModeRef.current = sfuMode;

        dispatch({
          type: 'SET_ACTIVE_CALL',
          call: {
            id: callId,
            type,
            state: 'ringing',
            initiatorId: user!.id,
            participants: [],
            isOutgoing: true,
            callerName: '',
            sfuMode,
          },
        });

        if (sfuMode) {
          // SFU: join room immediately so we're ready when others accept
          try {
            await joinSfuRoom(callId, stream);
          } catch (err) {
            console.error('[Call] Failed to join SFU room:', err);
          }
        } else {
          // P2P: create peer connection and send offer
          const pc = createPeerConnection(callId);
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('call:signal', {
            kind: 'offer',
            callId,
            sdp: offer.sdp,
            fromUserId: user!.id,
          });
        }
      },
    );
  }, [socket, state.activeCall, user, createPeerConnection, joinSfuRoom]);

  const acceptCall = useCallback(async () => {
    if (!socket || !state.incomingCall) return;

    const { callId, type, sfuMode } = state.incomingCall;
    sfuModeRef.current = sfuMode;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
    dispatch({ type: 'SET_LOCAL_STREAM', stream });

    dispatch({
      type: 'SET_ACTIVE_CALL',
      call: {
        id: callId,
        type,
        state: 'connecting',
        initiatorId: state.incomingCall.fromUserId,
        participants: [],
        isOutgoing: false,
        callerName: state.incomingCall.fromName,
        sfuMode,
      },
    });

    socket.emit('call:respond', { callId, action: 'accept' }, () => {});

    if (sfuMode) {
      try {
        await joinSfuRoom(callId, stream);
      } catch (err) {
        console.error('[Call] Failed to join SFU room:', err);
      }
    } else {
      const pc = createPeerConnection(callId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // If an offer arrived before the PC was created, process it now
      if (pendingOfferRef.current) {
        const pendingOffer = pendingOfferRef.current;
        pendingOfferRef.current = null;
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
        await flushPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:signal', { kind: 'answer', callId, sdp: answer.sdp, fromUserId: user?.id });
        dispatch({ type: 'SET_CALL_STATE', state: 'connected' });
      }
    }
  }, [socket, state.incomingCall, user?.id, createPeerConnection, joinSfuRoom, flushPendingCandidates]);

  const declineCall = useCallback(() => {
    if (!socket || !state.incomingCall) return;
    socket.emit('call:respond', { callId: state.incomingCall.callId, action: 'decline' }, () => {});
    dispatch({ type: 'SET_INCOMING_CALL', call: null });
  }, [socket, state.incomingCall]);

  const endCall = useCallback(() => {
    if (!socket || !state.activeCall) return;

    if (sfuModeRef.current) {
      socket.emit('sfu:leave', { callId: state.activeCall.id }, () => {});
    }

    socket.emit('call:signal', {
      kind: 'call-end',
      callId: state.activeCall.id,
      fromUserId: user?.id,
    });

    endCallCleanup();
  }, [socket, state.activeCall, user?.id, endCallCleanup]);

  const toggleMute = useCallback(() => {
    const newMuted = !state.isMuted;
    state.localStream?.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    dispatch({ type: 'TOGGLE_MUTE', isMuted: newMuted });

    if (socket && state.activeCall) {
      socket.emit('call:signal', {
        kind: 'mute-toggle',
        callId: state.activeCall.id,
        fromUserId: user?.id,
        isMuted: newMuted,
      });
    }
  }, [state.isMuted, state.localStream, state.activeCall, socket, user?.id]);

  const toggleVideo = useCallback(() => {
    const newEnabled = !state.isVideoEnabled;
    state.localStream?.getVideoTracks().forEach((t) => { t.enabled = newEnabled; });
    dispatch({ type: 'TOGGLE_VIDEO', isVideoEnabled: newEnabled });

    if (socket && state.activeCall) {
      socket.emit('call:signal', {
        kind: 'video-toggle',
        callId: state.activeCall.id,
        fromUserId: user?.id,
        isVideoEnabled: newEnabled,
      });
    }
  }, [state.isVideoEnabled, state.localStream, state.activeCall, socket, user?.id]);

  const startScreenShare = useCallback(() => {
    if (!state.activeCall) return;
    setShowScreenPicker(true);
  }, [state.activeCall]);

  const startScreenShareWithSource = useCallback(async (sourceId: string) => {
    if (!state.activeCall) return;
    setShowScreenPicker(false);

    let capturedStream: MediaStream;
    let screenTrack: MediaStreamTrack;

    try {
      // Tell main process which source to use before calling getDisplayMedia
      await window.electronAPI.selectScreenSource(sourceId);

      // Electron's setDisplayMediaRequestHandler will intercept this and use the selected source
      capturedStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = capturedStream.getVideoTracks()[0];
      if (!track) return;
      screenTrack = track;
    } catch (err) {
      console.error('[Call] Screen share failed:', err);
      return;
    }

    // Capture callId before async/callback boundaries to avoid stale closure
    const callId = state.activeCall!.id;

    if (sfuModeRef.current) {
      // SFU: produce a new screen track
      if (sendTransportRef.current) {
        const producer = await sendTransportRef.current.produce({
          track: screenTrack,
          appData: { type: 'screen' },
        });
        producersRef.current.set(producer.id, producer);
        screenTrack.onended = () => {
          producer.close();
          producersRef.current.delete(producer.id);
          dispatch({ type: 'SET_SCREEN_SHARING', isScreenSharing: false });
          if (socket) {
            socket.emit('sfu:close-producer', { callId, producerId: producer.id }, () => {});
          }
        };
      }
    } else {
      // P2P: replace video track
      const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      screenTrack.onended = () => { stopScreenShare(); };
    }

    dispatch({ type: 'SET_SCREEN_SHARING', isScreenSharing: true, screenStream: capturedStream });

    if (socket) {
      socket.emit('call:signal', {
        kind: 'screen-share-start',
        callId,
        fromUserId: user?.id,
      });
    }
  }, [state.activeCall, socket, user?.id]);

  const stopScreenShare = useCallback(() => {
    if (!state.activeCall) return;

    // Clear onended to prevent double invocation
    state.screenStream?.getVideoTracks().forEach((t) => { t.onended = null; });

    // Stop screen capture tracks to release the screen capture
    state.screenStream?.getTracks().forEach((t) => t.stop());

    if (!sfuModeRef.current && peerConnectionRef.current && state.localStream) {
      const cameraTrack = state.localStream.getVideoTracks()[0];
      const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
    }

    dispatch({ type: 'SET_SCREEN_SHARING', isScreenSharing: false });

    if (socket) {
      socket.emit('call:signal', {
        kind: 'screen-share-stop',
        callId: state.activeCall.id,
        fromUserId: user?.id,
      });
    }
  }, [state.localStream, state.screenStream, state.activeCall, socket, user?.id]);

  // ── Detach / Attach (mini mode toggle) ──
  const detachCall = useCallback(() => {
    setIsDetached(true);
  }, []);

  const attachCall = useCallback(() => {
    setIsDetached(false);
  }, []);

  // ── Add participants to an active call ──
  const addParticipants = useCallback((userIds: string[], names?: Record<string, string>) => {
    if (!socket || !state.activeCall) return;

    // Store names for display
    if (names) {
      dispatch({ type: 'SET_PARTICIPANT_NAMES', names });
    }

    socket.emit('call:invite', {
      callId: state.activeCall.id,
      targetUserIds: userIds,
    }, (res: any) => {
      if (!res?.ok) {
        console.error('[Call] Failed to invite participants:', res?.error);
      }
    });

    setShowAddPeople(false);
  }, [socket, state.activeCall]);

  // Auto-attach when call ends
  useEffect(() => {
    if (!state.activeCall && isDetached) {
      setIsDetached(false);
    }
  }, [state.activeCall, isDetached]);

  // ── Socket event listeners ──

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleSignaling = async (event: any) => {
      switch (event.kind) {
        case 'call-invite': {
          dispatch({
            type: 'SET_INCOMING_CALL',
            call: {
              callId: event.callId,
              type: event.type,
              fromUserId: event.fromUserId,
              fromName: event.fromName || 'Unknown',
              sfuMode: event.sfuMode ?? false,
            },
          });
          const visible = await window.electronAPI.isWindowVisible();
          if (!visible) window.electronAPI.showCallNotification(event.fromName || 'Unknown');
          break;
        }

        case 'call-accept':
          dispatch({ type: 'SET_CALL_STATE', state: 'connecting' });
          break;

        case 'call-decline':
        case 'call-end':
          endCallCleanup();
          break;

        // P2P-only signaling
        case 'offer': {
          if (sfuModeRef.current) break; // SFU doesn't use P2P offers
          // If peer connection doesn't exist yet (acceptCall hasn't finished),
          // store the offer and process it once the PC is ready
          if (!peerConnectionRef.current) {
            pendingOfferRef.current = { type: 'offer', sdp: event.sdp };
            break;
          }
          const pc = peerConnectionRef.current;
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: event.sdp }));
          await flushPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', { kind: 'answer', callId: event.callId, sdp: answer.sdp, fromUserId: user?.id });
          dispatch({ type: 'SET_CALL_STATE', state: 'connected' });
          break;
        }

        case 'answer': {
          if (sfuModeRef.current) break;
          const pc = peerConnectionRef.current;
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: event.sdp }));
            await flushPendingCandidates(pc);
            dispatch({ type: 'SET_CALL_STATE', state: 'connected' });
          }
          break;
        }

        case 'ice-candidate': {
          if (sfuModeRef.current) break;
          const pc = peerConnectionRef.current;
          if (pc && event.candidate) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(event.candidate));
            } else {
              pendingCandidatesRef.current.push(event.candidate);
            }
          }
          break;
        }
      }
    };

    // SFU: new producer available from another peer
    const handleNewProducer = async (data: { callId: string; producerId: string; producerUserId: string; kind: string }) => {
      if (!sfuModeRef.current) return;
      await consumeProducer(data.callId, data.producerId, data.producerUserId);
    };

    // SFU: a peer left the room
    const handlePeerLeft = (data: { callId: string; userId: string }) => {
      dispatch({ type: 'REMOVE_REMOTE_STREAM', userId: data.userId });
    };

    // SFU: a producer was closed (e.g. stopped screen share)
    const handleProducerClosed = (data: { callId: string; producerId: string; userId: string }) => {
      // Find and close the consumer for this producer
      for (const [consumerId, consumer] of consumersRef.current.entries()) {
        if (consumer.producerId === data.producerId) {
          consumer.close();
          consumersRef.current.delete(consumerId);
        }
      }
    };

    socket.on('call:signaling', handleSignaling);
    socket.on('sfu:new-producer', handleNewProducer);
    socket.on('sfu:peer-left', handlePeerLeft);
    socket.on('sfu:producer-closed', handleProducerClosed);

    return () => {
      socket.off('call:signaling', handleSignaling);
      socket.off('sfu:new-producer', handleNewProducer);
      socket.off('sfu:peer-left', handlePeerLeft);
      socket.off('sfu:producer-closed', handleProducerClosed);
    };
  }, [socket, isAuthenticated, user?.id, createPeerConnection, endCallCleanup, consumeProducer, flushPendingCandidates]);

  // Memoize context value
  const value = useMemo<CallContextValue>(() => ({
    state,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    startScreenShareWithSource,
    stopScreenShare,
    showScreenPicker,
    setShowScreenPicker,
    isDetached,
    detachCall,
    attachCall,
    addParticipants,
    showAddPeople,
    setShowAddPeople,
  }), [
    state,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    startScreenShareWithSource,
    stopScreenShare,
    showScreenPicker,
    isDetached,
    detachCall,
    attachCall,
    addParticipants,
    showAddPeople,
  ]);

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}
