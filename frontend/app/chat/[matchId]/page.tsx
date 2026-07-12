'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/authStore';
import { Send, ArrowLeft, ShieldAlert, Phone, Copy, Check, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { API_BASE, WS_BASE } from '../../../lib/api';

export default function ChatRoomPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuthStore();
  
  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [contactRevealed, setContactRevealed] = useState(false);
  const [otherUserPhone, setOtherUserPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch match details and messages
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    // 1. Fetch match info
    fetch(`${API_BASE}/matches/${matchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Offline');
      })
      .then(data => {
        setMatch(data);
        if (data.status === 'contact_revealed' || data.status === 'transferred') {
          setContactRevealed(true);
          const other = data.seeker_id === user?.id ? data.transferor : data.seeker;
          setOtherUserPhone(other.phone || '+91 9988776655');
        }
      })
      .catch(() => {
        // Mock fallback
        setMatch({
          id: matchId,
          listing: { id: "1", title: "Mumbai CSMT → Pune Jn", asking_price: "425.00" },
          seeker_id: "s-1",
          transferor_id: "dev-user-id",
          seeker: { name: "Priya Sharma", phone: "+919876543210" },
          transferor: { name: "Rahul Sharma", phone: "+919988776655" },
          status: "accepted"
        });
      });

    // 2. Fetch messages
    fetch(`${API_BASE}/matches/${matchId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Offline');
      })
      .then(data => {
        setMessages(data);
      })
      .catch(() => {
        // Seed initial mock message conversation
        setMessages([
          { id: "msg-1", sender_id: "s-1", content: "Hi Rahul, is the seat booking still transferable?", created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
          { id: "msg-2", sender_id: "dev-user-id", content: "Yes, it is! I have verified details. Willing to coordinate the transfer.", created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString() }
        ]);
      });

    // 3. Connect to WebSocket
    const wsUrl = `${WS_BASE}/ws/chat/${matchId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setMessages((prev) => [...prev, payload]);
    };

    return () => {
      ws.close();
    };
  }, [matchId, isAuthenticated]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const payload = {
      content: inputText.trim()
    };

    // If WS connected, send it
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      // Offline fallback: append directly and simulate reply
      const userMsg = {
        id: `msg-${Date.now()}`,
        sender_id: user?.id || 'dev-user-id',
        content: inputText,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsg]);
    }
    setInputText('');
  };

  const handleRevealContact = async () => {
    try {
      const response = await fetch(`${API_BASE}/matches/${matchId}/reveal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setContactRevealed(true);
        const data = await response.json();
        const other = data.seeker_id === user?.id ? data.transferor : data.seeker;
        setOtherUserPhone(other.phone || '+91 98765 43210');
      } else {
        // Simulate local contact reveal
        setContactRevealed(true);
        const otherPhone = match.seeker_id === user?.id ? match.transferor.phone : match.seeker.phone;
        setOtherUserPhone(otherPhone || '+91 98765 43210');
      }
    } catch (e) {
      setContactRevealed(true);
      const otherPhone = match.seeker_id === user?.id ? match.transferor.phone : match.seeker.phone;
      setOtherUserPhone(otherPhone || '+91 98765 43210');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(otherUserPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmTransfer = async () => {
    try {
      const response = await fetch(`${API_BASE}/matches/${matchId}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        router.push('/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (e) {
      router.push('/dashboard');
    }
  };

  if (!match) {
    return <div className="p-12 text-center text-slate-400">Loading chat...</div>;
  }

  const otherUser = match.seeker_id === user?.id ? match.transferor : match.seeker;
  const isSeller = match.transferor_id === user?.id;

  return (
    <div className="max-w-4xl mx-auto my-6 px-6 h-[80vh] flex flex-col justify-between glass-card relative overflow-hidden">
      {/* HEADER */}
      <header className="py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 text-slate-400 hover:text-slate-200 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-bold text-sm text-slate-200">{otherUser?.name || 'Partner'}</h2>
            <span className="text-[10px] text-blue-400 font-semibold tracking-wide">
              Regarding: {match.listing.title} · ₹{Math.round(parseFloat(match.listing.asking_price))}
            </span>
          </div>
        </div>

        {/* Complete transfer confirmation button */}
        {match.status !== 'transferred' && (
          <button 
            onClick={handleConfirmTransfer}
            className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 rounded-full text-[10px] font-bold uppercase transition"
          >
            Confirm Transfer Done
          </button>
        )}
      </header>

      {/* SAFETY WARNING BANNER */}
      <div className="bg-rose-500/10 border-b border-rose-500/20 p-3 flex items-center gap-2 text-[10px] text-rose-400">
        <ShieldAlert className="w-4 h-4" />
        <span>Never pay in advance. Inspect the ticket PDF / details before sending money. Connect directly.</span>
      </div>

      {/* MESSAGES VIEW */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Centered System Message */}
        <div className="text-center">
          <span className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[9px] text-slate-500 font-bold uppercase">
            Match Confirmed! Chat room active
          </span>
        </div>

        {messages.map((m) => {
          const isOwnMessage = m.sender_id === user?.id || m.sender_id === 'dev-user-id';
          return (
            <div 
              key={m.id} 
              className={`flex flex-col max-w-[70%] space-y-1 ${isOwnMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              <div className={`p-3.5 rounded-2xl text-xs ${
                isOwnMessage 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-900/60 border border-white/5 text-slate-300 rounded-tl-none'
              }`}>
                {m.content}
              </div>
              <div className="flex items-center gap-1 text-[8px] text-slate-500 font-medium">
                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isOwnMessage && <CheckCheck className="w-3 h-3 text-blue-500" />}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* REVEAL PHONE BANNER ACTION */}
      <div className="p-4 border-t border-white/5 bg-slate-950/40 space-y-3">
        {contactRevealed ? (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3 rounded-xl flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-400" />
              <span>Contact Number: <strong>{otherUserPhone}</strong></span>
            </div>
            <button 
              onClick={copyToClipboard}
              className="p-1.5 hover:bg-white/5 rounded-lg transition"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-3.5 rounded-xl text-xs font-bold">
            <span>Coordinate details over phone?</span>
            <button 
              onClick={handleRevealContact}
              className="px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-[10px] uppercase tracking-wider font-extrabold transition"
            >
              Reveal Contact Number
            </button>
          </div>
        )}

        {/* INPUT FORM */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Type your message here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full input-glass text-xs py-3"
            required
          />
          <button 
            type="submit" 
            className="btn-primary p-3 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
