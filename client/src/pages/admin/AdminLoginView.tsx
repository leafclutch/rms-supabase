import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, LayoutDashboard, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const AdminLoginView: React.FC = () => {
  // 🔒 LOGIC — UNCHANGED
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as any)?.from?.pathname || '/admin/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16516f]/10 via-white to-orange-50 flex items-center justify-center relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-[#16516f]/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-orange-400/20 rounded-full blur-3xl"></div>

      {/* Back */}
      {/* <Link
        to="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-[#16516f] text-sm font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link> */}

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-[0_20px_60px_-10px_rgba(22,81,111,0.35)] p-10 animate-login-card">


        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#16516f] to-[#1a5b7d] flex items-center justify-center shadow-xl">
            <LayoutDashboard className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-black text-slate-900">
            Aaradhya<span className="text-[#16516f]">Restaurant</span>
          </h1>

          <p className="text-sm text-slate-500 text-center">
            <p>Created by:<a href='https://leafclutchtech.com.np/'>Leafclutch Technologies Pvt.Ltd. </a></p>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              Email Address
            </label>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@leafclutch.com"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#16516f]/20 focus:border-[#16516f] outline-none transition"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Password
              </label>
              <span className="text-xs text-[#16516f] font-semibold cursor-pointer hover:underline">
                Forgot?
              </span>
            </div>

            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#16516f]/20 focus:border-[#16516f] outline-none transition"
                required
              />
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-[#16516f] to-[#1a5b7d] text-white font-black text-base shadow-lg hover:shadow-[#16516f]/40 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Login to Dashboard
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Trust */}
        <div className="mt-8 flex justify-center gap-4 text-slate-400">
          <ShieldCheck className="w-6 h-6" />
          <span className="text-xs font-semibold">Secure Admin Access</span>
        </div>
      </div>

      <style>{`
  @keyframes loginFadeUp {
    0% {
      opacity: 0;
      transform: translateY(40px) scale(0.98);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .animate-login-card {
    animation: loginFadeUp 0.9s ease-out forwards;
  }
`}</style>

    </div>
  );
};

export default AdminLoginView;
