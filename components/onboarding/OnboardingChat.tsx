"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

interface OnboardingChatProps {
  tenantId: string;
  displayName: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const API_URL = "/api/chat";

const WELCOME_MESSAGE =
  "Ciao! 👋 Sono l'assistente SmartVolve. Come posso aiutarti con l'onboarding?";

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function OnboardingChat({ tenantId, displayName }: OnboardingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      text: WELCOME_MESSAGE,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Auto-focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Send message */
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: userMsg.text, tenantId }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        const agentMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "agent",
          text:
            data.response ??
            data.reply ??
            data.message ??
            data.text ??
            "Risposta ricevuta.",
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, agentMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "agent",
          text: "Mi dispiace, si è verificato un errore. Riprova tra qualche istante.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [sending],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div style={styles.shell}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          {/* Logo mark */}
          <div style={styles.logoMark}>
            <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">
              <rect
                x="3" y="17" width="3.5" height="8" rx="0.6"
                fill="currentColor" opacity="0.45"
              />
              <rect
                x="9" y="13" width="3.5" height="12" rx="0.6"
                fill="currentColor" opacity="0.7"
              />
              <rect
                x="15" y="8" width="3.5" height="17" rx="0.6"
                fill="currentColor" opacity="0.92"
              />
              <path
                d="M21 12 L25 8 M25 8 L25 12.5 M25 8 L20.5 8"
                stroke="var(--accent)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <div>
            <h1 style={styles.headerTitle}>{displayName}</h1>
            <p style={styles.headerSub}>Onboarding SmartVolve</p>
          </div>
        </div>
        {/* Status pill */}
        <div style={styles.statusPill}>
          <span style={styles.statusDot} />
          Online
        </div>
      </header>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div style={styles.messageArea}>
        <div style={styles.messagesInner}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.bubble,
                ...(msg.role === "user" ? styles.bubbleUser : styles.bubbleAgent),
              }}
            >
              {msg.role === "agent" && (
                <div style={styles.agentLabel}>SmartVolve</div>
              )}
              <p style={styles.bubbleText}>{msg.text}</p>
              <time style={styles.timestamp}>
                {new Date(msg.timestamp).toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div style={{ ...styles.bubble, ...styles.bubbleAgent }}>
              <div style={styles.agentLabel}>SmartVolve</div>
              <div style={styles.typingDots}>
                <span style={{ ...styles.dot, animationDelay: "0s" }} />
                <span style={{ ...styles.dot, animationDelay: "0.15s" }} />
                <span style={{ ...styles.dot, animationDelay: "0.3s" }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} style={styles.inputBar}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio…"
            rows={1}
            disabled={sending}
            style={styles.textarea}
            aria-label="Messaggio"
            id="onboarding-chat-input"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: sending || !input.trim() ? 0.4 : 1,
            }}
            aria-label="Invia messaggio"
            id="onboarding-send-button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Keyframe animation injected once */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes onb-bounce {
              0%, 60%, 100% { transform: translateY(0); }
              30% { transform: translateY(-4px); }
            }
            #onboarding-chat-input::placeholder {
              color: var(--ink-soft);
            }
            #onboarding-chat-input:focus {
              outline: none;
              border-color: var(--accent);
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
            }
          `,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles — inline CSSProperties for zero-config portability                 */
/* -------------------------------------------------------------------------- */

const styles: Record<string, React.CSSProperties> = {
  /* Full-viewport shell */
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    maxHeight: "100dvh",
    overflow: "hidden",
  },

  /* Header */
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--line)",
    flexShrink: 0,
  },
  headerInner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logoMark: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "var(--bg-raised)",
    color: "var(--ink)",
  },
  headerTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: 1.3,
  },
  headerSub: {
    margin: 0,
    fontSize: "12px",
    color: "var(--ink-soft)",
    lineHeight: 1.3,
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#10B981",
    background: "rgba(16, 185, 129, 0.08)",
    padding: "4px 10px",
    borderRadius: "999px",
    fontWeight: 500,
  },
  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#10B981",
  },

  /* Message area */
  messageArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    scrollBehavior: "smooth",
  },
  messagesInner: {
    maxWidth: "720px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  /* Bubbles */
  bubble: {
    maxWidth: "80%",
    padding: "12px 16px",
    borderRadius: "16px",
    lineHeight: 1.55,
    fontSize: "14px",
    position: "relative" as const,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    background: "var(--accent)",
    color: "#fff",
    borderBottomRightRadius: "4px",
  },
  bubbleAgent: {
    alignSelf: "flex-start",
    background: "var(--bg-surface)",
    border: "1px solid var(--line)",
    borderBottomLeftRadius: "4px",
  },
  agentLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--accent)",
    marginBottom: "4px",
    letterSpacing: "0.02em",
  },
  bubbleText: {
    margin: 0,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  timestamp: {
    display: "block",
    fontSize: "10px",
    color: "var(--ink-soft)",
    marginTop: "6px",
    textAlign: "right" as const,
    opacity: 0.7,
  },

  /* Typing indicator */
  typingDots: {
    display: "flex",
    gap: "4px",
    padding: "4px 0",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--ink-soft)",
    animation: "onb-bounce 0.8s ease-in-out infinite",
  },

  /* Input bar */
  inputBar: {
    padding: "12px 20px",
    paddingBottom: "max(12px, env(safe-area-inset-bottom))",
    background: "var(--bg-surface)",
    borderTop: "1px solid var(--line)",
    flexShrink: 0,
  },
  inputWrapper: {
    maxWidth: "720px",
    margin: "0 auto",
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
  },
  textarea: {
    flex: 1,
    resize: "none" as const,
    border: "1px solid var(--line)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    lineHeight: "1.45",
    background: "var(--bg)",
    color: "var(--ink)",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  sendBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity 0.15s, transform 0.1s",
  },
};
