import React, { useState } from 'react';
import { MessageSquare, Paintbrush, Image, FolderOpen, Sparkles, Search, Sun, Moon } from 'lucide-react';

const Sidebar = ({ username, activeTab, setActiveTab, onLogout }) => {
  const [theme, setTheme] = useState('light');

  const menuItems = [
    { id: 'chat', label: 'AI Chat', icon: MessageSquare, badge: 'NEW' },
    { id: 'studio', label: 'Studio Canvas', icon: Paintbrush },
    { id: 'gallery', label: 'Gallery', icon: Image },
    { id: 'assets', label: 'Assets', icon: FolderOpen },
    { id: 'loras', label: 'LoRAs', icon: Sparkles },
  ];

  return (
    <div className="w-64 border-r border-gray-100 bg-[#f4f5f8] h-full flex flex-col justify-between p-5 flex-shrink-0 select-none font-sans">
      
      {/* Top Header & Search */}
      <div className="flex flex-col gap-6">
        {/* Brand Logo matching the Script.io geometric grid */}
        <div className="flex items-center gap-3 px-1">
          <div className="relative h-8 w-8 flex items-center justify-center">
            {/* Grid dot logo pattern */}
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-900"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-900"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-900"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-violet-600"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-900"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-900"></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-900"></div>
            </div>
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">AI Studio</span>
        </div>

        {/* Minimal Search Bar */}
        <div className="relative flex items-center bg-white/70 hover:bg-white border border-gray-100 rounded-xl px-3 py-2 transition-all cursor-pointer">
          <Search size={15} className="text-gray-400 mr-2" />
          <span className="text-gray-400 text-xs font-medium flex-1">Search</span>
          <span className="text-[10px] font-bold text-gray-300 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">⌘K</span>
        </div>

        {/* Middle Navigation Menu */}
        <div className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-slate-900 border border-gray-100/40'
                    : 'text-gray-500 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-violet-600' : 'text-gray-400'} />
                <span className="text-xs font-semibold">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[8px] font-extrabold text-white bg-violet-600 px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Light/Dark Toggle & User Profile */}
      <div className="flex flex-col gap-5 pt-4 border-t border-gray-100/60">
        
        {/* Light/Dark pill selector */}
        <div className="bg-white/60 border border-gray-100 p-1 rounded-xl flex items-center justify-between shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              theme === 'light'
                ? 'bg-white text-slate-900 shadow-sm border border-gray-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Sun size={14} /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              theme === 'dark'
                ? 'bg-white text-slate-900 shadow-sm border border-gray-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Moon size={14} /> Dark
          </button>
        </div>

        {/* User Profile Info with logout */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 font-bold text-sm">
              {username ? username.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 leading-tight">@{username || 'Creator'}</span>
              <span className="text-[10px] text-gray-400 leading-none mt-0.5" onClick={onLogout} style={{cursor: 'pointer'}}>Sign Out</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Sidebar;
