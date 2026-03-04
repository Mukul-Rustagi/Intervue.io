import type { PollSnapshot, ServerState } from "../types/domain";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

const parseResponse = async <T>(response: Response): Promise<T> => {
  const data = (await response.json()) as { message?: string } & T;

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }

  return data;
};

export const fetchState = async (role: "teacher" | "student", sessionId: string): Promise<ServerState> => {
  const params = new URLSearchParams({ role, sessionId });
  const response = await fetch(`${API_BASE}/api/state?${params.toString()}`);
  return parseResponse<ServerState>(response);
};

export const fetchPollHistory = async (): Promise<PollSnapshot[]> => {
  const response = await fetch(`${API_BASE}/api/polls/history`);
  const data = await parseResponse<{ polls: PollSnapshot[] }>(response);
  return data.polls;
};

export const apiBaseUrl = API_BASE;
