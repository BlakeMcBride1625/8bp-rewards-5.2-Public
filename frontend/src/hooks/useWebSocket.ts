import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WEBSOCKET_URL } from '../config/api';
import { logger } from '../utils/logger';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

/**
 * Custom hook for managing WebSocket connections
 * Provides connection status, auto-reconnection, and cleanup
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = Infinity
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return; // Already connected
    }

    setStatus('connecting');

    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
      withCredentials: true, // Include cookies for session authentication
      autoConnect: true,
      path: '/8bp-rewards/socket.io' // Match backend path
    });

    socket.on('connect', () => {
      setStatus('connected');
      setIsConnected(true);
      logger.debug('WebSocket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      setIsConnected(false);
      logger.debug('WebSocket disconnected:', reason);
      
      // If disconnected due to server closing or transport close, try to reconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setStatus('connecting');
      }
    });

    socket.on('connect_error', (error) => {
      setStatus('error');
      setIsConnected(false);
      console.error('WebSocket connection error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      setStatus('connected');
      setIsConnected(true);
      logger.debug('WebSocket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      setStatus('connecting');
      logger.debug('WebSocket reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      setStatus('error');
      console.error('WebSocket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      setStatus('error');
      setIsConnected(false);
      console.error('WebSocket reconnection failed');
    });

    socketRef.current = socket;
  }, [reconnection, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    status,
    connect,
    disconnect,
    isConnected
  };
}

/**
 * Hook specifically for listening to claim progress events
 */
export function useClaimProgress(processId: string | null) {
  const { socket, status, isConnected } = useWebSocket({ autoConnect: !!processId });
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    if (!socket || !processId || !isConnected) {
      return;
    }

    // Join the claim progress room
    socket.emit('join-claim-progress', processId);

    // Listen for claim progress updates
    const handleProgress = (data: any) => {
      if (data.processId === processId) {
        setProgress(data);
      }
    };

    socket.on('claim-progress', handleProgress);

    return () => {
      socket.off('claim-progress', handleProgress);
      socket.emit('leave-claim-progress', processId);
    };
  }, [socket, processId, isConnected]);

  return { progress, status, isConnected };
}

/**
 * Hook specifically for listening to VPS stats events
 */
export function useVPSStats() {
  const { socket, status, isConnected } = useWebSocket({ autoConnect: true });
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // Join the VPS stats room
    socket.emit('join-vps-stats');

    // Listen for VPS stats updates
    const handleStats = (data: any) => {
      setStats(data);
    };

    socket.on('vps-stats', handleStats);

    return () => {
      socket.off('vps-stats', handleStats);
      socket.emit('leave-vps-stats');
    };
  }, [socket, isConnected]);

  return { stats, status, isConnected };
}

/**
 * Hook specifically for listening to screenshot updates
 */
export function useScreenshots(userId: string | null) {
  const { socket, status, isConnected } = useWebSocket({ autoConnect: !!userId });
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [newScreenshot, setNewScreenshot] = useState<any>(null);

  useEffect(() => {
    if (!socket || !userId || !isConnected) {
      return;
    }

    // Join the screenshots room for this user
    socket.emit('join-screenshots');

    // Listen for screenshot refresh events
    const handleRefresh = () => {
      setShouldRefresh(true);
    };

    // Listen for individual screenshot updates
    const handleScreenshotUpdate = (data: any) => {
      setNewScreenshot(data);
      setShouldRefresh(true);
    };

    socket.on('screenshots-refresh', handleRefresh);
    socket.on('screenshot-update', handleScreenshotUpdate);

    return () => {
      socket.off('screenshots-refresh', handleRefresh);
      socket.off('screenshot-update', handleScreenshotUpdate);
      socket.emit('leave-screenshots');
    };
  }, [socket, userId, isConnected]);

  // Reset refresh flag after it's been consumed
  const consumeRefresh = useCallback(() => {
    setShouldRefresh(false);
    setNewScreenshot(null);
  }, []);

  return { 
    shouldRefresh, 
    newScreenshot, 
    consumeRefresh, 
    status, 
    isConnected 
  };
}

/**
 * Hook specifically for listening to ticket message updates
 */
export function useTicketMessages(ticketId: string | null) {
  const { socket, status, isConnected } = useWebSocket({ autoConnect: !!ticketId });
  const [newMessage, setNewMessage] = useState<any>(null);

  useEffect(() => {
    if (!socket || !ticketId || !isConnected) {
      return;
    }

    // Join the ticket room
    socket.emit('join-ticket', ticketId);

    // Listen for ticket message updates
    const handleTicketMessage = (data: any) => {
      if (data.ticketId === ticketId) {
        setNewMessage(data.message);
      }
    };

    socket.on('ticket-message', handleTicketMessage);

    return () => {
      socket.off('ticket-message', handleTicketMessage);
      socket.emit('leave-ticket', ticketId);
    };
  }, [socket, ticketId, isConnected]);

  // Reset new message after it's been consumed
  const consumeNewMessage = useCallback(() => {
    setNewMessage(null);
  }, []);

  return { 
    newMessage, 
    consumeNewMessage, 
    status, 
    isConnected 
  };
}

/**
 * Hook specifically for listening to avatar/leaderboard updates
 */
export function useAvatars(userId: string | null) {
  const { socket, status, isConnected } = useWebSocket({ autoConnect: !!userId });
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [avatarUpdate, setAvatarUpdate] = useState<any>(null);

  useEffect(() => {
    if (!socket || !userId || !isConnected) {
      return;
    }

    // Join the avatars room for this user
    socket.emit('join-avatars');

    // Listen for avatar refresh events
    const handleRefresh = () => {
      setShouldRefresh(true);
    };

    // Listen for individual avatar updates
    const handleAvatarUpdate = (data: any) => {
      setAvatarUpdate(data);
      setShouldRefresh(true);
    };

    socket.on('avatars-refresh', handleRefresh);
    socket.on('avatar-update', handleAvatarUpdate);

    return () => {
      socket.off('avatars-refresh', handleRefresh);
      socket.off('avatar-update', handleAvatarUpdate);
      socket.emit('leave-avatars');
    };
  }, [socket, userId, isConnected]);

  // Reset refresh flag after it's been consumed
  const consumeRefresh = useCallback(() => {
    setShouldRefresh(false);
    setAvatarUpdate(null);
  }, []);

  return { 
    shouldRefresh, 
    avatarUpdate, 
    consumeRefresh, 
    status, 
    isConnected 
  };
}

