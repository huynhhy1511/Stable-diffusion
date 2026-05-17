import React from 'react';
import { FolderOpen, ArrowUpRight, ShieldCheck } from 'lucide-react';

const AssetsView = () => {
  const assets = [
    { name: 'Studio Brush Presets', size: '1.2 MB', category: 'Brush' },
    { name: 'ComfyUI Input Templates', size: '254 KB', category: 'Workflow' },
    { name: 'SAM MobileWeights PointSet', size: '14.5 MB', category: 'Model' },
    { name: 'Studio Watermark Overlay', size: '4.1 MB', category: 'Overlay' },
  ];

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] h-full flex flex-col font-sans select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Storage Assets</h2>
          <span className="text-[10px] text-gray-400">Manage your workspace models, templates and overrides</span>
        </div>
        <button className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-1.5 transition shadow-sm">
          Upload Asset
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        {assets.map((asset, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:border-slate-200 hover:bg-slate-50/50 transition duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                <FolderOpen size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">{asset.name}</span>
                <span className="text-[10px] text-gray-400">{asset.size}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-extrabold text-slate-400 border border-slate-100 px-2 py-0.5 rounded-full uppercase">
                {asset.category}
              </span>
              <button className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center transition">
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetsView;
