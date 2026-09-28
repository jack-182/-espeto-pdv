/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ModuloNavegacao, 
  Empresa, 
  Operador, 
  TurnoCaixa, 
  Comanda, 
  MovimentacaoCaixa, 
  Produto, 
  MetodoPagamento 
} from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { ComandasView } from './components/comandas/ComandasView';
import { QuickPosView } from './components/pos/QuickPosView';
import { CaixaTurnoView } from './components/caixa/CaixaTurnoView';
import { FechamentoExpedienteView } from './components/fechamento/FechamentoExpedienteView';
import { PainelAdministrador } from './components/admin/PainelAdministrador';
import { ProdutosView } from './components/produtos/ProdutosView';
import { ConfiguracoesView } from './components/configuracoes/ConfiguracoesView';
import { NovaComandaModal } from './components/modals/NovaComandaModal';
import { SangriaSuprimentoModal } from './components/modals/SangriaSuprimentoModal';
import { AberturaCaixaModal } from './components/modals/AberturaCaixaModal';
import { RecebimentoModal } from './components/modals/RecebimentoModal';
import { getSocket, emitirVendaRealtime, EventoVendaRealtime } from './services/socket';
import { api } from './services/api';
import { Radio, X, Store, CheckCircle } from 'lucide-react';
import { formatCurrency } from './utils/formatters';
import { AuthProvider, usePermissions } from './hooks/usePermissions';
import { AdminOnly, AccessDeniedFallback } from './components/auth/AdminOnly';
import { AdminAuthModal } from './components/auth/AdminAuthModal';
import { LoginView } from './components/auth/LoginView';
import { AceitarConviteModal } from './components/auth/AceitarConviteModal';

const defaultUnidadePlaceholder: Empresa = {
  id: 'emp-1',
  nomeFantasia: 'Carregando Unidade...',
  razaoSocial: 'Gestão Inteligente',
  cnpj: '00.000.000/0000-00',
  segmento: 'ESPETINHO',
  endereco: '',
  telefone: '',
  taxaServicoPadrao: 0,
  bloqueioLimiteComanda: 600
};

function AppContent() {
  // Permissões e Autenticação Global
  const { user: operadorAtivo, isAdmin, isAuthenticated, isLoading } = usePermissions();

  // Estados de navegação e layout
  const [moduloAtivo, setModuloAtivo] = useState<ModuloNavegacao>('DASHBOARD');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [termoBuscaGlobal, setTermoBuscaGlobal] = useState('');

  // Estados de Negócio (Multi-Empresa sincronizados em tempo real via PostgreSQL)
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaAtiva, setEmpresaAtiva] = useState<Empresa>(defaultUnidadePlaceholder);

  // Armazenamento individual e segregado por empresa
  const [produtosPorLoja, setProdutosPorLoja] = useState<Record<string, Produto[]>>({});
  const [comandasPorLoja, setComandasPorLoja] = useState<Record<string, Comanda[]>>({});
  const [turnosPorLoja, setTurnosPorLoja] = useState<Record<string, TurnoCaixa | null>>({});
  const [movimentacoesPorLoja, setMovimentacoesPorLoja] = useState<Record<string, MovimentacaoCaixa[]>>({});

  const lojaAtivaId = empresaAtiva?.id || 'emp-1';

  // Dados da loja selecionada no momento (Reatividade Imediata)
  const produtos = produtosPorLoja[lojaAtivaId] || [];
  const comandas = comandasPorLoja[lojaAtivaId] || [];
  const turnoAtual = turnosPorLoja[lojaAtivaId] || null;
  const movimentacoes = movimentacoesPorLoja[lojaAtivaId] || [];

  // Funções de mutação de estado escopadas por empresa
  const setProdutos = (updater: Produto[] | ((prev: Produto[]) => Produto[])) => {
    setProdutosPorLoja(prev => {
      const atual = prev[lojaAtivaId] || [];
      const proximo = typeof updater === 'function' ? updater(atual) : updater;
      return { ...prev, [lojaAtivaId]: proximo };
    });
  };

  const setComandas = (updater: Comanda[] | ((prev: Comanda[]) => Comanda[])) => {
    setComandasPorLoja(prev => {
      const atual = prev[lojaAtivaId] || [];
      const proximo = typeof updater === 'function' ? updater(atual) : updater;
      return { ...prev, [lojaAtivaId]: proximo };
    });
  };

  const setTurnoAtual = (novoTurno: TurnoCaixa | null | ((prev: TurnoCaixa | null) => TurnoCaixa | null)) => {
    setTurnosPorLoja(prev => {
      const atual = prev[lojaAtivaId] || null;
      const proximo = typeof novoTurno === 'function' ? novoTurno(atual) : novoTurno;
      return { ...prev, [lojaAtivaId]: proximo };
    });
  };

  const setMovimentacoes = (updater: MovimentacaoCaixa[] | ((prev: MovimentacaoCaixa[]) => MovimentacaoCaixa[])) => {
    setMovimentacoesPorLoja(prev => {
      const atual = prev[lojaAtivaId] || [];
      const proximo = typeof updater === 'function' ? updater(atual) : updater;
      return { ...prev, [lojaAtivaId]: proximo };
    });
  };

  // Estados de Real-Time (WebSocket Socket.IO)
  const [socketConnected, setSocketConnected] = useState(false);
  const [vendasRealtimeFeed, setVendasRealtimeFeed] = useState<EventoVendaRealtime[]>([]);
  const [notificacaoVendaRecente, setNotificacaoVendaRecente] = useState<EventoVendaRealtime | null>(null);

  // Convite de Operador recebido via link/URL
  const [conviteToken, setConviteToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('convite');
    }
    return null;
  });

  useEffect(() => {
    const s = getSocket();

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    
    const handleNovaVenda = (dados: EventoVendaRealtime) => {
      setVendasRealtimeFeed(prev => [dados, ...prev.slice(0, 29)]);
      setNotificacaoVendaRecente(dados);
      // Auto-remover notificação flutuante após 5 segundos
      setTimeout(() => {
        setNotificacaoVendaRecente(current => current === dados ? null : current);
      }, 5000);
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('nova_venda_realizada', handleNovaVenda);

    if (s.connected) {
      setSocketConnected(true);
    }

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('nova_venda_realizada', handleNovaVenda);
    };
  }, []);

  // Sincronização inicial com o banco PostgreSQL via API corporativa
  useEffect(() => {
    async function carregarLojasDoBanco() {
      try {
        const res = await api.getStores();
        if (res.sucesso && res.data && res.data.length > 0) {
          const lojasMapeadas: Empresa[] = res.data.map((l: any) => ({
            id: l.id,
            nomeFantasia: l.nomeFantasia,
            razaoSocial: l.razaoSocial,
            cnpj: l.cnpj,
            segmento: l.segmento,
            endereco: l.endereco,
            telefone: l.telefone,
            taxaServicoPadrao: l.taxaServicoPadrao,
            bloqueioLimiteComanda: l.bloqueioLimiteComanda
          }));
          setEmpresas(lojasMapeadas);
          if (!lojasMapeadas.find(l => l.id === empresaAtiva?.id)) {
            setEmpresaAtiva(lojasMapeadas[0]);
          }
        }
      } catch (err) {
        console.warn('[Sync] Fallback para catálogo inicial:', err);
      }
    }
    if (operadorAtivo) {
      carregarLojasDoBanco();
    }
  }, [operadorAtivo?.id]);

  // Carrega produtos da unidade ativa direto do PostgreSQL
  useEffect(() => {
    async function carregarProdutosDoBanco() {
      try {
        const res = await api.getProductsByStore(lojaAtivaId);
        if (res.sucesso && res.data) {
          setProdutosPorLoja(prev => ({
            ...prev,
            [lojaAtivaId]: res.data
          }));
        }
      } catch (err) {
        console.warn('[Sync] Fallback produtos:', err);
      }
    }
    if (operadorAtivo) {
      carregarProdutosDoBanco();
    }
  }, [lojaAtivaId, operadorAtivo?.id]);

  // Alinha a loja ativa com a loja vinculada ao operador autenticado
  useEffect(() => {
    if (operadorAtivo?.lojaId) {
      const lojaUsuario = empresas.find(e => e.id === operadorAtivo.lojaId);
      if (lojaUsuario) {
        setEmpresaAtiva(lojaUsuario);
      }
    }
  }, [operadorAtivo?.lojaId, empresas]);

  const [isGlobalAdminAuthOpen, setIsGlobalAdminAuthOpen] = useState(false);

  // Redireciona automaticamente caso o operador logado não tenha permissão para a tela atual
  useEffect(() => {
    if (!isAdmin && ['DASHBOARD', 'PAINEL_ADMIN', 'FECHAMENTO', 'PRODUTOS', 'CONFIGURACOES'].includes(moduloAtivo)) {
      setModuloAtivo('PDV_RAPIDO');
    }
  }, [isAdmin, moduloAtivo]);

  // Modais
  const [isNovaComandaOpen, setIsNovaComandaOpen] = useState(false);
  const [sangriaModalConfig, setSangriaModalConfig] = useState<{ isOpen: boolean; tipo: 'SANGRIA' | 'SUPRIMENTO' }>({
    isOpen: false,
    tipo: 'SANGRIA'
  });
  const [isAberturaCaixaOpen, setIsAberturaCaixaOpen] = useState(false);
  const [comandaEmRecebimento, setComandaEmRecebimento] = useState<Comanda | null>(null);

  // Atalhos de teclado para o balcão
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o foco estiver em um input de texto
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        if (isAdmin) setModuloAtivo('DASHBOARD');
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (isAdmin) setModuloAtivo('PAINEL_ADMIN');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setIsNovaComandaOpen(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setModuloAtivo('PDV_RAPIDO');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setModuloAtivo('CAIXA_TURNO');
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (isAdmin) setModuloAtivo('FECHAMENTO');
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (isAdmin) setModuloAtivo('PRODUTOS');
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (isAdmin) setModuloAtivo('CONFIGURACOES');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Cálculo de dinheiro em gaveta em tempo real
  const fundoTroco = turnoAtual?.saldoInicialSuprimento || 0;
  const vendasDinheiro = movimentacoes
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'DINHEIRO')
    .reduce((acc, m) => acc + m.valor, 0);

  const suprimentosDinheiro = movimentacoes
    .filter(m => m.tipo === 'SUPRIMENTO')
    .reduce((acc, m) => acc + m.valor, 0);

  const sangriasDinheiro = movimentacoes
    .filter(m => m.tipo === 'SANGRIA')
    .reduce((acc, m) => acc + m.valor, 0);

  const saldoDinheiroEmGaveta = fundoTroco + vendasDinheiro + suprimentosDinheiro - sangriasDinheiro;

  // Lógica de Comandas
  const handleCriarComanda = (
    numero: number, 
    clienteNome: string, 
    tipo: 'MESA' | 'COMANDA_CARTAO' | 'BALCAO_RAPIDO'
  ) => {
    const nova: Comanda = {
      id: `cmd-${Date.now()}`,
      numero,
      tipo,
      clienteNome,
      status: 'ABERTA',
      itens: [],
      abertaEm: new Date().toISOString(),
      abertaPor: operadorAtivo.nome,
      totalBruto: 0,
      desconto: 0,
      taxaServico: 0,
      totalLiquido: 0,
      pago: false
    };

    setComandas(prev => [nova, ...prev]);
    setModuloAtivo('COMANDAS');
  };

  const handleAdicionarItemComanda = (comandaId: string, produto: Produto, quantidade: number = 1) => {
    setComandas(prev => prev.map(cmd => {
      if (cmd.id !== comandaId) return cmd;

      const itemExistenteIndex = cmd.itens.findIndex(i => i.produtoId === produto.id);
      let novosItens = [...cmd.itens];

      if (itemExistenteIndex >= 0) {
        const item = novosItens[itemExistenteIndex];
        const novaQtd = item.quantidade + quantidade;
        novosItens[itemExistenteIndex] = {
          ...item,
          quantidade: novaQtd,
          subtotal: novaQtd * item.precoUnitario
        };
      } else {
        novosItens.push({
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          produtoId: produto.id,
          nomeProduto: produto.nome,
          quantidade,
          precoUnitario: produto.precoVenda,
          subtotal: quantidade * produto.precoVenda,
          adicionadoEm: new Date().toISOString(),
          adicionadoPor: operadorAtivo.nome
        });
      }

      const totalBruto = novosItens.reduce((acc, i) => acc + i.subtotal, 0);
      const taxaServico = empresaAtiva.taxaServicoPadrao > 0 
        ? Number(((totalBruto * empresaAtiva.taxaServicoPadrao) / 100).toFixed(2)) 
        : 0;
      const totalLiquido = totalBruto + taxaServico - cmd.desconto;

      return {
        ...cmd,
        itens: novosItens,
        totalBruto,
        taxaServico,
        totalLiquido
      };
    }));
  };

  const handleRemoverItemComanda = (comandaId: string, itemId: string) => {
    setComandas(prev => prev.map(cmd => {
      if (cmd.id !== comandaId) return cmd;

      const novosItens = cmd.itens.filter(i => i.id !== itemId);
      const totalBruto = novosItens.reduce((acc, i) => acc + i.subtotal, 0);
      const taxaServico = empresaAtiva.taxaServicoPadrao > 0 
        ? Number(((totalBruto * empresaAtiva.taxaServicoPadrao) / 100).toFixed(2)) 
        : 0;
      const totalLiquido = totalBruto + taxaServico - cmd.desconto;

      return {
        ...cmd,
        itens: novosItens,
        totalBruto,
        taxaServico,
        totalLiquido
      };
    }));
  };

  const handleAlterarQuantidadeItem = (comandaId: string, itemId: string, delta: number) => {
    setComandas(prev => prev.map(cmd => {
      if (cmd.id !== comandaId) return cmd;

      const novosItens = cmd.itens.map(i => {
        if (i.id === itemId) {
          const novaQtd = i.quantidade + delta;
          if (novaQtd <= 0) return null;
          return {
            ...i,
            quantidade: novaQtd,
            subtotal: novaQtd * i.precoUnitario
          };
        }
        return i;
      }).filter(Boolean) as any[];

      const totalBruto = novosItens.reduce((acc, i) => acc + i.subtotal, 0);
      const taxaServico = empresaAtiva.taxaServicoPadrao > 0 
        ? Number(((totalBruto * empresaAtiva.taxaServicoPadrao) / 100).toFixed(2)) 
        : 0;
      const totalLiquido = totalBruto + taxaServico - cmd.desconto;

      return {
        ...cmd,
        itens: novosItens,
        totalBruto,
        taxaServico,
        totalLiquido
      };
    }));
  };

  // Recebimento de Comanda
  const handleConfirmarPagamentoComanda = (
    comandaId: string, 
    metodo: MetodoPagamento, 
    valorRecebido: number, 
    troco: number, 
    desconto: number
  ) => {
    const cmd = comandas.find(c => c.id === comandaId);
    if (!cmd) return;

    const valorFinal = cmd.totalLiquido - desconto;

    // Atualiza status da comanda para Paga
    setComandas(prev => prev.map(c => {
      if (c.id === comandaId) {
        return {
          ...c,
          status: 'PAGA',
          desconto,
          totalLiquido: valorFinal,
          fechadaEm: new Date().toISOString(),
          pago: true
        };
      }
      return c;
    }));

    // Registra movimentação no caixa
    const novaMov: MovimentacaoCaixa = {
      id: `mov-${Date.now()}`,
      turnoId: turnoAtual?.id || 'turno-1',
      tipo: 'VENDA',
      descricao: `Recebimento Comanda #${cmd.numero} (${cmd.clienteNome || 'Balcão'})`,
      valor: valorFinal,
      metodoPagamento: metodo,
      operadorId: operadorAtivo?.id || 'op-padrao',
      operadorNome: operadorAtivo?.nome || 'Operador',
      comandaId: cmd.id,
      comandaNumero: cmd.numero,
      timestamp: new Date().toISOString()
    };

    setMovimentacoes(prev => [novaMov, ...prev]);

    // Emissão em tempo real via WebSocket (Socket.IO)
    emitirVendaRealtime({
      lojaId: lojaAtivaId,
      formaPagamento: metodo === 'DINHEIRO' ? 'Dinheiro' : metodo === 'PIX' ? 'Pix' : 'Cartao',
      valor: valorFinal,
      item: `Comanda #${cmd.numero} (${(cmd.itens || []).length} itens)`
    });
  };

  // Venda Direta / PDV Balcão
  const handleFinalizarVendaDireta = (
    itens: { produto: Produto; quantidade: number }[],
    metodo: MetodoPagamento,
    valorRecebido: number,
    troco: number
  ) => {
    const safeItens = itens || [];
    const total = safeItens.reduce((acc, item) => acc + (item.produto.precoVenda * item.quantidade), 0);

    // Registra movimentação de venda direta localmente para fluidez de UI
    const novaMov: MovimentacaoCaixa = {
      id: `mov-${Date.now()}`,
      turnoId: turnoAtual?.id || 'turno-1',
      tipo: 'VENDA',
      descricao: `Venda Direta Balcão (${safeItens.length} itens)`,
      valor: total,
      metodoPagamento: metodo,
      operadorId: operadorAtivo?.id || 'op-padrao',
      operadorNome: operadorAtivo?.nome || 'Operador',
      timestamp: new Date().toISOString()
    };

    setMovimentacoes(prev => [novaMov, ...prev]);

    // Transação corporativa no PostgreSQL com idempotência e concorrência
    const formaPgtoApi = metodo === 'DINHEIRO' ? 'DINHEIRO' : metodo === 'PIX' ? 'PIX' : 'CARTAO_DEBITO';
    api.processSale({
      lojaId: empresaAtiva.id,
      formaPagamento: formaPgtoApi,
      valor: total,
      itens: itens.map(i => ({
        productId: i.produto.id,
        quantity: i.quantidade,
        unitPrice: i.produto.precoVenda
      }))
    }).catch(err => {
      console.warn('[Venda] Erro transacional no PostgreSQL:', err.message);
    });
  };

  // Sangria e Suprimento
  const handleConfirmarSangriaOuSuprimento = (
    tipo: 'SANGRIA' | 'SUPRIMENTO',
    valor: number,
    motivo: string
  ) => {
    const novaMov: MovimentacaoCaixa = {
      id: `mov-${Date.now()}`,
      turnoId: turnoAtual?.id || 'turno-1',
      tipo,
      descricao: `${tipo === 'SANGRIA' ? 'Sangria de Segurança' : 'Suprimento de Troco'} - ${motivo}`,
      valor,
      metodoPagamento: 'DINHEIRO',
      operadorId: operadorAtivo?.id || 'op-padrao',
      operadorNome: operadorAtivo?.nome || 'Operador',
      motivo,
      timestamp: new Date().toISOString()
    };

    setMovimentacoes(prev => [novaMov, ...prev]);

    if (turnoAtual?.id) {
      api.addCashMovement(lojaAtivaId, turnoAtual.id, tipo, valor, motivo)
        .catch(err => console.warn('[Caixa] Movimentação registrada:', err.message));
    }
  };

  // Abertura de Caixa
  const handleConfirmarAberturaCaixa = (fundoTroco: number) => {
    const novoTurno: TurnoCaixa = {
      id: `turno-${Date.now()}`,
      empresaId: lojaAtivaId,
      numeroTurno: (turnoAtual?.numeroTurno || 0) + 1,
      operadorAberturaId: operadorAtivo?.id || 'op-padrao',
      operadorAberturaNome: operadorAtivo?.nome || 'Operador',
      dataHoraAbertura: new Date().toISOString(),
      saldoInicialSuprimento: fundoTroco,
      status: 'ABERTO',
      totalSangrias: 0,
      totalSuprimentos: fundoTroco
    };

    const movAbertura: MovimentacaoCaixa = {
      id: `mov-${Date.now()}`,
      turnoId: novoTurno.id,
      tipo: 'ABERTURA',
      descricao: `Abertura de Caixa - Turno #${novoTurno.numeroTurno}`,
      valor: fundoTroco,
      metodoPagamento: 'DINHEIRO',
      operadorId: operadorAtivo?.id || 'op-padrao',
      operadorNome: operadorAtivo?.nome || 'Operador',
      timestamp: new Date().toISOString()
    };

    setTurnoAtual(novoTurno);
    setMovimentacoes([movAbertura]);
  };

  // Fechamento de Turno / Expediente
  const handleConcluirFechamento = (
    valoresDeclarados: Record<MetodoPagamento, number>,
    diferenca: number,
    observacao: string
  ) => {
    if (!turnoAtual) return;

    setTurnoAtual({
      ...turnoAtual,
      status: 'FECHADO',
      operadorFechamentoId: operadorAtivo?.id || 'op-padrao',
      operadorFechamentoNome: operadorAtivo?.nome || 'Operador',
      dataHoraFechamento: new Date().toISOString(),
      valoresDeclarados,
      diferencaTotal: diferenca,
      observacoesFechamento: observacao
    });
  };

  // Produtos
  const handleAtualizarEstoque = (produtoId: string, novoEstoque: number) => {
    setProdutos(prev => prev.map(p => p.id === produtoId ? { ...p, estoqueAtual: novoEstoque } : p));
  };

  const handleAtualizarPreco = (produtoId: string, novoPreco: number) => {
    setProdutos(prev => prev.map(p => p.id === produtoId ? { ...p, precoVenda: novoPreco } : p));
  };

  const handleAdicionarProduto = (produtoData: Omit<Produto, 'id'>) => {
    const novoProduto: Produto = {
      ...produtoData,
      id: `prod-${Date.now()}`
    };
    setProdutos(prev => [novoProduto, ...prev]);
  };

  const proximoNumeroComanda = ((comandas || []).reduce((max, c) => c.numero > max ? c.numero : max, 0)) + 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <Store className="w-7 h-7 text-amber-400 animate-pulse" />
        </div>
        <p className="text-sm font-bold tracking-wide text-slate-200 font-mono">Validando sessão...</p>
        <p className="text-xs text-slate-500 font-mono mt-1">Conectando ao PostgreSQL seguro • ACID</p>
      </div>
    );
  }

  if (!isAuthenticated || !operadorAtivo) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* Barra Lateral (Sidebar) */}
      <Sidebar
        moduloAtivo={moduloAtivo}
        onSelectModulo={setModuloAtivo}
        empresaAtiva={empresaAtiva}
        turnoAtual={turnoAtual}
        operadorAtivo={operadorAtivo}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenSangriaModal={() => setSangriaModalConfig({ isOpen: true, tipo: 'SANGRIA' })}
        onOpenSuprimentoModal={() => setSangriaModalConfig({ isOpen: true, tipo: 'SUPRIMENTO' })}
        saldoDinheiroEmGaveta={saldoDinheiroEmGaveta}
      />

      {/* Área Principal de Conteúdo */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        {/* Barra Superior (Navbar) */}
        <Navbar
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          empresaAtiva={empresaAtiva}
          todasEmpresas={empresas}
          onTrocarEmpresa={setEmpresaAtiva}
          turnoAtual={turnoAtual}
          operadorAtivo={operadorAtivo}
          onOpenNovaComandaModal={() => setIsNovaComandaOpen(true)}
          onOpenQuickPos={() => setModuloAtivo('PDV_RAPIDO')}
          termoBusca={termoBuscaGlobal}
          onSetTermoBusca={setTermoBuscaGlobal}
          onOpenAberturaCaixa={() => setIsAberturaCaixaOpen(true)}
          saldoDinheiroEmGaveta={saldoDinheiroEmGaveta}
          socketConnected={socketConnected}
        />

        {/* Notificação Flutuante de Venda Realtime (Socket.IO) */}
        {notificacaoVendaRecente && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3 p-3.5 bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl shadow-emerald-950/50 text-slate-100 max-w-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Nova Venda Realizada
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {notificacaoVendaRecente.horario}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate">
                  {notificacaoVendaRecente.loja} • {formatCurrency(notificacaoVendaRecente.valor)}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {notificacaoVendaRecente.item} ({notificacaoVendaRecente.formaPagamento})
                </p>
              </div>
              <button
                onClick={() => setNotificacaoVendaRecente(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Renderizado por Módulo com Controle de Permissões */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Bloqueio de Acesso para Telas Exclusivas de Administrador */}
          {!isAdmin && ['DASHBOARD', 'PAINEL_ADMIN', 'USUARIOS_CONVITES', 'FECHAMENTO', 'PRODUTOS', 'CONFIGURACOES'].includes(moduloAtivo) ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center max-w-md mx-auto my-12 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4">
                <span className="font-bold text-xl">🔒</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Acesso Restrito ao Administrador</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                O operador <strong className="text-slate-200">{operadorAtivo.nome}</strong> possui perfil de caixa e não tem permissão para visualizar este módulo gerencial.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => setModuloAtivo('PDV_RAPIDO')}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Ir para Frente de Caixa (PDV)
                </button>
                <button
                  onClick={() => setIsGlobalAdminAuthOpen(true)}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Solicitar PIN de Supervisor
                </button>
              </div>
            </div>
          ) : (
            <>
              {moduloAtivo === 'DASHBOARD' && (
                <AdminOnly
                  user={operadorAtivo}
                  fallback={
                    <AccessDeniedFallback
                      title="Painel de Resultados Restrito"
                      description="A visualização dos indicadores gerenciais, faturamento global e fluxo financeiro é restrita a Administradores."
                      onBackToAllowed={() => setModuloAtivo('PDV_RAPIDO')}
                      onRequestAdminAuth={() => setIsGlobalAdminAuthOpen(true)}
                    />
                  }
                >
                  <DashboardView
                    turnoAtual={turnoAtual}
                    comandas={comandas}
                    movimentacoes={movimentacoes}
                    empresaAtiva={empresaAtiva}
                    todasEmpresas={empresas}
                    onTrocarEmpresa={setEmpresaAtiva}
                    onNavigate={setModuloAtivo}
                    onOpenNovaComanda={() => setIsNovaComandaOpen(true)}
                    onOpenQuickPos={() => setModuloAtivo('PDV_RAPIDO')}
                    onOpenSangria={() => setSangriaModalConfig({ isOpen: true, tipo: 'SANGRIA' })}
                    vendasRealtimeFeed={vendasRealtimeFeed}
                    socketConnected={socketConnected}
                  />
                </AdminOnly>
              )}

              {moduloAtivo === 'PAINEL_ADMIN' && (
                <AdminOnly
                  user={operadorAtivo}
                  fallback={
                    <AccessDeniedFallback
                      title="Painel MultiGestão Restrito"
                      description="A gestão consolidada das unidades e faturamento ao vivo é restrita a Administradores."
                      onBackToAllowed={() => setModuloAtivo('PDV_RAPIDO')}
                      onRequestAdminAuth={() => setIsGlobalAdminAuthOpen(true)}
                    />
                  }
                >
                  <PainelAdministrador
                    empresaAtiva={empresaAtiva}
                    todasEmpresas={empresas}
                    movimentacoes={movimentacoes}
                    onTrocarEmpresa={setEmpresaAtiva}
                    abaInicial="METRICAS"
                  />
                </AdminOnly>
              )}

              {moduloAtivo === 'USUARIOS_CONVITES' && (
                <AdminOnly
                  user={operadorAtivo}
                  fallback={
                    <AccessDeniedFallback
                      title="Gestão de Funcionários Restrita"
                      description="Apenas usuários com perfil Administrador podem cadastrar, ativar, desativar ou vincular funcionários às lojas."
                      onBackToAllowed={() => setModuloAtivo('PDV_RAPIDO')}
                      onRequestAdminAuth={() => setIsGlobalAdminAuthOpen(true)}
                    />
                  }
                >
                  <PainelAdministrador
                    empresaAtiva={empresaAtiva}
                    todasEmpresas={empresas}
                    movimentacoes={movimentacoes}
                    onTrocarEmpresa={setEmpresaAtiva}
                    abaInicial="FUNCIONARIOS"
                  />
                </AdminOnly>
              )}

              {moduloAtivo === 'COMANDAS' && (
                <ComandasView
                  comandas={comandas}
                  produtos={produtos}
                  operadorAtivo={operadorAtivo}
                  onAdicionarItemComanda={handleAdicionarItemComanda}
                  onRemoverItemComanda={handleRemoverItemComanda}
                  onAlterarQuantidadeItem={handleAlterarQuantidadeItem}
                  onOpenNovaComanda={() => setIsNovaComandaOpen(true)}
                  onOpenRecebimentoComanda={(cmd) => setComandaEmRecebimento(cmd)}
                  termoBuscaGlobal={termoBuscaGlobal}
                />
              )}

              {moduloAtivo === 'PDV_RAPIDO' && (
                <QuickPosView
                  produtos={produtos}
                  operadorAtivo={operadorAtivo}
                  onFinalizarVendaDireta={handleFinalizarVendaDireta}
                />
              )}

              {moduloAtivo === 'CAIXA_TURNO' && (
                <CaixaTurnoView
                  turnoAtual={turnoAtual}
                  movimentacoes={movimentacoes}
                  operadorAtivo={operadorAtivo}
                  onOpenSangria={() => setSangriaModalConfig({ isOpen: true, tipo: 'SANGRIA' })}
                  onOpenSuprimento={() => setSangriaModalConfig({ isOpen: true, tipo: 'SUPRIMENTO' })}
                  onOpenFechamento={() => setModuloAtivo('FECHAMENTO')}
                  onOpenAberturaCaixa={() => setIsAberturaCaixaOpen(true)}
                />
              )}

              {moduloAtivo === 'FECHAMENTO' && (
                <AdminOnly
                  user={operadorAtivo}
                  fallback={
                    <AccessDeniedFallback
                      title="Fechamento de Caixa Restrito"
                      description="O encerramento do expediente e conciliação de caixa exige a alçada de Administrador."
                      onBackToAllowed={() => setModuloAtivo('PDV_RAPIDO')}
                      onRequestAdminAuth={() => setIsGlobalAdminAuthOpen(true)}
                    />
                  }
                >
                  <FechamentoExpedienteView
                    turnoAtual={turnoAtual}
                    movimentacoes={movimentacoes}
                    operadorAtivo={operadorAtivo}
                    onConcluirFechamento={handleConcluirFechamento}
                    onReabrirOuNovoTurno={() => setIsAberturaCaixaOpen(true)}
                  />
                </AdminOnly>
              )}

              {moduloAtivo === 'PRODUTOS' && (
                <AdminOnly
                  user={operadorAtivo}
                  fallback={
                    <AccessDeniedFallback
                      title="Controle de Estoque e Preços Restrito"
                      description="O reajuste de preços de venda e entrada de mercadorias no estoque é de alçada do Administrador."
                      onBackToAllowed={() => setModuloAtivo('PDV_RAPIDO')}
                      onRequestAdminAuth={() => setIsGlobalAdminAuthOpen(true)}
                    />
                  }
                >
                  <ProdutosView
                    produtos={produtos}
                    empresaAtiva={empresaAtiva}
                    todasEmpresas={empresas}
                    onTrocarEmpresa={setEmpresaAtiva}
                    onAtualizarEstoque={handleAtualizarEstoque}
                    onAdicionarProduto={handleAdicionarProduto}
                    onAtualizarPreco={handleAtualizarPreco}
                  />
                </AdminOnly>
              )}

              {moduloAtivo === 'CONFIGURACOES' && (
                <AdminOnly
                  user={operadorAtivo}
                  fallback={
                    <AccessDeniedFallback
                      title="Configurações do Sistema Restritas"
                      description="Alterações fiscais, limites de comanda e dados cadastrais da empresa exigem perfil de Administrador."
                      onBackToAllowed={() => setModuloAtivo('PDV_RAPIDO')}
                      onRequestAdminAuth={() => setIsGlobalAdminAuthOpen(true)}
                    />
                  }
                >
                  <ConfiguracoesView
                    empresaAtiva={empresaAtiva}
                    onAtualizarEmpresa={setEmpresaAtiva}
                    operadores={[operadorAtivo]}
                  />
                </AdminOnly>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modais Globais do Sistema */}
      <NovaComandaModal
        isOpen={isNovaComandaOpen}
        onClose={() => setIsNovaComandaOpen(false)}
        onCriarComanda={handleCriarComanda}
        proximoNumeroSugerido={proximoNumeroComanda}
        operadorAtivo={operadorAtivo}
      />

      <SangriaSuprimentoModal
        isOpen={sangriaModalConfig.isOpen}
        onClose={() => setSangriaModalConfig({ ...sangriaModalConfig, isOpen: false })}
        tipo={sangriaModalConfig.tipo}
        saldoAtualGaveta={saldoDinheiroEmGaveta}
        operadorAtivo={operadorAtivo}
        onConfirmar={handleConfirmarSangriaOuSuprimento}
      />

      <AberturaCaixaModal
        isOpen={isAberturaCaixaOpen}
        onClose={() => setIsAberturaCaixaOpen(false)}
        operadorAtivo={operadorAtivo}
        onConfirmarAbertura={handleConfirmarAberturaCaixa}
      />

      <RecebimentoModal
        isOpen={!!comandaEmRecebimento}
        onClose={() => setComandaEmRecebimento(null)}
        comanda={comandaEmRecebimento}
        operadorAtivo={operadorAtivo}
        onConfirmarPagamento={handleConfirmarPagamentoComanda}
      />

      {/* Modal de Autorização de Administrador */}
      <AdminAuthModal
        isOpen={isGlobalAdminAuthOpen}
        onClose={() => setIsGlobalAdminAuthOpen(false)}
        onSuccess={() => {
          setIsGlobalAdminAuthOpen(false);
        }}
        actionName="Liberar Acesso de Administrador"
      />

      {/* Modal de Aceite de Convite de Operador */}
      {conviteToken && (
        <AceitarConviteModal
          token={conviteToken}
          onClose={() => {
            setConviteToken(null);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
          onSucesso={(userData) => {
            setConviteToken(null);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            alert(`Conta ativada com sucesso para ${userData.nome || 'Operador'}! Seu PIN está configurado.`);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
