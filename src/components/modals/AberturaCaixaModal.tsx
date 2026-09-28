import React, { useState } from 'react';
import { X, Wallet, CheckCircle2, DollarSign } from 'lucide-react';
import { Operador } from '../../types';

interface AberturaCaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  operadorAtivo: Operador;
  onConfirmarAbertura: (fundoTroco: number) => void;
}

export const AberturaCaixaModal: React.FC<AberturaCaixaModalProps> = ({
  isOpen,
  onClose,
  operadorAtivo,
  onConfirmarAbertura
}) => {
  const [fundoTroco, setFundoTroco] = useState('200.00');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(fundoTroco.replace(',', '.')) || 0;
    onConfirmarAbertura(val);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Abertura de Caixa (Novo Turno)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">
              Fundo de Troco Inicial em Gaveta (R$)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                step="5.00"
                required
                value={fundoTroco}
                onChange={(e) => setFundoTroco(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-lg font-mono font-bold text-emerald-400 outline-hidden focus:border-amber-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Valor em moedas e notas disponível no início do expediente.
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            Operador Responsável: <span className="font-semibold text-slate-200">{operadorAtivo.nome}</span>
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
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              Abrir Caixa Agora
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
