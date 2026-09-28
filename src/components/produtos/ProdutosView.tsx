import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Tag, 
  Edit3, 
  DollarSign,
  Store,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { Produto, CategoriaProduto, Empresa } from '../../types';
import { formatCurrency, getCategoryBadge } from '../../utils/formatters';

interface ProdutosViewProps {
  produtos: Produto[];
  empresaAtiva?: Empresa;
  todasEmpresas?: Empresa[];
  onTrocarEmpresa?: (empresa: Empresa) => void;
  onAtualizarEstoque: (produtoId: string, novoEstoque: number) => void;
  onAdicionarProduto: (produto: Omit<Produto, 'id'>) => void;
  onAtualizarPreco?: (produtoId: string, novoPreco: number) => void;
}

export const ProdutosView: React.FC<ProdutosViewProps> = ({
  produtos = [],
  empresaAtiva,
  todasEmpresas = [],
  onTrocarEmpresa,
  onAtualizarEstoque,
  onAdicionarProduto,
  onAtualizarPreco
}) => {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('TODAS');
  const [showModalNovoProduto, setShowModalNovoProduto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [estoqueEditando, setEstoqueEditando] = useState<string>('');
  const [precoEditando, setPrecoEditando] = useState<string>('');

  // Form novo produto
  const [novoNome, setNovoNome] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<CategoriaProduto>('ESPETOS');
  const [novoPrecoVenda, setNovoPrecoVenda] = useState('');
  const [novoPrecoCusto, setNovoPrecoCusto] = useState('');
  const [novoEstoque, setNovoEstoque] = useState('50');
  const [novoEstoqueMin, setNovoEstoqueMin] = useState('10');

  const produtosFiltrados = (produtos || []).filter((p) => {
    const matchCat = categoriaAtiva === 'TODAS' || p.categoria === categoriaAtiva;
    const matchBusca = busca === '' || p.nome.toLowerCase().includes(busca.toLowerCase());
    return matchCat && matchBusca;
  });

  const handleSalvarProduto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome || !novoPrecoVenda) return;

    onAdicionarProduto({
      nome: novoNome,
      categoria: novaCategoria,
      precoVenda: parseFloat(novoPrecoVenda.replace(',', '.')) || 0,
      precoCusto: parseFloat(novoPrecoCusto.replace(',', '.')) || 0,
      estoqueAtual: parseInt(novoEstoque) || 0,
      estoqueMinimo: parseInt(novoEstoqueMin) || 0,
      unidade: 'UN',
      atalhoRapido: true
    });

    setShowModalNovoProduto(false);
    setNovoNome('');
    setNovoPrecoVenda('');
    setNovoPrecoCusto('');
  };

  const handleAbrirEdicao = (prod: Produto) => {
    setProdutoEditando(prod);
    setEstoqueEditando(prod.estoqueAtual.toString());
    setPrecoEditando(prod.precoVenda.toFixed(2));
  };

  const handleSalvarEdicaoRapida = () => {
    if (!produtoEditando) return;
    const novoEstoqueNum = parseInt(estoqueEditando);
    const novoPrecoNum = parseFloat(precoEditando.replace(',', '.'));

    if (!isNaN(novoEstoqueNum)) {
      onAtualizarEstoque(produtoEditando.id, novoEstoqueNum);
    }
    if (!isNaN(novoPrecoNum) && onAtualizarPreco) {
      onAtualizarPreco(produtoEditando.id, novoPrecoNum);
    }

    setProdutoEditando(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo / Header com Seletor de Loja */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[#111827] border border-gray-800 text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-inner">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Gestão de Estoque e Preços
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Controle individualizado por estabelecimento e preços em tempo real
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Loja */}
          {todasEmpresas.length > 0 && onTrocarEmpresa && (
            <div className="flex items-center gap-2 bg-[#1f2937] border border-gray-700 px-3 py-1.5 rounded-xl">
              <Store className="w-4 h-4 text-amber-400" />
              <select
                value={empresaAtiva?.id || todasEmpresas[0]?.id}
                onChange={(e) => {
                  const emp = todasEmpresas.find(item => item.id === e.target.value);
                  if (emp) onTrocarEmpresa(emp);
                }}
                className="bg-transparent text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
              >
                {todasEmpresas.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                    {emp.nomeFantasia}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowModalNovoProduto(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      {/* Card da Tabela de Produtos */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Barra de Filtros e Busca */}
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-[#1f2937]/30">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por descrição ou categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#0b0f19] border border-gray-700 rounded-xl text-gray-200 outline-hidden focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {['TODAS', 'ESPETOS', 'BEBIDAS_ALCOOLICAS', 'BEBIDAS_NAO_ALCOOLICAS', 'ESSENCIAS_NARGHILE', 'CARVAO_ALUMINIO', 'PODS_VAPES', 'PORCOES'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  categoriaAtiva === cat
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-[#1f2937] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                {cat === 'TODAS' ? 'Todos' : cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela de Produtos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase bg-[#1f2937]/50">
                <th className="p-4">Produto</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Preço Venda</th>
                <th className="p-4">Estoque Atual</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xs text-gray-400">
                    Nenhum produto encontrado para o filtro aplicado.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map((prod) => {
                  const isEstoqueBaixo = prod.estoqueAtual < 50;
                  const badge = getCategoryBadge(prod.categoria);

                  return (
                    <tr key={prod.id} className="hover:bg-gray-800/50 transition">
                      <td className="p-4 font-medium text-white">
                        <div>{prod.nome}</div>
                        <span className="text-[10px] text-gray-400 font-mono">Cód: {prod.id}</span>
                      </td>
                      <td className="p-4 text-gray-400 text-xs">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-amber-400 font-mono">
                        {formatCurrency(prod.precoVenda)}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isEstoqueBaixo 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>
                          {prod.estoqueAtual} unidades
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleAbrirEdicao(prod)}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição Rápida */}
      {produtoEditando && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-sm w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white">Ajustar Produto</h2>
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md">
                {empresaAtiva?.nomeFantasia || 'Loja Ativa'}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-300 font-semibold mb-3">{produtoEditando.nome}</p>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={precoEditando}
                    onChange={(e) => setPrecoEditando(e.target.value)}
                    className="w-full p-2.5 bg-[#0b0f19] border border-gray-700 rounded-xl text-white font-mono outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Estoque Atual (Unidades)</label>
                  <input
                    type="number"
                    value={estoqueEditando}
                    onChange={(e) => setEstoqueEditando(e.target.value)}
                    className="w-full p-2.5 bg-[#0b0f19] border border-gray-700 rounded-xl text-white font-mono outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setProdutoEditando(null)}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicaoRapida}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Produto */}
      {showModalNovoProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Cadastrar Novo Produto</h2>

            <form onSubmit={handleSalvarProduto} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Espeto de Kafta c/ Queijo"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full p-2 bg-[#0b0f19] border border-gray-700 rounded-lg text-white outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Categoria</label>
                <select
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value as CategoriaProduto)}
                  className="w-full p-2 bg-[#0b0f19] border border-gray-700 rounded-lg text-white outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="ESPETOS">🍢 Espetos</option>
                  <option value="BEBIDAS_ALCOOLICAS">🍺 Chopp & Cervejas</option>
                  <option value="BEBIDAS_NAO_ALCOOLICAS">🥤 Bebidas Não Alcoólicas</option>
                  <option value="ESSENCIAS_NARGHILE">💨 Essências & Narguile</option>
                  <option value="CARVAO_ALUMINIO">🔥 Carvão & Acessórios</option>
                  <option value="PODS_VAPES">⚡ Pods & Vapes</option>
                  <option value="PORCOES">🍟 Porções & Cozinha</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    placeholder="15.00"
                    value={novoPrecoVenda}
                    onChange={(e) => setNovoPrecoVenda(e.target.value)}
                    className="w-full p-2 bg-[#0b0f19] border border-gray-700 rounded-lg text-white font-mono outline-hidden focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.10"
                    placeholder="6.00"
                    value={novoPrecoCusto}
                    onChange={(e) => setNovoPrecoCusto(e.target.value)}
                    className="w-full p-2 bg-[#0b0f19] border border-gray-700 rounded-lg text-white font-mono outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    value={novoEstoque}
                    onChange={(e) => setNovoEstoque(e.target.value)}
                    className="w-full p-2 bg-[#0b0f19] border border-gray-700 rounded-lg text-white font-mono outline-hidden focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    value={novoEstoqueMin}
                    onChange={(e) => setNovoEstoqueMin(e.target.value)}
                    className="w-full p-2 bg-[#0b0f19] border border-gray-700 rounded-lg text-white font-mono outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModalNovoProduto(false)}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-md cursor-pointer"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
