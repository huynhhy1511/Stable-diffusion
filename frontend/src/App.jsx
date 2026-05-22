import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import ChatView from './components/ChatView';
import StudioView from './components/StudioView';
import GalleryView from './components/GalleryView';
import AssetsView from './components/AssetsView';
import LorasView from './components/LorasView';

import { HelpCircle, Gift, User, Star } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || null);
  const [isRegister, setIsRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'studio', 'gallery', 'assets', 'loras'
  
  // Shared Parameters inside right-hand panel
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [cfgScale, setCfgScale] = useState(7.0);
  const [steps, setSteps] = useState(20);
  const [selectedModel, setSelectedModel] = useState('my_model.safetensors');

  // Direct image passing between T2I Chat and SAM Inpainting Canvas
  const [canvasInitialImage, setCanvasInitialImage] = useState(null);

  const handleLoginSuccess = (userToken, loggedInUser) => {
    setToken(userToken);
    setUsername(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
    setCanvasInitialImage(null);
    setActiveTab('chat');
  };

  // Cấu hình Axios Interceptor toàn cục để phát hiện lỗi 401 (Token hết hạn/Không hợp lệ từ dự án khác chạy cùng port 5173)
  // và tự động đăng xuất người dùng để tránh bị kẹt màn hình lỗi.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          console.warn("Phát hiện Token không hợp lệ hoặc hết hạn. Đang tự động đăng xuất...");
          handleLogout();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleSendToCanvas = (imageUrl) => {
    setCanvasInitialImage(imageUrl);
    setActiveTab('studio');
  };

  // 1. AUTH GATE (Login / Register Screens matching off-white clean minimalist style)
  if (!token) {
    if (isRegister) {
      return (
        <Register 
          onRegisterSuccess={() => setIsRegister(false)} 
          onSwitchToLogin={() => setIsRegister(false)} 
        />
      );
    }
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onSwitchToRegister={() => setIsRegister(true)} 
      />
    );
  }

  // Header Title mapping
  const headerTitles = {
    chat: 'Creative Workspace',
    studio: 'Studio Canvas',
    gallery: 'Art Gallery',
    assets: 'Storage Assets',
    loras: 'LoRA Weights',
  };

  // Determine whether to display the right Parameter Panel (only show on Studio and Chat tabs)
  const showParameters = ['chat', 'studio'].includes(activeTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f5f8] text-slate-800 font-sans antialiased">
      
      {/* 1. LEFT COLUMN: Sidebar (Minimalist navigation) */}
      <Sidebar 
        username={username} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      {/* 2. CENTER COLUMN: Main Workspace Layout (Canvas & View panels) */}
      <div className="flex-1 flex flex-col p-6 h-full overflow-hidden">
        
        {/* Workspace Clean Header Bar */}
        <div className="flex items-center justify-between mb-5 select-none">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">
              {headerTitles[activeTab]}
            </h1>
            <span className="text-[10px] text-gray-400 mt-1">AI Creative Studio v2.0</span>
          </div>

          {/* Right Header Navigation Widgets */}
          <div className="flex items-center gap-4">
            {/* Dark Upgrade Button badge exactly as shown in the image */}
            <button className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl py-2 px-3 text-xs font-semibold shadow-sm transition-all">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span>Upgrade</span>
            </button>

            {/* Icon Group */}
            <div className="flex items-center gap-3 text-gray-400">
              <button className="hover:text-slate-800 transition">
                <HelpCircle size={17} />
              </button>
              <button className="hover:text-slate-800 transition">
                <Gift size={17} />
              </button>
              <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                <User size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Display Container (Render active layout view) */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <ChatView 
              token={token} 
              onSendToCanvas={handleSendToCanvas} 
            />
          )}
          {activeTab === 'studio' && (
            <StudioView 
              token={token} 
              initialImageUrl={canvasInitialImage} 
              aspectRatio={aspectRatio}
              cfgScale={cfgScale}
              steps={steps}
              selectedModel={selectedModel}
            />
          )}
          {activeTab === 'gallery' && (
            <GalleryView 
              token={token} 
              onSelectImage={handleSendToCanvas} 
            />
          )}
          {activeTab === 'assets' && (
            <AssetsView />
          )}
          {activeTab === 'loras' && (
            <LorasView />
          )}
        </div>

      </div>

      {/* 3. RIGHT COLUMN: Control Parameter Settings Panel */}
      {showParameters && (
        <SettingsPanel 
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          cfgScale={cfgScale}
          setCfgScale={setCfgScale}
          steps={steps}
          setSteps={setSteps}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
        />
      )}

    </div>
  );
}

export default App;
