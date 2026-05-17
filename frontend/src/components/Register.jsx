import React, { useState } from 'react';
import axios from 'axios';
import { Shield, ArrowRight } from 'lucide-react';

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 1. Kiểm tra độ dài Client-side trước khi gửi lên Server để báo lỗi chính xác
    if (username.length < 3) {
      setError('Tên đăng nhập phải dài tối thiểu 3 ký tự!');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải dài tối thiểu 6 ký tự để đảm bảo bảo mật!');
      return;
    }

    if (password !== confirmPassword) {
       setError('Mật khẩu xác nhận không trùng khớp!');
       return;
    }

    setIsLoading(true);

    try {
      await axios.post('http://localhost:8000/api/auth/register', {
        username,
        password
      });
      
      setSuccess('Đăng ký thành công! Đang chuyển hướng...');
      setTimeout(() => {
        onRegisterSuccess();
      }, 1500);
    } catch (err) {
      console.error(err);
      
      // Xử lý bóc tách thông báo lỗi chuẩn từ FastAPI (Pydantic Validation hoặc DB conflict)
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Lỗi Pydantic Validation gửi từ Server
        setError(detail.map(d => `${d.loc[1]}: ${d.msg}`).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Đăng ký thất bại. Tên tài khoản có thể đã được sử dụng!');
      }
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
          Tạo tài khoản Creative Studio miễn phí
        </p>

        {error && (
          <div className="bg-red-50/50 border border-red-100 text-red-500 rounded-2xl px-4 py-3 text-sm flex gap-2 items-center mb-5">
            <Shield size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50/50 border border-green-100 text-green-600 rounded-2xl px-4 py-3 text-sm flex gap-2 items-center mb-5">
            <span>🎉</span> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Tên đăng nhập</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white" 
              placeholder="Tối thiểu 3 ký tự (Ví dụ: huy)..."
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
              placeholder="Tối thiểu từ 6 ký tự..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Xác nhận mật khẩu</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white" 
              placeholder="Nhập lại mật khẩu..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-3.5 px-4 font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Đang đăng ký...' : 'Đăng Ký'}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-8">
          Đã có tài khoản?{' '}
          <span 
            onClick={onSwitchToLogin}
            className="text-slate-950 font-semibold cursor-pointer hover:underline"
          >
            Đăng nhập ngay
          </span>
        </p>
      </div>
    </div>
  );
};

export default Register;
