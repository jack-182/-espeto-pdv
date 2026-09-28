import React, { useState } from 'react';
import { useAuth } from '../../hooks/usePermissions';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  LogIn, 
  AlertCircle, 
  Store, 
  Server
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErro('Informe o e-mail corporativo e a senha.');
      return;
    }

    setErro(null);
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found'
        ? 'Credenciais incorretas ou usuário não autorizado.'
        : err.message || 'Falha ao realizar login.';
      setErro(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErro(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErro(err.message || 'Erro ao conectar via conta Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-amber-500 selection:text-black">
      {/* Background Subtle Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 mb-4">
            <Store className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
            SISTEMA PDV & GESTÃO COMERCIAL
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Acesso Corporativo Seguro • Multi-Tenant & Multiunidade
          </p>
        </div>

        {erro && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{erro}</div>
          </div>
        )}

        {/* Google OAuth Login */}
        <button
          id="btn-login-google"
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting || isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{submitting ? 'Autenticando...' : 'Entrar com Google Workspace'}</span>
        </button>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-slate-800" />
          <span className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            ou credenciais
          </span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@empresa.com.br"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-xs text-slate-200 placeholder-slate-600 outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-xs text-slate-200 placeholder-slate-600 outline-none transition-all font-mono"
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/10 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{submitting ? 'Validando...' : 'Acessar Terminal PDV'}</span>
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono">
          <Server className="w-3 h-3 text-emerald-500" />
          <span>PostgreSQL ACID + Firebase Auth + RBAC Enforcement</span>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
