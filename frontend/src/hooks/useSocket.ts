import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { apiBaseUrl } from "../api/client";
import type {
  OperationErrorPayload,
  OperationSuccessPayload,
  ServerState,
  UserRole
} from "../types/domain";

interface UseSocketOptions {
  role: UserRole | null;
  sessionId: string;
  name: string;
  onStateSync: (state: ServerState) => void;
  onOperationError: (payload: OperationErrorPayload) => void;
  onOperationSuccess: (payload: OperationSuccessPayload) => void;
  onRemoved: (message: string) => void;
}

export const useSocket = ({
  role,
  sessionId,
  name,
  onStateSync,
  onOperationError,
  onOperationSuccess,
  onRemoved
}: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!role) {
      return;
    }

    const socket = io(apiBaseUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      const registerPayload =
        role === "student"
          ? {
              role,
              sessionId,
              name
            }
          : {
              role,
              sessionId
            };

      socket.emit("session:register", registerPayload);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("state:sync", (state: ServerState) => {
      onStateSync(state);
    });

    socket.on("operation:error", (payload: OperationErrorPayload) => {
      onOperationError(payload);
    });

    socket.on("operation:success", (payload: OperationSuccessPayload) => {
      onOperationSuccess(payload);
    });

    socket.on("session:removed", (payload: { message?: string }) => {
      onRemoved(payload.message ?? "You were removed from the live room.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [role, sessionId, name, onStateSync, onOperationError, onOperationSuccess, onRemoved]);

  const emit = useCallback((eventName: string, payload?: unknown) => {
    socketRef.current?.emit(eventName, payload);
  }, []);

  return {
    isConnected,
    emit
  };
};
