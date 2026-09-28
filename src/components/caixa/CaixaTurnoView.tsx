import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  DollarSign, 
  Clock, 
  User, 
  Receipt, 
  Filter,
  CheckCircle2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { TurnoCaixa, MovimentacaoCaixa, Operador } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { AdminAuthModal } from '../auth/AdminAuthModal';
import { usePermissions } from '../../hooks/usePermissions';

interface CaixaTurnoViewProps {
  turnoAtual: TurnoCaixa | null;
  movimentacoes: MovimentacaoCaixa[];
  operadorAtivo: Operador;
  onOpenSangria: () => void;
  onOpenSuprimento: () => void;
  onOpenFechamento: () => void;
  onOpenAberturaCaixa: () => void;
}

export const CaixaTurnoView: React.FC<CaixaTurnoViewProps> = ({
  turnoAtual,
  movimentacoes = [],
  operadorAtivo,
  onOpenSangria,
  onOpenSuprimento,
  onOpenFechamento,
  onOpenAberturaCaixa
}) => {
  const [filtroTipo, setFiltroTipo] = useState<string>('TODAS');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const { isAdmin } = usePermissions();

  const isCaixaAberto = turnoAtual?.status === 'ABERTO';

  const handleSolicitarSangria = () => {
    // Intercepta a sangria solicitando o PIN de Administrador touch
    setIsAuthModalOpen(true);
  };

  const safeMovs = movimentacoes || [];

  // Cálculos
  const fundoTroco = turnoAtual?.saldoInicialSuprimento || 0;
  const vendasDinheiro = safeMovs
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'DINHEIRO')
    .reduce((acc, m) => acc + m.valor, 0);

  const vendasPix = safeMovs
    .filter(m => m.tipo === 'VENDA' && m.metodoPagamento === 'PIX')
    .reduce((acc, m) => acc + m.valor, 0);

  const vendasCartao = safeMovs
    .filter(m => m.tipo === 'VENDA' && (m.metodoPagamento === 'CARTAO_DEBITO' || m.metodoPagamento === 'CARTAO_CREDITO'))
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSangrias = safeMovs
    .filter(m => m.tipo === 'SANGRIA')
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSuprimentos = safeMovs
    .filter(m => m.tipo === 'SUPRIMENTO')
    .reduce((acc, m) => acc + m.valor, 0);

  // Dinheiro em gaveta = Fundo inicial + Vendas Dinheiro + Suprimentos - Sangrias
  const saldoDinheiroGaveta = fundoTroco + vendasDinheiro + totalSuprimentos - totalSangrias;
  const faturamentoTotalVendas = vendasDinheiro + vendasPix + vendasCartao;

  const movimentacoesFiltradas = safeMovs.filter((m) => {
    if (filtroTipo === 'TODAS') return true;
    return m.tipo === filtroTipo;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo do Módulo de Caixa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Fluxo de Caixa & Turno Operacional
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                isCaixaAberto 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {isCaixaAberto ? `Turno ${turnoAtual?.numeroTurno} Ativo` : 'Caixa Encerrado'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão de suprimentos, sangrias de segurança e conciliação auditada de valores.
            </p>
          </div>
        </div>

        {isCaixaAberto ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-caixa-sangria"
              onClick={handleSolicitarSangria}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-semibold text-xs transition-all cursor-pointer"
            >
              <ArrowDownCircle className="w-4 h-4 text-rose-400" />
              Realizar Sangria
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" /> PIN
              </span>
            </button>
            <button
              id="btn-caixa-suprimento"
              onClick={onOpenSuprimento}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-semibold text-xs transition-all cursor-pointer"
            >
              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
              Suprimento (Troco)
            </button>
            <button
              id="btn-caixa-fechamento"
              onClick={onOpenFechamento}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Encerrar Turno (F8)
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAberturaCaixa}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
          >
            Abrir Novo Turno
          </button>
        )}
      </div>

      {/* Grid de Balanço do Turno */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dinheiro Físico em Gaveta */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400">Saldo Físico em Gaveta</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {formatCurrency(saldoDinheiroGaveta)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Dinheiro esperado na contagem física
          </p>
        </div>

        {/* Fundo de Troco Inicial */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400">Fundo de Troco (Abertura)</span>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">
            {formatCurrency(fundoTroco)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Lançado na abertura do caixa
          </p>
        </div>

        {/* Total de Sangrias Realizadas */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-rose-400">Sangrias (Retiradas)</span>
          <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
            - {formatCurrency(totalSangrias)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Enviadas para o cofre da gerência
          </p>
        </div>

        {/* Vendas Faturadas no Turno */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-amber-400">Total Vendas (Turno)</span>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {formatCurrency(faturamentoTotalVendas)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            PIX, Cartões e Espécie
          </p>
        </div>
      </div>

      {/* Extrato Detalhado de Movimentações */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">
              Extrato Auditado de Movimentações
            </h2>
            <p className="text-xs text-slate-400">
              Todas as entradas, saídas, vendas e retiradas com registro de operador.
            </p>
          </div>

          {/* Filtro por tipo */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            {['TODAS', 'VENDA', 'SANGRIA', 'SUPRIMENTO'].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filtroTipo === tipo
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tipo === 'TODAS' ? 'Todas' : tipo.charAt(0) + tipo.slice(1).toLowerCase() + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela de Extrato */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">Horário</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Descrição / Comanda</th>
                <th className="py-3 px-3">Forma Pagto</th>
                <th className="py-3 px-3">Operador</th>
                <th className="py-3 px-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {movimentacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhuma movimentação registrada para este filtro.
                  </td>
                </tr>
              ) : (
                movimentacoesFiltradas.map((mov) => {
                  const isEntrada = mov.tipo === 'VENDA' || mov.tipo === 'SUPRIMENTO' || mov.tipo === 'ABERTURA';
                  const isSangria = mov.tipo === 'SANGRIA';

                  return (
                    <tr key={mov.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {formatDateTime(mov.timestamp)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          mov.tipo === 'VENDA'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : mov.tipo === 'SANGRIA'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : mov.tipo === 'SUPRIMENTO'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-200 font-medium">
                        {mov.descricao}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {mov.metodoPagamento ? (
                          <span className="font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                            {mov.metodoPagamento.replace('_', ' ')}
                          </span>
                        ) : '--'}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {mov.operadorNome}
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${
                        isSangria ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {isSangria ? '-' : '+'} {formatCurrency(mov.valor)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Touch de Autorização de Administrador */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          onOpenSangria();
        }}
        actionName="Autorizar Sangria de Gaveta"
      />
    </div>
  );
};
