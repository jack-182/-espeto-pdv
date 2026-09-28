import React, { useState, useEffect } from 'react';
import { ShieldCheck, Store, Mail, Lock, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

interface AceitarConviteModalProps {
  token: string;
  onClose: () => void;
  onSucesso: (userData: any) => void;
}

export const AceitarConviteModal: React.FC<AceitarConviteModalProps> = ({
  token,
  onClose,
  onSucesso
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conviteData, setConviteData] = useState<any>(null);
  const [nome, setNome] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [sucessoMsg, setSucessoMsg] = useState(false);

  useEffect(() => {
    async function carregarConvite() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getInvitation(token);
        if (res.sucesso && res.data) {
          setConviteData(res.data);
          setNome(res.data.nome || '');
          if (res.data.isExpired) {
            setError('Este convite expirou. Entre em contato com o administrador da sua empresa.');
          } else if (res.data.isAccepted) {
            setError('Este convite já foi aceito anteriormente. Você já pode fazer login.');
          }
        } else {
          setError(res.erro || 'Convite inválido ou expirado.');
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do convite.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      carregarConvite();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setError('O PIN deve conter pelo menos 4 dígitos numéricos.');
      return;
    }
    if (pin !== confirmPin) {
      setError('A confirmação do PIN não confere.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.acceptInvitation(token, { pin, name: nome.trim() });
      if (res.sucesso) {
        setSucessoMsg(true);
        setTimeout(() => {
          onSucesso(res.data);
        }, 1800);
      } else {
        setError(res.erro || 'Falha ao aceitar convite.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao aceitar convite.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      id="modal-aceitar-convite-backdrop"
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div 
        id="modal-aceitar-convite"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Convite de Acesso</h3>
              <p className="text-xs text-slate-400">Ativação de Conta de Funcionário</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-xs">Validando convite de segurança...</span>
          </div>
        ) : sucessoMsg ? (
          <div className="p-8 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Conta Ativada com Sucesso!</h4>
            <p className="text-xs text-slate-300">
              Seu perfil de <strong className="text-amber-400">OPERADOR</strong> está ativo e pronto para uso no caixa.
            </p>
          </div>
        ) : conviteData && !conviteData.isExpired && !conviteData.isAccepted ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Cartão de Resumo do Vínculo */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500">Estabelecimento:</span>
                <strong className="text-white">{conviteData.tenantNome}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-amber-400" /> Loja Vinculada:
                </span>
                <strong className="text-amber-300">{conviteData.storeNome}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-400" /> Perfil de Acesso:
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  OPERADOR
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> E-mail:
                </span>
                <span className="text-slate-300 font-mono">{conviteData.email}</span>
              </div>
            </div>

            {/* Confirmação do Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Seu Nome Completo
              </label>
              <input
                id="input-aceitar-nome"
                type="text"
                required
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Criação do PIN do Operador */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Criar PIN (4 a 8 dígitos)
                </label>
                <input
                  id="input-aceitar-pin"
                  type="password"
                  maxLength={8}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-center font-mono tracking-widest text-amber-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Confirmar PIN
                </label>
                <input
                  id="input-aceitar-pin-confirm"
                  type="password"
                  maxLength={8}
                  required
                  placeholder="••••"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-center font-mono tracking-widest text-amber-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Este PIN será utilizado para abrir turnos de caixa e registrar vendas na sua loja.
            </p>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-aceite-convite"
                type="submit"
                disabled={submitting}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Ativar Minha Conta</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 text-center space-y-4">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error || 'Convite indisponível.'}</span>
            </div>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
