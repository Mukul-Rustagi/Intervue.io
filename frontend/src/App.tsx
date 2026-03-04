import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchState } from "./api/client";
import { ChatWidget } from "./components/ChatWidget";
import { RoleSelector } from "./components/RoleSelector";
import { StudentDashboard } from "./components/StudentDashboard";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { ToastHost } from "./components/ToastHost";
import { ToastContext, type ToastItem } from "./hooks/useToast";
import { useSocket } from "./hooks/useSocket";
import type {
  OperationErrorPayload,
  OperationSuccessPayload,
  ServerState,
  StudentState,
  TeacherState,
  UserRole
} from "./types/domain";
import {
  clearSessionSelections,
  getSessionId,
  getStoredRole,
  getStoredStudentName,
  setStoredRole,
  setStoredStudentName
} from "./utils/session";

const EMPTY_TEACHER_STATE: TeacherState = {
  role: "teacher",
  serverTime: new Date().toISOString(),
  activePoll: null,
  connectedStudents: [],
  pollHistory: [],
  chatMessages: []
};

const EMPTY_STUDENT_STATE: StudentState = {
  role: "student",
  serverTime: new Date().toISOString(),
  activePoll: null,
  hasAnsweredCurrentPoll: false,
  selectedOptionId: null,
  latestClosedPoll: null,
  chatMessages: []
};

const App = () => {
  const [role, setRole] = useState<UserRole | null>(() => getStoredRole());
  const [studentName, setStudentName] = useState(() => getStoredStudentName());
  const [teacherState, setTeacherState] = useState<TeacherState>(EMPTY_TEACHER_STATE);
  const [studentState, setStudentState] = useState<StudentState>(EMPTY_STUDENT_STATE);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [voteErrorVersion, setVoteErrorVersion] = useState(0);
  const [removedNotice, setRemovedNotice] = useState<string | null>(null);

  const sessionId = useMemo(() => getSessionId(), []);
  const pendingVoteRef = useRef(false);
  const seenChatMessageIdsRef = useRef<Set<string>>(new Set());
  const lastConnectionRef = useRef<boolean | null>(null);

  const addToast = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((prev) => [...prev, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const effectiveRole = useMemo<UserRole | null>(() => {
    if (role === "teacher") {
      return role;
    }

    if (role === "student" && studentName.trim()) {
      return role;
    }

    return null;
  }, [role, studentName]);

  const handleStateSync = useCallback((state: ServerState) => {
    if (state.role === "teacher") {
      setTeacherState(state);
      return;
    }

    setStudentState(state);

    if (state.hasAnsweredCurrentPoll) {
      pendingVoteRef.current = false;
    }
  }, []);

  const handleOperationError = useCallback(
    (payload: OperationErrorPayload) => {
      addToast(payload.message, "error");

      if (pendingVoteRef.current) {
        pendingVoteRef.current = false;
        setVoteErrorVersion((value) => value + 1);
      }
    },
    [addToast]
  );

  const handleOperationSuccess = useCallback(
    (payload: OperationSuccessPayload) => {
      addToast(payload.message, "success");
    },
    [addToast]
  );

  const handleRemoved = useCallback(
    (message: string) => {
      addToast(message, "error");
      setRemovedNotice(message);
      clearSessionSelections();
      setRole(null);
      setStudentName("");
      setStudentState(EMPTY_STUDENT_STATE);
    },
    [addToast]
  );

  const { emit, isConnected } = useSocket({
    role: effectiveRole,
    sessionId,
    name: studentName,
    onStateSync: handleStateSync,
    onOperationError: handleOperationError,
    onOperationSuccess: handleOperationSuccess,
    onRemoved: handleRemoved
  });

  useEffect(() => {
    if (!effectiveRole) {
      return;
    }

    const loadState = async () => {
      try {
        const state = await fetchState(effectiveRole, sessionId);
        handleStateSync(state);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load initial state.";
        addToast(message, "error");
      }
    };

    void loadState();
  }, [effectiveRole, sessionId, handleStateSync, addToast]);

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setStoredRole(nextRole);
    setRemovedNotice(null);

    if (nextRole === "teacher") {
      setStudentName("");
      setStoredStudentName("");
    }
  };

  const logout = () => {
    clearSessionSelections();
    setRole(null);
    setStudentName("");
    setTeacherState(EMPTY_TEACHER_STATE);
    setStudentState(EMPTY_STUDENT_STATE);
    seenChatMessageIdsRef.current = new Set();
    setRemovedNotice(null);
  };

  const saveStudentName = (name: string) => {
    const normalized = name.trim();
    if (!normalized) {
      addToast("Please enter your name.", "error");
      return;
    }

    setStudentName(normalized);
    setStoredStudentName(normalized);
  };

  const handleCreatePoll = (payload: { question: string; options: string[]; durationSeconds: number }) => {
    const normalizedOptions = payload.options.map((option) => option.trim()).filter(Boolean);

    if (normalizedOptions.length < 2) {
      addToast("At least 2 options are required.", "error");
      return;
    }

    emit("poll:create", {
      question: payload.question,
      options: normalizedOptions,
      durationSeconds: payload.durationSeconds
    });
  };

  const handleVote = (pollId: string, optionId: string) => {
    pendingVoteRef.current = true;
    emit("poll:vote", { pollId, optionId });
  };

  const handleClosePoll = () => {
    emit("poll:close");
  };

  const handleRemoveStudent = (targetSessionId: string) => {
    emit("student:remove", { sessionId: targetSessionId });
  };

  const handleSendMessage = (message: string) => {
    emit("chat:send", { message });
  };

  const chatMessages = role === "teacher" ? teacherState.chatMessages : studentState.chatMessages;
  const currentUserName = role === "teacher" ? "Teacher" : studentName.trim();
  const chatParticipants = role === "teacher" ? teacherState.connectedStudents : [];

  useEffect(() => {
    if (!effectiveRole) {
      seenChatMessageIdsRef.current = new Set();
      lastConnectionRef.current = null;
      return;
    }

    const seenMessageIds = seenChatMessageIdsRef.current;
    const unseenMessages = chatMessages.filter((message) => !seenMessageIds.has(message.id));
    if (unseenMessages.length === 0) {
      return;
    }

    const shouldSilenceFirstSync = seenMessageIds.size === 0;
    unseenMessages.forEach((message) => seenMessageIds.add(message.id));

    if (shouldSilenceFirstSync) {
      return;
    }

    const incomingFromOthers = unseenMessages.filter((message) => message.senderName !== currentUserName);
    incomingFromOthers.forEach((message) => {
      const preview = message.message.length > 70 ? `${message.message.slice(0, 70)}...` : message.message;
      addToast(`${message.senderName}: ${preview}`, "info");
    });
  }, [chatMessages, effectiveRole, currentUserName, addToast]);

  useEffect(() => {
    if (!effectiveRole) {
      return;
    }

    if (lastConnectionRef.current === null) {
      lastConnectionRef.current = isConnected;
      return;
    }

    if (lastConnectionRef.current !== isConnected) {
      if (isConnected) {
        addToast("Socket connected.", "success");
      } else {
        addToast("Socket reconnecting. Please wait...", "info");
      }
      lastConnectionRef.current = isConnected;
    }
  }, [effectiveRole, isConnected, addToast]);

  if (!role) {
    if (removedNotice) {
      return (
        <ToastContext.Provider value={{ addToast }}>
          <main className="role-selector-page">
            <section className="onboarding-shell onboarding-shell--narrow onboarding-shell--removed">
              <span className="brand-pill">Intervue Poll</span>
              <h1 className="removed-title">You&apos;ve been Kicked out!</h1>
              <p className="removed-subtitle">
                Looks like the teacher had removed you from the poll system.
                <br />
                Try again sometime.
              </p>
              <button type="button" className="primary-button continue-button" onClick={() => setRemovedNotice(null)}>
                Go to Home
              </button>
            </section>
          </main>
          <ToastHost toasts={toasts} />
        </ToastContext.Provider>
      );
    }

    return (
      <ToastContext.Provider value={{ addToast }}>
        <RoleSelector onSelectRole={selectRole} />
        <ToastHost toasts={toasts} />
      </ToastContext.Provider>
    );
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className={`app-shell app-shell--${role}`}>
        <div className={`session-controls session-controls--${role}`}>
          <span className={`chip ${isConnected ? "chip--ok" : "chip--warn"}`}>
            {isConnected ? "Connected" : "Reconnecting"}
          </span>
          <button type="button" className="secondary-button" onClick={logout}>
            Exit Session
          </button>
        </div>

        {role === "teacher" && (
          <TeacherDashboard
            state={teacherState}
            onCreatePoll={handleCreatePoll}
            onClosePoll={handleClosePoll}
          />
        )}

        {role === "student" && (
          <StudentDashboard
            state={studentState}
            studentName={studentName}
            onSaveName={saveStudentName}
            onVote={handleVote}
            voteErrorVersion={voteErrorVersion}
          />
        )}

        {effectiveRole && (
          <ChatWidget
            role={effectiveRole}
            currentUserName={currentUserName}
            messages={chatMessages}
            participants={chatParticipants}
            onSendMessage={handleSendMessage}
            onRemoveParticipant={role === "teacher" ? handleRemoveStudent : undefined}
          />
        )}
      </div>

      <ToastHost toasts={toasts} />
    </ToastContext.Provider>
  );
};

export default App;
