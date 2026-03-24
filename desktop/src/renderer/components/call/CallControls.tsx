import React from 'react';
import { Button, Tooltip } from 'antd';
import {
  AudioMutedOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  DesktopOutlined,
  PhoneOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useCall } from '../../contexts/CallContext';

interface Props {
  mini?: boolean;
}

export default function CallControls({ mini }: Props) {
  const { state, toggleMute, toggleVideo, startScreenShare, stopScreenShare, endCall, setShowAddPeople } = useCall();

  if (!state.activeCall) return null;
  const isVideo = state.activeCall.type === 'video';

  const btnSize = mini ? 30 : 44;
  const iconSize = mini ? 13 : 18;
  const endSize = mini ? 32 : 48;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: mini ? 6 : 12,
        padding: mini ? 0 : '12px 0',
      }}
    >
      {/* Mute */}
      <Tooltip title={state.isMuted ? 'Unmute' : 'Mute'}>
        <Button
          type="text"
          shape="circle"
          icon={
            state.isMuted
              ? <AudioMutedOutlined style={{ fontSize: iconSize, color: '#ff4d4f' }} />
              : <AudioOutlined style={{ fontSize: iconSize, color: 'rgba(255,255,255,0.8)' }} />
          }
          onClick={toggleMute}
          style={{
            width: btnSize,
            height: btnSize,
            minWidth: btnSize,
            background: state.isMuted ? 'rgba(255, 77, 79, 0.15)' : 'rgba(255,255,255,0.08)',
            border: state.isMuted ? '1px solid rgba(255, 77, 79, 0.3)' : '1px solid rgba(255,255,255,0.1)',
          }}
        />
      </Tooltip>

      {/* Video Toggle */}
      {isVideo && (
        <Tooltip title={state.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}>
          <Button
            type="text"
            shape="circle"
            icon={
              state.isVideoEnabled
                ? <VideoCameraOutlined style={{ fontSize: iconSize, color: 'rgba(255,255,255,0.8)' }} />
                : <VideoCameraAddOutlined style={{ fontSize: iconSize, color: '#ff4d4f' }} />
            }
            onClick={toggleVideo}
            style={{
              width: btnSize,
              height: btnSize,
              minWidth: btnSize,
              background: !state.isVideoEnabled ? 'rgba(255, 77, 79, 0.15)' : 'rgba(255,255,255,0.08)',
              border: !state.isVideoEnabled ? '1px solid rgba(255, 77, 79, 0.3)' : '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </Tooltip>
      )}

      {/* Screen Share — hide in mini mode */}
      {!mini && (
        <Tooltip title={state.isScreenSharing ? 'Stop sharing' : 'Share screen'}>
          <Button
            type="text"
            shape="circle"
            icon={<DesktopOutlined style={{ fontSize: iconSize, color: state.isScreenSharing ? '#38efb3' : 'rgba(255,255,255,0.8)' }} />}
            onClick={() => {
              if (state.isScreenSharing) {
                stopScreenShare();
              } else {
                startScreenShare();
              }
            }}
            style={{
              width: btnSize,
              height: btnSize,
              minWidth: btnSize,
              background: state.isScreenSharing ? 'rgba(56, 239, 176, 0.15)' : 'rgba(255,255,255,0.08)',
              border: state.isScreenSharing ? '1px solid rgba(56, 239, 176, 0.3)' : '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </Tooltip>
      )}

      {/* Add People — hide in mini mode */}
      {!mini && state.activeCall.state === 'connected' && (
        <Tooltip title="Add people">
          <Button
            type="text"
            shape="circle"
            icon={<UserAddOutlined style={{ fontSize: iconSize, color: 'rgba(255,255,255,0.8)' }} />}
            onClick={() => setShowAddPeople(true)}
            style={{
              width: btnSize,
              height: btnSize,
              minWidth: btnSize,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </Tooltip>
      )}

      {/* End Call */}
      <Tooltip title="End call">
        <Button
          type="primary"
          shape="circle"
          icon={<PhoneOutlined style={{ fontSize: mini ? 14 : 18, transform: 'rotate(135deg)' }} />}
          onClick={endCall}
          style={{
            width: endSize,
            height: endSize,
            minWidth: endSize,
            background: '#ff4d4f',
            border: 'none',
            boxShadow: mini ? 'none' : '0 0 15px rgba(255, 77, 79, 0.3)',
          }}
        />
      </Tooltip>
    </div>
  );
}
