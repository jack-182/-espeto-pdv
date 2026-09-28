import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  X, 
  Delete, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { api } from '../../services/api';

export interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionName: string;
  storeId?: string;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionName,
  storeId
}) => {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  // Resetar estado quando o modal abre ou fecha
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg(null);
      setIsSuccess(false);
      setLoading(false);
      setShake(false);
    }
  }, [isOpen]);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length < 8 && !loading) {
      setErrorMsg(null);
      setPin(prev => prev + digit);
    }
  }, [pin, loading]);

  const handleBackspace = useCallback(() => {
    if (!loading) {
      setErrorMsg(null);
      setPin(prev => prev.slice(0, -1));
    }
  }, [loading]);

  const handleClear = useCallback(() => {
    if (!loading) {
      setErrorMsg(null);
      setPin('');
    }
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    if (loading) return;
    if (pin.length === 0) {
      setErrorMsg('Digite a senha/PIN de alçada do Administrador ou Gerente.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Validação real e segura via API do Backend com auditoria em banco de dados
      const res = await api.verifySupervisorPin(pin, storeId);

      if (res.sucesso && res.supervisor) {
        setIsSuccess(true);
        setErrorMsg(null);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 400);
      } else {
        setShake(true);
        setErrorMsg(res.erro || 'Senha incorreta. Apenas Administrador ou Gerente autorizado pode liberar esta alçada.');
        setPin('');
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setShake(true);
      setErrorMsg(err.message || 'Falha na comunicação de segurança com o servidor.');
      setPin('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }, [pin, storeId, loading, onSuccess, onClose]);

  // Listener para digitação no teclado físico do PDV
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleBackspace, handleConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className={`w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-amber-600/20 via-slate-800/60 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Alçada de Segurança
              </h3>
              <p className="text-[11px] text-slate-400">Verificação Segura de Supervisor</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60 text-center">
            <span className="text-xs text-slate-400 block mb-1">Operação Solicitada:</span>
            <span className="text-sm font-semibold text-amber-300 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {actionName}
            </span>
          </div>

          {/* Campo de Exibição dos Dígitos (Bolinhas protegidas) */}
          <div className="flex flex-col items-center justify-center gap-2 pt-1 pb-2">
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div 
                    key={idx}
                    className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                      isFilled 
                        ? isSuccess 
                          ? 'bg-emerald-500 border-emerald-400 scale-110'
                          : 'bg-amber-500 border-amber-400 scale-110 shadow-lg shadow-amber-500/30'
                        : 'border-slate-700 bg-slate-950'
                    }`}
                  >
                    {isFilled && (
                      <div className="w-2 h-2 rounded-full bg-slate-950" />
                    )}
                  </div>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {pin.length > 0 ? `${pin.length} dígitos inseridos` : 'Digite a senha de 4 dígitos'}
            </span>
          </div>

          {/* Mensagem de Erro ou Sucesso */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Alçada autorizada com sucesso!</span>
            </div>
          )}

          {/* Teclado Numérico Físico / Touch */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                disabled={loading || isSuccess}
                onClick={() => handleDigit(num)}
                className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-100 font-semibold text-lg border border-slate-700/60 transition flex items-center justify-center shadow-sm disabled:opacity-50"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              disabled={loading || isSuccess}
              onClick={handleClear}
              className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 active:scale-95 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-700/40 transition flex items-center justify-center gap-1 disabled:opacity-50"
              title="Limpar tudo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={loading || isSuccess}
              onClick={() => handleDigit('0')}
              className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-100 font-semibold text-lg border border-slate-700/60 transition flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              0
            </button>

            <button
              type="button"
              disabled={loading || isSuccess}
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 active:scale-95 text-slate-400 hover:text-slate-200 border border-slate-700/40 transition flex items-center justify-center disabled:opacity-50"
              title="Apagar dígito"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Botão de Confirmar */}
          <div className="pt-2">
            <button
              type="button"
              disabled={pin.length === 0 || loading || isSuccess}
              onClick={handleConfirm}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando no Servidor...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Autorizado!</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Autorizar Operação</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
