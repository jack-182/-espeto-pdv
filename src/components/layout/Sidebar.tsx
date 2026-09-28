import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  ShoppingBag, 
  Wallet, 
  CheckCircle2, 
  Package, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Building2,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  Radio,
  ShieldCheck,
  Users
} from 'lucide-react';
import { ModuloNavegacao, TurnoCaixa, Empresa, Operador } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { usePermissions } from '../../hooks/usePermissions';
import { AdminOnly } from '../auth/AdminOnly';
import { AdminAuthModal } from '../auth/AdminAuthModal';

interface SidebarProps {
  moduloAtivo: ModuloNavegacao;
  onSelectModulo: (modulo: ModuloNavegacao) => void;
  empresaAtiva?: Empresa | null;
  turnoAtual: TurnoCaixa | null;
  operadorAtivo?: Operador;
  onToggleCargoRapido?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSangriaModal: () => void;
  onOpenSuprimentoModal: () => void;
  saldoDinheiroEmGaveta: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  moduloAtivo,
  onSelectModulo,
  empresaAtiva,
  turnoAtual,
  operadorAtivo: propOperadorAtivo,
  onToggleCargoRapido,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenSangriaModal,
  onOpenSuprimentoModal,
  saldoDinheiroEmGaveta
}) => {
  const { user: authUser, isAdmin } = usePermissions();
  const operadorAtivo = propOperadorAtivo || authUser || {
    id: 'op-1',
    nome: 'Operador',
    cargo: 'Operador',
    role: 'OPERADOR' as const,
    active: true
  };
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const operacionaisMenuItems = [
    {
      id: 'COMANDAS' as ModuloNavegacao,
      label: 'Comandas & Mesas',
      icon: Receipt,
      shortcut: 'F2',
      badge: '3 Abertas'
    },
    {
      id: 'PDV_RAPIDO' as ModuloNavegacao,
      label: 'Frente de Caixa (PDV)',
      icon: ShoppingBag,
      shortcut: 'F3',
      badge: undefined
    },
    {
      id: 'CAIXA_TURNO' as ModuloNavegacao,
      label: 'Caixa & Turno',
      icon: Wallet,
      shortcut: 'F4',
      badge: turnoAtual?.status === 'ABERTO' ? 'Ativo' : 'Fechado'
    }
  ];

  const adminMenuItems = [
    {
      id: 'DASHBOARD' as ModuloNavegacao,
      label: 'Visão Geral',
      icon: LayoutDashboard,
      shortcut: 'F1',
      badge: undefined
    },
    {
      id: 'PAINEL_ADMIN' as ModuloNavegacao,
      label: 'Painel MultiGestão',
      icon: Radio,
      shortcut: 'F5',
      badge: 'Ao Vivo'
    },
    {
      id: 'USUARIOS_CONVITES' as ModuloNavegacao,
      label: 'Usuários / Funcionários',
      icon: Users,
      shortcut: 'F6',
      badge: 'Novo'
    },
    {
      id: 'FECHAMENTO' as ModuloNavegacao,
      label: 'Fechamento Expediente',
      icon: CheckCircle2,
      shortcut: 'F8',
      badge: undefined
    },
    {
      id: 'PRODUTOS' as ModuloNavegacao,
      label: 'Produtos & Estoque',
      icon: Package,
      shortcut: 'F9',
      badge: undefined
    },
    {
      id: 'CONFIGURACOES' as ModuloNavegacao,
      label: 'Configurações',
      icon: Settings,
      shortcut: 'F10',
      badge: undefined
    }
  ];

  const handleNavClick = (id: ModuloNavegacao) => {
    onSelectModulo(id);
    onCloseMobile();
  };

  const handleSolicitarSangria = () => {
    setIsAuthModalOpen(true);
  };

  const isCaixaAberto = turnoAtual?.status === 'ABERTO';

  return (
    <>
      {/* Backdrop para mobile */}
      {mobileOpen && (
        <div 
          id="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Container da Sidebar */}
      <aside
        id="main-sidebar"
        className={`
          fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800
          transition-all duration-300 ease-in-out select-none
          ${collapsed ? 'w-20' : 'w-72'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Topo: Logo e Nome da Loja */}
        <div className="h-18 flex items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 font-bold shadow-lg shadow-orange-950/30 shrink-0">
              <Building2 className="w-5 h-5 text-slate-950" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-slate-100 tracking-tight leading-tight truncate">
                  {empresaAtiva?.nomeFantasia || 'Carregando Unidade...'}
                </span>
              </div>
            )}
          </div>

          <button
            id="btn-collapse-sidebar"
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Card de Status do Caixa Ativo */}
        {!collapsed ? (
          <div className="p-3.5 mx-3 mt-3 rounded-xl bg-slate-950/70 border border-slate-800/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${isCaixaAberto ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-xs font-semibold text-slate-200">
                  {isCaixaAberto ? `Caixa Aberto (Turno ${turnoAtual?.numeroTurno})` : 'Caixa Fechado'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {operadorAtivo.cargo.split(' ')[0]}
              </span>
            </div>

            {isCaixaAberto && (
              <>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[11px] text-slate-400">Gaveta (Dinheiro):</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {formatCurrency(saldoDinheiroEmGaveta)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
                  <button
                    id="btn-sangria-sidebar"
                    onClick={handleSolicitarSangria}
                    className="flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <ArrowDownCircle className="w-3 h-3 text-rose-400" />
                    Sangria
                  </button>
                  <button
                    id="btn-suprimento-sidebar"
                    onClick={onOpenSuprimentoModal}
                    className="flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <ArrowUpCircle className="w-3 h-3 text-emerald-400" />
                    Suprimento
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-3 flex justify-center border-b border-slate-800">
            <span 
              className={`w-3 h-3 rounded-full ${isCaixaAberto ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-rose-500'}`} 
              title={isCaixaAberto ? 'Caixa Aberto' : 'Caixa Fechado'} 
            />
          </div>
        )}

        {/* Itens de Navegação */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Módulos Operacionais (Acessíveis a Operadores e Administradores) */}
          <div className="space-y-1">
            {operacionaisMenuItems.map((item) => {
              const Icon = item.icon;
              const isSelected = moduloAtivo === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-${item.id.toLowerCase()}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group
                    ${isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/80'
                    }
                    ${collapsed ? 'justify-center px-0' : 'justify-between'}
                  `}
                  title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!collapsed && (
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected 
                            ? 'bg-slate-950/20 text-slate-950' 
                            : 'bg-slate-800 text-amber-400 border border-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected 
                          ? 'bg-slate-950/20 text-slate-950' 
                          : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                      }`}>
                        {item.shortcut}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Módulos de Alçada Exclusiva do Administrador */}
          <AdminOnly>
            <div className="pt-2 mt-2 border-t border-slate-800/60 space-y-1">
              {!collapsed && (
                <div className="px-3 py-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    Gerência & Gestão
                  </span>
                </div>
              )}

              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const isSelected = moduloAtivo === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id.toLowerCase()}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group
                      ${isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/80'
                      }
                      ${collapsed ? 'justify-center px-0' : 'justify-between'}
                    `}
                    title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && (
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected 
                              ? 'bg-slate-950/20 text-slate-950' 
                              : 'bg-slate-800 text-amber-400 border border-slate-700'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected 
                            ? 'bg-slate-950/20 text-slate-950' 
                            : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                        }`}>
                          {item.shortcut}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </AdminOnly>
        </nav>

        {/* Rodapé do Operador e Alternador Rápido de Permissões */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70">
          {!collapsed ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs shadow-amber-500/20">
                    {(operadorAtivo?.nome || 'OP').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-200 truncate leading-tight">
                      {operadorAtivo?.nome || 'Operador'}
                    </p>
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      {isAdmin ? 'ADMINISTRADOR' : 'OPERADOR'}
                    </p>
                  </div>
                </div>

                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sessão Segura Online" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0"
                title={`Operador: ${operadorAtivo?.nome || 'Operador'} (${isAdmin ? 'ADMIN' : 'OPERADOR'})`}
              >
                {(operadorAtivo?.nome || 'OP').substring(0, 2).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modal Touch de Autorização de Administrador */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          onOpenSangriaModal();
        }}
        actionName="Autorizar Sangria de Caixa"
      />
    </>
  );
};
