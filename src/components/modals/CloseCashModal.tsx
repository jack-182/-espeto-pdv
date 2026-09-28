import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { CashSessionResponse } from '../../services/cash.service';

interface CloseCashModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onCloseCashSession: (data: {
    declaredCash: number;
    declaredPix: number;
    declaredCard: number;
    notes?: string;
  }) => Promise<CashSessionResponse>;
}

export const CloseCashModal: React.FC<CloseCashModalProps> = ({
  sessionId,
  isOpen,
  onClose,
  onCloseCashSession,
}) => {
  const [declaredCash, setDeclaredCash] = useState<string>('0');
  const [declaredPix, setDeclaredPix] = useState<string>('0');
  const [declaredCard, setDeclaredCard] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CashSessionResponse | null>(null);

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await onCloseCashSession({
        declaredCash: parseFloat(declaredCash) || 0,
        declaredPix: parseFloat(declaredPix) || 0,
        declaredCard: parseFloat(declaredCard) || 0,
        notes: notes || undefined,
      });

      setResult(response);

      // Fechar modal após 3 segundos se sem desvio crítico
      if (!response.alertCreated) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fechar caixa');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const total =
    (parseFloat(declaredCash) || 0) +
    (parseFloat(declaredPix) || 0) +
    (parseFloat(declaredCard) || 0);

  const hasDeviation = result?.desvio && result.desvio.total > 0;
  const isCoitical = result?.desvio && result.desvio.percentual > 5;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">
          {result ? 'Resultado do Fechamento' : 'Fechar Caixa'}
        </h2>

        {/* FORMULÁRIO */}
        {!result && (
          <form onSubmit={handleClose} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dinheiro Declarado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={declaredCash}
                onChange={(e) => setDeclaredCash(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIX Declarado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={declaredPix}
                onChange={(e) => setDeclaredPix(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cartão Declarado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={declaredCard}
                onChange={(e) => setDeclaredCard(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                disabled={isLoading}
                placeholder="Alguma observação sobre o caixa?"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm font-medium text-gray-700">
                Total Declarado:
              </div>
              <div className="text-2xl font-bold text-blue-600">
                R$ {total.toFixed(2)}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    Processando...
                  </span>
                ) : (
                  'Fechar Caixa'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 bg-gray-400 text-white py-2 rounded font-semibold hover:bg-gray-500 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* RESULTADO */}
        {result && (
          <div className="space-y-4">
            {isCoitical ? (
              <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-bold text-red-600">
                    ⚠️ DESVIO DETECTADO!
                  </h3>
                </div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>
                    <strong>Desvio Total:</strong> R${' '}
                    {result.desvio.total.toFixed(2)}
                  </p>
                  <p>
                    <strong>Percentual:</strong> {result.desvio.percentual.toFixed(2)}%
                  </p>
                  <p className="mt-2 text-xs opacity-75">
                    ⚠️ O dono foi notificado automaticamente via WebSocket.
                    Investigação recomendada.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-bold text-green-600">
                    ✅ Caixa Fechado com Sucesso
                  </h3>
                </div>
                <div className="text-sm text-green-700">
                  <p>Sem desvios detectados.</p>
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-3 rounded space-y-2 text-sm">
              <div>
                <strong>Dinheiro:</strong> R${' '}
                {result.desvio.cash.toFixed(2)}
              </div>
              <div>
                <strong>PIX:</strong> R$ {result.desvio.pix.toFixed(2)}
              </div>
              <div>
                <strong>Cartão:</strong> R$ {result.desvio.card.toFixed(2)}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
