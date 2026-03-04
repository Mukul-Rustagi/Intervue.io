export type UserRole = "teacher" | "student";

export type PollStatus = "active" | "closed";

export type PollEndReason = "timer" | "all_answered" | "manual";

export interface ConnectedStudent {
  sessionId: string;
  name: string;
  connectedAt: string;
}

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
  status: PollStatus;
  endReason: PollEndReason | null;
  totalVotes: number;
}

export interface TeacherState {
  role: "teacher";
  serverTime: string;
  activePoll: PollSnapshot | null;
  connectedStudents: ConnectedStudent[];
  pollHistory: PollSnapshot[];
  chatMessages: ChatMessageView[];
}

export interface StudentState {
  role: "student";
  serverTime: string;
  activePoll: PollSnapshot | null;
  hasAnsweredCurrentPoll: boolean;
  selectedOptionId: string | null;
  latestClosedPoll: PollSnapshot | null;
  chatMessages: ChatMessageView[];
}

export interface ChatMessageView {
  id: string;
  role: UserRole;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface RegisterPayload {
  role: UserRole;
  sessionId: string;
  name?: string;
}

export interface CreatePollPayload {
  question: string;
  options: string[];
  durationSeconds: number;
}

export interface SubmitVotePayload {
  pollId: string;
  optionId: string;
}

export interface ChatPayload {
  message: string;
}
