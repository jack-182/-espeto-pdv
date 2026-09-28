import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Wallet, 
  TrendingUp, 
  AlertCircle, 
  PlusCircle, 
  CreditCard, 
  QrCode, 
  DollarSign, 
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronRight,
  Sparkles,
  Radio,
  Store,
  BarChart3,
  Flame,
  Cigarette,
  Layers,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { TurnoCaixa, Comanda, MovimentacaoCaixa, ModuloNavegacao, Empresa } from '../../types';
import { formatCurrency, formatTimeOnly } from '../../utils/formatters';
import { EventoVendaRealtime } from '../../services/socket';

interface DadosVendas7Dias {
  dia: string;
  dataCompleta: string;
  espetinho1: number;
  espetinho2: number;
  tabacaria: number;
  totalDia: number;
}

const dadosHistorico7DiasPadrao: DadosVendas7Dias[] = [
  { dia: 'Qua (26/08)', dataCompleta: '26/08/2026', espetinho1: 1420.00, espetinho2: 980.00, tabacaria: 1850.00, totalDia: 4250.00 },
  { dia: 'Qui (27/08)', dataCompleta: '27/08/2026', espetinho1: 1680.00, espetinho2: 1120.00, tabacaria: 2100.00, totalDia: 4900.00 },
  { dia: 'Sex (28/08)', dataCompleta: '28/08/2026', espetinho1: 2850.00, espetinho2: 2190.00, tabacaria: 3450.00, totalDia: 8490.00 },
  { dia: 'Sáb (29/08)', dataCompleta: '29/08/2026', espetinho1: 3420.00, espetinho2: 2780.00, tabacaria: 4120.00, totalDia: 10320.00 },
  { dia: 'Dom (30/08)', dataCompleta: '30/08/2026', espetinho1: 2310.00, espetinho2: 1840.00, tabacaria: 2890.00, totalDia: 7040.00 },
  { dia: 'Seg (31/08)', dataCompleta: '31/08/2026', espetinho1: 1210.00, espetinho2: 890.00, tabacaria: 1640.00, totalDia: 3740.00 },
  { dia: 'Ter (Hoje)', dataCompleta: '01/09/2026', espetinho1: 1554.00, espetinho2: 1080.00, tabacaria: 2340.00, totalDia: 4974.00 }
];

interface DashboardViewProps {
  turnoAtual: TurnoCaixa | null;
  comandas: Comanda[];
  movimentacoes: MovimentacaoCaixa[];
  empresaAtiva?: Empresa;
  todasEmpresas?: Empresa[];
  onTrocarEmpresa?: (empresa: Empresa) => void;
  onNavigate: (modulo: ModuloNavegacao) => void;
  onOpenNovaComanda: () => void;
  onOpenQuickPos: () => void;
  onOpenSangria: () => void;
  vendasRealtimeFeed?: EventoVendaRealtime[];
  socketConnected?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  turnoAtual,
  comandas = [],
  movimentacoes = [],
  empresaAtiva,
  todasEmpresas = [],
  onTrocarEmpresa,
  onNavigate,
  onOpenNovaComanda,
  onOpenQuickPos,
  onOpenSangria,
  vendasRealtimeFeed = [],
  socketConnected = true
}) => {
  const [tipoGrafico, setTipoGrafico] = useState<'area' | 'barras' | 'empilhado'>('area');
  const [focoUnidadeAtiva, setFocoUnidadeAtiva] = useState(true);

  const safeComandas = comandas || [];
  const safeMovimentacoes = movimentacoes || [];

  const comandasAbertas = safeComandas.filter(c => c.status === 'ABERTA' || c.status === 'EM_FECHAMENTO');
  const totalEmComandasAbertas = comandasAbertas.reduce((acc, c) => acc + c.totalLiquido, 0);

  // Totalizadores do turno
  const vendasTurno = safeMovimentacoes.filter(m => m.tipo === 'VENDA');
  const totalVendidoTurno = vendasTurno.reduce((acc, m) => acc + m.valor, 0);

  const totalDinheiroVendido = vendasTurno.filter(m => m.metodoPagamento === 'DINHEIRO').reduce((acc, m) => acc + m.valor, 0);
  const totalPixVendido = vendasTurno.filter(m => m.metodoPagamento === 'PIX').reduce((acc, m) => acc + m.valor, 0);
  const totalCartaoVendido = vendasTurno.filter(m => m.metodoPagamento === 'CARTAO_DEBITO' || m.metodoPagamento === 'CARTAO_CREDITO').reduce((acc, m) => acc + m.valor, 0);

  const fundoTroco = turnoAtual?.saldoInicialSuprimento || 0;
  const sangrias = safeMovimentacoes.filter(m => m.tipo === 'SANGRIA').reduce((acc, m) => acc + m.valor, 0);
  const suprimentos = safeMovimentacoes.filter(m => m.tipo === 'SUPRIMENTO').reduce((acc, m) => acc + m.valor, 0);

  // Dinheiro em gaveta = Fundo inicial + Vendas em dinheiro + Suprimentos - Sangrias
  const dinheiroEmGaveta = fundoTroco + totalDinheiroVendido + suprimentos - sangrias;

  // Identificação da unidade ativa no dataset
  const activeCompanyId = empresaAtiva?.id || 'emp-1';

  // Configuração visual das unidades
  const configUnidades = useMemo(() => ({
    'emp-1': {
      dataKey: 'espetinho1' as const,
      nome: 'Espetinho 1',
      corHex: '#f59e0b',
      gradienteId: 'gradDashEspetinho1',
      icone: Flame,
      tagBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    'emp-2': {
      dataKey: 'espetinho2' as const,
      nome: 'Espetinho 2',
      corHex: '#06b6d4',
      gradienteId: 'gradDashEspetinho2',
      icone: Flame,
      tagBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    'emp-3': {
      dataKey: 'tabacaria' as const,
      nome: 'Tabacaria',
      corHex: '#a855f7',
      gradienteId: 'gradDashTabacaria',
      icone: Cigarette,
      tagBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    }
  }), []);

  // Dados calculados dos 7 dias considerando vendas dinâmicas do turno de hoje
  const dadosGrafico = useMemo(() => {
    return dadosHistorico7DiasPadrao.map((item, index) => {
      // Para o dia de hoje (último item), ajusta com vendas reais se houver
      if (index === dadosHistorico7DiasPadrao.length - 1 && totalVendidoTurno > 0) {
        let v1 = item.espetinho1;
        let v2 = item.espetinho2;
        let v3 = item.tabacaria;

        if (activeCompanyId === 'emp-1') v1 = Math.max(v1, totalVendidoTurno);
        else if (activeCompanyId === 'emp-2') v2 = Math.max(v2, totalVendidoTurno);
        else if (activeCompanyId === 'emp-3') v3 = Math.max(v3, totalVendidoTurno);

        return {
          ...item,
          espetinho1: v1,
          espetinho2: v2,
          tabacaria: v3,
          totalDia: v1 + v2 + v3
        };
      }
      return item;
    });
  }, [activeCompanyId, totalVendidoTurno]);

  // Cálculos consolidados dos últimos 7 dias
  const totais7Dias = useMemo(() => {
    const totalE1 = dadosGrafico.reduce((acc, d) => acc + d.espetinho1, 0);
    const totalE2 = dadosGrafico.reduce((acc, d) => acc + d.espetinho2, 0);
    const totalTab = dadosGrafico.reduce((acc, d) => acc + d.tabacaria, 0);
    const totalRede = totalE1 + totalE2 + totalTab;

    let totalAtiva = totalE1;
    let nomeAtiva = 'Espetinho 1';
    let corAtiva = '#f59e0b';

    if (activeCompanyId === 'emp-2') {
      totalAtiva = totalE2;
      nomeAtiva = 'Espetinho 2';
      corAtiva = '#06b6d4';
    } else if (activeCompanyId === 'emp-3') {
      totalAtiva = totalTab;
      nomeAtiva = 'Tabacaria';
      corAtiva = '#a855f7';
    }

    const percentualAtiva = totalRede > 0 ? (totalAtiva / totalRede) * 100 : 0;
    const mediaDiariaAtiva = totalAtiva / 7;

    // Encontra o pico da unidade ativa
    const pico = dadosGrafico.reduce((max, d) => {
      const val = activeCompanyId === 'emp-1' ? d.espetinho1 : activeCompanyId === 'emp-2' ? d.espetinho2 : d.tabacaria;
      return val > max.val ? { dia: d.dia, val } : max;
    }, { dia: '', val: 0 });

    return {
      totalE1,
      totalE2,
      totalTab,
      totalRede,
      totalAtiva,
      nomeAtiva,
      corAtiva,
      percentualAtiva,
      mediaDiariaAtiva,
      pico
    };
  }, [dadosGrafico, activeCompanyId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner de Boas-Vindas e Ações Rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 text-slate-100 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Painel Operacional
            </span>
            {empresaAtiva && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5">
                <Store className="w-3 h-3 text-amber-400" /> {empresaAtiva?.nomeFantasia}
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono">
              Turno #{turnoAtual?.numeroTurno || 1}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Visão Geral do Expediente {empresaAtiva?.nomeFantasia ? `• ${empresaAtiva.nomeFantasia}` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Acompanhe o faturamento em tempo real, status das comandas e comparativo multiunidades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="dash-btn-nova-comanda"
            onClick={onOpenNovaComanda}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            Nova Comanda (F2)
          </button>
          <button
            id="dash-btn-pdv-rapido"
            onClick={onOpenQuickPos}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
          >
            <DollarSign className="w-4 h-4" />
            Venda Balcão (F3)
          </button>
          <button
            id="dash-btn-sangria"
            onClick={onOpenSangria}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            Sangria Rápida
          </button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faturado */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Recebido (Turno)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono tracking-tight">
            {formatCurrency(totalVendidoTurno)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">{vendasTurno.length} vendas</span>
            <span>registradas neste turno</span>
          </div>
        </div>

        {/* Em Aberto nas Comandas */}
        <div 
          onClick={() => onNavigate('COMANDAS')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/50 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400">Consumo em Aberto</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono tracking-tight">
            {formatCurrency(totalEmComandasAbertas)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{comandasAbertas.length} comandas ativas</span>
            <span className="text-amber-400 font-semibold flex items-center">
              Ver Mesas <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Dinheiro na Gaveta */}
        <div 
          onClick={() => onNavigate('CAIXA_TURNO')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400">Dinheiro em Gaveta</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-cyan-300 font-mono tracking-tight">
            {formatCurrency(dinheiroEmGaveta)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Fundo inicial: {formatCurrency(fundoTroco)}</span>
            <span className="text-cyan-400">Conferir</span>
          </div>
        </div>

        {/* Status do Turno & Fechamento */}
        <div 
          onClick={() => onNavigate('FECHAMENTO')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400">Expediente & Fechamento</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-200 mt-1">
            Aberto às {formatTimeOnly(turnoAtual?.dataHoraAbertura)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">
            Op: {turnoAtual?.operadorAberturaNome || 'Juliana Mendes'}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-purple-300 font-semibold">
            <span>Conferência Cega (F8)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* CARD RECHARTS: ANÁLISE COMPARATIVA VISUAL DE VENDAS DAS UNIDADES (ÚLTIMOS 7 DIAS) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        {/* Cabeçalho do Card */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  Comparativo de Vendas dos Últimos 7 Dias
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                    Recharts
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Evolução do faturamento entre <strong className="text-amber-400">Espetinho 1</strong>, <strong className="text-cyan-400">Espetinho 2</strong> e <strong className="text-purple-400">Tabacaria</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Controles de Visualização e Filtro Rápido de Unidade */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor Rápido de Unidade para Sincronização */}
            {todasEmpresas && onTrocarEmpresa && (
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {todasEmpresas.map((emp) => {
                  const isCurrent = emp.id === activeCompanyId;
                  const corBadge = emp.id === 'emp-1' ? 'text-amber-400' : emp.id === 'emp-2' ? 'text-cyan-400' : 'text-purple-400';
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => onTrocarEmpresa(emp)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></span>
                      <span className={isCurrent ? corBadge : ''}>{emp?.nomeFantasia || ''}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Alternador de Tipo de Gráfico */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setTipoGrafico('area')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoGrafico === 'area'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Áreas
              </button>
              <button
                type="button"
                onClick={() => setTipoGrafico('barras')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoGrafico === 'barras'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Barras
              </button>
              <button
                type="button"
                onClick={() => setTipoGrafico('empilhado')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoGrafico === 'empilhado'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Empilhado
              </button>
            </div>
          </div>
        </div>

        {/* Faixa de Destaque da Unidade Ativa */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: totais7Dias.corAtiva }}></div>
            <div>
              <span className="text-slate-400">Unidade Ativa em Análise:</span>{' '}
              <strong className="text-white font-bold">{totais7Dias.nomeAtiva}</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span className="text-slate-300">
              Total 7 Dias: <strong className="text-white font-bold">{formatCurrency(totais7Dias.totalAtiva)}</strong>
            </span>
            <span className="text-slate-300">
              Média/Dia: <strong className="text-amber-400 font-bold">{formatCurrency(totais7Dias.mediaDiariaAtiva)}</strong>
            </span>
            <span className="text-slate-300">
              Participação na Rede: <strong className="text-emerald-400 font-bold">{totais7Dias.percentualAtiva.toFixed(1)}%</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">
              Melhor Dia: <strong className="text-amber-300 font-bold">{totais7Dias.pico.dia} ({formatCurrency(totais7Dias.pico.val)})</strong>
            </span>
          </div>
        </div>

        {/* Gráfico Recharts Responsivo */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {tipoGrafico === 'barras' ? (
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis 
                  dataKey="dia" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#475569' }} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#475569' }} 
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} 
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const totalDia = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans space-y-2 min-w-[200px]">
                          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>{label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Consolidado</span>
                          </p>
                          <div className="space-y-1.5 font-mono">
                            {payload.map((entry) => {
                              const isThisActive = 
                                (entry.dataKey === 'espetinho1' && activeCompanyId === 'emp-1') ||
                                (entry.dataKey === 'espetinho2' && activeCompanyId === 'emp-2') ||
                                (entry.dataKey === 'tabacaria' && activeCompanyId === 'emp-3');

                              return (
                                <div key={entry.name} className="flex justify-between items-center text-[11px]">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                    <span className={isThisActive ? 'font-bold text-white' : 'text-slate-400'}>
                                      {entry.name}:
                                    </span>
                                  </span>
                                  <span className="font-bold" style={{ color: entry.color }}>
                                    {formatCurrency(Number(entry.value))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center font-bold text-white text-[11px] font-mono">
                            <span>Total do Dia:</span>
                            <span className="text-emerald-400">{formatCurrency(totalDia)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  formatter={(value) => <span className="text-xs font-semibold text-slate-300">{value}</span>} 
                />
                <Bar 
                  dataKey="espetinho1" 
                  name="Espetinho 1" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                  opacity={activeCompanyId === 'emp-1' ? 1 : 0.65} 
                />
                <Bar 
                  dataKey="espetinho2" 
                  name="Espetinho 2" 
                  fill="#06b6d4" 
                  radius={[4, 4, 0, 0]} 
                  opacity={activeCompanyId === 'emp-2' ? 1 : 0.65} 
                />
                <Bar 
                  dataKey="tabacaria" 
                  name="Tabacaria" 
                  fill="#a855f7" 
                  radius={[4, 4, 0, 0]} 
                  opacity={activeCompanyId === 'emp-3' ? 1 : 0.65} 
                />
              </BarChart>
            ) : (
              <AreaChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDashEspetinho1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={activeCompanyId === 'emp-1' ? 0.6 : 0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradDashEspetinho2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={activeCompanyId === 'emp-2' ? 0.6 : 0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradDashTabacaria" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={activeCompanyId === 'emp-3' ? 0.6 : 0.25} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis 
                  dataKey="dia" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#475569' }} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: '#475569' }} 
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} 
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const totalDia = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans space-y-2 min-w-[210px]">
                          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>{label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Consolidado 7D</span>
                          </p>
                          <div className="space-y-1.5 font-mono">
                            {payload.map((entry) => {
                              const isThisActive = 
                                (entry.dataKey === 'espetinho1' && activeCompanyId === 'emp-1') ||
                                (entry.dataKey === 'espetinho2' && activeCompanyId === 'emp-2') ||
                                (entry.dataKey === 'tabacaria' && activeCompanyId === 'emp-3');

                              return (
                                <div key={entry.name} className="flex justify-between items-center text-[11px]">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                    <span className={isThisActive ? 'font-bold text-white' : 'text-slate-400'}>
                                      {entry.name}:
                                    </span>
                                    {isThisActive && (
                                      <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-300 font-sans">
                                        ATIVA
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-bold" style={{ color: entry.color }}>
                                    {formatCurrency(Number(entry.value))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center font-bold text-white text-[11px] font-mono">
                            <span>Total Consolidado:</span>
                            <span className="text-emerald-400">{formatCurrency(totalDia)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  formatter={(value) => <span className="text-xs font-semibold text-slate-300">{value}</span>} 
                />
                <Area 
                  type="monotone" 
                  dataKey="espetinho1" 
                  name="Espetinho 1" 
                  stroke="#f59e0b" 
                  strokeWidth={activeCompanyId === 'emp-1' ? 3 : 1.5}
                  fillOpacity={1} 
                  fill="url(#gradDashEspetinho1)" 
                  stackId={tipoGrafico === 'empilhado' ? '1' : undefined}
                />
                <Area 
                  type="monotone" 
                  dataKey="espetinho2" 
                  name="Espetinho 2" 
                  stroke="#06b6d4" 
                  strokeWidth={activeCompanyId === 'emp-2' ? 3 : 1.5}
                  fillOpacity={1} 
                  fill="url(#gradDashEspetinho2)" 
                  stackId={tipoGrafico === 'empilhado' ? '1' : undefined}
                />
                <Area 
                  type="monotone" 
                  dataKey="tabacaria" 
                  name="Tabacaria" 
                  stroke="#a855f7" 
                  strokeWidth={activeCompanyId === 'emp-3' ? 3 : 1.5}
                  fillOpacity={1} 
                  fill="url(#gradDashTabacaria)" 
                  stackId={tipoGrafico === 'empilhado' ? '1' : undefined}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Faixa Inferior de Indicadores das 3 Unidades (Cards Comparativos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Unidade 1: Espetinho 1 */}
          <div 
            onClick={() => {
              const target = todasEmpresas.find(e => e.id === 'emp-1') || todasEmpresas[0];
              if (target && onTrocarEmpresa) onTrocarEmpresa(target);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeCompanyId === 'emp-1'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Espetinho 1
              </span>
              {activeCompanyId === 'emp-1' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  SELECIONADA
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatCurrency(totais7Dias.totalE1)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>Média: {formatCurrency(totais7Dias.totalE1 / 7)}/dia</span>
              <span className="text-amber-400 font-semibold">{((totais7Dias.totalE1 / totais7Dias.totalRede) * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Unidade 2: Espetinho 2 */}
          <div 
            onClick={() => {
              const target = todasEmpresas.find(e => e.id === 'emp-2') || todasEmpresas[1];
              if (target && onTrocarEmpresa) onTrocarEmpresa(target);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeCompanyId === 'emp-2'
                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Espetinho 2
              </span>
              {activeCompanyId === 'emp-2' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  SELECIONADA
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatCurrency(totais7Dias.totalE2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>Média: {formatCurrency(totais7Dias.totalE2 / 7)}/dia</span>
              <span className="text-cyan-400 font-semibold">{((totais7Dias.totalE2 / totais7Dias.totalRede) * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Unidade 3: Tabacaria */}
          <div 
            onClick={() => {
              const target = todasEmpresas.find(e => e.id === 'emp-3') || todasEmpresas[2];
              if (target && onTrocarEmpresa) onTrocarEmpresa(target);
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeCompanyId === 'emp-3'
                ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-500/10'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Cigarette className="w-3.5 h-3.5" /> Tabacaria
              </span>
              {activeCompanyId === 'emp-3' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  SELECIONADA
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatCurrency(totais7Dias.totalTab)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
              <span>Média: {formatCurrency(totais7Dias.totalTab / 7)}/dia</span>
              <span className="text-purple-400 font-semibold">{((totais7Dias.totalTab / totais7Dias.totalRede) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Central Dividida: Distribuição de Pagamentos + Comandas Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel Esquerdo: Distribuição por Meio de Pagamento */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 tracking-tight">
              Faturamento por Forma de Pagamento
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Total: {formatCurrency(totalVendidoTurno)}
            </span>
          </div>

          <div className="space-y-3">
            {/* PIX */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">PIX Instantâneo</p>
                  <p className="text-[10px] text-slate-400">Liquidação imediata</p>
                </div>
              </div>
              <span className="text-sm font-bold text-teal-300 font-mono">
                {formatCurrency(totalPixVendido)}
              </span>
            </div>

            {/* Cartões (Débito/Crédito) */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Cartões de Débito / Crédito</p>
                  <p className="text-[10px] text-slate-400">POS / TEF</p>
                </div>
              </div>
              <span className="text-sm font-bold text-indigo-300 font-mono">
                {formatCurrency(totalCartaoVendido)}
              </span>
            </div>

            {/* Dinheiro */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Espécie (Dinheiro Físico)</p>
                  <p className="text-[10px] text-slate-400">Entrada na gaveta</p>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-300 font-mono">
                {formatCurrency(totalDinheiroVendido)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 text-rose-400">
              <ArrowDownRight className="w-3.5 h-3.5" /> Sangrias: {formatCurrency(sangrias)}
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" /> Suprimentos: {formatCurrency(suprimentos)}
            </span>
          </div>
        </div>

        {/* Painel Direito (2 colunas): Comandas Ativas no Balcão */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 tracking-tight">
                Comandas & Mesas em Consumo
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {comandasAbertas.length} em atendimento
              </span>
            </div>
            <button
              onClick={() => onNavigate('COMANDAS')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              Gerenciar Todas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {comandasAbertas.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-300">Nenhuma comanda aberta no momento</p>
              <p className="text-xs text-slate-500 mt-1">Abra uma nova comanda ou inicie uma venda rápida de balcão.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {comandasAbertas.map((cmd) => (
                <div
                  key={cmd.id}
                  onClick={() => onNavigate('COMANDAS')}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-amber-400">
                          #{cmd.numero.toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                          {cmd.clienteNome || `Mesa ${cmd.numero}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Aberta às {formatTimeOnly(cmd.abertaEm)}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      cmd.status === 'EM_FECHAMENTO'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {cmd.status === 'EM_FECHAMENTO' ? 'Fechando' : 'Ativa'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {cmd.itens.reduce((acc, i) => acc + i.quantidade, 0)} itens
                    </span>
                    <span className="text-sm font-bold text-slate-100 font-mono group-hover:text-amber-400 transition-colors">
                      {formatCurrency(cmd.totalLiquido)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feed de Vendas em Tempo Real (WebSocket Socket.IO) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              Feed de Vendas em Tempo Real (Socket.IO)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Sincronizando: Espetinho 1, Espetinho 2 e Tabacaria
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
            {vendasRealtimeFeed.length} vendas ao vivo
          </span>
        </div>

        {vendasRealtimeFeed.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
            Aguardando novas vendas em tempo real das unidades da rede...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendasRealtimeFeed.slice(0, 6).map((venda, idx) => (
              <div 
                key={`${venda.lojaId}-${venda.horario}-${idx}`}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-200 truncate">{venda.loja}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{venda.item}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{venda.horario} • {venda.formaPagamento}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {formatCurrency(venda.valor)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
