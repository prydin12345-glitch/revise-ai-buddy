import { useState, useRef, useEffect, useCallback } from 'react';
import { GraduationCap, X, Send, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
  'What have I been getting wrong lately?',
  'Review my most recent exam',
  'What topics should I focus on this week?',
  'Explain a topic I am struggling with',
];

export const AiTutorChat = ({ open, onOpenChange, onUnreadChange }: AiTutorChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [messagesSentToday, setMessagesSentToday] = useState(0);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
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
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

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
          body: JSON.stringify({
            message: msg,
            conversationHistory: history,
            selectedExamId: selectedExamId ?? undefined,
            selectedSetId: selectedSetId ?? undefined,
          }),
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
  }, [input, loading, messages, open, session, selectedExamId, selectedSetId]);

  if (!session) return null;

  return (
    <>
      {open && (
        <div
          className="fixed bg-background border border-border shadow-2xl flex flex-col z-[9998] rounded-2xl overflow-hidden
            inset-x-3 bottom-24 top-20
            sm:inset-x-auto sm:right-6 sm:bottom-24 sm:top-auto sm:w-[400px] sm:h-[600px]"
          style={{ animation: 'aiChatPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                  <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.2} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">AI Tutor</div>
                <div className="text-[11px] text-muted-foreground">Online</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                title="New chat"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  title="Clear chat"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close chat"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] text-foreground leading-relaxed max-w-[85%]">
                    Hi! I have access to your exam history and practice results. What would you like help with?
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left px-3.5 py-2.5 rounded-xl border border-border text-[12.5px] text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition-all duration-150"
                      style={{ animation: `aiSuggestionFade 0.3s ease ${i * 0.08}s both` }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'aiMessageSlide 0.25s ease-out' }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed break-words ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                      : 'bg-muted text-foreground rounded-2xl rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      {msg.streaming && !msg.content ? (
                        <span className="inline-flex gap-1 items-center py-1">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 inline-block"
                              style={{ animation: `aiTypingBounce 1.2s infinite ${i * 0.15}s` }}
                            />
                          ))}
                        </span>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-code:bg-background/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/60 prose-pre:text-foreground prose-a:text-primary text-foreground">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                      {msg.streaming && msg.content && (
                        <span
                          className="inline-block w-[2px] h-[14px] bg-current ml-0.5 align-middle"
                          style={{ animation: 'aiCursorBlink 1s infinite' }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {rateLimitHit && (
              <div className="text-center py-2">
                <span className="inline-block text-[11px] text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                  Daily message limit reached. Resets at midnight.
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 bg-background/95">
            {!rateLimitHit && messagesSentToday > 40 && (
              <div className="text-[10px] text-muted-foreground text-right mb-1.5">
                {Math.max(0, 50 - messagesSentToday)} messages remaining today
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={rateLimitHit ? 'Daily limit reached' : 'Ask anything… (Enter to send)'}
                  disabled={loading || rateLimitHit}
                  rows={1}
                  className="w-full resize-none bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:bg-muted/60 transition-colors duration-150 leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || rateLimitHit}
                aria-label="Send message"
                className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0 hover:bg-primary/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes aiChatPopUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes aiCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes aiTypingBounce {
          0%, 80%, 100% { transform: translateY(0);    }
          40%            { transform: translateY(-4px); }
        }
        @keyframes aiMessageSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes aiSuggestionFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </>
  );
};
