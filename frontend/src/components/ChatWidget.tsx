import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { ChatMessage, ConnectedStudent, UserRole } from "../types/domain";

interface ChatWidgetProps {
  role: UserRole;
  currentUserName: string;
  messages: ChatMessage[];
  participants: ConnectedStudent[];
  onSendMessage: (message: string) => void;
  onRemoveParticipant?: (sessionId: string) => void;
}

export const ChatWidget = ({
  role,
  currentUserName,
  messages,
  participants,
  onSendMessage,
  onRemoveParticipant
}: ChatWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const isHydratedRef = useRef(false);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  useEffect(() => {
    const seen = seenMessageIdsRef.current;
    const unseenMessages = sortedMessages.filter((chat) => !seen.has(chat.id));
    if (unseenMessages.length === 0) {
      return;
    }

    unseenMessages.forEach((chat) => seen.add(chat.id));

    if (!isHydratedRef.current) {
      isHydratedRef.current = true;
      return;
    }

    const incomingFromOthers = unseenMessages.filter((chat) => chat.senderName !== currentUserName);
    if (incomingFromOthers.length === 0) {
      return;
    }

    if (!isOpen) {
      setUnreadCount((count) => count + incomingFromOthers.length);
    }
  }, [sortedMessages, currentUserName, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setUnreadCount(0);
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [isOpen, sortedMessages]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    onSendMessage(trimmed);
    setMessage("");
  };

  const formatChatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

  return (
    <aside className={`chat-widget ${isOpen ? "chat-widget--open" : ""}`}>
      <button
        className="chat-toggle"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Toggle chat"
      >
        <span className="chat-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" role="presentation">
            <path
              d="M5 5h14v10H9l-4 4V5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {unreadCount > 0 && <span className="chat-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-tabs">
            <button
              type="button"
              className={`chat-tab ${activeTab === "chat" ? "chat-tab--active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>
            <button
              type="button"
              className={`chat-tab ${activeTab === "participants" ? "chat-tab--active" : ""}`}
              onClick={() => setActiveTab("participants")}
            >
              Participants
            </button>
          </div>

          {activeTab === "chat" && (
            <>
              <div className="chat-messages" ref={messageContainerRef}>
                {sortedMessages.length === 0 && <p className="chat-empty">No messages yet.</p>}
                {sortedMessages.map((chat) => (
                  <article key={chat.id} className={`chat-message chat-message--${chat.role}`}>
                    <p className="chat-meta">
                      <strong className="chat-meta-name">{chat.senderName}</strong>
                      <time className="chat-meta-time" dateTime={chat.createdAt}>
                        {formatChatTime(chat.createdAt)}
                      </time>
                    </p>
                    <p>{chat.message}</p>
                  </article>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="chat-form">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  type="text"
                  placeholder="Type message"
                  maxLength={500}
                />
                <button type="submit">Send</button>
              </form>
            </>
          )}

          {activeTab === "participants" && (
            <div className="participants-tab">
              {participants.length === 0 && <p className="chat-empty">No participants connected.</p>}
              {participants.length > 0 && (
                <>
                  {role === "teacher" && (
                    <div className="participants-head">
                      <span>Name</span>
                      <span>Action</span>
                    </div>
                  )}
                  <ul className="participants-list">
                    {participants.map((participant) => (
                      <li key={participant.sessionId}>
                        <span>{participant.name}</span>
                        {role === "teacher" && onRemoveParticipant ? (
                          <button type="button" onClick={() => onRemoveParticipant(participant.sessionId)}>
                            Kick out
                          </button>
                        ) : (
                          <span className="participants-dot" aria-hidden="true" />
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
