import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePepperStore } from '../hooks/usePepperState';
import { getBridgeUrl } from '../lib/bridge';

function ChatPopup() {
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_open') ?? 'true'); }
    catch { return true; }
  });
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_pos')) || { x: null, y: null }; }
    catch { return { x: null, y: null }; }
  });
  const [input, setInput] = useState('');
  const messages = usePepperStore((s) => s.chatMessages);
  const chatLoading = usePepperStore((s) => s.chatLoading);
  const addChatMessage = usePepperStore((s) => s.addChatMessage);
  const setChatLoading = usePepperStore((s) => s.setChatLoading);

  const messagesEndRef = useRef(null);
  const dragRef = useRef(null);
  const dragStartRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('chat_open', JSON.stringify(open));
  }, [open]);

  useEffect(() => {
    if (position.x !== null) {
      localStorage.setItem('chat_pos', JSON.stringify(position));
    }
  }, [position]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDragStart = useCallback((e) => {
    const rect = dragRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    const handleMove = (ev) => {
      if (!dragStartRef.current) return;
      setPosition({
        x: ev.clientX - dragStartRef.current.offsetX,
        y: ev.clientY - dragStartRef.current.offsetY,
      });
    };
    const handleUp = () => {
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open chat"
        className="fixed bottom-5 right-[400px] w-10 h-10 rounded-full bg-surface-1 border border-border
                   text-text text-lg flex items-center justify-center cursor-pointer z-[150] hover:border-border-strong"
      >C</button>
    );
  }

  if (minimized) {
    const minStyle = position.x !== null
      ? { top: position.y, left: position.x }
      : { bottom: '20px', right: '400px' };
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{ position: 'fixed', ...minStyle }}
        className="px-4 py-1.5 rounded-full bg-surface-1 border border-border text-text text-xs cursor-pointer z-[150]"
      >
        Chat {messages.length > 0 ? `(${messages.length})` : ''}
      </button>
    );
  }

  const posStyle = position.x !== null
    ? { top: position.y, left: position.x }
    : { bottom: '20px', right: '400px' };

  return (
    <div
      ref={dragRef}
      style={{ position: 'fixed', ...posStyle }}
      className="w-[320px] h-[420px] bg-surface-1 border border-border rounded-lg flex flex-col overflow-hidden z-[150] shadow-2xl"
    >
      <div
        onMouseDown={handleDragStart}
        className="px-3.5 py-2.5 border-b border-border flex items-center justify-between cursor-grab select-none"
      >
        <span className="text-[13px] font-semibold text-text">Chat</span>
        <div className="flex gap-2">
          <span onClick={() => setMinimized(true)} className="cursor-pointer text-dim hover:text-text text-sm">—</span>
          <span onClick={() => setOpen(false)} className="cursor-pointer text-dim hover:text-text text-sm">✕</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="text-dim text-xs text-center mt-10">Say something to Pepper...</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={'max-w-[85%] ' + (msg.role === 'user' ? 'self-end' : 'self-start')}>
            <div className={'px-3 py-2 text-[13px] leading-relaxed '
              + (msg.role === 'user'
                ? 'rounded-[10px_10px_4px_10px] bg-surface-2 text-text'
                : 'rounded-[10px_10px_10px_4px] bg-ok/10 text-ok')}>
              {msg.text}
            </div>
            {msg.routedTo && (
              <div className="text-[9px] text-dim mt-0.5 pl-1">via {msg.routedTo}</div>
            )}
          </div>
        ))}
        {chatLoading && (
          <div className="self-start px-3 py-2 rounded-[10px_10px_10px_4px] bg-ok/10 text-ok text-[13px]">...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2.5 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded-md bg-bg border border-border px-3 py-2 text-[13px] text-text
                     placeholder:text-dim focus:outline-none focus:border-accent/60 focus:ring-[3px] focus:ring-accent-soft"
        />
        <button
          onClick={sendMessage}
          disabled={chatLoading || !input.trim()}
          className="px-3.5 py-2 rounded-md bg-accent text-on-accent text-[13px] font-semibold
                     hover:bg-accent-hover disabled:bg-surface-2 disabled:text-dim disabled:cursor-default"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPopup;
