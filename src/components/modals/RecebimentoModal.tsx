import React, { useState } from 'react';
import { X, CheckCircle2, QrCode, CreditCard, DollarSign, Receipt, Percent } from 'lucide-react';
import { Comanda, MetodoPagamento, Operador } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface RecebimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  comanda: Comanda | null;
  operadorAtivo: Operador;
  onConfirmarPagamento: (comandaId: string, metodo: MetodoPagamento, valorRecebido: number, troco: number, desconto: number) => void;
}

export const RecebimentoModal: React.FC<RecebimentoModalProps> = ({
  isOpen,
  onClose,
  comanda,
  operadorAtivo,
  onConfirmarPagamento
}) => {
  const [metodo, setMetodo] = useState<MetodoPagamento>('PIX');
  const [desconto, setDesconto] = useState<string>('0');
  const [valorPagoDinheiro, setValorPagoDinheiro] = useState<string>('');

  if (!isOpen || !comanda) return null;

  const descNum = parseFloat(desconto.replace(',', '.')) || 0;
  const valorFinalCobrar = Math.max(0, comanda.totalLiquido - descNum);

  const valorPagoNum = parseFloat(valorPagoDinheiro.replace(',', '.')) || 0;
  const trocoCalculado = Math.max(0, valorPagoNum - valorFinalCobrar);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (metodo === 'DINHEIRO' && valorPagoNum < valorFinalCobrar && valorPagoNum > 0) {
      alert('Valor recebido em dinheiro é inferior ao total da comanda!');
      return;
    }

    const valorFinalRecebido = metodo === 'DINHEIRO' ? (valorPagoNum || valorFinalCobrar) : valorFinalCobrar;
    onConfirmarPagamento(comanda.id, metodo, valorFinalRecebido, trocoCalculado, descNum);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Recebimento de Comanda #{comanda.numero}</h2>
              <p className="text-[11px] text-slate-400">{comanda.clienteNome || `Mesa ${comanda.numero}`}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Escolha do Meio de Pagamento */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMetodo('PIX')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  metodo === 'PIX'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>PIX Instantâneo</span>
              </button>

              <button
                type="button"
                onClick={() => setMetodo('CARTAO_DEBITO')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  metodo === 'CARTAO_DEBITO' || metodo === 'CARTAO_CREDITO'
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Cartão POS</span>
              </button>

              <button
                type="button"
                onClick={() => setMetodo('DINHEIRO')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  metodo === 'DINHEIRO'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Dinheiro (Espécie)</span>
              </button>
            </div>
          </div>

          {/* Desconto Opcional */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Subtotal com Taxa</label>
              <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono font-semibold text-slate-300">
                {formatCurrency(comanda.totalLiquido)}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Desconto Comercial (R$)</label>
              <input
                type="number"
                step="0.50"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100 outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Se for dinheiro: Troco */}
          {metodo === 'DINHEIRO' && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Valor Entregue pelo Cliente:</span>
                <input
                  type="number"
                  step="0.50"
                  placeholder="Ex: 100.00"
                  value={valorPagoDinheiro}
                  onChange={(e) => setValorPagoDinheiro(e.target.value)}
                  className="w-32 text-right font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 outline-hidden focus:border-amber-500"
                />
              </div>

              {valorPagoNum > 0 && (
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-800">
                  <span className="text-slate-400 font-semibold">Troco:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {formatCurrency(trocoCalculado)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Total Final */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-300">Total a Liquidar:</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {formatCurrency(valorFinalCobrar)}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              Confirmar Recebimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
