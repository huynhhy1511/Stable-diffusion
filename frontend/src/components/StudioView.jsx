import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ImageEditor from './ImageEditor';
import { Upload, RefreshCw, Send, ShieldAlert, Sparkles, History, Loader, Image as ImageIcon } from 'lucide-react';

const StudioView = ({ token, initialImageUrl, aspectRatio, cfgScale, steps, selectedModel }) => {
  const [file, setFile] = useState(null);
  const [localImageUrl, setLocalImageUrl] = useState(initialImageUrl || null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [maskUrl, setMaskUrl] = useState(null);
  
  const [inputPrompt, setInputPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showNegative, setShowNegative] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [invertMask, setInvertMask] = useState(false);
  const [selectionLevel, setSelectionLevel] = useState('coarse');
  const [denoise, setDenoise] = useState(0.85);

  const fileInputRef = useRef(null);
  const wsRef = useRef(null);

  const apiConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (initialImageUrl) {
      setLocalImageUrl(initialImageUrl);
      setOriginalUrl(initialImageUrl);
      setFile(null);
    }
  }, [initialImageUrl]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axios.get('http://localhost:8000/api/editor/history', apiConfig);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLocalImageUrl(URL.createObjectURL(selectedFile));
    setOriginalUrl(null);
    setMaskUrl(null);
    setInputPrompt('');
    setInvertMask(false);
  };

  const handleMaskGenerated = (generatedMaskUrl) => {
    setMaskUrl(generatedMaskUrl);
  };

  const customFetchMask = async (x, y) => {
    if (!file && !localImageUrl) {
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
        const responseImg = await fetch(localImageUrl);
        const blob = await responseImg.blob();
        formData.append('image', blob, 'image.png');
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
      console.error(err);
      alert("Không lấy được mask từ SAM!");
      return null;
    }
  };

  const handleSelectAll = async () => {
    if (!file && !localImageUrl) {
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
        formData.append('image', blob, 'image.png');
      }

      const res = await axios.post('http://localhost:8000/api/editor/sam/full', formData, {
        headers: {
          ...apiConfig.headers
        }
      });

      setOriginalUrl(res.data.original_url);
      setMaskUrl(res.data.mask_url);
      setDenoise(0.95); // High denoise for full styling
    } catch (err) {
      console.error("Lỗi chọn toàn bộ ảnh:", err);
      alert("Không thể chọn toàn bộ ảnh!");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInpaint = async () => {
    if (!originalUrl || !maskUrl || !inputPrompt.trim() || isProcessing) {
      alert("Vui lòng chọn đối tượng trên ảnh và nhập prompt mô tả!");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    let promptToSend = inputPrompt;
    if (magicPrompt) {
      promptToSend = `${inputPrompt}, highly detailed, matching style, photorealistic, 8k resolution`;
    }

    try {
      // Gửi inpaint kèm các tham số Slider từ Panel cài đặt phải!
      const res = await axios.post('http://localhost:8000/api/editor/inpaint', {
        original_url: originalUrl,
        mask_url: maskUrl,
        prompt: promptToSend,
        invert_mask: invertMask,
        denoise: denoise,
        // Các tham số cài đặt cao cấp
        aspect_ratio: aspectRatio,
        cfg_scale: cfgScale,
        steps: steps,
        model: selectedModel
      }, apiConfig);

      setCurrentJobId(res.data.job_id);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
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
        setIsProcessing(false);
        setCurrentJobId(null);
        
        setLocalImageUrl(data.image_url);
        setOriginalUrl(data.image_url);
        setMaskUrl(null);
        setFile(null);
        setInputPrompt('');
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
    <div className="flex flex-1 flex-col gap-5 h-full font-sans select-none overflow-y-auto pr-1">
      
      {/* Upper Main Workspace Row (Canvas Panel) */}
      <div className="flex-1 min-h-[420px] bg-white rounded-2xl border border-gray-100 flex items-center justify-center p-6 relative">
        {!localImageUrl ? (
          <div
            onClick={() => fileInputRef.current.click()}
            className="w-full max-w-lg h-72 border-2 border-dashed border-gray-100 bg-slate-50/30 hover:bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
          >
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <Upload size={20} />
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-slate-800 block">Kéo thả hoặc tải ảnh lên</span>
              <span className="text-[10px] text-gray-400 mt-1 block">Định dạng PNG, JPG (Tối đa 10MB)</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <ImageEditor
              imageUrl={localImageUrl}
              maskUrl={maskUrl}
              onMaskGenerated={handleMaskGenerated}
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-100 bg-slate-50 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
            >
              <RefreshCw size={12} /> Thay đổi ảnh
            </button>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />

        {/* Floating progress overlays */}
        {isProcessing && (
          <div className="absolute top-4 left-4 bg-white/95 border border-slate-100 rounded-xl px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-800">Inpainting... {progress}%</span>
            <div className="w-36 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div style={{ width: `${progress}%` }} className="h-full bg-slate-900 transition-all"></div>
            </div>
          </div>
        )}
      </div>

      {/* Replicated Floating Input Bar for Studio view */}
      <div className="border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] bg-white flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder={maskUrl ? "Describe how to modify the selected object..." : "Click any object on the canvas first to generate a mask overlay..."}
          className="w-full px-4 py-3.5 text-xs text-slate-800 bg-transparent outline-none placeholder-slate-400 font-medium"
          disabled={!maskUrl || isProcessing}
        />

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

        {maskUrl && (
          <div className="px-4 py-3 bg-slate-50/30 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
              <div className="flex flex-col min-w-[120px]">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Sức mạnh sáng tạo</span>
                <span className="text-[9px] text-slate-400">Denoise strength: {denoise}</span>
              </div>
              <input
                type="range"
                min="0.15"
                max="1.0"
                step="0.05"
                value={denoise}
                onChange={(e) => setDenoise(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
              />
              <span className="text-xs font-bold text-slate-900 w-8 text-right">{denoise}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              💡 {denoise < 0.6 ? "Thấp (0.3-0.5): Giữ nét cũ, đổi chi tiết" : "Cao (0.8-1.0): Vẽ lại mạnh mẽ, đổi phong cách"}
            </div>
          </div>
        )}

        <div className="h-[1px] bg-slate-100 w-full"></div>

        <div className="px-3 py-2 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Cấp độ vùng chọn SAM */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 mr-1">
              <button
                onClick={() => setSelectionLevel('fine')}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                  selectionLevel === 'fine'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Sửa chi tiết nhỏ (khuôn mặt, tay...)"
              >
                🔍 Chi tiết
              </button>
              <button
                onClick={() => setSelectionLevel('medium')}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                  selectionLevel === 'medium'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Sửa bộ phận (áo, quần...)"
              >
                👕 Bộ phận
              </button>
              <button
                onClick={() => setSelectionLevel('coarse')}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                  selectionLevel === 'coarse'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Sửa toàn bộ hoặc tách nền"
              >
                🧍 Toàn bộ
              </button>
              <button
                onClick={handleSelectAll}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                  maskUrl && !invertMask && !file
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
                title="Chọn toàn bộ bức tranh để chuyển đổi phong cách"
              >
                🖼️ Toàn ảnh
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition text-[10px] font-bold"
            >
              <ImageIcon size={12} className="text-slate-400" /> Attach
            </button>

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

            <button
              onClick={() => setInvertMask(!invertMask)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition ${
                invertMask
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
              disabled={!maskUrl}
            >
              🔄 Đảo ngược (Sửa nền)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-300">
              {inputPrompt.length}/3,000
            </span>
            <button
              onClick={handleInpaint}
              disabled={!maskUrl || isProcessing || !inputPrompt.trim()}
              className="h-7 w-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white flex items-center justify-center transition"
            >
              <Send size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Version History Horizontal Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <History size={13} className="text-gray-400" /> Version History
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1.5">
          {loadingHistory ? (
            <div className="flex justify-center w-full py-2">
              <Loader className="animate-spin text-slate-400" size={16} />
            </div>
          ) : history.length === 0 ? (
            <span className="text-[11px] text-gray-400">No edits recorded yet</span>
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
                className="w-20 flex-shrink-0 cursor-pointer rounded-xl border border-gray-100 overflow-hidden bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <img src={item.result_url} alt="History image" className="w-full h-14 object-cover" />
                <span className="block px-2 py-1 text-[9px] font-bold text-slate-700 truncate">
                  {item.prompt}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default StudioView;
