'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AiAssistant() {
  const [role, setRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { apiPost } = useApi();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkRole = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userRole = session?.user?.user_metadata?.role || 'student';
      setRole(userRole);
      
      if (userRole === 'warden') {
        setMessages([
          { role: 'assistant', content: 'Hello! I am your AI assistant. How can I help you manage the hostel today?' }
        ]);
      } else {
        setMessages([
          { role: 'assistant', content: 'Hello! I am your AI assistant. Do you have any questions about your hostel, leaves, or complaints?' }
        ]);
      }
    };
    checkRole();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!role) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await apiPost('/api/v1/ai/chat', { messages: newMessages });
      if (res.success && res.data) {
        setMessages([...newMessages, { role: 'assistant', content: res.data.message }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' }]);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Network error. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const isWarden = role === 'warden';
  const theme = {
    primary: isWarden ? '#7c5cfc' : '#fb923c',
    primaryLight: isWarden ? '#a78bfa' : '#fdba74',
    primaryBg: isWarden ? 'rgba(124,92,252,0.2)' : 'rgba(251,146,60,0.2)',
    primaryBgHover: isWarden ? 'rgba(124,92,252,0.1)' : 'rgba(251,146,60,0.1)',
    primaryBorder: isWarden ? 'rgba(124,92,252,0.4)' : 'rgba(251,146,60,0.4)',
    primaryBorderFocus: isWarden ? 'rgba(124,92,252,0.5)' : 'rgba(251,146,60,0.5)',
    headerBg: isWarden ? 'rgba(124,92,252,0.05)' : 'rgba(251,146,60,0.05)',
    basePath: isWarden ? '/warden' : '/student',
  };

  const parseMessage = (content: string, isAssistant: boolean) => {
    if (!isAssistant) return [content];

    // Simple parser to make keywords clickable
    const keywords = [
      { word: 'leave', href: `${theme.basePath}/leaves` },
      { word: 'leaves', href: `${theme.basePath}/leaves` },
      { word: 'complaint', href: `${theme.basePath}/complaints` },
      { word: 'complaints', href: `${theme.basePath}/complaints` },
      { word: 'visitor', href: `${theme.basePath}/visitors` },
      { word: 'visitors', href: `${theme.basePath}/visitors` },
      { word: 'mess', href: `${theme.basePath}/mess` },
      { word: 'attendance', href: `${theme.basePath}/attendance` },
    ];

    let elements: (string | React.JSX.Element)[] = [content];

    keywords.forEach(({ word, href }) => {
      elements = elements.flatMap((el) => {
        if (typeof el !== 'string') return [el];
        
        const regex = new RegExp(`\\b(${word})\\b`, 'gi');
        const parts = el.split(regex);
        
        return parts.map((part, i) => {
          if (part.toLowerCase() === word) {
            return (
              <span
                key={`${word}-${i}`}
                onClick={() => router.push(href)}
                style={{ color: theme.primaryLight, textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
              >
                {part}
              </span>
            );
          }
          return part;
        });
      });
    });

    return elements;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '32px', height: '32px', borderRadius: '50%', background: isOpen ? theme.primaryBg : 'transparent',
          border: '1px solid', borderColor: isOpen ? theme.primaryBorder : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen ? theme.primaryLight : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = theme.primaryLight;
            e.currentTarget.style.background = theme.primaryBgHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <Sparkles size={16} />
      </button>

      {isOpen && mounted && createPortal(
        <>
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999 }} 
          onClick={() => setIsOpen(false)} 
        />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '520px',
          background: 'rgba(15,15,22,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${theme.primaryBg}`, borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', zIndex: 10000, overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.headerBg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: theme.primaryBg, color: theme.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={12} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{isWarden ? 'Warden AI' : 'Student AI'}</span>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.5,
                  background: m.role === 'user' ? theme.primary : 'rgba(255,255,255,0.05)',
                  color: m.role === 'user' ? '#fff' : 'rgba(255,255,255,0.85)',
                  borderBottomRightRadius: m.role === 'user' ? '4px' : '12px',
                  borderBottomLeftRadius: m.role === 'assistant' ? '4px' : '12px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {parseMessage(m.content, m.role === 'assistant')}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.primaryLight, fontSize: '12px', padding: '0 4px' }}>
                <Loader2 size={12} className="animate-spin" /> Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '8px' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about leaves, complaints..."
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px', padding: '8px 14px', fontSize: '13px', color: '#fff', outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = theme.primaryBorderFocus}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%', background: input.trim() && !loading ? theme.primary : 'rgba(255,255,255,0.05)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: input.trim() && !loading ? 'pointer' : 'default', transition: 'all 0.2s'
                }}
              >
                <Send size={14} style={{ marginLeft: '2px' }} />
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
