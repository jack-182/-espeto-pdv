import React from 'react';
import { NotificacaoDono } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { 
  Smartphone, 
  X, 
  ExternalLink, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  ArrowDownCircle, 
  CheckCircle2, 
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { gerarLinkWhatsApp } from '../../services/notificationService';

interface ToastNotificacaoDonoProps {
  notificacao: NotificacaoDono | null;
  onClose: () => void;
  onOpenPainelCompleto: () => void;
}

export const ToastNotificacaoDono: React.FC<ToastNotificacaoDonoProps> = ({
  notificacao,
  onClose,
  onOpenPainelCompleto
}) => {
  if (!notificacao) return null;

  const isCritico = notificacao.nivel === 'CRITICO';
  const isAtencao = notificacao.nivel === 'ATENCAO';

  const getIcon = () => {
    switch (notificacao.tipo) {
      case 'SANGRIA':
        return <ArrowDownCircle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />;
      case 'CANCELAMENTO_ITEM':
        return <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'FECHAMENTO_CAIXA':
        return <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />;
      case 'ALERTA_FRAUDE':
        return <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 animate-pulse" />;
      case 'VENDA':
      default:
        return <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
  };

  const getBgBorder = () => {
    if (isCritico) return 'bg-slate-900/95 border-rose-500/70 shadow-rose-950/50 text-rose-100';
    if (isAtencao) return 'bg-slate-900/95 border-amber-500/70 shadow-amber-950/50 text-amber-100';
    return 'bg-slate-900/95 border-emerald-500/60 shadow-emerald-950/50 text-slate-100';
  };

  const whatsappUrl = gerarLinkWhatsApp(notificacao.enviadoParaTelefone, notificacao.mensagemWhatsApp);

  return (
    <div 
      id="toast-notificacao-dono"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${getBgBorder()}`}>
        {/* Cabeçalho do Push no Celular */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-400 tracking-wide uppercase">
                  NOTIFICAÇÃO ENVIADA AO DONO
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                📱 {notificacao.enviadoParaTelefone} • {notificacao.horario}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Fechar Notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com Informações do Evento e Prevenção de Fraude */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-slate-100 truncate">
                {notificacao.titulo}
              </h4>
              {notificacao.valor !== undefined && (
                <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                  {formatCurrency(notificacao.valor)}
                </span>
              )}
            </div>

            <div className="mt-1 space-y-0.5 text-[11px] text-slate-300">
              <p className="truncate">
                <span className="text-slate-400">🏢 Loja:</span> <strong className="text-slate-200">{notificacao.empresaNome}</strong>
                <span className="mx-1 text-slate-600">|</span>
                <span className="text-slate-400">👤 Operador:</span> <span className="text-slate-200">{notificacao.operadorNome}</span>
              </p>
              {notificacao.detalhes && (
                <p className="text-slate-400 truncate text-[10.5px]">
                  {notificacao.detalhes}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            title="Abrir no WhatsApp Real"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ver no WhatsApp</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>

          <button
            onClick={() => {
              onClose();
              onOpenPainelCompleto();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
          >
            Auditar no Painel
          </button>
        </div>
      </div>
    </div>
  );
};
