import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

const LorasView = () => {
  const loras = [
    { name: 'Detail Tweaker XL v1.0', creator: 'CivitaiUser', strength: '0.8', active: true },
    { name: 'Cyberpunk Aesthetic Enhancer', creator: 'ArtModeller', strength: '0.55', active: false },
    { name: 'Studio Portrait Lighting LoRA', creator: 'PhotographerPro', strength: '1.0', active: true },
    { name: 'Anime Lineart Stylizer', creator: 'MangakaPro', strength: '0.7', active: false },
  ];

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] h-full flex flex-col font-sans select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">LoRA Models</h2>
          <span className="text-[10px] text-gray-400">Layer specific weights to guide Stable Diffusion generation styles</span>
        </div>
        <button className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-1.5 transition shadow-sm">
          Discover LoRAs
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {loras.map((lora, idx) => (
          <div
            key={idx}
            className={`p-4 border rounded-2xl flex flex-col justify-between transition duration-300 ${
              lora.active
                ? 'border-violet-100 bg-violet-50/10 hover:border-violet-200'
                : 'border-gray-100 bg-white hover:border-slate-200 hover:bg-slate-50/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className={`h-10 w-10 border rounded-xl flex items-center justify-center ${
                  lora.active ? 'bg-violet-50 border-violet-100 text-violet-600' : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}>
                  <Sparkles size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">{lora.name}</span>
                  <span className="text-[10px] text-gray-400">by {lora.creator}</span>
                </div>
              </div>

              {lora.active && (
                <CheckCircle2 size={16} className="text-violet-600" />
              )}
            </div>

            <div className="flex items-center justify-between mt-5 pt-3 border-t border-gray-100/50">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400">Strength Weight</span>
                <span className="text-xs font-bold text-slate-800">{lora.strength}</span>
              </div>
              <button className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                lora.active
                  ? 'border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100/60'
                  : 'border-slate-100 text-slate-600 bg-slate-50 hover:bg-slate-100'
              }`}>
                {lora.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LorasView;
