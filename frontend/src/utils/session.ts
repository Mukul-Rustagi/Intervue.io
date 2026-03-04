const SESSION_ID_KEY = "live-poll-session-id";
const ROLE_KEY = "live-poll-role";
const STUDENT_NAME_KEY = "live-poll-student-name";

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getSessionId = (): string => {
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = createSessionId();
  sessionStorage.setItem(SESSION_ID_KEY, generated);
  return generated;
};

export const getStoredRole = (): "teacher" | "student" | null => {
  const role = sessionStorage.getItem(ROLE_KEY);
  return role === "teacher" || role === "student" ? role : null;
};

export const setStoredRole = (role: "teacher" | "student" | null): void => {
  if (!role) {
    sessionStorage.removeItem(ROLE_KEY);
    return;
  }

  sessionStorage.setItem(ROLE_KEY, role);
};

export const getStoredStudentName = (): string => sessionStorage.getItem(STUDENT_NAME_KEY) ?? "";

export const setStoredStudentName = (name: string): void => {
  const normalized = name.trim();
  if (!normalized) {
    sessionStorage.removeItem(STUDENT_NAME_KEY);
    return;
  }

  sessionStorage.setItem(STUDENT_NAME_KEY, normalized);
};

export const clearSessionSelections = (): void => {
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(STUDENT_NAME_KEY);
};
