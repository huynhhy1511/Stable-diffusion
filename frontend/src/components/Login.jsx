import React, { useState } from 'react';
import axios from 'axios';
import { Shield, ArrowRight } from 'lucide-react';

const Login = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const res = await axios.post('http://localhost:8000/api/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { access_token, username: loggedInUser } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('username', loggedInUser);
      onLoginSuccess(access_token, loggedInUser);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#f4f5f8] px-4 font-sans">
      <div className="bg-white rounded-3xl border border-gray-100/80 shadow-sm w-full max-w-md p-10 flex flex-col">
        <div className="flex items-center gap-2.5 justify-center mb-2">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white">
            <span className="font-extrabold text-lg">AI</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Creative Studio</span>
        </div>
        
        <p className="text-gray-400 text-sm text-center mb-8">
          Đăng nhập vào không gian sáng tạo ảnh bằng AI
        </p>

        {error && (
          <div className="bg-red-50/50 border border-red-100 text-red-500 rounded-2xl px-4 py-3 text-sm flex gap-2 items-center mb-5">
            <Shield size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Tên đăng nhập</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white" 
              placeholder="Nhập tên đăng nhập..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Mật khẩu</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white" 
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-3.5 px-4 font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-8">
          Chưa có tài khoản?{' '}
          <span 
            onClick={onSwitchToRegister}
            className="text-slate-950 font-semibold cursor-pointer hover:underline"
          >
            Đăng ký ngay
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
