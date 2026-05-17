import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ImageEditor from './ImageEditor';
import { Upload, ArrowRight, Loader, History, Wand2, RefreshCw } from 'lucide-react';

const CanvasInterface = ({ token, initialImageUrl }) => {
  const [file, setFile] = useState(null);
  const [localImageUrl, setLocalImageUrl] = useState(initialImageUrl || null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [maskUrl, setMaskUrl] = useState(null);
  const [inpaintPrompt, setInpaintPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);

  const fileInputRef = useRef(null);
  const wsRef = useRef(null);

  const apiConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 1. Tải lịch sử sửa ảnh từ Database
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axios.get('http://localhost:8000/api/editor/history', apiConfig);
      setHistory(res.data);
    } catch (err) {
      console.error("Lỗi lấy lịch sử chỉnh sửa:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Đồng bộ ảnh nếu được chuyển trực tiếp từ ô chat (T2I)
  useEffect(() => {
    if (initialImageUrl) {
      setLocalImageUrl(initialImageUrl);
      setOriginalUrl(initialImageUrl);
      setFile(null); // Không có file cục bộ vì lấy từ mạng
    }
  }, [initialImageUrl]);

  // 2. Tiếp nhận file ảnh tải lên cục bộ
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const objUrl = URL.createObjectURL(selectedFile);
    setLocalImageUrl(objUrl);
    
    // Reset trạng thái cũ
    setOriginalUrl(null);
    setMaskUrl(null);
    setInpaintPrompt('');
  };

  // 3. Xử lý khi bóc được Mask thành công từ MobileSAM
  const handleMaskGenerated = (generatedMaskUrl) => {
    setMaskUrl(generatedMaskUrl);
    // Nếu ảnh được truyền từ Chat (đã có originalUrl)
    if (!originalUrl && localImageUrl) {
       // Với file upload cục bộ, URL ảnh gốc sẽ được cập nhật từ API `/sam/segment`
    }
  };

  // Hỗ trợ bọc đầu vào bóc lớp MobileSAM
  const customFetchMask = async (x, y) => {
    if (!file && !initialImageUrl) {
      alert("Vui lòng tải ảnh lên trước!");
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('x', x);
      formData.append('y', y);

      if (file) {
        formData.append('image', file);
      } else {
        // Tải ảnh từ URL nếu là ảnh chuyển từ ô chat
        const responseImg = await fetch(localImageUrl);
        const blob = await responseImg.blob();
        formData.append('image', blob, 'chat_image.png');
      }

      const res = await axios.post('http://localhost:8000/api/editor/sam/segment', formData, {
        headers: {
          ...apiConfig.headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      setOriginalUrl(res.data.original_url);
      setMaskUrl(res.data.mask_url);
      return res.data.mask_url;
    } catch (err) {
      console.error("Lỗi SAM segment:", err);
      alert("Không thể bóc lớp vùng chọn. Hãy chắc chắn máy bạn đã tải model SAM!");
      return null;
    }
  };

  // 4. Kích hoạt tính năng Inpaint vùng đã tô đỏ
  const handleInpaint = async () => {
    if (!originalUrl || !maskUrl || !inpaintPrompt.trim() || isProcessing) {
      alert("Vui lòng bóc lớp vùng chọn (click lên ảnh) và nhập prompt phụ!");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const res = await axios.post('http://localhost:8000/api/editor/inpaint', {
        original_url: originalUrl,
        mask_url: maskUrl,
        prompt: inpaintPrompt
      }, apiConfig);

      const { job_id } = res.data;
      setCurrentJobId(job_id);
    } catch (err) {
      console.error("Lỗi inpaint:", err);
      setIsProcessing(false);
      alert("Đã xảy ra lỗi khi tạo yêu cầu Inpaint!");
    }
  };

  // 5. Kết nối WebSocket đón nhận progress inpaint từ ComfyUI
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
        setIsProcessing(false);
        setCurrentJobId(null);
        
        // Tự động thay thế ảnh nền canvas bằng ảnh mới đã inpaint thành công!
        setLocalImageUrl(data.image_url);
        setOriginalUrl(data.image_url);
        setMaskUrl(null); // Reset mask
        setFile(null); // Xóa file cục bộ để dùng URL mới từ server
        setInpaintPrompt('');
        
        // Cập nhật lại danh mục Lịch sử
        fetchHistory();
      } else if (data.type === 'error') {
        alert(`Inpainting thất bại: ${data.message}`);
        setIsProcessing(false);
        setCurrentJobId(null);
      }
    };

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [currentJobId, originalUrl, maskUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      
      {/* KHU VỰC LÀM VIỆC CHÍNH (CANVAS & PANEL ĐIỀU KHIỂN) */}
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, alignItems: 'flex-start' }}>
        
        {/* BÊN TRÁI: Khu vực kéo thả & Canvas vẽ */}
        <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          {!localImageUrl ? (
            <div 
              onClick={() => fileInputRef.current.click()}
              style={{
                width: '100%',
                maxWidth: '450px',
                height: '280px',
                border: '2px dashed rgba(255,255,255,0.1)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: 'rgba(255,255,255,0.01)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            >
              <Upload size={40} style={{ color: 'var(--text-muted)' }} />
              <h4 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>Kéo thả hoặc tải ảnh lên</h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Hỗ trợ định dạng PNG, JPG (Tối đa 10MB)</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <ImageEditor 
                imageUrl={localImageUrl}
                onMaskGenerated={handleMaskGenerated}
                // Custom override bọc chức năng SAM bóc tách ảnh
                customSAM={customFetchMask}
              />
              <button 
                onClick={() => {
                  setLocalImageUrl(null);
                  setOriginalUrl(null);
                  setMaskUrl(null);
                  setFile(null);
                }}
                className="premium-btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={12} /> Tải Ảnh Khác
              </button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*" 
          />
        </div>

        {/* BÊN PHẢI: Bảng điều khiển sinh ảnh Inpaint */}
        <div className="glass-panel" style={{ width: '320px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', height: '100%', minHeight: '400px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wand2 size={18} style={{ color: 'var(--primary)' }} /> Studio Chỉnh Sửa
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            1. Click chuột trực tiếp vào một vật thể bất kỳ trên Canvas để AI tự động tạo lớp phủ mờ bọc đối tượng.
            <br /><br />
            2. Nhập mô tả mới cho đối tượng đó ở bên dưới để thay đổi nội dung (Inpaint).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#ccc' }}>PROMPT CHỈNH SỬA</label>
            <textarea 
              className="premium-input"
              rows={4}
              style={{ resize: 'none', padding: '10px 14px', lineHeight: '1.5' }}
              placeholder="Ví dụ: Đổi thành một chiếc đầm màu đỏ, thêm mũ bảo hiểm cyberpunk..."
              value={inpaintPrompt}
              onChange={(e) => setInpaintPrompt(e.target.value)}
              disabled={isProcessing || !maskUrl}
            />
          </div>

          <button 
            onClick={handleInpaint}
            className="premium-btn-primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
            disabled={isProcessing || !maskUrl || !inpaintPrompt.trim()}
          >
            {isProcessing ? 'Đang Inpaint...' : 'KÍCH HOẠT INPAINT'} <ArrowRight size={16} />
          </button>

          {/* Hiển thị tiến trình Inpaint */}
          {isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#ccc' }}>
                <span>Đang inpaint...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* KHU VỰC LỊCH SỬ CHỈNH SỬA (HISTORY TIMELINE) */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={16} style={{ color: 'var(--secondary)' }} /> Nhật Ký Phiên Bản (Version History)
        </h3>

        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {loadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '1rem' }}>
              <Loader className="animate-spin" size={20} style={{ color: 'var(--secondary)', animation: 'spin 1.5s linear infinite' }} />
            </div>
          ) : history.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa có tác phẩm chỉnh sửa thành công nào được lưu lại.</p>
          ) : (
            history.map(item => (
              <div 
                key={item.id}
                onClick={() => {
                  if (!isProcessing) {
                    setLocalImageUrl(item.result_url);
                    setOriginalUrl(item.result_url);
                    setMaskUrl(null);
                    setFile(null);
                  }
                }}
                style={{
                  width: '90px',
                  flexShrink: 0,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
              >
                <img 
                  src={item.result_url} 
                  alt="History item" 
                  style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }} 
                />
                <div style={{ padding: '4px', background: 'rgba(0,0,0,0.6)', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ccc', textAlign: 'center' }}>
                  {item.prompt}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default CanvasInterface;
