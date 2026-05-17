import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Plus, MessageSquare, Loader, Download, Edit3 } from 'lucide-react';

const ChatInterface = ({ token, onSendToCanvas }) => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);

  const apiConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 1. Tải danh sách phiên trò chuyện
  const fetchSessions = async (autoSelectFirst = false) => {
    try {
      setLoadingSessions(true);
      const res = await axios.get('http://localhost:8000/api/chat/sessions', apiConfig);
      setSessions(res.data);
      if (res.data.length > 0 && autoSelectFirst && !activeSessionId) {
        setActiveSessionId(res.data[0].id);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách session:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions(true);
  }, []);

  // 2. Tải tin nhắn trong phiên hiện tại
  useEffect(() => {
    if (!activeSessionId) return;
    
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/chat/sessions/${activeSessionId}/messages`, apiConfig);
        setMessages(res.data);
        scrollToBottom();
      } catch (err) {
        console.error("Lỗi tải tin nhắn:", err);
      }
    };

    fetchMessages();
  }, [activeSessionId]);

  // Tự động cuộn xuống đáy ô chat khi có tin nhắn mới
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 3. Tạo một cuộc hội thoại mới
  const handleCreateSession = async () => {
    const title = prompt("Nhập tiêu đề cuộc hội thoại mới:", "Phiên Sáng Tạo Mới");
    if (!title) return;
    
    try {
      const res = await axios.post('http://localhost:8000/api/chat/sessions', { title }, apiConfig);
      setSessions([res.data, ...sessions]);
      setActiveSessionId(res.data.id);
      setMessages([]);
    } catch (err) {
      console.error(err);
      alert("Không thể khởi tạo cuộc hội thoại!");
    }
  };

  // 4. Gửi Prompt sinh ảnh T2I
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isGenerating || !activeSessionId) return;

    const userPrompt = inputPrompt;
    setInputPrompt('');
    setIsGenerating(true);
    setProgress(0);

    // Thêm tạm tin nhắn User vào màn hình để hiển thị ngay lập tức
    setMessages(prev => [...prev, { role: 'user', content: userPrompt, created_at: new Date().toISOString() }]);
    scrollToBottom();

    try {
      const res = await axios.post(
        `http://localhost:8000/api/chat/sessions/${activeSessionId}/send`, 
        { prompt: userPrompt }, 
        apiConfig
      );
      
      const { job_id } = res.data;
      setCurrentJobId(job_id);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      setIsGenerating(false);
      alert("Đã xảy ra lỗi khi gửi yêu cầu sinh ảnh!");
    }
  };

  // 5. Kết nối WebSocket đón nhận progress tiến trình vẽ ảnh từ ComfyUI
  useEffect(() => {
    if (!currentJobId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/progress/${currentJobId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'progress') {
        const percent = Math.round((data.step / data.total_steps) * 100);
        setProgress(percent);
      } else if (data.type === 'done') {
        setProgress(100);
        setIsGenerating(false);
        setCurrentJobId(null);
        
        // Load lại tin nhắn từ DB để lấy câu trả lời chính thức kèm URL ảnh đã lưu
        axios.get(`http://localhost:8000/api/chat/sessions/${activeSessionId}/messages`, apiConfig)
          .then(res => {
            setMessages(res.data);
            scrollToBottom();
          });
      } else if (data.type === 'error') {
        alert(`Lỗi từ AI Engine: ${data.message}`);
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
    <div style={{ display: 'flex', height: '100%', gap: '1.5rem' }}>
      
      {/* SIDEBAR: Danh sách các phiên trò chuyện */}
      <div className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column', padding: '1rem', flexShrink: 0 }}>
        <button 
          onClick={handleCreateSession}
          className="premium-btn-primary" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginBottom: '1rem', padding: '10px' }}
        >
          <Plus size={18} /> Chat Sáng Tạo Mới
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingSessions ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
            </div>
          ) : sessions.length === 0 ? (
            <p style={{ textSelf: 'center', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '2rem' }}>Chưa có cuộc trò chuyện nào</p>
          ) : (
            sessions.map(sess => (
              <div 
                key={sess.id}
                onClick={() => !isGenerating && setActiveSessionId(sess.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  background: activeSessionId === sess.id ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activeSessionId === sess.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.04)'}`,
                  transition: 'all 0.2s',
                  color: activeSessionId === sess.id ? '#fff' : '#ccc'
                }}
              >
                <MessageSquare size={16} style={{ color: activeSessionId === sess.id ? 'var(--primary)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sess.title}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CHAT BOX: Khu vực hiển thị tin nhắn giống Messenger */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', position: 'relative' }}>
        
        {/* Khung tin nhắn cuộn */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1rem' }}>
          {!activeSessionId ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
              <MessageSquare size={48} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '15px' }}>Hãy chọn hoặc tạo một cuộc hội thoại ở Sidebar để bắt đầu vẽ!</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '15px' }}>Nhập một ý tưởng vào khung chat bên dưới để AI vẽ ảnh...</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={msg.id || index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                {/* Bong bóng tin nhắn */}
                <div 
                  style={{
                    maxWidth: '70%',
                    padding: '12px 18px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: '#fff',
                    boxShadow: msg.role === 'user' ? '0 4px 14px rgba(139, 92, 246, 0.3)' : 'none',
                    borderRadiusTopright: msg.role === 'user' ? '4px' : '16px',
                    borderRadiusTopleft: msg.role === 'user' ? '16px' : '4px'
                  }}
                >
                  {msg.content}

                  {/* Hiển thị ảnh nếu có */}
                  {msg.image_url && (
                    <div style={{ marginTop: '12px', position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                      <img 
                        src={msg.image_url} 
                        alt="AI Result" 
                        style={{ width: '100%', display: 'block', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }} 
                      />
                      {/* Bảng công cụ thao tác nhanh dưới bức ảnh */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <a 
                          href={msg.image_url} 
                          download 
                          target="_blank" 
                          rel="noreferrer"
                          className="premium-btn-secondary" 
                          style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
                        >
                          <Download size={14} /> Tải Ảnh Về
                        </a>
                        <button 
                          onClick={() => onSendToCanvas(msg.image_url)}
                          className="premium-btn-primary" 
                          style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
                        >
                          <Edit3 size={14} /> Chuyển Sang Canvas
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', padding: '0 4px' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}

          {/* Bong bóng chờ AI đang vẽ và thanh tiến độ chạy thực tế */}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div 
                style={{
                  padding: '14px 20px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span style={{ fontSize: '13px', color: '#ccc', marginLeft: '6px' }}>AI đang vẽ ảnh... {progress}%</span>
                </div>
                
                {/* Thanh chạy % thực tế */}
                <div style={{ width: '220px', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, #a78bfa 100%)', transition: 'width 0.3s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Khung input nhập prompt phía dưới */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text"
            className="premium-input"
            style={{ flex: 1, padding: '14px 18px' }}
            placeholder={activeSessionId ? "Nhập mô tả ý tưởng ảnh muốn vẽ (ví dụ: A neon forest, realistic)..." : "Vui lòng chọn cuộc hội thoại ở sidebar..."}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={!activeSessionId || isGenerating}
          />
          <button 
            type="submit" 
            className="premium-btn-primary" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', padding: 0 }}
            disabled={!activeSessionId || isGenerating || !inputPrompt.trim()}
          >
            <Send size={18} />
          </button>
        </form>

      </div>

    </div>
  );
};

export default ChatInterface;
