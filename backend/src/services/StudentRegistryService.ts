import { EventEmitter } from "node:events";

import type { ConnectedStudent } from "../types/domain.js";

interface StudentRecord {
  sessionId: string;
  name: string;
  socketIds: Set<string>;
  connectedAt: number;
}

export class StudentRegistryService extends EventEmitter {
  private readonly studentsBySession = new Map<string, StudentRecord>();
  private readonly sessionBySocketId = new Map<string, string>();

  public registerStudent(sessionId: string, name: string, socketId: string): void {
    const existing = this.studentsBySession.get(sessionId);

    if (existing) {
      existing.name = name;
      existing.socketIds.add(socketId);
      this.studentsBySession.set(sessionId, existing);
    } else {
      this.studentsBySession.set(sessionId, {
        sessionId,
        name,
        socketIds: new Set([socketId]),
        connectedAt: Date.now()
      });
    }

    this.sessionBySocketId.set(socketId, sessionId);
    this.emit("updated", this.getConnectedStudents());
  }

  public unregisterSocket(socketId: string): void {
    const sessionId = this.sessionBySocketId.get(socketId);
    if (!sessionId) {
      return;
    }

    this.sessionBySocketId.delete(socketId);

    const record = this.studentsBySession.get(sessionId);
    if (!record) {
      return;
    }

    record.socketIds.delete(socketId);
    if (record.socketIds.size === 0) {
      this.studentsBySession.delete(sessionId);
    } else {
      this.studentsBySession.set(sessionId, record);
    }

    this.emit("updated", this.getConnectedStudents());
  }

  public removeStudent(sessionId: string): string[] {
    const record = this.studentsBySession.get(sessionId);
    if (!record) {
      return [];
    }

    const socketIds = [...record.socketIds];

    for (const socketId of socketIds) {
      this.sessionBySocketId.delete(socketId);
    }

    this.studentsBySession.delete(sessionId);
    this.emit("updated", this.getConnectedStudents());

    return socketIds;
  }

  public getConnectedStudents(): ConnectedStudent[] {
    return [...this.studentsBySession.values()]
      .sort((a, b) => a.connectedAt - b.connectedAt)
      .map((student) => ({
        sessionId: student.sessionId,
        name: student.name,
        connectedAt: new Date(student.connectedAt).toISOString()
      }));
  }

  public getConnectedStudentCount(): number {
    return this.studentsBySession.size;
  }

  public getSessionIdBySocketId(socketId: string): string | undefined {
    return this.sessionBySocketId.get(socketId);
  }
}
