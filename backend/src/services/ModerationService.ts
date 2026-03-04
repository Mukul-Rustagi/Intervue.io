import { ValidationError } from "../utils/errors.js";
import { StudentRegistryService } from "./StudentRegistryService.js";

export class ModerationService {
  constructor(private readonly studentRegistry: StudentRegistryService) {}

  public removeStudent(sessionId: string): string[] {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      throw new ValidationError("student sessionId is required.");
    }

    return this.studentRegistry.removeStudent(normalizedSessionId);
  }
}
