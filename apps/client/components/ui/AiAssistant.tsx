/**
 * @file apps/client/components/ui/AiAssistant.tsx
 * Shared client component for layout renders and user interaction flows.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import {
  Sparkles, X, Send, Loader2, Bot, User,
  ClipboardList, AlertTriangle, UtensilsCrossed, PlaneTakeoff,
  ChevronRight, Zap, Shield,
} from 'lucide-react';

// ─── Minimal markdown renderer ────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, li) => {
    // Bold (**text**)
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((chunk, ci) => {
      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return <strong key={ci} style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{chunk.slice(2, -2)}</strong>;
      }
      return chunk;
    });
    // Bullet lines
    if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ')) {
      nodes.push(
        <div key={li} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ opacity: 0.5, flexShrink: 0, marginTop: '1px' }}>•</span>
          <span>{parts}</span>
        </div>
      );
    } else if (line.trim() === '') {
      nodes.push(<div key={li} style={{ height: '6px' }} />);
    } else {
      nodes.push(<div key={li}>{parts}</div>);
    }
  });
  return nodes;
}

// ─── Typing indicator dots ─────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: '6px', height: '6px', borderRadius: '50%', background: color,
            animation: `aiDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes aiDotPulse { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}

// ─── Quick chips config ────────────────────────────────────────────────────────
type Chip = { label: string; icon: React.ReactNode; prompt: string };

const STUDENT_CHIPS: Chip[] = [
  { label: 'My leaves', icon: <PlaneTakeoff size={12} />, prompt: 'Show me my recent leave requests and their status.' },
  { label: 'My complaints', icon: <AlertTriangle size={12} />, prompt: 'What are my open complaints?' },
  { label: "Today's mess", icon: <UtensilsCrossed size={12} />, prompt: "What is today's mess menu?" },
  { label: 'Attendance', icon: <ClipboardList size={12} />, prompt: 'Summarize my attendance for this month.' },
];

const WARDEN_CHIPS: Chip[] = [
  { label: 'Pending leaves', icon: <PlaneTakeoff size={12} />, prompt: 'Show me all pending leave requests that need approval.' },
  { label: 'Urgent issues', icon: <AlertTriangle size={12} />, prompt: 'List all urgent or unresolved complaints right now.' },
  { label: 'Absentee alert', icon: <Zap size={12} />, prompt: 'Who are the habitual absentees this week? Give me names and details.' },
  { label: 'Mess feedback', icon: <UtensilsCrossed size={12} />, prompt: 'Summarize the recent mess reviews and average ratings.' },
  { label: 'Pending visitors', icon: <Shield size={12} />, prompt: 'List all pending visitor approvals.' },
  { label: 'Daily briefing', icon: <ClipboardList size={12} />, prompt: 'Give me a complete daily briefing: attendance, leaves, complaints, and visitors.' },
];

// ─── Main component ────────────────────────────────────────────────────────────
export function AiAssistant() {
  const [role, setRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { apiPost } = useApi();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkRole = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {return;}

      // Role lives in the profiles table — not in the Supabase JWT metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      const userRole = profile?.role || 'student';
      setRole(userRole);

      if (userRole === 'warden') {
        setMessages([{
          role: 'assistant',
          content: "**Warden Intelligence Active.**\n\nI have real-time access to your hostel's attendance, leaves, complaints, visitors, and mess data. Ask me anything or use a quick action below.",
        }]);
      } else {
        setMessages([{
          role: 'assistant',
          content: "**Student Assistant Ready.**\n\nI can help you with your leaves, complaints, mess menu, attendance, and more. What do you need?",
        }]);
      }
    };
    checkRole();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) {return;}
    setInput('');
    const newMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await apiPost('/api/v1/ai/chat', { messages: newMessages });
      if (res.success && res.data) {
        setMessages([...newMessages, { role: 'assistant', content: res.data.message }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }]);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Network error — please check your connection.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, apiPost]);

  if (!role) {return null;}

  const isWarden = role === 'warden';
  const chips = isWarden ? WARDEN_CHIPS : STUDENT_CHIPS;

  // ── Theme tokens ──
  const accent = isWarden ? '#7c5cfc' : '#fb923c';
  const accentLight = isWarden ? '#a78bfa' : '#fdba74';
  const accentGlow = isWarden ? 'rgba(124,92,252,0.18)' : 'rgba(251,146,60,0.18)';
  const accentBorder = isWarden ? 'rgba(124,92,252,0.35)' : 'rgba(251,146,60,0.35)';
  const accentBg = isWarden ? 'rgba(124,92,252,0.12)' : 'rgba(251,146,60,0.12)';

  const persona = isWarden ? 'Warden AI' : 'Student AI';
  const subtitle = isWarden ? 'Hostel Intelligence' : 'Your Personal Assistant';



  const renderMessage = (content: string): React.ReactNode => {
    // Render markdown first, then wrap each text node with links
    const lines = renderMarkdown(content);
    return lines;
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        id="ai-assistant-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={`${persona} (⌘K / Ctrl+K)`}
        style={{
          height: '32px', padding: '0 8px', borderRadius: '16px',
          background: isOpen ? accentBg : 'transparent',
          border: '1px solid', borderColor: isOpen ? accentBorder : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          color: isOpen ? accentLight : 'rgba(255,255,255,0.4)',
          cursor: 'pointer', transition: 'all 0.2s',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = accentLight;
            e.currentTarget.style.background = accentBg;
            e.currentTarget.style.borderColor = accentBorder;
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <Sparkles size={15} />
        <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.75, padding: '1px 4px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', letterSpacing: '0.5px' }}>⌘K</span>
      </button>

      {isOpen && mounted && createPortal(
        <>
          {/* ── Backdrop ── */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 9998,
              animation: 'aiFadeIn 0.18s ease',
            }}
          />

          {/* ── Panel ── */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(480px, calc(100vw - 32px))',
            height: 'min(620px, calc(100vh - 48px))',
            background: 'rgba(10,10,18,0.97)',
            backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
            border: `1px solid ${accentBorder}`,
            borderRadius: '20px',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.6), 0 0 80px ${accentGlow}`,
            display: 'flex', flexDirection: 'column',
            zIndex: 9999, overflow: 'hidden',
            animation: 'aiSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}>

            <style>{`
              @keyframes aiFadeIn { from { opacity:0 } to { opacity:1 } }
              @keyframes aiSlideUp { from { opacity:0; transform:translate(-50%,-48%) scale(0.97) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
              .ai-chip:hover { border-color: ${accentBorder} !important; background: ${accentBg} !important; color: ${accentLight} !important; }
              .ai-chip:hover svg { color: ${accentLight} !important; }
              .ai-messages::-webkit-scrollbar { width: 4px; }
              .ai-messages::-webkit-scrollbar-track { background: transparent; }
              .ai-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
            `}</style>

            {/* ── Header ── */}
            <div style={{
              padding: '16px 18px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: `linear-gradient(135deg, ${accentGlow} 0%, transparent 60%)`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: accentBg, border: `1px solid ${accentBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: accentLight, flexShrink: 0,
                  boxShadow: `0 0 16px ${accentGlow}`,
                }}>
                  <Sparkles size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.2px' }}>
                    {persona}
                  </div>
                  <div style={{ fontSize: '10px', color: accentLight, letterSpacing: '0.5px', opacity: 0.8 }}>
                    {subtitle}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              >
                <X size={14} />
              </button>
            </div>

            {/* ── Messages ── */}
            <div className="ai-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {messages.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                      background: isUser ? 'rgba(255,255,255,0.07)' : accentBg,
                      border: `1px solid ${isUser ? 'rgba(255,255,255,0.1)' : accentBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isUser ? 'rgba(255,255,255,0.5)' : accentLight,
                    }}>
                      {isUser ? <User size={12} /> : <Bot size={12} />}
                    </div>
                    {/* Bubble */}
                    <div style={{
                      maxWidth: '82%',
                      padding: '10px 13px',
                      borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                      fontSize: '13px', lineHeight: 1.6,
                      background: isUser ? accent : 'rgba(255,255,255,0.04)',
                      border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      color: isUser ? '#fff' : 'rgba(255,255,255,0.85)',
                      boxShadow: isUser ? `0 4px 16px ${accentGlow}` : 'none',
                    }}>
                      {isUser ? m.content : renderMessage(m.content)}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                    background: accentBg, border: `1px solid ${accentBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentLight,
                  }}>
                    <Bot size={12} />
                  </div>
                  <div style={{
                    padding: '10px 14px', borderRadius: '4px 14px 14px 14px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <TypingDots color={accentLight} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick chips ── */}
            {messages.length <= 1 && (
              <div style={{
                padding: '0 14px 10px',
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                flexShrink: 0,
              }}>
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    className="ai-chip"
                    onClick={() => sendMessage(chip.prompt)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex' }}>{chip.icon}</span>
                    {chip.label}
                    <ChevronRight size={10} style={{ opacity: 0.4 }} />
                  </button>
                ))}
              </div>
            )}

            {/* ── Input ── */}
            <div style={{
              padding: '12px 14px 14px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.015)',
            }}>
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isWarden ? 'Ask about attendance, leaves, complaints…' : 'Ask about your mess, leaves, complaints…'}
                  disabled={loading}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '10px 14px',
                    fontSize: '13px', color: '#fff', outline: 'none',
                    transition: 'border-color 0.15s',
                    opacity: loading ? 0.5 : 1,
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = accentBorder}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  style={{
                    width: '36px', height: '36px', borderRadius: '12px', flexShrink: 0,
                    background: input.trim() && !loading ? accent : 'rgba(255,255,255,0.06)',
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.25)',
                    cursor: input.trim() && !loading ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    boxShadow: input.trim() && !loading ? `0 4px 14px ${accentGlow}` : 'none',
                  }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} style={{ marginLeft: '1px' }} />}
                </button>
              </form>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
