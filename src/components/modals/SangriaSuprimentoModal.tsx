import React, { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, DollarSign } from 'lucide-react';
import { Operador } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface SangriaSuprimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'SANGRIA' | 'SUPRIMENTO';
  saldoAtualGaveta: number;
  operadorAtivo: Operador;
  onConfirmar: (tipo: 'SANGRIA' | 'SUPRIMENTO', valor: number, motivo: string) => void;
}

export const SangriaSuprimentoModal: React.FC<SangriaSuprimentoModalProps> = ({
  isOpen,
  onClose,
  tipo,
  saldoAtualGaveta,
  operadorAtivo,
  onConfirmar
}) => {
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');

  if (!isOpen) return null;

  const isSangria = tipo === 'SANGRIA';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valor.replace(',', '.'));
    if (!val || val <= 0) return;

    if (isSangria && val > saldoAtualGaveta) {
      alert(`Valor da sangria (${formatCurrency(val)}) excede o saldo físico disponível na gaveta (${formatCurrency(saldoAtualGaveta)})!`);
      return;
    }

    onConfirmar(tipo, val, motivo || (isSangria ? 'Sangria para cofre/gerência' : 'Suprimento de troco'));
    onClose();
    setValor('');
    setMotivo('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isSangria ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
              {isSangria ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
            </div>
            <h2 className="text-base font-bold text-white">
              {isSangria ? 'Registrar Sangria de Segurança' : 'Registrar Suprimento (Troco)'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isSangria && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-baseline">
              <span className="text-slate-400">Saldo Físico Atual na Gaveta:</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatCurrency(saldoAtualGaveta)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Valor da Movimentação (R$)</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                step="0.50"
                required
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-base font-mono font-bold text-slate-100 outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              Motivo / Justificativa
            </label>
            <input
              type="text"
              required
              placeholder={isSangria ? "Ex: Recolhimento para cofre / pagamento de fornecedor" : "Ex: Adição de moedas e notas de R$ 2,00 e R$ 5,00"}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            Operador: <span className="font-semibold text-slate-200">{operadorAtivo.nome}</span>
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
              className={`px-5 py-2.5 rounded-xl font-bold shadow-md cursor-pointer ${
                isSangria 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              Confirmar {isSangria ? 'Sangria' : 'Suprimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
