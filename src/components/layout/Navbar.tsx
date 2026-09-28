import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Search, 
  PlusCircle, 
  Clock, 
  Building2, 
  ChevronDown, 
  UserCheck, 
  Maximize2,
  DollarSign,
  ShieldCheck, 
  User as UserIcon,
  Smartphone,
  LogOut
} from 'lucide-react';
import { Empresa, TurnoCaixa, Operador } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { usePermissions } from '../../hooks/usePermissions';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
  empresaAtiva: Empresa;
  todasEmpresas: Empresa[];
  onTrocarEmpresa: (empresa: Empresa) => void;
  turnoAtual: TurnoCaixa | null;
  operadorAtivo?: Operador;
  todosOperadores?: Operador[];
  onTrocarOperador?: (operador: Operador) => void;
  onOpenNovaComandaModal: () => void;
  onOpenQuickPos: () => void;
  termoBusca: string;
  onSetTermoBusca: (termo: string) => void;
  onOpenAberturaCaixa: () => void;
  saldoDinheiroEmGaveta?: number;
  socketConnected?: boolean;
  onOpenNotificacoesDono?: () => void;
  totalNotificacoesDono?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileSidebar,
  empresaAtiva,
  todasEmpresas = [],
  onTrocarEmpresa,
  turnoAtual,
  operadorAtivo: propOperadorAtivo,
  todosOperadores: propTodosOperadores,
  onTrocarOperador,
  onOpenNovaComandaModal,
  onOpenQuickPos,
  termoBusca,
  onSetTermoBusca,
  onOpenAberturaCaixa,
  saldoDinheiroEmGaveta = 0,
  socketConnected = true,
  onOpenNotificacoesDono,
  totalNotificacoesDono = 0
}) => {
  const { user: authUser, logout, isAdmin } = usePermissions();
  const operadorAtivo = authUser || propOperadorAtivo || {
    id: 'user',
    nome: 'Operador',
    cargo: 'Operador',
    role: 'OPERADOR' as const,
    active: true
  };
  const todosOperadores = propTodosOperadores || [];

  const [horaAtual, setHoraAtual] = useState<string>('');
  const [showEmpresaDropdown, setShowEmpresaDropdown] = useState(false);
  const [showOperadorDropdown, setShowOperadorDropdown] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setHoraAtual(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const isCaixaAberto = turnoAtual?.status === 'ABERTO';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-18 px-4 lg:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      {/* Esquerda: Botão Menu Mobile + Seletor de Loja */}
      <div className="flex items-center gap-3">
        <button
          id="btn-mobile-menu"
          onClick={onToggleMobileSidebar}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 lg:hidden cursor-pointer"
          title="Abrir menu de navegação"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Dropdown Multi-Lojas */}
        <div className="relative">
          <button
            id="dropdown-empresa-btn"
            onClick={() => setShowEmpresaDropdown(!showEmpresaDropdown)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 text-xs font-semibold text-slate-100 transition-colors cursor-pointer"
          >
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shrink-0 shadow-xs shadow-emerald-400/50"></div>
            <div className="text-left">
              <span className="block leading-none text-slate-100 font-bold">{empresaAtiva?.nomeFantasia || 'Selecione a Loja'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {showEmpresaDropdown && (
            <div className="absolute left-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                ALTERNAR ESTABELECIMENTO
              </div>
              {(todasEmpresas || []).map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    onTrocarEmpresa(emp);
                    setShowEmpresaDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    emp.id === empresaAtiva?.id 
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' 
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{emp.nomeFantasia}</p>
                  </div>
                  {emp.id === empresaAtiva?.id && (
                    <span className="text-[10px] bg-slate-950 text-amber-400 font-bold px-1.5 py-0.5 rounded">Ativa</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Indicador de Status do Turno & Gaveta */}
        <div className="hidden md:flex items-center gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
            isCaixaAberto 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {isCaixaAberto ? `Turno ${turnoAtual?.numeroTurno || 1} Aberto` : 'Caixa Fechado'}
          </span>

          {isCaixaAberto && (
            <div className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300">
              Gaveta (Dinheiro): <span className="text-emerald-400 font-mono font-bold">{formatCurrency(saldoDinheiroEmGaveta)}</span>
            </div>
          )}

          {!isCaixaAberto && (
            <button
              onClick={onOpenAberturaCaixa}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors cursor-pointer"
            >
              Abrir Caixa
            </button>
          )}
        </div>
      </div>

      {/* Centro: Campo de Busca Rápida */}
      <div className="flex-1 max-w-md mx-4 hidden lg:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Buscar comanda (#12), cliente ou produto..."
            value={termoBusca}
            onChange={(e) => onSetTermoBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950/70 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-slate-200 placeholder:text-slate-500 outline-hidden transition-all"
          />
        </div>
      </div>

      {/* Direita: Ações Rápidas, Relógio, Operador & Tela Cheia */}
      <div className="flex items-center gap-2.5">
        {/* Botão Nova Comanda */}
        <button
          id="btn-quick-new-comanda"
          onClick={onOpenNovaComandaModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Comanda</span>
          <span className="text-[10px] font-mono opacity-80">(F2)</span>
        </button>

        {/* Botão Venda Balcão Rápida */}
        <button
          id="btn-quick-pos-nav"
          onClick={onOpenQuickPos}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer active:scale-95"
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Venda Rápida</span>
        </button>

        {/* Botão Notificações no Celular do Dono */}
        {onOpenNotificacoesDono && (
          <button
            id="btn-notificacoes-dono-nav"
            onClick={onOpenNotificacoesDono}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-all cursor-pointer active:scale-95 relative"
            title="Abrir Central Anti-Fraude e Notificações no Celular do Dono"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="hidden lg:inline">Celular do Dono</span>
            {totalNotificacoesDono > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-mono font-bold flex items-center justify-center">
                {totalNotificacoesDono > 9 ? '9+' : totalNotificacoesDono}
              </span>
            )}
          </button>
        )}

        {/* Status Conexão WebSocket Realtime */}
        <div 
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/60 text-slate-300 border border-slate-800/80 font-mono text-[11px]"
          title={socketConnected ? "WebSocket Conectado (Socket.IO Real-time)" : "WebSocket Reconectando..."}
        >
          <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400/50' : 'bg-amber-400'}`}></div>
          <span className="hidden lg:inline text-slate-400">WS:</span>
          <span className={socketConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
            {socketConnected ? 'Real-Time' : 'Offline'}
          </span>
        </div>

        {/* Relógio Digital */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/60 text-slate-300 border border-slate-800/80 font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{horaAtual || '--:--:--'}</span>
        </div>

        {/* Perfil do Operador Autenticado & Logout */}
        <div className="relative">
          <button
            id="dropdown-operador-btn"
            onClick={() => setShowOperadorDropdown(!showOperadorDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
            title="Perfil de Acesso do Usuário"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center">
              {operadorAtivo.nome.charAt(0)}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {showOperadorDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-3 animate-in fade-in zoom-in-95">
              <div className="px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-2 flex items-center justify-between">
                <span>Sessão Autenticada</span>
                <span className="text-[9px] font-mono text-emerald-400 font-semibold">PostgreSQL ACID</span>
              </div>
              <div className="p-2.5 mb-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-200">{operadorAtivo.nome}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    operadorAtivo.role === 'ADMINISTRADOR'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {operadorAtivo.role}
                  </span>
                </div>
                <p className="text-[11px] text-amber-400">{operadorAtivo.cargo}</p>
                {operadorAtivo.email && (
                  <p className="text-[10px] text-slate-400 truncate mt-1">{operadorAtivo.email}</p>
                )}
              </div>

              <button
                id="btn-logout-navbar"
                onClick={() => {
                  setShowOperadorDropdown(false);
                  logout();
                }}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Encerrar Sessão (Sair)</span>
              </button>
            </div>
          )}
        </div>

        {/* Botão Tela Cheia */}
        <button
          id="btn-fullscreen-toggle"
          onClick={toggleFullscreen}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors hidden md:block cursor-pointer"
          title="Modo Tela Cheia (Ideal para Balcão Touch)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
