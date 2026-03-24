import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RealtimeGateway, AuthenticatedSocket, registerSocketHandler } from '../realtime/realtime.gateway';
import { SignalingService } from './signaling.service';
import { CallService } from './call.service';
import { MediasoupService } from './mediasoup.service';

const GROUP_CALL_THRESHOLD = 2;

@Injectable()
export class CallGateway implements OnModuleInit {
  private readonly logger = new Logger(CallGateway.name);

  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly signalingService: SignalingService,
    private readonly callService: CallService,
    private readonly mediasoupService: MediasoupService,
  ) {}

  onModuleInit() {
    this.logger.log('Registering call socket handlers...');

    registerSocketHandler('call:initiate', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }

        const existingCall = await this.signalingService.getUserActiveCall(client.user.id);
        if (existingCall) { callback?.({ ok: false, error: 'You are already in a call' }); return; }

        const isGroupCall = data.targetUserIds.length >= GROUP_CALL_THRESHOLD;

        const call = await this.signalingService.initiateCall(data.type, client.user.id, data.targetUserIds, isGroupCall);

        await this.callService.createCallLog({
          id: call.id, type: call.type, initiatorId: call.initiatorId,
          participantIds: call.participantIds, state: 'ringing', startedAt: call.startedAt,
        });

        if (isGroupCall) await this.mediasoupService.getOrCreateRoom(call.id);

        for (const targetId of data.targetUserIds) {
          this.realtimeGateway.emitToUser(targetId, 'call:signaling', {
            kind: 'call-invite', callId: call.id, type: data.type,
            fromUserId: client.user.id, fromName: client.user.email,
            participants: call.participantIds, sfuMode: isGroupCall,
          });
        }

        callback?.({ ok: true, callId: call.id, sfuMode: isGroupCall });
      } catch (err: any) {
        this.logger.error(`Error initiating call: ${err.message}`);
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('call:respond', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }

        const call = await this.signalingService.getCall(data.callId);
        if (!call) { callback?.({ ok: false, error: 'Call not found or expired' }); return; }

        // Verify user is a participant in this call
        if (!call.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'You are not a participant in this call' });
          return;
        }

        if (data.action === 'accept') {
          await this.signalingService.acceptCall(data.callId);
          await this.callService.updateCallLog(data.callId, { state: 'connecting', connectedAt: new Date() });
          for (const userId of call.participantIds) {
            this.realtimeGateway.emitToUser(userId, 'call:signaling', { kind: 'call-accept', callId: data.callId, fromUserId: client.user.id });
          }
        } else {
          await this.signalingService.endCall(data.callId);
          await this.callService.updateCallLog(data.callId, { state: 'declined', endedAt: new Date() });
          for (const userId of call.participantIds) {
            this.realtimeGateway.emitToUser(userId, 'call:signaling', { kind: 'call-decline', callId: data.callId, fromUserId: client.user.id });
          }
        }

        callback?.({ ok: true });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    // ── Invite new participants to an existing call ──
    registerSocketHandler('call:invite', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }

        const call = await this.signalingService.getCall(data.callId);
        if (!call) { callback?.({ ok: false, error: 'Call not found' }); return; }
        if (!call.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'You are not in this call' }); return;
        }

        const newUserIds: string[] = data.targetUserIds || [];
        if (newUserIds.length === 0) { callback?.({ ok: false, error: 'No users to invite' }); return; }

        // Upgrade to SFU if adding makes it a group call
        const willBeGroup = call.participantIds.length + newUserIds.length > 2;
        if (willBeGroup && !call.sfuMode) {
          call.sfuMode = true;
          await this.mediasoupService.getOrCreateRoom(call.id);
        }

        const updated = await this.signalingService.addParticipants(data.callId, newUserIds);
        if (!updated) { callback?.({ ok: false, error: 'Failed to add participants' }); return; }

        // Send invite to new participants
        for (const targetId of newUserIds) {
          this.realtimeGateway.emitToUser(targetId, 'call:signaling', {
            kind: 'call-invite',
            callId: call.id,
            type: call.type,
            fromUserId: client.user.id,
            fromName: client.user.email,
            participants: updated.participantIds,
            sfuMode: updated.sfuMode,
          });
        }

        // Notify existing participants about new members
        for (const userId of call.participantIds) {
          if (userId !== client.user.id) {
            this.realtimeGateway.emitToUser(userId, 'call:signaling', {
              kind: 'participants-updated',
              callId: call.id,
              participantIds: updated.participantIds,
            });
          }
        }

        callback?.({ ok: true, participantIds: updated.participantIds });
      } catch (err: any) {
        this.logger.error(`Error inviting to call: ${err.message}`);
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('call:signal', async (client, event) => {
      if (!client.user) return;
      const call = await this.signalingService.getCall(event.callId);
      if (!call) return;

      // Verify user is a participant in this call
      if (!call.participantIds.includes(client.user.id)) return;

      for (const userId of call.participantIds) {
        if (userId !== client.user.id) {
          this.realtimeGateway.emitToUser(userId, 'call:signaling', { ...event, fromUserId: client.user.id });
        }
      }

      if (event.kind === 'answer') {
        await this.signalingService.setConnected(event.callId);
        await this.callService.updateCallLog(event.callId, { state: 'connected' });
      }

      if (event.kind === 'call-end') {
        const endedCall = await this.signalingService.endCall(event.callId);
        if (endedCall) {
          const duration = Math.floor((Date.now() - new Date(endedCall.startedAt).getTime()) / 1000);
          await this.callService.updateCallLog(event.callId, { state: 'ended', endedAt: new Date(), durationSeconds: duration });
          if (endedCall.sfuMode) await this.mediasoupService.closeRoom(event.callId);
        }
      }
    });

    // ── SFU handlers ──

    registerSocketHandler('sfu:get-router-capabilities', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const sfuCall = await this.signalingService.getCall(data.callId);
        if (!sfuCall || !sfuCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        const room = await this.mediasoupService.getOrCreateRoom(data.callId);
        callback?.({ ok: true, rtpCapabilities: room.router.rtpCapabilities });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:create-transport', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const ctCall = await this.signalingService.getCall(data.callId);
        if (!ctCall || !ctCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        const transport = await this.mediasoupService.createWebRtcTransport(data.callId, client.user.id, data.direction);
        callback?.({ ok: true, transport });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:connect-transport', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const conCall = await this.signalingService.getCall(data.callId);
        if (!conCall || !conCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        await this.mediasoupService.connectTransport(data.callId, client.user.id, data.direction, data.dtlsParameters);
        callback?.({ ok: true });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:produce', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const prodCall = await this.signalingService.getCall(data.callId);
        if (!prodCall || !prodCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        const { producerId } = await this.mediasoupService.produce(data.callId, client.user.id, data.kind, data.rtpParameters, data.appData);
        const peerIds = this.mediasoupService.getRoomPeerIds(data.callId);
        for (const userId of peerIds) {
          if (userId !== client.user.id) {
            this.realtimeGateway.emitToUser(userId, 'sfu:new-producer', { callId: data.callId, producerId, producerUserId: client.user.id, kind: data.kind });
          }
        }
        callback?.({ ok: true, producerId });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:consume', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const consCall = await this.signalingService.getCall(data.callId);
        if (!consCall || !consCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        const result = await this.mediasoupService.consume(data.callId, client.user.id, data.producerId, data.rtpCapabilities);
        if (!result) { callback?.({ ok: false, error: 'Cannot consume this producer' }); return; }
        callback?.({ ok: true, ...result });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:resume-consumer', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const resCall = await this.signalingService.getCall(data.callId);
        if (!resCall || !resCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        await this.mediasoupService.resumeConsumer(data.callId, client.user.id, data.consumerId);
        callback?.({ ok: true });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:get-producers', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }
        const gpCall = await this.signalingService.getCall(data.callId);
        if (!gpCall || !gpCall.participantIds.includes(client.user.id)) {
          callback?.({ ok: false, error: 'Not a participant in this call' }); return;
        }
        const producers = this.mediasoupService.getOtherProducers(data.callId, client.user.id);
        callback?.({ ok: true, producers });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('sfu:leave', async (client, data) => {
      if (!client.user) return;
      const leaveCall = await this.signalingService.getCall(data.callId);
      if (!leaveCall || !leaveCall.participantIds.includes(client.user.id)) return;
      this.mediasoupService.removePeer(data.callId, client.user.id);
      const peerIds = this.mediasoupService.getRoomPeerIds(data.callId);
      for (const userId of peerIds) {
        this.realtimeGateway.emitToUser(userId, 'sfu:peer-left', { callId: data.callId, userId: client.user.id });
      }
    });

    registerSocketHandler('sfu:close-producer', async (client, data) => {
      if (!client.user) return;
      const cpCall = await this.signalingService.getCall(data.callId);
      if (!cpCall || !cpCall.participantIds.includes(client.user.id)) return;
      await this.mediasoupService.closeProducer(data.callId, client.user.id, data.producerId);
      const peerIds = this.mediasoupService.getRoomPeerIds(data.callId);
      for (const userId of peerIds) {
        if (userId !== client.user.id) {
          this.realtimeGateway.emitToUser(userId, 'sfu:producer-closed', { callId: data.callId, producerId: data.producerId, userId: client.user.id });
        }
      }
    });

    this.logger.log('Call socket handlers registered');
  }
}
