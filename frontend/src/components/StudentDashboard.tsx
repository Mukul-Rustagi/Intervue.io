import { useEffect, useMemo, useState } from "react";

import { usePollTimer } from "../hooks/usePollTimer";
import type { PollSnapshot, StudentState } from "../types/domain";

interface StudentDashboardProps {
  state: StudentState;
  studentName: string;
  onSaveName: (name: string) => void;
  onVote: (pollId: string, optionId: string) => void;
  voteErrorVersion: number;
}

const PollResultBoard = ({
  poll,
  questionLabel = "Question 1",
  showTitle = true
}: {
  poll: PollSnapshot;
  questionLabel?: string;
  showTitle?: boolean;
}) => {
  return (
    <section className="question-board-block">
      {showTitle && <p className="question-board-title">{questionLabel}</p>}

      <article className="question-board">
        <p className="question-board-strip">{poll.question}</p>

        <ul className="question-result-list">
          {poll.options.map((option) => (
            <li key={option.optionId} className="question-result-row">
              <div className="question-result-track">
                <div className="question-result-fill" style={{ width: `${Math.max(option.percentage, 6)}%` }}>
                  <span className="result-dot" aria-hidden="true" />
                  <span>{option.text}</span>
                </div>
                <span className="question-result-percent">{option.percentage}%</span>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
};

export const StudentDashboard = ({
  state,
  studentName,
  onSaveName,
  onVote,
  voteErrorVersion
}: StudentDashboardProps) => {
  const [nameDraft, setNameDraft] = useState(studentName);
  const [draftOptionId, setDraftOptionId] = useState<string | null>(null);

  const activePoll = state.activePoll;

  const timer = usePollTimer({
    expiresAt: activePoll?.expiresAt ?? null,
    durationSeconds: activePoll?.durationSeconds ?? 60,
    serverTime: state.serverTime,
    active: Boolean(activePoll && activePoll.status === "active")
  });

  useEffect(() => {
    setDraftOptionId(null);
  }, [activePoll?.id, voteErrorVersion]);

  const selectedOptionId = state.selectedOptionId ?? draftOptionId;

  const shouldShowResults = useMemo(() => {
    if (!activePoll) {
      return Boolean(state.latestClosedPoll);
    }

    if (activePoll.status === "closed") {
      return true;
    }

    if (state.hasAnsweredCurrentPoll || Boolean(state.selectedOptionId)) {
      return true;
    }

    return timer.remainingSeconds === 0;
  }, [activePoll, state.latestClosedPoll, state.hasAnsweredCurrentPoll, state.selectedOptionId, timer]);

  if (!studentName.trim()) {
    return (
      <main className="student-screen student-screen--centered">
        <section className="onboarding-shell">
          <span className="brand-pill">Intervue Poll</span>
          <h2>Let's Get Started</h2>
          <p>
            If you&apos;re a student, you&apos;ll be able to submit your answers, participate in live polls, and see how
            your responses compare with your classmates.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSaveName(nameDraft);
            }}
            className="name-form"
          >
            <label htmlFor="student-name-input">Enter your Name</label>
            <input
              id="student-name-input"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Enter your name"
              maxLength={80}
              required
            />
            <button type="submit" className="primary-button continue-button">
              Continue
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (!activePoll && !state.latestClosedPoll) {
    return (
      <main className="student-screen student-screen--centered">
        <section className="waiting-card waiting-card--large">
          <span className="brand-pill">Intervue Poll</span>
          <div className="loader-ring" />
          <h3>Wait for the teacher to ask questions..</h3>
        </section>
      </main>
    );
  }

  return (
    <main className="student-screen student-screen--centered">
      <section className="student-poll-shell">
        {activePoll && (
          <>
            <div className="question-meta-row">
              <strong>Question 1</strong>
              {activePoll.status === "active" && (
                <span className="timer-red">
                  <svg viewBox="0 0 24 24" width="12" height="12" role="presentation" aria-hidden="true">
                    <circle cx="12" cy="13" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 9.3v4.2l2.8 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9.4 3.5h5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span>00:{String(timer.remainingSeconds).padStart(2, "0")}</span>
                </span>
              )}
            </div>

            {!shouldShowResults && (
              <article className="question-board question-board--input">
                <p className="question-board-strip">{activePoll.question}</p>

                <div className="vote-option-grid">
                  {activePoll.options.map((option) => (
                    <button
                      type="button"
                      key={option.optionId}
                      className={`vote-option ${selectedOptionId === option.optionId ? "vote-option--selected" : ""}`}
                      onClick={() => setDraftOptionId(option.optionId)}
                      disabled={state.hasAnsweredCurrentPoll || timer.remainingSeconds === 0}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              </article>
            )}

            {shouldShowResults && <PollResultBoard poll={activePoll} questionLabel="Question 1" showTitle={false} />}

            {!shouldShowResults && (
              <div className="submit-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => selectedOptionId && onVote(activePoll.id, selectedOptionId)}
                  disabled={!selectedOptionId || state.hasAnsweredCurrentPoll || timer.remainingSeconds === 0}
                >
                  Submit
                </button>
              </div>
            )}

            {shouldShowResults && <p className="result-wait-copy">Wait for the teacher to ask a new question..</p>}
          </>
        )}

        {!activePoll && state.latestClosedPoll && (
          <>
            <PollResultBoard poll={state.latestClosedPoll} questionLabel="Question 1" showTitle />
            <p className="result-wait-copy">Wait for the teacher to ask a new question..</p>
          </>
        )}
      </section>
    </main>
  );
};


