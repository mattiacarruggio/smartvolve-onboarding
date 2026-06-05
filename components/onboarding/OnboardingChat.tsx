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

interface FeedbackData {
  nome: string;
  email: string;
  consenso: boolean;
  timestamp: number;
  tenantId: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const API_URL = "/api/chat";

const WELCOME_MESSAGE =
  "Ciao! 👋 Sono l'assistente SmartVolve. Come posso aiutarti con l'onboarding?";

/** Onboarding progress steps */
const STEPS = ["Nome", "Settore", "Tool", "Obiettivi"] as const;

/** Keywords per ogni step (case-insensitive, matched sull'ultimo messaggio agent) */
const STEP_KEYWORDS: string[][] = [
  ["nome", "chi sei", "come ti chiami", "presentati"],
  ["settore", "attività", "attivita", "industria", "cosa fai"],
  ["tool", "software", "programmi", "usa"],
  ["obiettivi", "risultati", "goal", "obiettivo"],
];

/** Keywords that signal completion */
const COMPLETION_KEYWORDS = [
  "grazie",
  "ho capito",
  "perfetto",
  "procedo",
  "complimenti",
  "ottimo",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function msgStorageKey(tenantId: string) {
  return `onboarding-messages-${tenantId}`;
}
function feedbackStorageKey(tenantId: string) {
  return `onboarding-feedback-${tenantId}`;
}

function loadMessages(tenantId: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(msgStorageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveMessages(tenantId: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(msgStorageKey(tenantId), JSON.stringify(msgs));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

function loadFeedback(tenantId: string): FeedbackData | null {
  try {
    const raw = localStorage.getItem(feedbackStorageKey(tenantId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFeedback(tenantId: string, data: FeedbackData) {
  try {
    localStorage.setItem(feedbackStorageKey(tenantId), JSON.stringify(data));
  } catch {
    /* quota exceeded */
  }
}

/**
 * Detect the highest step reached by scanning ALL agent messages.
 * Returns the highest matching step index, or -1 if none found.
 */
function detectMaxStep(messages: ChatMessage[]): number {
  let highest = -1;
  const agentTexts = messages
    .filter((m) => m.role === "agent")
    .map((m) => m.text.toLowerCase());

  for (const text of agentTexts) {
    for (let i = 0; i < STEP_KEYWORDS.length; i++) {
      if (STEP_KEYWORDS[i].some((kw) => text.includes(kw))) {
        if (i > highest) highest = i;
      }
    }
  }
  return highest;
}

/** Check if the LAST agent message signals completion */
function detectCompletion(messages: ChatMessage[]): boolean {
  const agentMsgs = messages.filter((m) => m.role === "agent");
  if (agentMsgs.length === 0) return false;
  const lastAgent = agentMsgs[agentMsgs.length - 1].text.toLowerCase();
  return COMPLETION_KEYWORDS.some((kw) => lastAgent.includes(kw));
}

function defaultMessages(): ChatMessage[] {
  return [
    {
      id: "welcome",
      role: "agent",
      text: WELCOME_MESSAGE,
      timestamp: Date.now(),
    },
  ];
}

/** Build and download a JSON export of the onboarding profile */
function exportProfile(
  tenantId: string,
  messages: ChatMessage[],
  feedback: FeedbackData,
) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

  const payload = {
    tenantId,
    exportTimestamp: now.toISOString(),
    messages,
    feedback,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `onboarding-${tenantId}-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function OnboardingChat({ tenantId, displayName }: OnboardingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(defaultMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<FeedbackData | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [resetFlash, setResetFlash] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackForm, setFeedbackForm] = useState({
    nome: "",
    email: "",
    consenso: false,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hydrated = useRef(false);

  /* ── Load from localStorage on mount ──────────────────────────────── */
  useEffect(() => {
    const saved = loadMessages(tenantId);
    if (saved) {
      setMessages(saved);
      setCurrentStep(detectMaxStep(saved));
      if (detectCompletion(saved)) {
        setShowFeedback(true);
      }
    }
    const fb = loadFeedback(tenantId);
    if (fb) {
      setFeedbackSubmitted(true);
      setSavedFeedback(fb);
      setSessionCompleted(true);
    }
    hydrated.current = true;
  }, [tenantId]);

  /* ── Persist messages to localStorage on change ───────────────────── */
  useEffect(() => {
    if (!hydrated.current) return;
    saveMessages(tenantId, messages);
  }, [messages, tenantId]);

  /* Auto-scroll on new messages / feedback appearance */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showFeedback, feedbackSubmitted]);

  /* Auto-focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ── Reset chat ────────────────────────────────────────────────── */
  const resetChat = useCallback(() => {
    try {
      localStorage.removeItem(msgStorageKey(tenantId));
      localStorage.removeItem(feedbackStorageKey(tenantId));
    } catch {
      /* ignore */
    }
    setMessages(defaultMessages());
    setCurrentStep(-1);
    setShowFeedback(false);
    setFeedbackSubmitted(false);
    setSavedFeedback(null);
    setSessionCompleted(false);
    setFeedbackError("");
    setFeedbackForm({ nome: "", email: "", consenso: false });

    // Flash "Chat azzerata" for 2s
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 2000);

    inputRef.current?.focus();
  }, [tenantId]);

  /* ── Send message ──────────────────────────────────────────────── */
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending || sessionCompleted) return;

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

        setMessages((prev) => {
          const next = [...prev, agentMsg];
          setCurrentStep(detectMaxStep(next));
          if (detectCompletion(next)) setShowFeedback(true);
          return next;
        });
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
    [sending, tenantId, sessionCompleted],
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

  const handleFeedbackSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFeedbackError("");

    // Validation
    if (!feedbackForm.nome || feedbackForm.nome.trim().length <= 2) {
      setFeedbackError("Il nome deve contenere almeno 3 caratteri.");
      return;
    }
    if (!feedbackForm.email || !EMAIL_REGEX.test(feedbackForm.email)) {
      setFeedbackError("Inserisci un indirizzo email valido.");
      return;
    }
    if (!feedbackForm.consenso) {
      setFeedbackError("Devi acconsentire ad essere contattato per procedere.");
      return;
    }

    const data: FeedbackData = {
      nome: feedbackForm.nome.trim(),
      email: feedbackForm.email.trim(),
      consenso: feedbackForm.consenso,
      timestamp: Date.now(),
      tenantId,
    };

    saveFeedback(tenantId, data);
    setSavedFeedback(data);
    setFeedbackSubmitted(true);
    setSessionCompleted(true);
  };

  const handleExport = useCallback(() => {
    const fb = savedFeedback ?? loadFeedback(tenantId);
    if (fb) exportProfile(tenantId, messages, fb);
  }, [tenantId, messages, savedFeedback]);

  const hasFeedbackData = feedbackSubmitted || !!savedFeedback;

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

        <div style={styles.headerActions}>
          {/* Export button — visible only if feedback saved */}
          {hasFeedbackData && (
            <button
              onClick={handleExport}
              style={styles.exportBtn}
              aria-label="Esporta riepilogo"
              id="onboarding-export-button"
              title="Esporta riepilogo JSON"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={styles.btnLabel}>Esporta</span>
            </button>
          )}

          {/* Reset button */}
          <button
            onClick={resetChat}
            style={styles.resetBtn}
            aria-label="Azzera chat"
            id="onboarding-reset-button"
            title="Azzera chat"
          >
            {resetFlash ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ ...styles.btnLabel, color: "#10B981" }}>
                  Chat azzerata
                </span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span style={styles.btnLabel}>Azzera</span>
              </>
            )}
          </button>

          {/* Status pill */}
          <div style={styles.statusPill}>
            <span style={styles.statusDot} />
            Online
          </div>
        </div>
      </header>

      {/* ── Progress Steps ──────────────────────────────────────────── */}
      <div style={styles.progressBar}>
        <div style={styles.progressInner}>
          {STEPS.map((label, i) => {
            const isCompleted = currentStep >= 0 && i < currentStep;
            const isActive = i === currentStep;
            return (
              <div key={label} style={styles.stepItem}>
                {/* Connector line (skip first) */}
                {i > 0 && (
                  <div
                    style={{
                      ...styles.stepLine,
                      background: isCompleted || isActive
                        ? "var(--accent)"
                        : "var(--line)",
                    }}
                  />
                )}
                {/* Circle */}
                <div
                  style={{
                    ...styles.stepCircle,
                    ...(isCompleted
                      ? styles.stepCircleCompleted
                      : isActive
                        ? styles.stepCircleActive
                        : {}),
                  }}
                  className={isActive ? "step-pulse" : undefined}
                >
                  {isCompleted ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>
                      {i + 1}
                    </span>
                  )}
                </div>
                {/* Label */}
                <span
                  style={{
                    ...styles.stepLabel,
                    color: isCompleted || isActive
                      ? "var(--ink)"
                      : "var(--ink-soft)",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div style={styles.messageArea}>
        <div style={styles.messagesInner}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.bubble,
                ...(msg.role === "user"
                  ? styles.bubbleUser
                  : styles.bubbleAgent),
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

          {/* ── Feedback form (end of onboarding) ──────────────────── */}
          {showFeedback && !feedbackSubmitted && (
            <div style={styles.feedbackCard}>
              <div style={styles.feedbackHeader}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={styles.feedbackTitle}>
                  Onboarding quasi completato!
                </span>
              </div>
              <p style={styles.feedbackDesc}>
                Ho raccolto le informazioni principali. Vuoi confermare?
              </p>

              {/* Inline error */}
              {feedbackError && (
                <div style={styles.feedbackErrorBox}>{feedbackError}</div>
              )}

              <form
                onSubmit={handleFeedbackSubmit}
                style={styles.feedbackForm}
                noValidate
              >
                <input
                  type="text"
                  placeholder="Nome e cognome"
                  value={feedbackForm.nome}
                  onChange={(e) =>
                    setFeedbackForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  style={styles.feedbackInput}
                  className="feedback-input"
                  id="feedback-name"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={feedbackForm.email}
                  onChange={(e) =>
                    setFeedbackForm((f) => ({ ...f, email: e.target.value }))
                  }
                  style={styles.feedbackInput}
                  className="feedback-input"
                  id="feedback-email"
                />
                <label style={styles.feedbackCheckLabel}>
                  <input
                    type="checkbox"
                    checked={feedbackForm.consenso}
                    onChange={(e) =>
                      setFeedbackForm((f) => ({
                        ...f,
                        consenso: e.target.checked,
                      }))
                    }
                    style={styles.feedbackCheck}
                    id="feedback-consent"
                  />
                  <span>Acconsento ad essere contattato</span>
                </label>
                <button
                  type="submit"
                  style={styles.feedbackSubmitBtn}
                  id="feedback-submit"
                >
                  Invia e completa
                </button>
              </form>
            </div>
          )}

          {/* Feedback confirmation */}
          {feedbackSubmitted && savedFeedback && (
            <div style={styles.feedbackConfirm}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#10B981" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span style={styles.feedbackConfirmText}>
                Grazie {savedFeedback.nome}! Ti ricontatteremo presto.
              </span>
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
            placeholder={
              sessionCompleted
                ? "Onboarding completato ✓"
                : "Scrivi un messaggio…"
            }
            rows={1}
            disabled={sending || sessionCompleted}
            style={{
              ...styles.textarea,
              ...(sessionCompleted ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            }}
            aria-label="Messaggio"
            id="onboarding-chat-input"
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || sessionCompleted}
            style={{
              ...styles.sendBtn,
              opacity: sending || !input.trim() || sessionCompleted ? 0.4 : 1,
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

      {/* Keyframe animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes onb-bounce {
              0%, 60%, 100% { transform: translateY(0); }
              30% { transform: translateY(-4px); }
            }
            @keyframes onb-pulse {
              0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.45); }
              70%  { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
              100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            }
            .step-pulse {
              animation: onb-pulse 1.5s ease-in-out infinite;
            }
            #onboarding-chat-input::placeholder {
              color: var(--ink-soft);
            }
            #onboarding-chat-input:focus {
              outline: none;
              border-color: var(--accent);
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
            }
            .feedback-input::placeholder {
              color: var(--ink-soft);
            }
            .feedback-input:focus {
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
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
  resetBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 10px",
    borderRadius: "8px",
    border: "1px solid var(--line)",
    background: "var(--bg)",
    color: "var(--ink-soft)",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "inherit",
    transition: "border-color 0.15s, color 0.15s",
    whiteSpace: "nowrap" as const,
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 10px",
    borderRadius: "8px",
    border: "1px solid var(--accent)",
    background: "var(--bg)",
    color: "var(--accent)",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "inherit",
    fontWeight: 500,
    transition: "background 0.15s, color 0.15s",
    whiteSpace: "nowrap" as const,
  },
  btnLabel: {
    fontSize: "12px",
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
    whiteSpace: "nowrap" as const,
  },
  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#10B981",
  },

  /* Progress bar */
  progressBar: {
    padding: "14px 20px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--line)",
    flexShrink: 0,
    overflowX: "auto" as const,
  },
  progressInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "420px",
    margin: "0 auto",
  },
  stepItem: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    position: "relative" as const,
    flex: 1,
    minWidth: "60px",
  },
  stepLine: {
    position: "absolute" as const,
    top: "14px",
    right: "50%",
    width: "100%",
    height: "2px",
    background: "var(--line)",
    zIndex: 0,
    transition: "background 0.3s",
  },
  stepCircle: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid var(--line)",
    background: "var(--bg)",
    color: "var(--ink-soft)",
    fontSize: "12px",
    fontWeight: 600,
    position: "relative" as const,
    zIndex: 1,
    transition: "all 0.3s",
  },
  stepCircleActive: {
    borderColor: "var(--accent)",
    borderWidth: "3px",
    background: "var(--accent)",
    color: "#fff",
  },
  stepCircleCompleted: {
    borderColor: "#10B981",
    background: "#10B981",
    color: "#fff",
  },
  stepLabel: {
    fontSize: "11px",
    marginTop: "4px",
    color: "var(--ink-soft)",
    transition: "color 0.3s",
    whiteSpace: "nowrap" as const,
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

  /* Feedback card */
  feedbackCard: {
    alignSelf: "stretch",
    maxWidth: "100%",
    padding: "20px",
    borderRadius: "16px",
    background: "var(--bg-surface)",
    border: "1px solid var(--accent)",
    marginTop: "8px",
  },
  feedbackHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  feedbackTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  feedbackDesc: {
    margin: "0 0 16px",
    fontSize: "13px",
    color: "var(--ink-soft)",
    lineHeight: 1.5,
  },
  feedbackErrorBox: {
    padding: "8px 12px",
    borderRadius: "8px",
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#dc2626",
    fontSize: "13px",
    marginBottom: "12px",
    lineHeight: 1.4,
  },
  feedbackForm: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  feedbackInput: {
    border: "1px solid var(--line)",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    background: "var(--bg)",
    color: "var(--ink)",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  feedbackCheckLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    color: "var(--ink-soft)",
    cursor: "pointer",
    lineHeight: 1.4,
  },
  feedbackCheck: {
    marginTop: "2px",
    accentColor: "var(--accent)",
    width: "16px",
    height: "16px",
    flexShrink: 0,
    cursor: "pointer",
  },
  feedbackSubmitBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "opacity 0.15s",
    marginTop: "4px",
  },

  /* Feedback confirmation */
  feedbackConfirm: {
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "16px 20px",
    borderRadius: "16px",
    background: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    marginTop: "8px",
  },
  feedbackConfirmText: {
    fontSize: "14px",
    color: "var(--ink)",
    lineHeight: 1.5,
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
