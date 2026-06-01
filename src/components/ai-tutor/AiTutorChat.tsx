import { useState, useRef, useEffect, useCallback } from 'react';
import { GraduationCap, X, Send, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface AiTutorChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadChange?: (count: number) => void;
}

const SUGGESTIONS = [
  'Explain my last wrong answer',
  'What should I revise this week?',
  'Generate practice questions on my weakest topic',
  'How am I performing overall?',
];

export const AiTutorChat = ({ open, onOpenChange, onUnreadChange }: AiTutorChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [messagesSentToday, setMessagesSentToday] = useState(0);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const session = useSession();
  const historyLoadedRef = useRef(false);

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setRateLimitHit(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!open || !session?.user?.id || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    (async () => {
      const { data } = await supabase
        .from('ai_tutor_messages')
        .select('role, content, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setMessages(
          data.reverse().map((m, i) => ({
            id: `history-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        );
      }
    })();
  }, [open, session?.user?.id]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || !session) return;

    setInput('');
    setLoading(true);

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: msg };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: Message = { id: assistantId, role: 'assistant', content: '', streaming: true };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setMessagesSentToday(n => n + 1);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('No session');

      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({ message: msg, conversationHistory: history }),
        }
      );

      if (response.status === 429) {
        const data = await response.json().catch(() => ({ message: 'Rate limit reached.' }));
        setRateLimitHit(true);
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, content: data.message || 'Daily message limit reached.', streaming: false }
          : m));
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error('AI service error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              fullContent += parsed.token;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
            }
          } catch {
            // skip
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
      if (!open) setUnread(u => u + 1);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false }
        : m));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, open, session]);

  if (!session) return null;

  return (
    <>
      {open && (
        <div
          className="fixed bg-background border border-border shadow-2xl flex flex-col z-[9998] rounded-2xl
            inset-x-3 bottom-24 top-20
            sm:inset-x-auto sm:right-6 sm:bottom-24 sm:top-auto sm:w-[380px] sm:h-[560px]"
          style={{ animation: 'aiChatPopUp 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground leading-tight">AI Tutor</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleNewChat}
                title="New chat"
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  title="Clear chat"
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div>
                <div className="text-sm font-medium text-foreground mb-1">How can I help you today?</div>
                <div className="text-xs text-muted-foreground mb-3">
                  I have access to your recent scores and topics. Ask me anything.
                </div>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                  {msg.streaming && msg.content && (
                    <span
                      className="inline-block w-[2px] h-[14px] bg-current ml-0.5 align-middle"
                      style={{ animation: 'aiCursorBlink 1s infinite' }}
                    />
                  )}
                  {msg.streaming && !msg.content && (
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 inline-block"
                          style={{ animation: `aiTypingBounce 1.2s infinite ${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={rateLimitHit ? 'Daily limit reached' : 'Ask anything...'}
                disabled={loading || rateLimitHit}
                className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || rateLimitHit}
                className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {!rateLimitHit && (
              <div className="text-[10px] text-muted-foreground text-right mt-1 opacity-60">
                {Math.max(0, 50 - messagesSentToday)} messages remaining today
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 w-13 h-13 rounded-full flex items-center justify-center z-[9999] shadow-lg transition-transform hover:scale-105"
        style={{
          width: 52,
          height: 52,
          background: open ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
          boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)',
        }}
        title="AI Tutor"
        aria-label="AI Tutor"
      >
        {open
          ? <X className="w-5 h-5 text-foreground" />
          : <GraduationCap className="w-5 h-5 text-primary-foreground" />}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <style>{`
        @keyframes aiChatPopUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aiCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes aiTypingBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
};
