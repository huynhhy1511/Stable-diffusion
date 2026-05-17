import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Image as ImageIcon, Sparkles, AlertCircle, Loader, Download, ArrowRight, ShieldAlert } from 'lucide-react';

const ChatView = ({ token, onSendToCanvas }) => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showNegative, setShowNegative] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const chatEndRef = useRef(null);
  const wsRef = useRef(null);

  const apiConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchSessions(true);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    fetchMessages();
  }, [activeSessionId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchSessions = async (autoSelectFirst = false) => {
    try {
      setLoadingSessions(true);
      const res = await axios.get('http://localhost:8000/api/chat/sessions', apiConfig);
      setSessions(res.data);
      if (res.data.length > 0 && autoSelectFirst && !activeSessionId) {
        setActiveSessionId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/chat/sessions/${activeSessionId}/messages`, apiConfig);
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSession = () => {
    const title = prompt("Nhập chủ đề hội thoại:", "Vẽ tranh phong cảnh");
    if (!title) return;

    axios.post('http://localhost:8000/api/chat/sessions', { title }, apiConfig)
      .then(res => {
        setSessions([res.data, ...sessions]);
        setActiveSessionId(res.data.id);
        setMessages([]);
      });
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isGenerating || !activeSessionId) return;

    // Apply Magic Prompt modifier if active
    let promptToSend = inputPrompt;
    if (magicPrompt) {
      promptToSend = `${inputPrompt}, highly detailed, volumetric lighting, unreal engine 5 render, cinematic concept art, 8k resolution`;
    }

    setInputPrompt('');
    setIsGenerating(true);
    setProgress(0);

    setMessages(prev => [...prev, { role: 'user', content: inputPrompt, created_at: new Date().toISOString() }]);
    scrollToBottom();

    try {
      const res = await axios.post(
        `http://localhost:8000/api/chat/sessions/${activeSessionId}/send`, 
        { prompt: promptToSend }, 
        apiConfig
      );
      setCurrentJobId(res.data.job_id);
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!currentJobId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/progress/${currentJobId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        setProgress(Math.round((data.step / data.total_steps) * 100));
      } else if (data.type === 'done') {
        setProgress(100);
        setIsGenerating(false);
        setCurrentJobId(null);
        fetchMessages();
      } else if (data.type === 'error') {
        alert(`Lỗi AI: ${data.message}`);
        setIsGenerating(false);
        setCurrentJobId(null);
      }
    };

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [currentJobId]);

  return (
    <div className="flex flex-1 h-full gap-5 font-sans select-none">
      
      {/* Sessions Sidebar Column (Replicated layout) */}
      <div className="w-56 bg-white rounded-2xl border border-gray-100 flex flex-col p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex-shrink-0">
        <button
          onClick={handleCreateSession}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3 text-xs font-semibold shadow-sm transition-all mb-4"
        >
          New Chat Session
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
          {loadingSessions ? (
            <div className="flex justify-center p-4">
              <Loader className="animate-spin text-slate-400" size={16} />
            </div>
          ) : sessions.length === 0 ? (
            <span className="text-[11px] text-gray-400 text-center mt-6">No sessions yet</span>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                onClick={() => !isGenerating && setActiveSessionId(s.id)}
                className={`px-3 py-2.5 rounded-xl cursor-pointer text-xs font-semibold transition-all truncate border ${
                  activeSessionId === s.id
                    ? 'bg-slate-50 border-slate-100 text-slate-900'
                    : 'border-transparent text-gray-400 hover:bg-slate-50/50 hover:text-slate-800'
                }`}
              >
                {s.title}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Flow */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col relative overflow-hidden">
        
        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {!activeSessionId ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <ImageIcon size={32} className="text-gray-300" />
              <span className="text-xs font-semibold text-gray-400">Please choose or create a chat session to draw!</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <Sparkles size={32} className="text-gray-300" />
              <span className="text-xs font-semibold text-gray-400">Describe what you want AI to draw in the box below...</span>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={m.id || idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-100/50 text-slate-800'
                  }`}
                >
                  {m.content}

                  {m.image_url && (
                    <div className="mt-3 relative rounded-lg overflow-hidden border border-gray-100 bg-white">
                      <img src={m.image_url} alt="AI output" className="w-full h-auto object-cover max-h-80" />
                      <div className="flex gap-2 p-2 bg-slate-50 border-t border-slate-100">
                        <a
                          href={m.image_url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download size={12} /> Save
                        </a>
                        <button
                          onClick={() => onSendToCanvas(m.image_url)}
                          className="flex-1 py-1.5 px-3 bg-slate-900 text-white rounded-lg text-[11px] font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all"
                        >
                          Send to Canvas Studio
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-gray-400 mt-1 px-1">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}

          {/* Real-time WebSocket Progress block */}
          {isGenerating && (
            <div className="flex flex-col items-start">
              <div className="bg-slate-50 border border-slate-100/60 rounded-2xl p-4 flex flex-col gap-2 max-w-[70%]">
                <div className="flex items-center gap-2">
                  <Loader className="animate-spin text-slate-900" size={13} />
                  <span className="text-xs font-semibold text-slate-800">Drawing... {progress}%</span>
                </div>
                <div className="w-56 h-1 bg-slate-200/60 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${progress}%` }}
                    className="h-full bg-slate-900 transition-all duration-300"
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Replicated Floating rounded input bar */}
        <div className="p-4 border-t border-gray-100/60 bg-white">
          <div className="border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] bg-white flex flex-col overflow-hidden max-w-4xl mx-auto">
            
            {/* Top Text entry row */}
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={activeSessionId ? "Summarize the latest prompt ideas..." : "Select a session to start..."}
              className="w-full px-4 py-3.5 text-xs text-slate-800 bg-transparent outline-none placeholder-slate-400 font-medium"
              disabled={!activeSessionId || isGenerating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />

            {/* Negative Prompt expanded row */}
            {showNegative && (
              <div className="px-4 pb-2 border-t border-slate-50 pt-2 flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-400" />
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Negative prompt (e.g. blurry, low quality, bad anatomy)..."
                  className="w-full text-[11px] text-slate-700 outline-none bg-transparent"
                />
              </div>
            )}

            {/* Thin dividing border */}
            <div className="h-[1px] bg-slate-100 w-full"></div>

            {/* Bottom Row Toolbars */}
            <div className="px-3 py-2 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {/* Attach icon for Image-to-image */}
                <button 
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition text-[10px] font-bold"
                  onClick={() => alert("Image-to-Image (I2I) is ready! Please load on Canvas for full editing control.")}
                >
                  <ImageIcon size={12} className="text-slate-400" /> Attach
                </button>

                {/* Negative prompt toggle */}
                <button
                  onClick={() => setShowNegative(!showNegative)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition ${
                    showNegative
                      ? 'bg-red-50 border-red-100 text-red-600'
                      : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Negative Prompt
                </button>

                {/* Magic prompt toggler */}
                <button
                  onClick={() => setMagicPrompt(!magicPrompt)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition ${
                    magicPrompt
                      ? 'bg-violet-50 border-violet-100 text-violet-600'
                      : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles size={11} className={magicPrompt ? 'text-violet-500' : 'text-slate-400'} /> Magic Prompt
                </button>
              </div>

              {/* Right side: chars limit and send flight icon */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-300">
                  {inputPrompt.length}/3,000
                </span>
                <button
                  onClick={handleSendMessage}
                  disabled={!activeSessionId || isGenerating || !inputPrompt.trim()}
                  className="h-7 w-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white flex items-center justify-center transition"
                >
                  <Send size={11} />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default ChatView;
