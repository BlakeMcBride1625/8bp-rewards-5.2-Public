import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from './LoggerService';
import { Request } from 'express';
import session from 'express-session';

interface PassportUser {
  id: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
}

export interface SocketWithSession extends Socket {
  request: Request & {
    session?: session.Session & {
      passport?: {
        user?: PassportUser;
      };
    };
  };
  userId?: string;
  isAdmin?: boolean;
}

export interface ClaimProgressEvent {
  processId: string;
  status: 'starting' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  currentUser: string | null;
  totalUsers: number;
  completedUsers: number;
  failedUsers: number;
  userProgress: Array<{
    userId: string;
    status: string;
    steps: Array<{ step: string; timestamp: Date }>;
  }>;
  logs: Array<{
    level: string;
    message: string;
    timestamp: string;
  }>;
  exitCode?: number;
}

// VPSStatsEvent matches the actual structure from vps-monitor.ts
export interface VPSStatsEvent {
  timestamp: string;
  system: {
    hostname: string;
    uptime?: number;
    platform: string;
    arch: string;
    nodeVersion?: string;
    release?: string;
  };
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    model?: string;
    temperature?: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    available?: number;
    usagePercent?: number;
    percentage?: number;
    swap?: {
      total: number;
      free: number;
      used: number;
    };
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent?: number;
    percentage?: number;
    inodes?: {
      total: number;
      free: number;
      used: number;
    };
  };
  network: {
    interfaces?: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
      packetsReceived?: number;
      packetsSent?: number;
    }>;
    connections?: number;
    [key: string]: any; // Allow additional network properties
  };
  processes: {
    total: number;
    running: number;
    sleeping?: number;
    stopped?: number;
    zombie: number;
  };
  services: Array<{
    name: string;
    status: string;
    uptime?: string | number;
    memory?: string;
    cpu?: string;
  }>;
  ping: {
    google?: number;
    cloudflare?: number;
    localhost?: number;
    latency?: number;
    status?: string;
    [key: string]: any; // Allow additional ping properties
  };
  uptime: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private httpServer: HTTPServer | null = null;
  private static instance: WebSocketService;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public initialize(httpServer: HTTPServer): void {
    this.httpServer = httpServer;
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const frontendPort = process.env.FRONTEND_PORT || '2500';
          const allowedOrigins = [
            `http://localhost:${frontendPort}`,
            'https://8ballpool.website',
            process.env.PUBLIC_URL
          ].filter(Boolean);
          
          // Allow requests with no origin (like mobile apps)
          if (!origin) return callback(null, true);
          
          const isAllowed = allowedOrigins.some(allowed => 
            origin.startsWith(allowed as string)
          );
          
          if (isAllowed) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling'], // Allow both for fallback
      allowEIO3: true,
      path: '/8bp-rewards/socket.io' // Match the base path
    });

    // Authentication middleware
    this.io.use((socket: Socket, next) => {
      const socketWithSession = socket as SocketWithSession;
      const req = socketWithSession.request as Request & {
        session?: session.Session & {
          passport?: {
            user?: PassportUser;
          };
        };
      };
      
      // Check if user has a session (basic check)
      // Full authentication will be done per-room/event if needed
      if (req.session?.passport?.user) {
        // User is authenticated
        socketWithSession.userId = req.session.passport.user.id;
        socketWithSession.isAdmin = true;
        return next();
      }
      
      // Allow unauthenticated connections for public events
      // Admin-only events should check auth in handlers
      return next();
    });

    this.io.on('connection', (socket: Socket) => {
      const socketWithSession = socket as SocketWithSession;
      const req = socket.request as Request;
      const userId = socketWithSession.userId || 'anonymous';
      
      logger.info('WebSocket client connected', {
        action: 'websocket_connect',
        socketId: socket.id,
        userId: userId
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', {
          action: 'websocket_disconnect',
          socketId: socket.id,
          userId: userId,
          reason: reason
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error', {
          action: 'websocket_error',
          socketId: socket.id,
          userId: userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

      // Join process-specific room for claim progress
      socket.on('join-claim-progress', (processId: string) => {
        if (processId) {
          socket.join(`claim-progress-${processId}`);
          logger.info('Client joined claim progress room', {
            action: 'websocket_join_room',
            socketId: socket.id,
            userId: userId,
            room: `claim-progress-${processId}`
          });
        }
      });

      // Leave process-specific room
      socket.on('leave-claim-progress', (processId: string) => {
        if (processId) {
          socket.leave(`claim-progress-${processId}`);
          logger.info('Client left claim progress room', {
            action: 'websocket_leave_room',
            socketId: socket.id,
            userId: userId,
            room: `claim-progress-${processId}`
          });
        }
      });

      // Join VPS stats room
      socket.on('join-vps-stats', () => {
        socket.join('vps-stats');
        logger.info('Client joined VPS stats room', {
          action: 'websocket_join_room',
          socketId: socket.id,
          userId: userId,
          room: 'vps-stats'
        });
      });

      // Leave VPS stats room
      socket.on('leave-vps-stats', () => {
        socket.leave('vps-stats');
        logger.info('Client left VPS stats room', {
          action: 'websocket_leave_room',
          socketId: socket.id,
          userId: userId,
          room: 'vps-stats'
        });
      });

      // Join user-specific screenshots room
      socket.on('join-screenshots', (targetUserId?: string) => {
        // Use the authenticated user's ID or the provided targetUserId
        const roomUserId = socketWithSession.userId || targetUserId;
        if (roomUserId) {
          const room = `screenshots-${roomUserId}`;
          socket.join(room);
          logger.info('Client joined screenshots room', {
            action: 'websocket_join_room',
            socketId: socket.id,
            userId: userId,
            room: room
          });
        }
      });

      // Leave user-specific screenshots room
      socket.on('leave-screenshots', (targetUserId?: string) => {
        const roomUserId = socketWithSession.userId || targetUserId;
        if (roomUserId) {
          const room = `screenshots-${roomUserId}`;
          socket.leave(room);
          logger.info('Client left screenshots room', {
            action: 'websocket_leave_room',
            socketId: socket.id,
            userId: userId,
            room: room
          });
        }
      });

      // Join ticket room
      socket.on('join-ticket', (ticketId: string) => {
        if (ticketId) {
          socket.join(`ticket-${ticketId}`);
          logger.info('Client joined ticket room', {
            action: 'websocket_join_room',
            socketId: socket.id,
            userId: userId,
            room: `ticket-${ticketId}`
          });
        }
      });

      // Leave ticket room
      socket.on('leave-ticket', (ticketId: string) => {
        if (ticketId) {
          socket.leave(`ticket-${ticketId}`);
          logger.info('Client left ticket room', {
            action: 'websocket_leave_room',
            socketId: socket.id,
            userId: userId,
            room: `ticket-${ticketId}`
          });
        }
      });

      // Join user-specific avatars room
      socket.on('join-avatars', (targetUserId?: string) => {
        // Use the authenticated user's ID or the provided targetUserId
        const roomUserId = socketWithSession.userId || targetUserId;
        if (roomUserId) {
          const room = `avatars-${roomUserId}`;
          socket.join(room);
          logger.info('Client joined avatars room', {
            action: 'websocket_join_room',
            socketId: socket.id,
            userId: userId,
            room: room
          });
        }
      });

      // Leave user-specific avatars room
      socket.on('leave-avatars', (targetUserId?: string) => {
        const roomUserId = socketWithSession.userId || targetUserId;
        if (roomUserId) {
          const room = `avatars-${roomUserId}`;
          socket.leave(room);
          logger.info('Client left avatars room', {
            action: 'websocket_leave_room',
            socketId: socket.id,
            userId: userId,
            room: room
          });
        }
      });
    });

    logger.info('WebSocket service initialized');
  }

  public emitClaimProgress(processId: string, progress: ClaimProgressEvent): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit claim progress');
      return;
    }

    this.io.to(`claim-progress-${processId}`).emit('claim-progress', progress);
    
    logger.debug('Emitted claim progress event', {
      action: 'websocket_emit_claim_progress',
      processId: processId,
      status: progress.status
    });
  }

  public emitVPSStats(stats: VPSStatsEvent): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit VPS stats');
      return;
    }

    this.io.to('vps-stats').emit('vps-stats', stats);
    
    logger.debug('Emitted VPS stats event', {
      action: 'websocket_emit_vps_stats',
      timestamp: stats.timestamp
    });
  }

  public emitScreenshotUpdate(userId: string, screenshotData: {
    eightBallPoolId: string;
    username: string;
    screenshotUrl: string;
    claimedAt: string | null;
    capturedAt?: string | null;
    filename?: string;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit screenshot update');
      return;
    }

    this.io.to(`screenshots-${userId}`).emit('screenshot-update', screenshotData);
    
    logger.debug('Emitted screenshot update event', {
      action: 'websocket_emit_screenshot_update',
      userId: userId,
      eightBallPoolId: screenshotData.eightBallPoolId,
      filename: screenshotData.filename
    });
  }

  public emitScreenshotsRefresh(userId: string): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit screenshots refresh');
      return;
    }

    this.io.to(`screenshots-${userId}`).emit('screenshots-refresh');
    
    logger.debug('Emitted screenshots refresh event', {
      action: 'websocket_emit_screenshots_refresh',
      userId: userId
    });
  }

  public emitTicketMessage(ticketId: string, message: {
    id: string;
    sender_type: 'user' | 'admin' | 'system';
    sender_discord_id?: string;
    message: string;
    created_at: string;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit ticket message');
      return;
    }

    this.io.to(`ticket-${ticketId}`).emit('ticket-message', {
      ticketId,
      message
    });
    
    logger.debug('Emitted ticket message event', {
      action: 'websocket_emit_ticket_message',
      ticketId: ticketId,
      messageId: message.id
    });
  }

  public emitAvatarUpdate(userId: string, avatarData: {
    eightBallPoolId: string;
    activeAvatarUrl: string | null;
    activeUsername: string;
    profile_image_url?: string | null;
    leaderboard_image_url?: string | null;
    eight_ball_pool_avatar_filename?: string | null;
    use_discord_avatar?: boolean;
    use_discord_username?: boolean;
    discord_avatar_hash?: string | null;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit avatar update');
      return;
    }

    // Send to specific user's room for dashboard updates
    this.io.to(`avatars-${userId}`).emit('avatar-update', avatarData);
    
    // Broadcast globally for leaderboard updates (all users need to see the change)
    const leaderboardUpdate = {
      eightBallPoolId: avatarData.eightBallPoolId,
      avatarUrl: avatarData.activeAvatarUrl
    };
    this.io.emit('leaderboard-avatar-update', leaderboardUpdate);
    
    logger.info('Emitted avatar update event', {
      action: 'websocket_emit_avatar_update',
      userId: userId,
      eightBallPoolId: avatarData.eightBallPoolId,
      activeAvatarUrl: avatarData.activeAvatarUrl,
      connectedClients: this.io.sockets.sockets.size,
      broadcastSent: true
    });
  }

  public emitAvatarsRefresh(userId: string): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit avatars refresh');
      return;
    }

    this.io.to(`avatars-${userId}`).emit('avatars-refresh');
    
    logger.debug('Emitted avatars refresh event', {
      action: 'websocket_emit_avatars_refresh',
      userId: userId
    });
  }

  /**
   * Emit leaderboard data update event - used when verification data (level/rank) changes
   * This broadcasts to all connected clients to refresh their leaderboard data
   */
  public emitLeaderboardDataUpdate(data: {
    eightBallPoolId: string;
    account_level?: number | null;
    account_rank?: string | null;
    username?: string | null;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized, cannot emit leaderboard data update');
      return;
    }

    // Broadcast to all connected clients
    this.io.emit('leaderboard-data-update', data);
    
    logger.info('Emitted leaderboard data update event', {
      action: 'websocket_emit_leaderboard_data_update',
      eightBallPoolId: data.eightBallPoolId,
      account_level: data.account_level,
      account_rank: data.account_rank,
      connectedClients: this.io.sockets.sockets.size
    });
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  public isInitialized(): boolean {
    return this.io !== null;
  }
}

export default WebSocketService.getInstance();

