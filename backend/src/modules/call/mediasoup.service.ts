import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import { types as msTypes } from 'mediasoup';
import * as os from 'os';

// ── mediasoup codec config ──
const MEDIA_CODECS: msTypes.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    preferredPayloadType: 111,
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    preferredPayloadType: 96,
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    preferredPayloadType: 98,
    clockRate: 90000,
    parameters: { 'profile-id': 2, 'x-google-start-bitrate': 1000 },
  },
];

// ── Per-room state ──
interface SfuRoom {
  router: msTypes.Router;
  peers: Map<string, SfuPeer>; // userId → peer
}

interface SfuPeer {
  userId: string;
  sendTransport: msTypes.WebRtcTransport | null;
  recvTransport: msTypes.WebRtcTransport | null;
  producers: Map<string, msTypes.Producer>; // producerId → producer
  consumers: Map<string, msTypes.Consumer>; // consumerId → consumer
}

@Injectable()
export class MediasoupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediasoupService.name);
  private workers: msTypes.Worker[] = [];
  private nextWorkerIdx = 0;
  private readonly rooms = new Map<string, SfuRoom>(); // callId → room

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const numWorkers = Math.min(os.cpus().length, 4);
    this.logger.log(`Creating ${numWorkers} mediasoup worker(s)...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: this.configService.get<number>('MS_RTC_MIN_PORT', 10000),
        rtcMaxPort: this.configService.get<number>('MS_RTC_MAX_PORT', 10100),
      });

      worker.on('died', () => {
        this.logger.error(`mediasoup worker ${worker.pid} died, restarting...`);
        this.workers = this.workers.filter((w) => w !== worker);
        // In production, recreate the worker
      });

      this.workers.push(worker);
    }

    this.logger.log(`${this.workers.length} mediasoup worker(s) ready`);
  }

  async onModuleDestroy() {
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
  }

  private getNextWorker(): msTypes.Worker {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  // ── Room management ──

  async getOrCreateRoom(callId: string): Promise<SfuRoom> {
    let room = this.rooms.get(callId);
    if (room) return room;

    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });

    room = { router, peers: new Map() };
    this.rooms.set(callId, room);
    this.logger.log(`Created SFU room for call ${callId}`);
    return room;
  }

  getRoom(callId: string): SfuRoom | undefined {
    return this.rooms.get(callId);
  }

  async closeRoom(callId: string): Promise<void> {
    const room = this.rooms.get(callId);
    if (!room) return;

    // Close all transports (which closes producers/consumers)
    for (const peer of room.peers.values()) {
      peer.sendTransport?.close();
      peer.recvTransport?.close();
    }

    room.router.close();
    this.rooms.delete(callId);
    this.logger.log(`Closed SFU room for call ${callId}`);
  }

  // ── Router capabilities ──

  getRouterRtpCapabilities(callId: string): msTypes.RtpCapabilities | null {
    const room = this.rooms.get(callId);
    return room?.router.rtpCapabilities ?? null;
  }

  // ── Peer management ──

  getOrCreatePeer(callId: string, userId: string): SfuPeer {
    const room = this.rooms.get(callId);
    if (!room) throw new Error(`Room ${callId} not found`);

    let peer = room.peers.get(userId);
    if (!peer) {
      peer = {
        userId,
        sendTransport: null,
        recvTransport: null,
        producers: new Map(),
        consumers: new Map(),
      };
      room.peers.set(userId, peer);
    }
    return peer;
  }

  removePeer(callId: string, userId: string): void {
    const room = this.rooms.get(callId);
    if (!room) return;

    const peer = room.peers.get(userId);
    if (!peer) return;

    peer.sendTransport?.close();
    peer.recvTransport?.close();
    room.peers.delete(userId);

    // If room is empty, close it
    if (room.peers.size === 0) {
      this.closeRoom(callId);
    }
  }

  // ── WebRtcTransport ──

  async createWebRtcTransport(
    callId: string,
    userId: string,
    direction: 'send' | 'recv',
  ): Promise<{
    id: string;
    iceParameters: msTypes.IceParameters;
    iceCandidates: msTypes.IceCandidate[];
    dtlsParameters: msTypes.DtlsParameters;
  }> {
    const room = this.rooms.get(callId);
    if (!room) throw new Error(`Room ${callId} not found`);

    const listenIp = this.configService.get<string>('MS_LISTEN_IP', '0.0.0.0');
    const announcedIp = this.configService.get<string>('MS_ANNOUNCED_IP', '');

    const transport = await room.router.createWebRtcTransport({
      listenInfos: [
        {
          protocol: 'udp',
          ip: listenIp,
          ...(announcedIp ? { announcedAddress: announcedIp } : {}),
        },
        {
          protocol: 'tcp',
          ip: listenIp,
          ...(announcedIp ? { announcedAddress: announcedIp } : {}),
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    const peer = this.getOrCreatePeer(callId, userId);
    if (direction === 'send') {
      peer.sendTransport = transport;
    } else {
      peer.recvTransport = transport;
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    callId: string,
    userId: string,
    direction: 'send' | 'recv',
    dtlsParameters: msTypes.DtlsParameters,
  ): Promise<void> {
    const room = this.rooms.get(callId);
    if (!room) throw new Error(`Room ${callId} not found`);

    const peer = room.peers.get(userId);
    if (!peer) throw new Error(`Peer ${userId} not found in room ${callId}`);

    const transport = direction === 'send' ? peer.sendTransport : peer.recvTransport;
    if (!transport) throw new Error(`${direction} transport not found for peer ${userId}`);

    await transport.connect({ dtlsParameters });
  }

  // ── Producer (client sends media to SFU) ──

  async produce(
    callId: string,
    userId: string,
    kind: msTypes.MediaKind,
    rtpParameters: msTypes.RtpParameters,
    appData?: Record<string, unknown>,
  ): Promise<{ producerId: string }> {
    const room = this.rooms.get(callId);
    if (!room) throw new Error(`Room ${callId} not found`);

    const peer = room.peers.get(userId);
    if (!peer?.sendTransport) throw new Error(`Send transport not found for ${userId}`);

    const producer = await peer.sendTransport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, userId },
    });

    peer.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      peer.producers.delete(producer.id);
    });

    return { producerId: producer.id };
  }

  // ── Consumer (client receives media from SFU) ──

  async consume(
    callId: string,
    consumerUserId: string,
    producerId: string,
    rtpCapabilities: msTypes.RtpCapabilities,
  ): Promise<{
    consumerId: string;
    producerId: string;
    kind: msTypes.MediaKind;
    rtpParameters: msTypes.RtpParameters;
    producerUserId: string;
  } | null> {
    const room = this.rooms.get(callId);
    if (!room) return null;

    // Check if the router can consume this producer
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      this.logger.warn(`Router cannot consume producer ${producerId} for user ${consumerUserId}`);
      return null;
    }

    const peer = room.peers.get(consumerUserId);
    if (!peer?.recvTransport) return null;

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      peer.consumers.delete(consumer.id);
    });

    // Find which user owns this producer
    let producerUserId = '';
    for (const [uid, p] of room.peers.entries()) {
      if (p.producers.has(producerId)) {
        producerUserId = uid;
        break;
      }
    }

    return {
      consumerId: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerUserId,
    };
  }

  /** Get all producers in a room that a given user should consume (everyone else's) */
  getOtherProducers(callId: string, userId: string): Array<{ producerId: string; userId: string; kind: msTypes.MediaKind }> {
    const room = this.rooms.get(callId);
    if (!room) return [];

    const result: Array<{ producerId: string; userId: string; kind: msTypes.MediaKind }> = [];
    for (const [peerUserId, peer] of room.peers.entries()) {
      if (peerUserId === userId) continue;
      for (const [producerId, producer] of peer.producers.entries()) {
        if (!producer.closed) {
          result.push({ producerId, userId: peerUserId, kind: producer.kind });
        }
      }
    }
    return result;
  }

  /** Get list of user IDs in a room */
  getRoomPeerIds(callId: string): string[] {
    const room = this.rooms.get(callId);
    if (!room) return [];
    return Array.from(room.peers.keys());
  }

  async closeProducer(callId: string, userId: string, producerId: string): Promise<void> {
    const room = this.rooms.get(callId);
    if (!room) return;

    const peer = room.peers.get(userId);
    if (!peer) return;

    const producer = peer.producers.get(producerId);
    if (producer) {
      producer.close();
      peer.producers.delete(producerId);
    }
  }

  async resumeConsumer(callId: string, userId: string, consumerId: string): Promise<void> {
    const room = this.rooms.get(callId);
    if (!room) return;

    const peer = room.peers.get(userId);
    if (!peer) return;

    const consumer = peer.consumers.get(consumerId);
    if (consumer) {
      await consumer.resume();
    }
  }
}
