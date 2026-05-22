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
  const [invertMask, setInvertMask] = useState(false);
  const [selectionLevel, setSelectionLevel] = useState('coarse');
  const [denoise, setDenoise] = useState(0.55); // 0.55 default for local edits (e.g. face)
  const [magicPrompt, setMagicPrompt] = useState(true);

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
    setInvertMask(false);
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
      formData.append('level', selectionLevel);

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
          ...apiConfig.headers
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

  // Hỗ trợ chọn toàn bộ bức tranh (tạo 100% white mask)
  const handleSelectAll = async () => {
    if (!file && !initialImageUrl) {
      alert("Vui lòng tải ảnh lên trước!");
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (file) {
        formData.append('image', file);
      } else {
        const responseImg = await fetch(localImageUrl);
        const blob = await responseImg.blob();
        formData.append('image', blob, 'chat_image.png');
      }

      const res = await axios.post('http://localhost:8000/api/editor/sam/full', formData, {
        headers: {
          ...apiConfig.headers
        }
      });

      setOriginalUrl(res.data.original_url);
      setMaskUrl(res.data.mask_url);
      // Đặt slider denoise lên cao để chuyển phong cách toàn ảnh đẹp hơn
      setDenoise(0.9); 
    } catch (err) {
      console.error("Lỗi chọn toàn bộ ảnh:", err);
      alert("Không thể chọn toàn bộ ảnh!");
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Kích hoạt tính năng Inpaint vùng đã tô đỏ
  const handleInpaint = async () => {
    if (!originalUrl || !maskUrl || !inpaintPrompt.trim() || isProcessing) {
      alert("Vui lòng bóc lớp vùng chọn (click lên ảnh hoặc Chọn toàn ảnh) và nhập mô tả!");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    let promptToSend = inpaintPrompt;
    if (magicPrompt) {
      promptToSend = `${inpaintPrompt}, highly detailed, matching style, masterpiece, 8k resolution`;
    }

    try {
      const res = await axios.post('http://localhost:8000/api/editor/inpaint', {
        original_url: originalUrl,
        mask_url: maskUrl,
        prompt: promptToSend,
        invert_mask: invertMask,
        denoise: denoise
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
                maskUrl={maskUrl}
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
                  setInvertMask(false);
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
            1. Chọn cấp độ chọn, click chuột lên ảnh (hoặc bấm chọn "Toàn ảnh").
            <br />
            2. Nhập mô tả mới ở dưới để thay đổi nội dung ảnh.
          </p>

          {/* CẤP ĐỘ VÙNG CHỌN (SAM LEVEL SELECTOR) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#ccc', letterSpacing: '0.5px' }}>
              CẤP ĐỘ VÙNG CHỌN
            </label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.01)', 
              borderRadius: '12px', 
              padding: '4px',
            }}>
              <button 
                onClick={() => setSelectionLevel('fine')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: selectionLevel === 'fine' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: selectionLevel === 'fine' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.02)',
                  color: selectionLevel === 'fine' ? 'var(--primary)' : '#aaa',
                }}
                title="Dành cho chi tiết nhỏ như mặt, ngón tay..."
              >
                🔍 Chi tiết
              </button>
              <button 
                onClick={() => setSelectionLevel('medium')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: selectionLevel === 'medium' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: selectionLevel === 'medium' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.02)',
                  color: selectionLevel === 'medium' ? 'var(--primary)' : '#aaa',
                }}
                title="Dành cho bộ phận như áo, quần, tóc..."
              >
                👕 Bộ phận
              </button>
              <button 
                onClick={() => setSelectionLevel('coarse')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: selectionLevel === 'coarse' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: selectionLevel === 'coarse' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.02)',
                  color: selectionLevel === 'coarse' ? 'var(--primary)' : '#aaa',
                }}
                title="Gom toàn bộ người hoặc chủ thể chính"
              >
                🧍 Cơ thể
              </button>
              <button 
                onClick={handleSelectAll}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: maskUrl && !invertMask && !file ? '1px solid var(--secondary)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: 'rgba(255,255,255,0.02)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--secondary)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
                title="Chọn toàn bộ bức tranh để chuyển đổi phong cách"
              >
                🖼️ Toàn ảnh
              </button>
            </div>
          </div>

          {/* CẤU HÌNH SÁNG TẠO */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            borderRadius: '12px', 
            padding: '12px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#ccc' }}>MAGIC PROMPT</label>
              <input 
                type="checkbox" 
                checked={magicPrompt}
                onChange={(e) => setMagicPrompt(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#ccc' }}>
                <span style={{ fontWeight: '700' }}>SỨC MẠNH SÁNG TẠO</span>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{denoise}</span>
              </div>
              <input 
                type="range"
                min="0.15"
                max="1.0"
                step="0.05"
                value={denoise}
                onChange={(e) => setDenoise(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                * Thấp (0.3-0.5) giữ khung vẽ cũ; Cao (0.8-0.95) để vẽ lại hoàn toàn.
              </span>
            </div>
          </div>

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

          {maskUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', marginBottom: '5px' }}>
              <input 
                type="checkbox" 
                id="invertMask"
                checked={invertMask}
                onChange={(e) => setInvertMask(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
              <label htmlFor="invertMask" style={{ fontSize: '12px', fontWeight: '600', color: '#ddd', cursor: 'pointer', userSelect: 'none' }}>
                Đảo ngược vùng chọn (Sửa nền)
              </label>
            </div>
          )}

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
