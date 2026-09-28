import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | null = null;

export interface EventoVendaRealtime {
  lojaId: number | string;
  loja: string;
  item: string;
  valor: number;
  formaPagamento: string;
  horario: string;
}

export interface RelatorioFechamentoGeral {
  relatorio: Array<{
    loja: string;
    lojaId: string | number;
    dinheiro: number;
    pix: number;
    cartao: number;
    aberto: boolean;
    totalLoja: number;
  }>;
  totalGeral: number;
}

export type ExpedientesRealtime = Record<string | number, {
  nome: string;
  dinheiro: number;
  pix: number;
  cartao: number;
  aberto: boolean;
}>;

/**
 * Inicializa ou retorna a instância autenticada do Socket.IO.
 * Envia estritamente o Bearer Token no handshake (auth: { token }).
 */
export function getSocket(token?: string): Socket {
  const tokenToUse = token || currentToken;

  if (!socket || (token && token !== currentToken)) {
    if (socket) {
      socket.disconnect();
    }
    currentToken = tokenToUse || null;

    socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: tokenToUse
      }
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Conectado e autenticado com segurança:', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[WebSocket] Falha no handshake ou autenticação:', err.message);
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

// Deprecated: O frontend agora realiza vendas e fechamentos exclusivamente via HTTP transacional
export function emitirVendaRealtime(_dados: any) {
  // Notificação gerenciada pelo servidor após commit transacional no PostgreSQL
}

export function solicitarFechamentoGeralRealtime() {
  // Dados consolidados obtidos via api.getConsolidatedClosing()
}
