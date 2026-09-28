import React, { useState } from 'react';
import { X, Receipt, PlusCircle } from 'lucide-react';
import { Operador } from '../../types';

interface NovaComandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCriarComanda: (numero: number, clienteNome: string, tipo: 'MESA' | 'COMANDA_CARTAO' | 'BALCAO_RAPIDO') => void;
  proximoNumeroSugerido: number;
  operadorAtivo: Operador;
}

export const NovaComandaModal: React.FC<NovaComandaModalProps> = ({
  isOpen,
  onClose,
  onCriarComanda,
  proximoNumeroSugerido,
  operadorAtivo
}) => {
  const [numero, setNumero] = useState(proximoNumeroSugerido.toString());
  const [clienteNome, setClienteNome] = useState('');
  const [tipo, setTipo] = useState<'MESA' | 'COMANDA_CARTAO' | 'BALCAO_RAPIDO'>('MESA');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(numero);
    if (!num || num <= 0) return;

    onCriarComanda(num, clienteNome || `Mesa ${num}`, tipo);
    onClose();
    setClienteNome('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Abrir Nova Comanda / Mesa</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Tipo de Comanda */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">Tipo de Identificação</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'MESA', label: '🪑 Mesa Física' },
                { id: 'COMANDA_CARTAO', label: '💳 Cartão Físico' },
                { id: 'BALCAO_RAPIDO', label: '⚡ Balcão' }
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setTipo(item.id as any)}
                  className={`p-2.5 rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                    tipo === item.id
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Número #</label>
              <input
                type="number"
                min="1"
                required
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-base font-mono font-bold text-amber-400 outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-400 mb-1 font-semibold">Nome do Cliente / Identificador</label>
              <input
                type="text"
                placeholder="Ex: Lucas Lounge ou Mesa Varanda"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            Operador de Abertura: <span className="font-semibold text-slate-200">{operadorAtivo.nome}</span>
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
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Abrir Comanda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
