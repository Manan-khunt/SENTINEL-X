import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Server, CheckCircle2, AlertCircle, ArrowRight, Lock, KeyRound } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('analyst123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please provide valid SOC credentials.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login(username, password);
      // Strictly in memory! Navigates to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed: invalid credentials or gateway offline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#0B1220] text-[#E6EDF7] font-sans relative p-4 select-none">
      {/* Background grid matrix effect */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#0E7C86 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#111A2E] border border-[#22304D] rounded-lg shadow-2xl p-8 relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-[#0E3B45] border border-[#0E7C86] mx-auto flex items-center justify-center text-[#12929E] shadow-lg shadow-teal-950/40">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold tracking-wider text-[#E6EDF7]">
              SENTINEL-X
            </h1>
            <p className="text-xs text-[#8FA0BF] mt-1">
              Autonomous Adaptive Cyberattack Response Agent
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div className="space-y-1.5">
            <label className="text-[#8FA0BF] text-[11px] uppercase tracking-wider">
              Operator Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="analyst"
                className="w-full bg-[#0B1220] border border-[#22304D] focus:border-[#0E7C86] rounded px-3 py-2 text-[#E6EDF7] outline-hidden transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#8FA0BF] text-[11px] uppercase tracking-wider">
              Security Token / Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="analyst123"
                className="w-full bg-[#0B1220] border border-[#22304D] focus:border-[#0E7C86] rounded px-3 py-2 text-[#E6EDF7] outline-hidden transition-colors"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-[#EF4444]/15 border border-[#EF4444]/40 rounded text-[#EF4444] text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded bg-[#0E7C86] hover:bg-[#12929E] text-white font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-2 shadow-md shadow-teal-950/50"
          >
            <span>{isSubmitting ? 'AUTHENTICATING...' : 'SIGN IN TO CONSOLE'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Seeded Operator Hint */}
        <div className="p-2 bg-[#0B1220] border border-[#22304D] rounded text-[10px] font-mono text-[#8FA0BF] space-y-1">
          <div className="flex items-center gap-1.5 text-[#0E7C86] font-bold">
            <KeyRound className="w-3 h-3" />
            <span>SEEDED SOC ACCOUNTS</span>
          </div>
          <div className="text-[9px] text-[#8FA0BF]/80 flex justify-between">
            <span>analyst : analyst123</span>
            <span>admin : admin123</span>
            <span>approver : approver123</span>
          </div>
        </div>

        {/* SOC System Status Info */}
        <div className="pt-3 border-t border-[#22304D] space-y-2 text-[11px] font-mono text-[#8FA0BF]">
          <div className="flex items-center justify-between">
            <span>Environment:</span>
            <span className="text-[#E6EDF7] font-semibold">Synthetic Enterprise</span>
          </div>
          <div className="flex items-center justify-between">
            <span>System State:</span>
            <span className="text-[#22C55E] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>API Gateway:</span>
            <span className="text-[#12929E] font-semibold flex items-center gap-1">
              <Server className="w-3 h-3" /> Connected
            </span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-2.5 rounded bg-[#0B1220] border border-[#22304D] text-[10px] font-mono text-[#8FA0BF] text-center space-y-1">
          <div className="flex items-center justify-center gap-1 text-[#0E7C86] font-bold">
            <Lock className="w-3 h-3" />
            <span>EPHEMERAL IN-MEMORY AUTHENTICATION</span>
          </div>
          <p className="text-[9px] text-[#8FA0BF]/80">
            JWT session tokens exist strictly in transient process memory. Zero persistent disk or local storage caching.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 text-center text-xs font-mono text-[#8FA0BF]/60">
        InnoHacks 4.0 | Track: Agentic AI / GenAI | Team: 404 Founder
      </footer>
    </div>
  );
};
