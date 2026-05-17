import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader, Download, Trash, Eye, Sparkles } from 'lucide-react';

const GalleryView = ({ token, onSelectImage }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:8000/api/editor/history', apiConfig);
      setImages(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] h-full flex flex-col font-sans overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Art Gallery</h2>
          <span className="text-[10px] text-gray-400">All of your edited and saved masterpieces</span>
        </div>
        <button
          onClick={fetchGallery}
          className="text-xs font-semibold text-slate-900 border border-gray-100 rounded-lg px-3 py-1.5 bg-slate-50 hover:bg-slate-100 transition shadow-sm"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader className="animate-spin text-slate-400" size={24} />
        </div>
      ) : images.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center gap-3 text-center">
          <Eye size={36} className="text-slate-300" />
          <span className="text-xs font-semibold text-slate-400">Your gallery is currently empty.</span>
          <span className="text-[10px] text-slate-400">Create beautiful inpaint alterations to fill your canvas registry!</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((item) => (
            <div
              key={item.id}
              className="group bg-slate-50 rounded-2xl border border-gray-100 overflow-hidden relative shadow-sm hover:shadow-md transition-all flex flex-col"
            >
              <div className="relative aspect-square overflow-hidden bg-white flex-1">
                <img
                  src={item.result_url}
                  alt={item.prompt}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                
                {/* Floating controls on hover */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                  <a
                    href={item.result_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 rounded-full bg-white hover:bg-slate-50 text-slate-950 flex items-center justify-center shadow transition-all"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => onSelectImage(item.result_url)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-950 text-[10px] font-bold rounded-full shadow transition-all flex items-center gap-1"
                  >
                    <Sparkles size={11} /> Load Studio
                  </button>
                </div>
              </div>

              {/* Description metadata */}
              <div className="p-3 bg-white border-t border-slate-50">
                <p className="text-[11px] font-bold text-slate-800 truncate leading-tight mb-1">
                  {item.prompt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-400">
                    {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[8px] font-extrabold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full uppercase">
                    Inpaint
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryView;
