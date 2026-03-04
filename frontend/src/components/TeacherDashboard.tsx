import { useEffect, useState, type FormEvent } from "react";

import type { PollSnapshot, TeacherState } from "../types/domain";

interface TeacherDashboardProps {
  state: TeacherState;
  onCreatePoll: (payload: { question: string; options: string[]; durationSeconds: number }) => void;
  onClosePoll: () => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

const PollResultBoard = ({
  poll,
  showPercentages,
  compact = false
}: {
  poll: PollSnapshot;
  showPercentages: boolean;
  compact?: boolean;
}) => {
  return (
    <section className={`question-board-block ${compact ? "question-board-block--compact" : ""}`}>
      {!compact && <p className="question-board-title">Question</p>}

      <article className={`question-board question-board--teacher ${compact ? "question-board--compact" : ""}`}>
        <p className="question-board-strip">{poll.question}</p>

        <ul className="question-result-list">
          {poll.options.map((option) => (
            <li key={option.optionId} className="question-result-row">
              <div className="question-result-track">
                <div className="question-result-fill" style={{ width: `${Math.max(option.percentage, 6)}%` }}>
                  <span className="result-dot" aria-hidden="true" />
                  <span>{option.text}</span>
                </div>

                {showPercentages && <span className="question-result-percent">{option.percentage}%</span>}
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
};

export const TeacherDashboard = ({
  state,
  onCreatePoll,
  onClosePoll
}: TeacherDashboardProps) => {
  const [question, setQuestion] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [options, setOptions] = useState(["", ""]);
  const [showComposer, setShowComposer] = useState<boolean>(() => !state.activePoll);
  const [showHistory, setShowHistory] = useState(false);

  const hasActivePoll = Boolean(state.activePoll && state.activePoll.status === "active");
  const latestClosedPoll = state.pollHistory[0] ?? null;
  const canCreateNextPoll =
    !latestClosedPoll || latestClosedPoll.endReason === "all_answered" || state.connectedStudents.length === 0;
  const canCreatePoll = !hasActivePoll && canCreateNextPoll;
  const shouldShowComposer = showComposer && canCreatePoll;
  const focusPoll = state.activePoll ?? state.pollHistory[0] ?? null;

  useEffect(() => {
    if (hasActivePoll) {
      setShowComposer(false);
    }

    if (!state.activePoll && state.pollHistory.length === 0) {
      setShowComposer(true);
    }
  }, [hasActivePoll, state.activePoll, state.pollHistory.length]);

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) {
      return;
    }

    setOptions((prev) => [...prev, ""]);
  };

  const handleCreatePoll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuestion = question.trim();
    const normalizedOptions = options.map((option) => option.trim()).filter(Boolean);

    if (!normalizedQuestion || normalizedOptions.length < MIN_OPTIONS) {
      return;
    }

    onCreatePoll({
      question: normalizedQuestion,
      options: normalizedOptions,
      durationSeconds
    });

    setShowComposer(false);
    setShowHistory(false);
    setQuestion("");
    setDurationSeconds(60);
    setOptions(["", ""]);
  };

  return (
    <main className="teacher-screen teacher-screen--enhanced">
      <section className="teacher-hero">
        <div className="teacher-hero__copy">
          <span className="brand-pill">Intervue Poll</span>
          <h2>Teacher Dashboard</h2>
          <p>Create and manage your live class poll session.</p>
        </div>
        <div className="teacher-hero__actions">
          {state.pollHistory.length > 0 && (
            <button type="button" className="primary-button history-toggle-button" onClick={() => setShowHistory((value) => !value)}>
              <svg viewBox="0 0 24 24" width="14" height="14" role="presentation" aria-hidden="true">
                <path
                  d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              {showHistory ? "Hide Poll History" : "View Poll History"}
            </button>
          )}
        </div>
      </section>

      {shouldShowComposer && (
        <section className="compose-card compose-card--teacher">
          <h3>Let&apos;s Get Started</h3>
          <p className="compose-copy">
            You&apos;ll have the ability to create and manage polls, ask questions, and monitor your students&apos; responses in
            real-time.
          </p>

          <form onSubmit={handleCreatePoll} className="poll-form">
            <div className="poll-form-row">
              <label htmlFor="teacher-question-input">Enter your question</label>
              <select
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(Number(event.target.value))}
                aria-label="Duration"
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>

            <div className="question-field">
              <textarea
                id="teacher-question-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask your class a question..."
                maxLength={100}
                required
              />
              <span className="question-counter">{question.length}/100</span>
            </div>

            <div className="option-grid">
              <div className="options-header options-header--teacher">
                <span>Edit Options</span>
                <span>Is it Correct?</span>
              </div>

              <div className="option-list">
                {options.map((option, index) => (
                  <div key={index} className="option-row">
                    <div className="option-input">
                      <span className="option-index">{index + 1}</span>
                      <input
                        value={option}
                        onChange={(event) => handleOptionChange(index, event.target.value)}
                        placeholder={`Option ${index + 1}`}
                        required
                        maxLength={200}
                      />
                    </div>
                    <div className="option-correctness" aria-hidden="true">
                      <span className={`correct-choice ${index === 0 ? "correct-choice--active" : ""}`}>Yes</span>
                      <span className={`correct-choice ${index !== 0 ? "correct-choice--active" : ""}`}>No</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="compose-actions">
              <button type="button" className="secondary-button" onClick={addOption} disabled={options.length >= MAX_OPTIONS}>
                + Add More option
              </button>
              <button type="submit" className="primary-button">
                Ask Question
              </button>
            </div>

            <div className="option-count" aria-hidden="true">
              {options.length}/{MAX_OPTIONS}
            </div>
          </form>
        </section>
      )}

      {!shouldShowComposer && focusPoll && (
        <section className="live-board-wrap live-board-wrap--teacher">
          <PollResultBoard poll={focusPoll} showPercentages={focusPoll.status !== "active" || focusPoll.totalVotes > 0} />

          <div className="live-panel-actions">
            {!hasActivePoll && !canCreatePoll && (
              <p className="compose-lock-note">
                You can ask a new question only after all connected students answer the previous one.
              </p>
            )}

            {hasActivePoll && (
              <button type="button" className="secondary-button" onClick={onClosePoll}>
                End Current Poll
              </button>
            )}

            {canCreatePoll && (
              <button type="button" className="primary-button" onClick={() => setShowComposer(true)}>
                + Ask a new question
              </button>
            )}
          </div>
        </section>
      )}

      {!focusPoll && !shouldShowComposer && (
        <section className="waiting-card">
          <span className="brand-pill">Intervue Poll</span>
          <div className="loader-ring" />
          <h3>Wait for the teacher to ask questions..</h3>
        </section>
      )}

      {showHistory && (
        <section className="history-sheet">
          <h3 className="history-title">View Poll History</h3>

          {state.pollHistory.length === 0 && <p className="empty-state">No historical polls available yet.</p>}

          {state.pollHistory.length > 0 && (
            <div className="history-grid">
              {state.pollHistory.map((poll, index) => (
                <article key={poll.id} className="history-card">
                  <h4>Question {index + 1}</h4>
                  <PollResultBoard poll={poll} showPercentages compact />
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};
