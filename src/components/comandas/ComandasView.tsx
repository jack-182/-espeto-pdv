import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Users, 
  Search, 
  Tag, 
  Filter, 
  ArrowRightLeft,
  X
} from 'lucide-react';
import { Comanda, Produto, StatusComanda, Operador } from '../../types';
import { formatCurrency, formatTimeOnly, getCategoryBadge } from '../../utils/formatters';

interface ComandasViewProps {
  comandas: Comanda[];
  produtos: Produto[];
  operadorAtivo: Operador;
  empresaAtiva?: { id: string; nomeFantasia: string; segmento: string };
  onAdicionarItemComanda: (comandaId: string, produto: Produto, quantidade: number) => void;
  onRemoverItemComanda: (comandaId: string, itemId: string) => void;
  onAlterarQuantidadeItem: (comandaId: string, itemId: string, delta: number) => void;
  onOpenNovaComanda: () => void;
  onOpenRecebimentoComanda: (comanda: Comanda) => void;
  termoBuscaGlobal: string;
}

export const ComandasView: React.FC<ComandasViewProps> = ({
  comandas = [],
  produtos = [],
  operadorAtivo,
  onAdicionarItemComanda,
  onRemoverItemComanda,
  onAlterarQuantidadeItem,
  onOpenNovaComanda,
  onOpenRecebimentoComanda,
  termoBuscaGlobal
}) => {
  const [comandaSelecionadaId, setComandaSelecionadaId] = useState<string>((comandas || [])[0]?.id || '');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODAS_ABERTAS');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS');
  const [buscaProduto, setBuscaProduto] = useState<string>('');
  const [dividirPessoas, setDividirPessoas] = useState<number>(1);

  useEffect(() => {
    if (!(comandas || []).some(c => c.id === comandaSelecionadaId)) {
      setComandaSelecionadaId((comandas || [])[0]?.id || '');
    }
  }, [comandas]);

  // Filtragem de comandas
  const comandasFiltradas = (comandas || []).filter((cmd) => {
    // Filtro global ou local
    const termo = (termoBuscaGlobal || '').toLowerCase();
    const matchBusca = termo === '' || 
      cmd.numero.toString().includes(termo) || 
      (cmd.clienteNome && cmd.clienteNome.toLowerCase().includes(termo));

    if (!matchBusca) return false;

    if (filtroStatus === 'TODAS_ABERTAS') {
      return cmd.status === 'ABERTA' || cmd.status === 'EM_FECHAMENTO';
    }
    if (filtroStatus === 'PAGAS') {
      return cmd.status === 'PAGA';
    }
    return true;
  });

  const comandaAtiva = (comandas || []).find(c => c.id === comandaSelecionadaId) || comandasFiltradas[0];

  // Produtos filtrados para lançamento rápido
  const produtosFiltrados = (produtos || []).filter((p) => {
    const matchCat = categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro;
    const matchNome = buscaProduto === '' || p.nome.toLowerCase().includes(buscaProduto.toLowerCase());
    return matchCat && matchNome;
  });

  const categoriasDisponiveis = [
    { id: 'TODAS', label: 'Todos os Itens' },
    { id: 'ESPETOS', label: '🍢 Espetos' },
    { id: 'BEBIDAS_ALCOOLICAS', label: '🍺 Chopp & Cervejas' },
    { id: 'BEBIDAS_NAO_ALCOOLICAS', label: '🥤 Bebidas' },
    { id: 'ESSENCIAS_NARGHILE', label: '💨 Narguile & Essências' },
    { id: 'CARVAO_ALUMINIO', label: '🔥 Carvão / Alumínio' },
    { id: 'PODS_VAPES', label: '⚡ Pods & Vapes' },
    { id: 'PORCOES', label: '🍟 Porções' }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Topo: Barra de Ferramentas de Comandas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Gestão de Comandas & Mesas
              <span className="text-xs font-mono font-normal text-slate-400">
                ({comandasFiltradas.length} encontradas)
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Lançamento ágil de itens, transferência e fechamento de conta no balcão.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros de Status */}
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFiltroStatus('TODAS_ABERTAS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filtroStatus === 'TODAS_ABERTAS'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Abertas ({comandas.filter(c => c.status !== 'PAGA').length})
            </button>
            <button
              onClick={() => setFiltroStatus('PAGAS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filtroStatus === 'PAGAS'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pagas
            </button>
          </div>

          <button
            id="btn-nova-comanda-top"
            onClick={onOpenNovaComanda}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Comanda
          </button>
        </div>
      </div>

      {/* Grid Principal: Lista de Comandas (Esquerda) + Detalhes & Lançamento (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Coluna 1 (4 colunas): Grid de Seleção de Comandas */}
        <div className="lg:col-span-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1 custom-scrollbar">
            {comandasFiltradas.map((cmd) => {
              const isSelected = comandaAtiva?.id === cmd.id;
              const isPaga = cmd.status === 'PAGA';

              return (
                <div
                  key={cmd.id}
                  id={`card-comanda-${cmd.numero}`}
                  onClick={() => setComandaSelecionadaId(cmd.id)}
                  className={`
                    p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between
                    ${isSelected 
                      ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/30 shadow-lg' 
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }
                    ${isPaga ? 'opacity-70 bg-slate-950' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-base font-bold text-amber-400">
                        #{cmd.numero.toString().padStart(2, '0')}
                      </span>
                      <p className="text-xs font-semibold text-slate-200 truncate mt-0.5 max-w-[110px]">
                        {cmd.clienteNome || `Mesa ${cmd.numero}`}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isPaga 
                        ? 'bg-slate-800 text-slate-400' 
                        : cmd.status === 'EM_FECHAMENTO'
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {isPaga ? 'Paga' : cmd.status === 'EM_FECHAMENTO' ? 'Fechando' : 'Aberta'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {(cmd.itens || []).reduce((acc, i) => acc + (i.quantidade || 0), 0)} itens
                    </span>
                    <span className="font-bold text-slate-100 font-mono">
                      {formatCurrency(cmd.totalLiquido || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna 2 & 3 (8 colunas): Detalhes da Comanda Ativa & Catálogo de Lançamento */}
        {comandaAtiva ? (
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Lado Esquerdo da Comanda (7 colunas): Itens da Comanda & Totais */}
            <div className="md:col-span-6 flex flex-col justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm min-h-[500px]">
              <div>
                {/* Cabeçalho da Comanda */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-amber-400">
                        Comanda #{comandaAtiva.numero.toString().padStart(2, '0')}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {comandaAtiva.clienteNome}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Aberta às {formatTimeOnly(comandaAtiva.abertaEm)} por {comandaAtiva.abertaPor}
                    </p>
                  </div>

                  {comandaAtiva.status !== 'PAGA' && (
                    <button
                      onClick={() => alert(`Comanda #${comandaAtiva.numero} transferida com sucesso.`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs flex items-center gap-1 cursor-pointer"
                      title="Transferir mesa / comanda"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Lista de Itens Consumidos */}
                <div className="py-2 space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar">
                  {(!comandaAtiva.itens || comandaAtiva.itens.length === 0) ? (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      Nenhum item lançado ainda. Clique nos produtos ao lado para lançar.
                    </div>
                  ) : (
                    (comandaAtiva.itens || []).map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {item.nomeProduto}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {item.quantidade}x {formatCurrency(item.precoUnitario)} = {formatCurrency(item.subtotal)}
                          </p>
                        </div>

                        {comandaAtiva.status !== 'PAGA' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onAlterarQuantidadeItem(comandaAtiva.id, item.id, -1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono text-xs font-bold w-5 text-center text-slate-100">
                              {item.quantidade}
                            </span>
                            <button
                              onClick={() => onAlterarQuantidadeItem(comandaAtiva.id, item.id, 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                            <button
                              onClick={() => onRemoverItemComanda(comandaAtiva.id, item.id)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-500/20 ml-1 cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Totais & Fechamento de Conta */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal Bruto:</span>
                  <span className="font-mono">{formatCurrency(comandaAtiva.totalBruto)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Taxa de Serviço (10%):</span>
                  <span className="font-mono">{formatCurrency(comandaAtiva.taxaServico)}</span>
                </div>

                {/* Divisão de Conta */}
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dividir p/ pessoas:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={dividirPessoas}
                      onChange={(e) => setDividirPessoas(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-mono outline-hidden"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                    <span className="font-bold text-amber-400 font-mono">
                      {formatCurrency(comandaAtiva.totalLiquido / dividirPessoas)} /cada
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-sm font-bold text-slate-200">Total a Pagar:</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">
                    {formatCurrency(comandaAtiva.totalLiquido)}
                  </span>
                </div>

                {comandaAtiva.status !== 'PAGA' ? (
                  <button
                    id="btn-pagar-comanda-ativa"
                    onClick={() => onOpenRecebimentoComanda(comandaAtiva)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Receber / Fechar Comanda (F8)
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950 text-center text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    ✓ Comanda Finalizada e Paga no Caixa
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito da Comanda (6 colunas): Lançamento Rápido de Produtos */}
            <div className="md:col-span-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Lançar no Balcão
                  </span>
                  <span className="text-[11px] text-amber-400 font-medium">
                    1 Clique = +1 Unidade
                  </span>
                </div>

                {/* Filtro de Categorias de Produtos */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                  {categoriasDisponiveis.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoriaFiltro(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        categoriaFiltro === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Busca de Produtos */}
                <div className="relative my-2.5">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou código..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 outline-hidden focus:border-amber-500"
                  />
                  {buscaProduto && (
                    <button
                      onClick={() => setBuscaProduto('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Lista de Botões de Produtos */}
                <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                  {produtosFiltrados.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => onAdicionarItemComanda(comandaAtiva.id, prod, 1)}
                      disabled={comandaAtiva.status === 'PAGA'}
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800/80 hover:border-amber-500/50 text-left transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex flex-col justify-between"
                    >
                      <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight group-hover:text-amber-300">
                        {prod.nome}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Estq: {prod.estoqueAtual}
                        </span>
                        <span className="text-xs font-bold text-amber-400 font-mono">
                          {formatCurrency(prod.precoVenda)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
            Selecione ou crie uma comanda para visualizar os itens.
          </div>
        )}
      </div>
    </div>
  );
};
