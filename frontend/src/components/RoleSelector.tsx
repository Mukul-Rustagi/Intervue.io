import { useState } from "react";

interface RoleSelectorProps {
  onSelectRole: (role: "teacher" | "student") => void;
}

export const RoleSelector = ({ onSelectRole }: RoleSelectorProps) => {
  const [selectedRole, setSelectedRole] = useState<"teacher" | "student">("student");

  return (
    <main className="role-selector-page">
      <section className="onboarding-shell">
        <span className="brand-pill">Intervue Poll</span>
        <h1>
          Welcome to the <strong>Live Polling System</strong>
        </h1>
        <p>
          Please select the role that best describes you to begin using the live polling
          <br />
          system
        </p>

        <div className="role-choice-grid">
          <button
            type="button"
            className={`role-choice ${selectedRole === "student" ? "role-choice--active" : ""}`}
            onClick={() => setSelectedRole("student")}
          >
            <h2>I&apos;m a Student</h2>
            <p>Submit answers and view live poll results in real-time.</p>
          </button>

          <button
            type="button"
            className={`role-choice ${selectedRole === "teacher" ? "role-choice--active" : ""}`}
            onClick={() => setSelectedRole("teacher")}
          >
            <h2>I&apos;m a Teacher</h2>
            <p>Create and manage polls, ask questions, and monitor student responses in real-time.</p>
          </button>
        </div>

        <button type="button" className="primary-button continue-button" onClick={() => onSelectRole(selectedRole)}>
          Continue
        </button>
      </section>
    </main>
  );
};
