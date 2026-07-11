import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { usePepperStore } from '../hooks/usePepperState';
import { getBridgeUrl } from '../lib/bridge';

// Docked chat console under the 3D viewport (was a floating draggable window —
// it covered the scene and looked bolted-on). Collapses to a slim header bar.
function ChatPopup() {
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_open') ?? 'true'); }
    catch { return true; }
  });
  const [input, setInput] = useState('');
  const messages = usePepperStore((s) => s.chatMessages);
  const chatLoading = usePepperStore((s) => s.chatLoading);
  const addChatMessage = usePepperStore((s) => s.addChatMessage);
  const setChatLoading = usePepperStore((s) => s.setChatLoading);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('chat_open', JSON.stringify(open));
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    addChatMessage({ role: 'user', text, ts: Date.now() });
    setChatLoading(true);
    try {
      const res = await fetch(`${getBridgeUrl()}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      addChatMessage({
        role: 'pepper',
        text: data.data?.response ?? data.error ?? 'No response',
        routedTo: data.data?.routed_to,
        ts: Date.now(),
      });
    } catch (err) {
      addChatMessage({ role: 'pepper', text: `Connection error: ${err.message}`, ts: Date.now() });
    } finally {
      setChatLoading(false);
    }
  }, [input, chatLoading, addChatMessage, setChatLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="hmi-bezel rounded-xl p-1.5 shrink-0">
      <div className="rounded-lg overflow-hidden flex flex-col">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="hmi-plate w-full px-4 h-10 flex items-center justify-between cursor-pointer select-none"
        >
          <span className="hmi-engrave text-[12px] font-bold uppercase tracking-[2px]">
            Chat{messages.length > 0 ? ` · ${messages.length}` : ''}
          </span>
          <span className="hmi-engrave flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-70">
            {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        </button>

        {open && (
          <>
            <div className="hmi-glass h-[190px] overflow-y-auto p-3.5 flex flex-col gap-2.5">
              {messages.length === 0 && (
                <div className="text-dim text-xs text-center mt-8">Say something to Pepper...</div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={'max-w-[70%] ' + (msg.role === 'user' ? 'self-end' : 'self-start')}>
                  <div className={'px-3.5 py-2 text-[13px] leading-relaxed '
                    + (msg.role === 'user'
                      ? 'rounded-[10px_10px_4px_10px] bg-surface-2 text-text'
                      : 'rounded-[10px_10px_10px_4px] bg-accent-soft text-accent')}>
                    {msg.text}
                  </div>
                  {msg.routedTo && (
                    <div className="text-[9px] text-dim mt-0.5 pl-1">via {msg.routedTo}</div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="self-start px-3.5 py-2 rounded-[10px_10px_10px_4px] bg-accent-soft text-accent text-[13px]">...</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="hmi-plate p-2.5 flex gap-2.5 border-t border-white/10">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="hmi-field flex-1 px-3.5 py-2 text-[13px]"
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !input.trim()}
                className="hmi-key hmi-key-go px-4 py-2 text-[13px] font-semibold"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ChatPopup;
