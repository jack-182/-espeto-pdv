import React from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { usePermissions, User } from '../../hooks/usePermissions';

export interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  user?: User | null;
}

/**
 * Componente Protetor de Rotas e Elementos Restritos.
 * Renderiza o `children` somente se o usuário possuir a role 'ADMINISTRADOR'.
 * Se for 'OPERADOR', renderiza o `fallback` fornecido ou null.
 */
export const AdminOnly: React.FC<AdminOnlyProps> = ({
  children,
  fallback = null
}) => {
  const { isAdmin } = usePermissions();

  if (isAdmin) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Fallback padrão elegante para telas de acesso restrito
 */
export interface AccessDeniedProps {
  title?: string;
  description?: string;
  onBackToAllowed?: () => void;
  onRequestAdminAuth?: () => void;
}

export const AccessDeniedFallback: React.FC<AccessDeniedProps> = ({
  title = 'Acesso Restrito ao Administrador',
  description = 'Este módulo gerencial requer nível de permissão de Administrador. Operadores de caixa possuem acesso às comandas, frente de caixa (PDV) e movimentações do turno.',
  onBackToAllowed,
  onRequestAdminAuth
}) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center shadow-2xl relative overflow-hidden">
        {/* Detalhe de fundo */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 mb-3 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Alçada Restrita
          </span>

          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
            {onBackToAllowed && (
              <button
                type="button"
                onClick={onBackToAllowed}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Comandas / PDV
              </button>
            )}

            {onRequestAdminAuth && (
              <button
                type="button"
                onClick={onRequestAdminAuth}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Digitar Senha do Administrador
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOnly;
