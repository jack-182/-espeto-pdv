import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  DollarSign, 
  CreditCard, 
  QrCode, 
  FileText, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Lock,
  Building2,
  Layers,
  Store,
  RefreshCw,
  Radio
} from 'lucide-react';
import { TurnoCaixa, MovimentacaoCaixa, Operador, MetodoPagamento } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { getSocket, solicitarFechamentoGeralRealtime, ExpedientesRealtime } from '../../services/socket';

interface FechamentoExpedienteViewProps {
  turnoAtual: TurnoCaixa | null;
  movimentacoes: MovimentacaoCaixa[];
  operadorAtivo: Operador;
  onConcluirFechamento: (valoresDeclarados: Record<MetodoPagamento, number>, diferenca: number, observacao: string) => void;
  onReabrirOuNovoTurno: () => void;
}

interface CaixaConsolidado {
  id: number;
  loja: string;
  operador: string;
  dinheiroSistema: number;
  pixSistema: number;
  cartaoSistema: number;
  dinheiroInformado: string;
}

export const FechamentoExpedienteView: React.FC<FechamentoExpedienteViewProps> = ({
  turnoAtual,
  movimentacoes,
  operadorAtivo,
  onConcluirFechamento,
  onReabrirOuNovoTurno
}) => {
  const [modoVisualizacao, setModoVisualizacao] = useState<'CONSOLIDADO' | 'UNIDADE_ATIVA'>('CONSOLIDADO');
  const [etapa, setEtapa] = useState<'CONFERENCIA_CEGA' | 'RESUMO_AUDITORIA'>('CONFERENCIA_CEGA');
  const [sincronizandoWs, setSincronizandoWs] = useState(false);
  
  // Estado para Fechamento Consolidado das 3 Unidades
  const [caixas, setCaixas] = useState<CaixaConsolidado[]>([
    { id: 1, loja: 'Espetinho 1', operador: 'Juliana Mendes', dinheiroSistema: 214.00, pixSistema: 450.00, cartaoSistema: 890.00, dinheiroInformado: '' },
    { id: 2, loja: 'Espetinho 2', operador: 'Carlos Silva', dinheiroSistema: 150.00, pixSistema: 320.00, cartaoSistema: 610.00, dinheiroInformado: '' },
    { id: 3, loja: 'Tabacaria', operador: 'Ana Souza', dinheiroSistema: 310.00, pixSistema: 780.00, cartaoSistema: 1250.00, dinheiroInformado: '' }
  ]);

  // Sincronização via Socket.IO
  useEffect(() => {
    const s = getSocket();

    const handleAtualizacao = (exp: ExpedientesRealtime) => {
      setCaixas(prev => prev.map(c => {
        const live = exp[c.id];
        if (live) {
          return {
            ...c,
            dinheiroSistema: live.dinheiro > 0 ? live.dinheiro : c.dinheiroSistema,
            pixSistema: live.pix > 0 ? live.pix : c.pixSistema,
            cartaoSistema: live.cartao > 0 ? live.cartao : c.cartaoSistema
          };
        }
        return c;
      }));
      setSincronizandoWs(false);
    };

    s.on('atualizacao_expedientes', handleAtualizacao);
    s.on('resultado_fechamento_geral', (dados) => {
      if (dados?.expedientes) {
        handleAtualizacao(dados.expedientes);
      }
    });

    // Solicita dados ao montar
    solicitarFechamentoGeralRealtime();

    return () => {
      s.off('atualizacao_expedientes', handleAtualizacao);
      s.off('resultado_fechamento_geral');
    };
  }, []);

  const handleSincronizarManual = () => {
    setSincronizandoWs(true);
    solicitarFechamentoGeralRealtime();
    setTimeout(() => setSincronizandoWs(false), 1000);
  };

  const [consolidadoFinalizado, setConsolidadoFinalizado] = useState(false);

  const atualizarValorInformado = (id: number, valor: string) => {
    setCaixas(caixas.map(c => c.id === id ? { ...c, dinheiroInformado: valor } : c));
  };

  const totalGeralVendas = caixas.reduce((acc, c) => acc + c.dinheiroSistema + c.pixSistema + c.cartaoSistema, 0);

  // Valores declarados pelo operador (Conferência Cega da Unidade Ativa)
  const [declaradoDinheiro, setDeclaradoDinheiro] = useState<string>('');
  const [declaradoPix, setDeclaradoPix] = useState<string>('');
  const [declaradoDebito, setDeclaradoDebito] = useState<string>('');
  const [declaradoCredito, setDeclaradoCredito] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [fechadoComSucesso, setFechadoComSucesso] = useState(false);

  // Cálculos do Sistema para a Unidade Ativa
  const fundoTroco = turnoAtual?.saldoInicialSuprimento || 0;
  const vendasDinheiro = movimentacoes
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'DINHEIRO')
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSuprimentos = movimentacoes
    .filter(m => m.tipo === 'SUPRIMENTO')
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSangrias = movimentacoes
    .filter(m => m.tipo === 'SANGRIA')
    .reduce((acc, m) => acc + m.valor, 0);

  // Dinheiro esperado pelo sistema = Fundo + Vendas Dinheiro + Suprimentos - Sangrias
  const sistemaEsperadoDinheiro = fundoTroco + vendasDinheiro + totalSuprimentos - totalSangrias;

  const sistemaEsperadoPix = movimentacoes
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'PIX')
    .reduce((acc, m) => acc + m.valor, 0);

  const sistemaEsperadoDebito = movimentacoes
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'CARTAO_DEBITO')
    .reduce((acc, m) => acc + m.valor, 0);

  const sistemaEsperadoCredito = movimentacoes
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'CARTAO_CREDITO')
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSistemaEsperado = sistemaEsperadoDinheiro + sistemaEsperadoPix + sistemaEsperadoDebito + sistemaEsperadoCredito;

  // Valores numéricos declarados
  const numDeclaradoDinheiro = parseFloat(declaradoDinheiro.replace(',', '.')) || 0;
  const numDeclaradoPix = parseFloat(declaradoPix.replace(',', '.')) || 0;
  const numDeclaradoDebito = parseFloat(declaradoDebito.replace(',', '.')) || 0;
  const numDeclaradoCredito = parseFloat(declaradoCredito.replace(',', '.')) || 0;

  const totalDeclarado = numDeclaradoDinheiro + numDeclaradoPix + numDeclaradoDebito + numDeclaradoCredito;
  const diferencaTotal = totalDeclarado - totalSistemaEsperado;

  const handleAvancarParaAuditoria = () => {
    setEtapa('RESUMO_AUDITORIA');
  };

  const handleFinalizarTurno = () => {
    const valoresDeclarados: Record<MetodoPagamento, number> = {
      DINHEIRO: numDeclaradoDinheiro,
      PIX: numDeclaradoPix,
      CARTAO_DEBITO: numDeclaradoDebito,
      CARTAO_CREDITO: numDeclaradoCredito,
      VALE_REFEICAO: 0,
      FIADO_CONVENIO: 0
    };

    onConcluirFechamento(valoresDeclarados, diferencaTotal, observacoes);
    setFechadoComSucesso(true);
  };

  const handleConsolidarGeral = () => {
    setConsolidadoFinalizado(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Seletor de Modo: Consolidado vs Unidade Específica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {modoVisualizacao === 'CONSOLIDADO' ? 'Fechamento de Expediente - Consolidado' : 'Fechamento de Caixa - Unidade Ativa'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {modoVisualizacao === 'CONSOLIDADO'
                ? 'Conferência de gaveta e fechamento de turno das 3 unidades da rede'
                : `Turno #${turnoAtual?.numeroTurno || 1} • Aberto em ${formatDateTime(turnoAtual?.dataHoraAbertura)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setModoVisualizacao('CONSOLIDADO')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                modoVisualizacao === 'CONSOLIDADO' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" /> Rede (3 Lojas)
            </button>
            <button
              onClick={() => setModoVisualizacao('UNIDADE_ATIVA')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                modoVisualizacao === 'UNIDADE_ATIVA' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Unidade Atual
            </button>
          </div>
        </div>
      </div>

      {modoVisualizacao === 'CONSOLIDADO' ? (
        /* VISÃO CONSOLIDADA DAS 3 LOJAS */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div>
              <span className="text-xs text-slate-400 block">Resumo do Movimento Consolidado</span>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">3 Turnos prontos para conferência e liquidação</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSincronizarManual}
                disabled={sincronizandoWs}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Sincronizar dados em tempo real via WebSocket"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${sincronizandoWs ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar ao Vivo</span>
              </button>

              <div className="bg-slate-950 border border-slate-800 px-5 py-2 rounded-xl flex items-center gap-3">
                <div>
                  <span className="text-xs text-slate-400 block">Faturamento Total:</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">
                    {formatCurrency(totalGeralVendas)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {consolidadoFinalizado && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold">Expediente geral de todas as 3 lojas consolidado com sucesso!</span>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir Relatório Consolidado
              </button>
            </div>
          )}

          <div className="space-y-4">
            {caixas.map((c) => {
              const dinheiroInf = parseFloat(c.dinheiroInformado.replace(',', '.')) || 0;
              const hasInput = c.dinheiroInformado.trim() !== '';
              const diferenca = hasInput ? dinheiroInf - c.dinheiroSistema : 0;
              const totalUnidade = c.dinheiroSistema + c.pixSistema + c.cartaoSistema;

              return (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="font-bold text-base text-amber-400">{c.loja}</h3>
                      <p className="text-xs text-slate-400">Operador(a): <span className="text-slate-300 font-medium">{c.operador}</span></p>
                    </div>
                    <span className="text-xs bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20 font-semibold">
                      Turno Encerrado
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Dinheiro (Sistema)</span>
                      <span className="text-sm font-bold text-slate-100 font-mono mt-0.5 block">
                        {formatCurrency(c.dinheiroSistema)}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Pix (Sistema)</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                        {formatCurrency(c.pixSistema)}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Cartão (Sistema)</span>
                      <span className="text-sm font-bold text-indigo-400 font-mono mt-0.5 block">
                        {formatCurrency(c.cartaoSistema)}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-xs text-slate-400 block">Total Unidade</span>
                      <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                        {formatCurrency(totalUnidade)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-300">Dinheiro Contado na Gaveta:</span>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="R$ 0,00" 
                        value={c.dinheiroInformado}
                        onChange={(e) => atualizarValorInformado(c.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 focus:border-amber-500 px-3 py-2 rounded-lg text-sm w-36 font-mono font-bold text-slate-100 outline-hidden transition"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Diferença (Quebra/Sobra):</span>
                      <span className={`font-mono font-bold text-sm ${
                        !hasInput 
                          ? 'text-slate-500' 
                          : Math.abs(diferenca) < 0.01 
                          ? 'text-slate-300' 
                          : diferenca > 0 
                          ? 'text-emerald-400' 
                          : 'text-rose-400'
                      }`}>
                        {!hasInput ? 'R$ 0,00' : (diferenca > 0 ? `+${formatCurrency(diferenca)}` : formatCurrency(diferenca))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Demonstrativo
            </button>
            <button 
              onClick={handleConsolidarGeral}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Consolidar e Fechar Expediente Geral
            </button>
          </div>
        </div>
      ) : (
        /* VISÃO INDIVIDUAL DA UNIDADE ATIVA (CONFERÊNCIA CEGA & AUDITORIA) */
        <div>
          {fechadoComSucesso ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Expediente da Unidade Encerrado!</h2>
              <p className="text-xs text-slate-400">
                O caixa foi bloqueado e o relatório de fechamento do turno foi gravado no sistema com assinatura digital do operador {operadorAtivo.nome}.
              </p>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Espelho de Fechamento
                </button>
                <button
                  onClick={() => {
                    setFechadoComSucesso(false);
                    setEtapa('CONFERENCIA_CEGA');
                    onReabrirOuNovoTurno();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Abrir Novo Turno
                </button>
              </div>
            </div>
          ) : etapa === 'CONFERENCIA_CEGA' ? (
            /* ETAPA 1: CONFERÊNCIA CEGA */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-5">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                    <p className="font-bold text-amber-400 mb-0.5">Procedimento de Conferência Cega Ativo</p>
                    Conte o dinheiro físico da gaveta e os comprovantes das maquininhas POS e digite os valores abaixo. O sistema só exibirá a conciliação após você avançar.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dinheiro */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" /> Dinheiro em Gaveta (Espécie)
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={declaradoDinheiro}
                      onChange={(e) => setDeclaradoDinheiro(e.target.value)}
                      className="w-full text-lg font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500">Inclui moedas e notas na gaveta</span>
                  </div>

                  {/* PIX */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-teal-400 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4" /> Comprovantes PIX
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={declaradoPix}
                      onChange={(e) => setDeclaradoPix(e.target.value)}
                      className="w-full text-lg font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500">Soma dos comprovantes no extrato PIX</span>
                  </div>

                  {/* Cartão de Débito */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" /> POS Cartão Débito
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={declaradoDebito}
                      onChange={(e) => setDeclaradoDebito(e.target.value)}
                      className="w-full text-lg font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500">Total do relatório da maquininha (Débito)</span>
                  </div>

                  {/* Cartão de Crédito */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" /> POS Cartão Crédito
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={declaradoCredito}
                      onChange={(e) => setDeclaradoCredito(e.target.value)}
                      className="w-full text-lg font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500">Total do relatório da maquininha (Crédito)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Observações do Fechamento de Caixa:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Diferença de moedas para troco, falta de comprovante de papel, etc."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="btn-avancar-auditoria"
                    onClick={handleAvancarParaAuditoria}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    Conferir & Auditar Valores <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-200">Resumo da Declaração</h3>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Dinheiro Informado:</span>
                    <span className="font-mono text-slate-200">{formatCurrency(numDeclaradoDinheiro)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>PIX Informado:</span>
                    <span className="font-mono text-slate-200">{formatCurrency(numDeclaradoPix)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Cartões Informados:</span>
                    <span className="font-mono text-slate-200">{formatCurrency(numDeclaradoDebito + numDeclaradoCredito)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-300">Total Declarado:</span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      {formatCurrency(totalDeclarado)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1.5">
                  <p className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" /> Operador responsável: {operadorAtivo.nome}
                  </p>
                  <p>O encerramento do turno bloqueia lançamentos retroativos.</p>
                </div>
              </div>
            </div>
          ) : (
            /* ETAPA 2: RESUMO DE AUDITORIA & CONCILIAÇÃO */
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">Espelho de Conciliação e Auditoria do Caixa</h2>
                  <p className="text-xs text-slate-400">Comparativo entre valores calculados pelo sistema e contagem física declarada.</p>
                </div>
                <button
                  onClick={() => setEtapa('CONFERENCIA_CEGA')}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  ← Revisar Contagem
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400">Calculado pelo Sistema:</span>
                  <div className="text-xl font-bold text-slate-200 font-mono mt-1">
                    {formatCurrency(totalSistemaEsperado)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400">Total Declarado pelo Operador:</span>
                  <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                    {formatCurrency(totalDeclarado)}
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  Math.abs(diferencaTotal) < 0.01 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : diferencaTotal < 0 
                    ? 'bg-rose-500/10 border-rose-500/30' 
                    : 'bg-cyan-500/10 border-cyan-500/30'
                }`}>
                  <span className="text-xs font-semibold text-slate-300">
                    {Math.abs(diferencaTotal) < 0.01 ? 'Caixa Bateu Perfeitamente' : diferencaTotal < 0 ? 'Quebra de Caixa (Falta)' : 'Sobra de Caixa'}
                  </span>
                  <div className={`text-xl font-bold font-mono mt-1 ${
                    Math.abs(diferencaTotal) < 0.01 ? 'text-emerald-400' : diferencaTotal < 0 ? 'text-rose-400' : 'text-cyan-400'
                  }`}>
                    {diferencaTotal > 0 ? '+' : ''}{formatCurrency(diferencaTotal)}
                  </div>
                </div>
              </div>

              {/* Tabela de Conciliação por Meio */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Forma de Pagamento</th>
                      <th className="py-2.5 px-3 text-right">Esperado (Sistema)</th>
                      <th className="py-2.5 px-3 text-right">Declarado (Contagem)</th>
                      <th className="py-2.5 px-3 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr>
                      <td className="py-3 px-3 text-slate-200 font-sans font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" /> Dinheiro em Gaveta (c/ Fundo e Sangrias)
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(sistemaEsperadoDinheiro)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(numDeclaradoDinheiro)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${numDeclaradoDinheiro - sistemaEsperadoDinheiro < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(numDeclaradoDinheiro - sistemaEsperadoDinheiro)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 text-slate-200 font-sans font-medium flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-teal-400" /> PIX Instantâneo
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(sistemaEsperadoPix)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(numDeclaradoPix)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${numDeclaradoPix - sistemaEsperadoPix < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(numDeclaradoPix - sistemaEsperadoPix)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 text-slate-200 font-sans font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-400" /> Cartão Débito
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(sistemaEsperadoDebito)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(numDeclaradoDebito)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${numDeclaradoDebito - sistemaEsperadoDebito < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(numDeclaradoDebito - sistemaEsperadoDebito)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3 text-slate-200 font-sans font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-purple-400" /> Cartão Crédito
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(sistemaEsperadoCredito)}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(numDeclaradoCredito)}</td>
                      <td className={`py-3 px-3 text-right font-bold ${numDeclaradoCredito - sistemaEsperadoCredito < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(numDeclaradoCredito - sistemaEsperadoCredito)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Relatório
                </button>

                <button
                  id="btn-confirmar-fechamento-final"
                  onClick={handleFinalizarTurno}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-xl shadow-purple-600/20 transition-all cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmar e Fechar Caixa Definitivamente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
