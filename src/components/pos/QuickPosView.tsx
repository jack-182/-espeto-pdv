import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  CheckCircle2, 
  QrCode, 
  CreditCard, 
  DollarSign, 
  Plus, 
  Minus, 
  Search, 
  X,
  Sparkles,
  Calculator
} from 'lucide-react';
import { Produto, MetodoPagamento, Operador } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

interface QuickPosViewProps {
  produtos: Produto[];
  operadorAtivo: Operador;
  onFinalizarVendaDireta: (itens: ItemCarrinho[], metodo: MetodoPagamento, valorRecebido: number, troco: number) => void;
}

export const QuickPosView: React.FC<QuickPosViewProps> = ({
  produtos = [],
  operadorAtivo,
  onFinalizarVendaDireta
}) => {
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => {
    const itemDefault = (produtos || []).find(p => p.nome.includes('Batata Frita') || p.id === 'prod-5');
    return itemDefault ? [{ produto: itemDefault, quantidade: 1 }] : [];
  });
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('TODAS');
  const [busca, setBusca] = useState<string>('');
  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoPagamento>('PIX');
  const [valorPagoDinheiro, setValorPagoDinheiro] = useState<string>('');
  const [showQrCodePix, setShowQrCodePix] = useState(false);

  const totalBruto = carrinho.reduce((acc, item) => acc + (item.produto.precoVenda * item.quantidade), 0);
  const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);

  const valorPagoNum = parseFloat(valorPagoDinheiro.replace(',', '.')) || 0;
  const trocoCalculado = Math.max(0, valorPagoNum - totalBruto);

  const adicionarAoCarrinho = (prod: Produto) => {
    setCarrinho((prev) => {
      const index = prev.findIndex(item => item.produto.id === prod.id);
      if (index >= 0) {
        const novo = [...prev];
        novo[index].quantidade += 1;
        return novo;
      }
      return [...prev, { produto: prod, quantidade: 1 }];
    });
  };

  const alterarQuantidade = (prodId: string, delta: number) => {
    setCarrinho((prev) => {
      return prev.map(item => {
        if (item.produto.id === prodId) {
          const novaQtd = item.quantidade + delta;
          return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
        }
        return item;
      }).filter(Boolean) as ItemCarrinho[];
    });
  };

  const removerDoCarrinho = (prodId: string) => {
    setCarrinho(prev => prev.filter(item => item.produto.id !== prodId));
  };

  const limparCarrinho = () => {
    setCarrinho([]);
    setValorPagoDinheiro('');
    setShowQrCodePix(false);
  };

  const finalizarVenda = () => {
    if (carrinho.length === 0) return;
    if (metodoSelecionado === 'DINHEIRO' && valorPagoNum < totalBruto && valorPagoNum > 0) {
      alert('Valor em dinheiro recebido é menor que o total da venda!');
      return;
    }

    const valorFinalRecebido = metodoSelecionado === 'DINHEIRO' ? (valorPagoNum || totalBruto) : totalBruto;
    onFinalizarVendaDireta(carrinho, metodoSelecionado, valorFinalRecebido, trocoCalculado);
    limparCarrinho();
  };

  const produtosFiltrados = (produtos || []).filter((p) => {
    const matchCat = categoriaAtiva === 'TODAS' || p.categoria === categoriaAtiva;
    const matchBusca = busca === '' || p.nome.toLowerCase().includes(busca.toLowerCase());
    return matchCat && matchBusca;
  });

  const categorias = [
    { id: 'TODAS', label: 'Todos os Produtos' },
    { id: 'ESPETOS', label: '🍢 Espetos' },
    { id: 'BEBIDAS_ALCOOLICAS', label: '🍺 Chopp & Cervejas' },
    { id: 'BEBIDAS_NAO_ALCOOLICAS', label: '🥤 Não Alcoólicos' },
    { id: 'ESSENCIAS_NARGHILE', label: '💨 Narguile' },
    { id: 'CARVAO_ALUMINIO', label: '🔥 Carvão' },
    { id: 'PODS_VAPES', label: '⚡ Pods' },
    { id: 'PORCOES', label: '🍟 Porções' }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Topo do PDV Rápido */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Frente de Caixa (PDV Balcão)
              <span className="text-xs font-mono font-normal text-emerald-400">
                • Venda Direta Instantânea
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Operador: {operadorAtivo.nome} | Ideal para clientes do balcão e retiradas expressas.
            </p>
          </div>
        </div>
      </div>

      {/* Grid Principal: Catálogo Rápido (7 colunas) + Carrinho & Pagamento (5 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lado Esquerdo: Grade de Produtos Touch (7 colunas) */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            {/* Categorias em Pílulas */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    categoriaAtiva === cat.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Busca Rápida */}
            <div className="relative my-2">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Digitar nome do produto ou bipar código de barras..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-slate-200 placeholder:text-slate-500 outline-hidden"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Grid de Produtos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
              {produtosFiltrados.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => adicionarAoCarrinho(prod)}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 text-left transition-all cursor-pointer group active:scale-95 flex flex-col justify-between min-h-[90px]"
                >
                  <span className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight group-hover:text-amber-300">
                    {prod.nome}
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Estq: {prod.estoqueAtual}
                    </span>
                    <span className="text-sm font-bold text-amber-400 font-mono">
                      {formatCurrency(prod.precoVenda)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lado Direito: Carrinho & Checkout Express (5 colunas) */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">Itens no Caixa</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400">
                  {totalItens} unid.
                </span>
              </div>
              {carrinho.length > 0 && (
                <button
                  onClick={limparCarrinho}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
            </div>

            {/* Lista do Carrinho */}
            <div className="py-2 space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
              {carrinho.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Carrinho vazio. Toque nos produtos ao lado para lançar.
                </div>
              ) : (
                carrinho.map((item) => (
                  <div
                    key={item.produto.id}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {item.produto.nome}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatCurrency(item.produto.precoVenda)} cada
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => alterarQuantidade(item.produto.id, -1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold w-5 text-center text-slate-100">
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => alterarQuantidade(item.produto.id, 1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold text-amber-400 w-16 text-right">
                        {formatCurrency(item.produto.precoVenda * item.quantidade)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Formas de Pagamento & Troco */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            {/* Escolha do Meio de Pagamento */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setMetodoSelecionado('PIX'); setShowQrCodePix(true); }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  metodoSelecionado === 'PIX'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="text-[11px]">PIX Instantâneo</span>
              </button>

              <button
                onClick={() => { setMetodoSelecionado('CARTAO_DEBITO'); setShowQrCodePix(false); }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  metodoSelecionado === 'CARTAO_DEBITO' || metodoSelecionado === 'CARTAO_CREDITO'
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[11px]">Cartão POS</span>
              </button>

              <button
                onClick={() => { setMetodoSelecionado('DINHEIRO'); setShowQrCodePix(false); }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  metodoSelecionado === 'DINHEIRO'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="text-[11px]">Dinheiro</span>
              </button>
            </div>

            {/* Se for dinheiro: Calculadora de Troco */}
            {metodoSelecionado === 'DINHEIRO' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Valor Recebido do Cliente:</span>
                  <input
                    type="number"
                    step="0.50"
                    placeholder="Ex: 50.00"
                    value={valorPagoDinheiro}
                    onChange={(e) => setValorPagoDinheiro(e.target.value)}
                    className="w-28 text-right font-mono font-bold text-sm bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 outline-hidden focus:border-amber-500"
                  />
                </div>
                {valorPagoNum > 0 && (
                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-800 text-xs">
                    <span className="text-slate-400 font-semibold">Troco a Devolver:</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {formatCurrency(trocoCalculado)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Total e Botão de Finalizar */}
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-slate-300">Total a Cobrar:</span>
              <span className="text-2xl font-bold text-emerald-400 font-mono">
                {formatCurrency(totalBruto)}
              </span>
            </div>

            <button
              id="btn-finalizar-venda-pos"
              onClick={finalizarVenda}
              disabled={carrinho.length === 0}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-5 h-5" />
              Finalizar Venda Balcão (R$ {totalBruto.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
