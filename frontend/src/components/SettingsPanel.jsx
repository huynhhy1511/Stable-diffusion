import React from 'react';
import { Sliders, Maximize, Cpu, ChevronDown } from 'lucide-react';

const SettingsPanel = ({
  aspectRatio,
  setAspectRatio,
  cfgScale,
  setCfgScale,
  steps,
  setSteps,
  selectedModel,
  setSelectedModel,
}) => {
  const aspectRatios = [
    { id: '1:1', label: '1:1', desc: 'Square' },
    { id: '16:9', label: '16:9', desc: 'Cinematic' },
    { id: '9:16', label: '9:16', desc: 'Vertical' },
    { id: '4:3', label: '4:3', desc: 'Classic' },
  ];

  const models = [
    { id: 'sd_xl_base_1.0.safetensors', name: 'SDXL Base 1.0' },
    { id: 'dreamshaper_8.safetensors', name: 'Dreamshaper 8' },
    { id: 'v1-5-pruned-emaonly.safetensors', name: 'Stable Diffusion v1.5' },
  ];

  return (
    <div className="w-80 border-l border-gray-100 bg-[#f4f5f8] h-full flex flex-col p-5 flex-shrink-0 select-none overflow-y-auto font-sans">
      
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Image Parameters (3)
        </h3>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full shadow-sm">
          Active
        </span>
      </div>

      <div className="flex flex-col gap-4">
        
        {/* CARD 1: Aspect Ratio */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-gray-200/60 transition-all">
          <div className="flex items-center gap-2.5 mb-3 text-slate-800">
            <Maximize size={15} className="text-gray-400" />
            <span className="text-xs font-bold">Aspect Ratio</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {aspectRatios.map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setAspectRatio(ratio.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  aspectRatio === ratio.id
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-xs font-extrabold leading-none">{ratio.label}</span>
                <span className={`text-[9px] mt-1 ${aspectRatio === ratio.id ? 'text-slate-300' : 'text-gray-400'}`}>
                  {ratio.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* CARD 2: Fine Tuning Sliders */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-gray-200/60 transition-all">
          <div className="flex items-center gap-2.5 mb-4 text-slate-800">
            <Sliders size={15} className="text-gray-400" />
            <span className="text-xs font-bold">Generation Weights</span>
          </div>

          <div className="flex flex-col gap-4">
            {/* CFG Scale */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">CFG Scale</span>
                <span className="text-xs font-bold text-slate-800">{cfgScale}</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={cfgScale}
                onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Inference Steps */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Steps</span>
                <span className="text-xs font-bold text-slate-800">{steps}</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={steps}
                onChange={(e) => setSteps(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: Model Selector */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-gray-200/60 transition-all">
          <div className="flex items-center gap-2.5 mb-3 text-slate-800">
            <Cpu size={15} className="text-gray-400" />
            <span className="text-xs font-bold">Base Model</span>
          </div>

          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold appearance-none outline-none pr-8 cursor-pointer focus:border-slate-300 focus:bg-white transition-all"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>

      </div>

    </div>
  );
};

export default SettingsPanel;
