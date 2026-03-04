export type UserRole = "teacher" | "student";

export interface PollOptionView {
  optionId: string;
  text: string;
  voteCount: number;
  percentage: number;
}

export interface PollSnapshot {
  id: string;
  question: string;
  options: PollOptionView[];
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  status: "active" | "closed";
  endReason: "timer" | "all_answered" | "manual" | null;
  totalVotes: number;
}

export interface ConnectedStudent {
  sessionId: string;
  name: string;
  connectedAt: string;
}

export interface ChatMessage {
  id: string;
  role: UserRole;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface TeacherState {
  role: "teacher";
  serverTime: string;
  activePoll: PollSnapshot | null;
  connectedStudents: ConnectedStudent[];
  pollHistory: PollSnapshot[];
  chatMessages: ChatMessage[];
}

export interface StudentState {
  role: "student";
  serverTime: string;
  activePoll: PollSnapshot | null;
  hasAnsweredCurrentPoll: boolean;
  selectedOptionId: string | null;
  latestClosedPoll: PollSnapshot | null;
  chatMessages: ChatMessage[];
}

export type ServerState = TeacherState | StudentState;

export interface OperationErrorPayload {
  message: string;
}

export interface OperationSuccessPayload {
  type: string;
  message: string;
}
