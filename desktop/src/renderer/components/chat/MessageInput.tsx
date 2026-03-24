import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Button, Tooltip } from 'antd';
import { SendOutlined, PaperClipOutlined, AudioOutlined, DeleteOutlined } from '@ant-design/icons';
import { useChat } from '../../contexts/ChatContext';
import apiClient from '../../api/client';

interface Props {
  conversationId: string;
}

export default function MessageInput({ conversationId }: Props) {
  const { sendMessage, setTyping } = useChat();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(conversationId, trimmed, 'text');
    setText('');
    setTyping(conversationId, false);
    typingRef.current = false;
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }
  }, [text, conversationId, sendMessage, setTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = '36px';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;

    // Typing indicator
    if (e.target.value && !typingRef.current) {
      typingRef.current = true;
      setTyping(conversationId, true);
    } else if (!e.target.value && typingRef.current) {
      typingRef.current = false;
      setTyping(conversationId, false);
    }
  };

  const handleFileUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(`/chat/conversations/${conversationId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const data = res.data?.data || res.data;
        sendMessage(conversationId, file.name, 'file', {
          fileUrl: data.s3Key,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
        });
      } catch {
        // Could show error toast
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(100); // collect chunks every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error('[VoiceNote] Failed to start recording:', err);
    }
  };

  const stopAndSend = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop recording and wait for final data
    const recorder = mediaRecorderRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        // Stop all tracks
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    setIsRecording(false);
    setRecordingDuration(0);
    mediaRecorderRef.current = null;

    if (blob.size === 0) return;

    // Upload the voice note
    setUploading(true);
    try {
      const ext = blob.type.includes('webm') ? 'webm' : 'ogg';
      const fileName = `voice-note-${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: blob.type });
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post(`/chat/conversations/${conversationId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data?.data || res.data;
      sendMessage(conversationId, fileName, 'file', {
        fileUrl: data.s3Key,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
      });
    } catch (err) {
      console.error('[VoiceNote] Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Recording UI ──
  if (isRecording) {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Cancel button */}
        <Tooltip title="Cancel">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }} />}
            onClick={cancelRecording}
            style={{ width: 32, height: 36, border: 'none', flexShrink: 0 }}
          />
        </Tooltip>

        {/* Recording indicator */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ff4d4f',
            animation: 'dot-pulse 1s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            Recording
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
            {formatDuration(recordingDuration)}
          </span>

          {/* Waveform visualization */}
          <WaveformBars />
        </div>

        {/* Send button */}
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined style={{ fontSize: 13 }} />}
          onClick={stopAndSend}
          loading={uploading}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: '#ff4d4f',
            border: 'none',
          }}
        />

        <style>{`
          @keyframes wave {
            from { height: 4px; }
            to { height: 16px; }
          }
          @keyframes dot-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  // ── Normal input UI ──
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <Tooltip title="Attach file">
        <Button
          type="text"
          size="small"
          icon={<PaperClipOutlined style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }} />}
          onClick={handleFileUpload}
          loading={uploading}
          style={{ width: 32, height: 36, border: 'none', flexShrink: 0 }}
        />
      </Tooltip>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 10,
          padding: '8px 12px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: 12.5,
          fontFamily: "'Inter', sans-serif",
          outline: 'none',
          height: 36,
          maxHeight: 120,
          lineHeight: 1.4,
          overflowY: 'auto',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(124, 92, 252, 0.4)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
      />

      {/* Show mic button when no text, send button when there is text */}
      {text.trim() ? (
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined style={{ fontSize: 13 }} />}
          onClick={handleSend}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: '#7c5cfc',
            border: 'none',
          }}
        />
      ) : (
        <Tooltip title="Voice note">
          <Button
            type="text"
            size="small"
            icon={<AudioOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }} />}
            onClick={startRecording}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
        </Tooltip>
      )}
    </div>
  );
}

// Pre-computed random values so we don't call Math.random() on every render
const WAVE_BARS = Array.from({ length: 12 }, (_, i) => ({
  height: 4 + Math.random() * 12,
  opacity: 0.4 + Math.random() * 0.4,
  duration: 0.3 + Math.random() * 0.4,
  delay: i * 0.05,
}));

function WaveformBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
      {WAVE_BARS.map((bar, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: bar.height,
            borderRadius: 1,
            background: '#ff4d4f',
            opacity: bar.opacity,
            animation: `wave ${bar.duration}s ease-in-out infinite alternate`,
            animationDelay: `${bar.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
