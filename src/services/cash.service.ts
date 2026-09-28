import { useApi } from '../hooks/useApi';

export interface CashSessionResponse {
  sessionId: string;
  status: string;
  desvio: {
    cash: number;
    pix: number;
    card: number;
    total: number;
    percentual: number;
  };
  alertCreated: boolean;
  closedAt: Date;
}

export const useCashService = () => {
  const { post, get } = useApi();

  return {
    /**
     * Abrir nova sessão de caixa
     */
    openCashSession: async (terminalId: string, initialFund: number) => {
      return post('/api/v1/cash-sessions', {
        terminalId,
        initialFund,
      });
    },

    /**
     * Fechar sessão e disparar validação de desvios
     */
    closeCashSession: async (
      sessionId: string,
      declaredCash: number,
      declaredPix: number,
      declaredCard: number,
      notes?: string,
    ): Promise<CashSessionResponse> => {
      return post(`/api/v1/cash-sessions/${sessionId}/close`, {
        declaredCash,
        declaredPix,
        declaredCard,
        notes,
      });
    },

    /**
     * Listar sessões de caixa
     */
    listCashSessions: async (status?: string) => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      return get(`/api/v1/cash-sessions?${params.toString()}`);
    },

    /**
     * Buscar uma sessão específica
     */
    getCashSession: async (sessionId: string) => {
      return get(`/api/v1/cash-sessions/${sessionId}`);
    },
  };
};
