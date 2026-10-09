import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('analyst123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      nav('/incidents', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg">
      <form
        onSubmit={submit}
        className="soc-panel rounded p-6 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col gap-3"
      >
        <div>
          <div className="font-mono font-bold text-lg text-text tracking-wider">
            SENTINEL<span className="text-primary">-X</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Autonomous Adaptive Cyberattack Response Agent
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted">USERNAME</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-surface-2 border border-border rounded px-2.5 py-2 text-sm font-mono text-text outline-none focus:border-primary"
            autoComplete="username"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted">PASSWORD</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface-2 border border-border rounded px-2.5 py-2 text-sm font-mono text-text outline-none focus:border-primary"
            autoComplete="current-password"
          />
        </label>
        {error && (
          <div className="font-mono text-[11px] text-danger border border-danger/40 bg-danger/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-mono text-xs font-semibold tracking-wider px-3 py-2"
        >
          {busy ? 'AUTHENTICATING…' : 'SIGN IN'}
        </button>
        <div className="font-mono text-[10px] text-muted leading-relaxed">
          Demo roles: viewer / analyst / approver / admin
          <br />
          JWT verified by backend · token kept in memory only
        </div>
      </form>
    </div>
  );
}
