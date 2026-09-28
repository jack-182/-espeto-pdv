import React, { useState, useEffect, useMemo } from 'react';
import { getSocket, EventoVendaRealtime, RelatorioFechamentoGeral } from '../../services/socket';
import { 
  Radio, 
  Store, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Layers, 
  Building2, 
  CreditCard, 
  QrCode, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  BarChart3,
  Filter,
  Flame,
  UtensilsCrossed,
  Cigarette,
  Globe2,
  ArrowUpRight,
  Wallet,
  Users,
  UserPlus
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { Empresa, MovimentacaoCaixa } from '../../types';
import { UsuariosFuncionarios } from './UsuariosFuncionarios';

interface DadosVendas7Dias {
  dia: string;
  dataCompleta: string;
  espetinho1: number;
  espetinho2: number;
  tabacaria: number;
  totalDia: number;
}

const dadosHistorico7Dias: DadosVendas7Dias[] = [
  { dia: 'Qua (26/08)', dataCompleta: '26/08/2026', espetinho1: 1420.00, espetinho2: 980.00, tabacaria: 1850.00, totalDia: 4250.00 },
  { dia: 'Qui (27/08)', dataCompleta: '27/08/2026', espetinho1: 1680.00, espetinho2: 1120.00, tabacaria: 2100.00, totalDia: 4900.00 },
  { dia: 'Sex (28/08)', dataCompleta: '28/08/2026', espetinho1: 2850.00, espetinho2: 2190.00, tabacaria: 3450.00, totalDia: 8490.00 },
  { dia: 'Sáb (29/08)', dataCompleta: '29/08/2026', espetinho1: 3420.00, espetinho2: 2780.00, tabacaria: 4120.00, totalDia: 10320.00 },
  { dia: 'Dom (30/08)', dataCompleta: '30/08/2026', espetinho1: 2310.00, espetinho2: 1840.00, tabacaria: 2890.00, totalDia: 7040.00 },
  { dia: 'Seg (31/08)', dataCompleta: '31/08/2026', espetinho1: 1210.00, espetinho2: 890.00, tabacaria: 1640.00, totalDia: 3740.00 },
  { dia: 'Ter (Hoje)', dataCompleta: '01/09/2026', espetinho1: 1554.00, espetinho2: 1080.00, tabacaria: 2340.00, totalDia: 4974.00 }
];

export interface PainelAdministradorProps {
  empresaAtiva?: Empresa;
  todasEmpresas?: Empresa[];
  movimentacoes?: MovimentacaoCaixa[];
  onTrocarEmpresa?: (empresa: Empresa) => void;
  abaInicial?: 'METRICAS' | 'FUNCIONARIOS';
}

type ChaveUnidade = 'TODAS' | 'emp-1' | 'emp-2' | 'emp-3';

export const PainelAdministrador: React.FC<PainelAdministradorProps> = ({
  empresaAtiva,
  todasEmpresas = [],
  onTrocarEmpresa,
  abaInicial = 'METRICAS'
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'METRICAS' | 'FUNCIONARIOS'>(abaInicial);

  useEffect(() => {
    if (abaInicial) {
      setAbaAtiva(abaInicial);
    }
  }, [abaInicial]);

  // Filtro de unidade: 'TODAS' para visão consolidada, ou id da empresa ('emp-1', 'emp-2', 'emp-3')
  const [filtroUnidade, setFiltroUnidade] = useState<ChaveUnidade>(
    empresaAtiva ? (empresaAtiva.id as ChaveUnidade) : 'TODAS'
  );

  // Sincroniza quando empresaAtiva mudar de fora
  useEffect(() => {
    if (empresaAtiva && empresaAtiva.id) {
      setFiltroUnidade(empresaAtiva.id as ChaveUnidade);
    }
  }, [empresaAtiva?.id]);

  const [notificacoes, setNotificacoes] = useState<EventoVendaRealtime[]>([
    {
      lojaId: 1,
      loja: 'Espetinho 1',
      item: '4x Espeto Angus, 2x Chopp Brahma',
      valor: 88.00,
      formaPagamento: 'Pix',
      horario: '10:15:30'
    },
    {
      lojaId: 3,
      loja: 'Tabacaria',
      item: '1x Essência Love 66 + Carvão',
      valor: 45.00,
      formaPagamento: 'Cartao',
      horario: '10:08:12'
    },
    {
      lojaId: 2,
      loja: 'Espetinho 2',
      item: 'Combo 6 Espetos + Refrigerante 2L',
      valor: 74.50,
      formaPagamento: 'Dinheiro',
      horario: '09:54:20'
    }
  ]);

  const [relatorioGeral, setRelatorioGeral] = useState<RelatorioFechamentoGeral | null>({
    relatorio: [
      { loja: 'Espetinho 1', lojaId: 1, dinheiro: 214.00, pix: 450.00, cartao: 890.00, aberto: true, totalLoja: 1554.00 },
      { loja: 'Espetinho 2', lojaId: 2, dinheiro: 150.00, pix: 320.00, cartao: 610.00, aberto: true, totalLoja: 1080.00 },
      { loja: 'Tabacaria', lojaId: 3, dinheiro: 310.00, pix: 780.00, cartao: 1250.00, aberto: true, totalLoja: 2340.00 }
    ],
    totalGeral: 4974.00
  });

  const [sincronizando, setSincronizando] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const [tipoGrafico, setTipoGrafico] = useState<'individual' | 'empilhado'>('individual');
  const [filtrarFeedPorUnidade, setFiltrarFeedPorUnidade] = useState(false);

  // Mapeamento de chave de unidade para a coluna no dataset do Recharts
  const unidadeMap = useMemo(() => ({
    'emp-1': {
      dataKey: 'espetinho1' as const,
      lojaId: 1,
      nome: 'Espetinho 1',
      corHex: '#f59e0b',
      gradienteId: 'corEspetinho1',
      bgClass: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Flame
    },
    'emp-2': {
      dataKey: 'espetinho2' as const,
      lojaId: 2,
      nome: 'Espetinho 2',
      corHex: '#10b981',
      gradienteId: 'corEspetinho2',
      bgClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: UtensilsCrossed
    },
    'emp-3': {
      dataKey: 'tabacaria' as const,
      lojaId: 3,
      nome: 'Tabacaria',
      corHex: '#a855f7',
      gradienteId: 'corTabacaria',
      bgClass: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
      tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Cigarette
    }
  }), []);

  // Dados calculados para os 7 dias
  const totalSemanaConsolidado = dadosHistorico7Dias.reduce((acc, d) => acc + d.totalDia, 0);
  const totalEspetinho1_7D = dadosHistorico7Dias.reduce((acc, d) => acc + d.espetinho1, 0);
  const totalEspetinho2_7D = dadosHistorico7Dias.reduce((acc, d) => acc + d.espetinho2, 0);
  const totalTabacaria_7D = dadosHistorico7Dias.reduce((acc, d) => acc + d.tabacaria, 0);

  // Informações específicas da unidade filtrada (se não for 'TODAS')
  const infoUnidadeSelecionada = useMemo(() => {
    if (filtroUnidade === 'TODAS') return null;
    const config = unidadeMap[filtroUnidade];
    if (!config) return null;

    const dataKey = config.dataKey;
    const total7Dias = dadosHistorico7Dias.reduce((acc, d) => acc + (d[dataKey] || 0), 0);
    const mediaDiaria = total7Dias / dadosHistorico7Dias.length;
    
    // Melhor dia da unidade
    let melhorDia = dadosHistorico7Dias[0];
    let maiorValor = dadosHistorico7Dias[0][dataKey];
    dadosHistorico7Dias.forEach(d => {
      if (d[dataKey] > maiorValor) {
        maiorValor = d[dataKey];
        melhorDia = d;
      }
    });

    const percentualRede = totalSemanaConsolidado > 0 
      ? (total7Dias / totalSemanaConsolidado) * 100 
      : 0;

    // Dados de hoje do relatório
    const dadosHojeLoja = relatorioGeral?.relatorio.find(r => r.lojaId === config.lojaId);

    return {
      ...config,
      total7Dias,
      mediaDiaria,
      melhorDia,
      maiorValor,
      percentualRede,
      dadosHojeLoja
    };
  }, [filtroUnidade, unidadeMap, totalSemanaConsolidado, relatorioGeral]);

  // Dataset customizado para o gráfico quando filtrado
  const dadosGraficoFormatados = useMemo(() => {
    if (filtroUnidade === 'TODAS') {
      return dadosHistorico7Dias;
    }
    const config = unidadeMap[filtroUnidade];
    if (!config) return dadosHistorico7Dias;

    return dadosHistorico7Dias.map(d => ({
      ...d,
      valorUnidade: d[config.dataKey],
      nomeUnidade: config.nome
    }));
  }, [filtroUnidade, unidadeMap]);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setSocketOnline(true);
    const handleDisconnect = () => setSocketOnline(false);

    const handleNovaVenda = (dadosVenda: EventoVendaRealtime) => {
      setNotificacoes((prev) => [dadosVenda, ...prev.slice(0, 9)]);
    };

    const handleResultadoFechamento = (dadosFechamento: RelatorioFechamentoGeral) => {
      setRelatorioGeral(dadosFechamento);
      setSincronizando(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('nova_venda_realizada', handleNovaVenda);
    socket.on('resultado_fechamento_geral', handleResultadoFechamento);

    if (socket.connected) {
      setSocketOnline(true);
    }

    socket.emit('solicitar_fechamento_geral');

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('nova_venda_realizada', handleNovaVenda);
      socket.off('resultado_fechamento_geral', handleResultadoFechamento);
    };
  }, []);

  const solicitarFechamento = () => {
    setSincronizando(true);
    const socket = getSocket();
    socket.emit('solicitar_fechamento_geral');
    setTimeout(() => setSincronizando(false), 800);
  };

  const handleSelecionarUnidade = (chave: ChaveUnidade) => {
    setFiltroUnidade(chave);
    if (chave !== 'TODAS' && onTrocarEmpresa) {
      const empresaAlvo = todasEmpresas.find(e => e.id === chave);
      if (empresaAlvo) {
        onTrocarEmpresa(empresaAlvo);
      }
    }
  };

  // Notificações filtradas pelo feed se ativado ou se houver filtro
  const notificacoesExibidas = useMemo(() => {
    if (filtroUnidade === 'TODAS' || !filtrarFeedPorUnidade) {
      return notificacoes;
    }
    const config = unidadeMap[filtroUnidade];
    if (!config) return notificacoes;
    return notificacoes.filter(n => 
      n.lojaId === config.lojaId || 
      n.loja.toLowerCase().includes(config.nome.toLowerCase())
    );
  }, [notificacoes, filtroUnidade, filtrarFeedPorUnidade, unidadeMap]);

  // Tooltip customizado do Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0]?.payload;

      // Tooltip para unidade individual
      if (filtroUnidade !== 'TODAS' && infoUnidadeSelecionada) {
        const valUnidade = dataItem[infoUnidadeSelecionada.dataKey] || dataItem.valorUnidade || 0;
        const totalRedeDia = dataItem.totalDia || 0;
        const percDia = totalRedeDia > 0 ? ((valUnidade / totalRedeDia) * 100).toFixed(1) : '0';

        return (
          <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs">
            <p className="font-bold text-slate-200 mb-2 border-b border-slate-800 pb-1.5 flex items-center justify-between gap-4">
              <span>{label}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                {percDia}% da Rede
              </span>
            </p>
            <div className="space-y-1 font-mono">
              <div className="flex items-center justify-between gap-5">
                <span className="flex items-center gap-1.5 font-bold" style={{ color: infoUnidadeSelecionada.corHex }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: infoUnidadeSelecionada.corHex }}></span>
                  {infoUnidadeSelecionada.nome}:
                </span>
                <span className="font-extrabold text-white text-sm">{formatCurrency(valUnidade)}</span>
              </div>
              <div className="flex items-center justify-between gap-5 text-slate-400 text-[11px] pt-1 border-t border-slate-900">
                <span>Total Consolidado Rede:</span>
                <span className="text-slate-300">{formatCurrency(totalRedeDia)}</span>
              </div>
            </div>
          </div>
        );
      }

      // Tooltip consolidado geral
      return (
        <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          <p className="font-bold text-slate-200 mb-2 border-b border-slate-800 pb-1.5 flex items-center justify-between gap-3">
            <span>{label}</span>
            <span className="font-mono text-emerald-400 font-extrabold">{formatCurrency(dataItem.totalDia)}</span>
          </p>
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Espetinho 1:
              </span>
              <span className="font-bold text-white">{formatCurrency(dataItem.espetinho1)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                Espetinho 2:
              </span>
              <span className="font-bold text-white">{formatCurrency(dataItem.espetinho2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                Tabacaria:
              </span>
              <span className="font-bold text-white">{formatCurrency(dataItem.tabacaria)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* SELETOR DE ABAS: VISÃO GERAL / USUÁRIOS E FUNCIONÁRIOS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
        <button
          id="tab-painel-metricas"
          onClick={() => setAbaAtiva('METRICAS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            abaAtiva === 'METRICAS'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Visão Geral & Balanço</span>
        </button>

        <button
          id="tab-painel-funcionarios"
          onClick={() => setAbaAtiva('FUNCIONARIOS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            abaAtiva === 'FUNCIONARIOS'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários / Funcionários</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/40 text-current">
            OPERADOR
          </span>
        </button>
      </div>

      {abaAtiva === 'FUNCIONARIOS' ? (
        <UsuariosFuncionarios
          lojasDisponiveis={todasEmpresas.map(e => ({ id: e.id, nome: e.nomeFantasia }))}
        />
      ) : (
        <>
          {/* CABEÇALHO DO DONO COM SELETOR DE UNIDADES */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 text-slate-100 shadow-xl">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${socketOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  Rede MultiGestão em Tempo Real
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  3 Unidades Sincronizadas
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Painel Gerencial - MultiGestão
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {filtroUnidade === 'TODAS'
                  ? 'Visualização consolidada do faturamento e métricas de toda a rede.'
                  : `Filtrando indicadores exclusivamente para: ${infoUnidadeSelecionada?.nome || 'Unidade'}`
                }
              </p>
            </div>

            {/* CONTROLES DO CABEÇALHO: ATUALIZAR E FILTRO RÁPIDO */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
              <button 
                id="btn-atualizar-fechamento-topo"
                onClick={solicitarFechamento}
                disabled={sincronizando}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
                <span>Atualizar Fechamento</span>
              </button>
            </div>
          </div>

      {/* SELETOR INTERATIVO DE UNIDADE (TODAS OU UNIDADE ESPECÍFICA) */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-2 px-2 pt-1 text-slate-400 text-xs font-semibold">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>Seletor de Unidades & Escopo de Análise:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Opção Todas as Unidades */}
          <button
            id="btn-filtro-todas-unidades"
            onClick={() => handleSelecionarUnidade('TODAS')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              filtroUnidade === 'TODAS'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Globe2 className={`w-4 h-4 ${filtroUnidade === 'TODAS' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Rede Consolidada (Todas)</span>
          </button>

          {/* Espetinho 1 */}
          <button
            id="btn-filtro-espetinho-1"
            onClick={() => handleSelecionarUnidade('emp-1')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              filtroUnidade === 'emp-1'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Flame className={`w-4 h-4 ${filtroUnidade === 'emp-1' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Espetinho 1</span>
          </button>

          {/* Espetinho 2 */}
          <button
            id="btn-filtro-espetinho-2"
            onClick={() => handleSelecionarUnidade('emp-2')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              filtroUnidade === 'emp-2'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <UtensilsCrossed className={`w-4 h-4 ${filtroUnidade === 'emp-2' ? 'text-slate-950' : 'text-emerald-400'}`} />
            <span>Espetinho 2</span>
          </button>

          {/* Tabacaria */}
          <button
            id="btn-filtro-tabacaria"
            onClick={() => handleSelecionarUnidade('emp-3')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              filtroUnidade === 'emp-3'
                ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/20'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Cigarette className={`w-4 h-4 ${filtroUnidade === 'emp-3' ? 'text-white' : 'text-purple-400'}`} />
            <span>Tabacaria</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES CONSOLIDADOS OU FILTRADOS POR UNIDADE */}
      {relatorioGeral && (
        <>
          {filtroUnidade === 'TODAS' ? (
            /* MODO CONSOLIDADO: TOTAL GERAL + 3 UNIDADES */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 block mb-1 flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5" />
                    Total Hoje Consolidado
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    3 Lojas
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono mt-1">
                  {formatCurrency(relatorioGeral.totalGeral)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1.5 block">
                  Somatório de faturamento do expediente
                </span>
              </div>

              {relatorioGeral.relatorio.map((loja, idx) => {
                const isEsp1 = loja.lojaId === 1;
                const isEsp2 = loja.lojaId === 2;
                const corBadge = isEsp1 ? 'border-amber-500/30 text-amber-400' : isEsp2 ? 'border-emerald-500/30 text-emerald-400' : 'border-purple-500/30 text-purple-400';

                return (
                  <div 
                    key={idx} 
                    onClick={() => handleSelecionarUnidade(isEsp1 ? 'emp-1' : isEsp2 ? 'emp-2' : 'emp-3')}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-sm transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        {loja.loja}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Aberta
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white font-mono mt-0.5">
                      {formatCurrency(loja.totalLoja)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 flex flex-wrap gap-2 font-mono border-t border-slate-800/80 pt-1.5">
                      <span>Pix: <strong className="text-slate-300">{formatCurrency(loja.pix)}</strong></span>
                      <span>•</span>
                      <span>Cartão: <strong className="text-slate-300">{formatCurrency(loja.cartao)}</strong></span>
                      <span>•</span>
                      <span>Dinheiro: <strong className="text-slate-300">{formatCurrency(loja.dinheiro)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* MODO UNIDADE ESPECÍFICA: INDICADORES EXCLUSIVOS DA LOJA */
            infoUnidadeSelecionada && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-150">
                {/* 1. Total Hoje da Unidade */}
                <div className={`p-4 rounded-2xl border shadow-lg bg-slate-900 ${infoUnidadeSelecionada.bgClass}`}>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold block flex items-center gap-1.5">
                      <infoUnidadeSelecionada.icon className="w-4 h-4" />
                      Faturamento Hoje ({infoUnidadeSelecionada.nome})
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${infoUnidadeSelecionada.tagColor}`}>
                      Ativo
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-1 text-white">
                    {formatCurrency(infoUnidadeSelecionada.dadosHojeLoja?.totalLoja || 0)}
                  </div>
                  <span className="text-[11px] text-slate-300 mt-1 block">
                    Representa {(( (infoUnidadeSelecionada.dadosHojeLoja?.totalLoja || 0) / relatorioGeral.totalGeral) * 100).toFixed(1)}% do faturamento da rede
                  </span>
                </div>

                {/* 2. Dinheiro em Gaveta da Unidade */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                      Dinheiro em Espécie (Gaveta)
                    </span>
                  </div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                    {formatCurrency(infoUnidadeSelecionada.dadosHojeLoja?.dinheiro || 0)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Disponível para conferência de caixa
                  </span>
                </div>

                {/* 3. Pagamentos Digitais (Pix + Cartão) */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                      Pix & Cartões
                    </span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono mt-1">
                    {formatCurrency(
                      (infoUnidadeSelecionada.dadosHojeLoja?.pix || 0) + 
                      (infoUnidadeSelecionada.dadosHojeLoja?.cartao || 0)
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 flex gap-2 font-mono">
                    <span>Pix: <strong className="text-slate-300">{formatCurrency(infoUnidadeSelecionada.dadosHojeLoja?.pix || 0)}</strong></span>
                    <span>•</span>
                    <span>Cartão: <strong className="text-slate-300">{formatCurrency(infoUnidadeSelecionada.dadosHojeLoja?.cartao || 0)}</strong></span>
                  </div>
                </div>

                {/* 4. Total Acumulado da Semana da Unidade */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      Total Últimos 7 Dias
                    </span>
                  </div>
                  <div className="text-xl font-bold text-blue-400 font-mono mt-1">
                    {formatCurrency(infoUnidadeSelecionada.total7Dias)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Média de {formatCurrency(infoUnidadeSelecionada.mediaDiaria)}/dia
                  </span>
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* COMPONENTE DE GRÁFICO DE ÁREA (RECHARTS) - DINÂMICO CONFORME UNIDADE SELECIONADA */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">
                {filtroUnidade === 'TODAS'
                  ? 'Volume de Vendas dos Últimos 7 Dias (Rede Consolidada)'
                  : `Volume de Vendas dos Últimos 7 Dias - ${infoUnidadeSelecionada?.nome}`
                }
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {filtroUnidade === 'TODAS'
                ? 'Comparativo diário de faturamento entre Espetinho 1, Espetinho 2 e Tabacaria'
                : `Evolução diária de receitas da unidade selecionada (${infoUnidadeSelecionada?.nome})`
              }
            </p>
          </div>

          {/* Seletor de Modo e Indicador 7D */}
          <div className="flex flex-wrap items-center gap-3">
            {filtroUnidade === 'TODAS' ? (
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setTipoGrafico('individual')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    tipoGrafico === 'individual'
                      ? 'bg-slate-800 text-amber-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Linhas Comparativas
                </button>
                <button
                  onClick={() => setTipoGrafico('empilhado')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    tipoGrafico === 'empilhado'
                      ? 'bg-slate-800 text-amber-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Volume Acumulado
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSelecionarUnidade('TODAS')}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>Ver Comparativo c/ Toda a Rede</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-mono font-bold">
                {filtroUnidade === 'TODAS'
                  ? `Total 7D Rede: ${formatCurrency(totalSemanaConsolidado)}`
                  : `Total 7D ${infoUnidadeSelecionada?.nome}: ${formatCurrency(infoUnidadeSelecionada?.total7Dias || 0)}`
                }
              </span>
            </div>
          </div>
        </div>

        {/* Resumo Métricas 7 Dias (Multi ou Individual) */}
        {filtroUnidade === 'TODAS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div 
              onClick={() => handleSelecionarUnidade('emp-1')}
              className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-500 transition-colors"
            >
              <div>
                <span className="text-[11px] text-amber-400/90 font-medium block flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Total Espetinho 1
                </span>
                <span className="text-sm font-bold text-white font-mono">{formatCurrency(totalEspetinho1_7D)}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {((totalEspetinho1_7D / totalSemanaConsolidado) * 100).toFixed(1)}% do total
              </span>
            </div>

            <div 
              onClick={() => handleSelecionarUnidade('emp-2')}
              className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex items-center justify-between cursor-pointer hover:border-emerald-500 transition-colors"
            >
              <div>
                <span className="text-[11px] text-emerald-400/90 font-medium block flex items-center gap-1">
                  <UtensilsCrossed className="w-3 h-3" />
                  Total Espetinho 2
                </span>
                <span className="text-sm font-bold text-white font-mono">{formatCurrency(totalEspetinho2_7D)}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {((totalEspetinho2_7D / totalSemanaConsolidado) * 100).toFixed(1)}% do total
              </span>
            </div>

            <div 
              onClick={() => handleSelecionarUnidade('emp-3')}
              className="p-3 rounded-xl bg-slate-950/70 border border-purple-500/30 flex items-center justify-between cursor-pointer hover:border-purple-500 transition-colors"
            >
              <div>
                <span className="text-[11px] text-purple-400/90 font-medium block flex items-center gap-1">
                  <Cigarette className="w-3 h-3" />
                  Total Tabacaria
                </span>
                <span className="text-sm font-bold text-white font-mono">{formatCurrency(totalTabacaria_7D)}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {((totalTabacaria_7D / totalSemanaConsolidado) * 100).toFixed(1)}% do total
              </span>
            </div>
          </div>
        ) : (
          /* DETALHES 7 DIAS DA UNIDADE SELECIONADA */
          infoUnidadeSelecionada && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Total da Semana</span>
                  <span className="text-sm font-bold text-white font-mono">{formatCurrency(infoUnidadeSelecionada.total7Dias)}</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  7 Dias
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Média Diária</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(infoUnidadeSelecionada.mediaDiaria)}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  / dia
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Pico de Faturamento</span>
                  <span className="text-sm font-bold text-white font-mono">{formatCurrency(infoUnidadeSelecionada.maiorValor)}</span>
                </div>
                <span className="text-[10px] font-mono text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                  {infoUnidadeSelecionada.melhorDia.dia.split(' ')[0]}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Participação na Rede</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">{infoUnidadeSelecionada.percentualRede.toFixed(1)}%</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  do Grupo
                </span>
              </div>
            </div>
          )
        )}

        {/* Gráfico de Área Recharts */}
        <div className="h-72 sm:h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={dadosGraficoFormatados}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="corEspetinho1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="corEspetinho2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="corTabacaria" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="corUnica" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={infoUnidadeSelecionada?.corHex || '#f59e0b'} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={infoUnidadeSelecionada?.corHex || '#f59e0b'} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="dia" 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
              />
              <Tooltip content={<CustomTooltip />} />

              {filtroUnidade === 'TODAS' ? (
                <>
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        espetinho1: 'Espetinho 1',
                        espetinho2: 'Espetinho 2',
                        tabacaria: 'Tabacaria'
                      };
                      return <span className="text-xs font-semibold text-slate-300">{labels[value] || value}</span>;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="espetinho1" 
                    name="espetinho1"
                    stackId={tipoGrafico === 'empilhado' ? '1' : undefined}
                    stroke="#f59e0b" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#corEspetinho1)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="espetinho2" 
                    name="espetinho2"
                    stackId={tipoGrafico === 'empilhado' ? '1' : undefined}
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#corEspetinho2)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tabacaria" 
                    name="tabacaria"
                    stackId={tipoGrafico === 'empilhado' ? '1' : undefined}
                    stroke="#a855f7" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#corTabacaria)" 
                  />
                </>
              ) : (
                /* ÁREA ESPECÍFICA DA UNIDADE SELECIONADA */
                infoUnidadeSelecionada && (
                  <>
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      formatter={() => (
                        <span className="text-xs font-bold" style={{ color: infoUnidadeSelecionada.corHex }}>
                          Faturamento Diário: {infoUnidadeSelecionada.nome}
                        </span>
                      )}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={infoUnidadeSelecionada.dataKey} 
                      name={infoUnidadeSelecionada.dataKey}
                      stroke={infoUnidadeSelecionada.corHex} 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#corUnica)" 
                    />
                  </>
                )
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRID PRINCIPAL: FEED EM TEMPO REAL + CONSOLIDADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FEED DE NOTIFICAÇÕES EM TEMPO REAL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[480px]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-200">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              Feed de Vendas em Tempo Real
            </h2>

            <div className="flex items-center gap-2">
              {filtroUnidade !== 'TODAS' && (
                <button
                  onClick={() => setFiltrarFeedPorUnidade(!filtrarFeedPorUnidade)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                    filtrarFeedPorUnidade
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {filtrarFeedPorUnidade ? `Filtro: ${infoUnidadeSelecionada?.nome}` : 'Ver Todas Lojas'}
                </button>
              )}
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                {notificacoesExibidas.length} vendas
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {notificacoesExibidas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">Nenhuma venda registrada no momento para esta unidade.</p>
              </div>
            ) : (
              notificacoesExibidas.map((n, idx) => {
                const isEsp1 = n.lojaId === 1 || n.loja.includes('1');
                const isEsp2 = n.lojaId === 2 || n.loja.includes('2');
                const tagCor = isEsp1 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : isEsp2 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/15 text-purple-400 border-purple-500/20';

                return (
                  <div 
                    key={idx} 
                    className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex justify-between items-center gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${tagCor}`}>
                          {n.loja}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{n.horario}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
                        {n.item || 'Venda de Balcão'} 
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Forma: <strong className="text-slate-300">{n.formaPagamento}</strong>
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        + {formatCurrency(n.valor)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CONSOLIDADO DO DIA E DETALHAMENTO DE FORMAS DE PAGAMENTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[480px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Fechamento e Balanço das Unidades
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              {filtroUnidade === 'TODAS' ? 'Rede Completa' : infoUnidadeSelecionada?.nome}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {!relatorioGeral ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <p className="text-xs text-slate-500">Clique em "Atualizar Fechamento" para carregar os dados.</p>
              </div>
            ) : (
              <>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 block font-bold uppercase tracking-wider">
                      {filtroUnidade === 'TODAS' 
                        ? 'TOTAL GERAL FATURADO NAS 3 LOJAS' 
                        : `TOTAL FATURADO HOJE - ${infoUnidadeSelecionada?.nome}`
                      }
                    </span>
                    <span className="text-2xl font-bold text-emerald-400 font-mono mt-0.5 block">
                      {formatCurrency(
                        filtroUnidade === 'TODAS'
                          ? relatorioGeral.totalGeral
                          : (infoUnidadeSelecionada?.dadosHojeLoja?.totalLoja || 0)
                      )}
                    </span>
                  </div>
                  {filtroUnidade !== 'TODAS' && (
                    <button
                      onClick={() => handleSelecionarUnidade('TODAS')}
                      className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
                    >
                      Ver Total Rede
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {relatorioGeral.relatorio.map((loja, i) => {
                    const isSelected = 
                      (filtroUnidade === 'emp-1' && loja.lojaId === 1) ||
                      (filtroUnidade === 'emp-2' && loja.lojaId === 2) ||
                      (filtroUnidade === 'emp-3' && loja.lojaId === 3);

                    return (
                      <div 
                        key={i} 
                        onClick={() => handleSelecionarUnidade(loja.lojaId === 1 ? 'emp-1' : loja.lojaId === 2 ? 'emp-2' : 'emp-3')}
                        className={`p-3.5 rounded-xl border flex justify-between items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-950 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Store className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-400'} shrink-0`} />
                            <p className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                              {loja.loja}
                            </p>
                            {isSelected && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Selecionada
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 mt-1 font-mono">
                            <span>Dinheiro: <strong className="text-slate-300">{formatCurrency(loja.dinheiro)}</strong></span>
                            <span>|</span>
                            <span>Pix: <strong className="text-slate-300">{formatCurrency(loja.pix)}</strong></span>
                            <span>|</span>
                            <span>Cartão: <strong className="text-slate-300">{formatCurrency(loja.cartao)}</strong></span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold font-mono ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                            {formatCurrency(loja.totalLoja)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
