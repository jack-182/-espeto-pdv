let authToken: string | null = null;

export const setApiAuthToken = (token: string | null) => {
  authToken = token;
};

export const getApiAuthToken = () => authToken;

const defaultHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export const api = {
  async getAuthMe() {
    const res = await fetch('/api/v1/auth/me', {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async getStores() {
    const res = await fetch('/api/lojas', {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async getProductsByStore(lojaId: string) {
    const res = await fetch(`/api/lojas/${lojaId}/produtos`, {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async getCurrentCashSession(lojaId: string) {
    const res = await fetch(`/api/lojas/${lojaId}/turnos/atual`, {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async openCashSession(lojaId: string, initialFund: number) {
    const res = await fetch(`/api/lojas/${lojaId}/turnos/abrir`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ fundoTrocoInicial: initialFund })
    });
    return res.json();
  },

  async addCashMovement(lojaId: string, turnoId: string, tipo: 'SANGRIA' | 'SUPRIMENTO', valor: number, motivo: string) {
    const res = await fetch(`/api/lojas/${lojaId}/turnos/${turnoId}/movimentacoes`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ tipo, valor, motivo })
    });
    return res.json();
  },

  async processSale(data: {
    lojaId: string;
    formaPagamento: 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'OUTROS';
    valor: number;
    itens: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }, idempotencyKey?: string) {
    const headers = defaultHeaders();
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    } else {
      headers['Idempotency-Key'] = `pos-sale-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    const res = await fetch('/api/vendas', {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async closeCashSession(lojaId: string, dados: {
    dinheiroInformadoNaGaveta: number;
    pixInformado?: number;
    cartaoInformado?: number;
    observacoes?: string;
  }) {
    const res = await fetch(`/api/fechamento/${lojaId}`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(dados)
    });
    return res.json();
  },

  async getConsolidatedClosing() {
    const res = await fetch('/api/fechamento/consolidado', {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async verifySupervisorPin(pin: string, storeId?: string) {
    const res = await fetch('/api/v1/auth/verify-supervisor-pin', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ pin, storeId })
    });
    return res.json();
  },

  async getAuditLogs(storeId?: string) {
    const url = storeId ? `/api/v1/audit/logs?storeId=${storeId}` : '/api/v1/audit/logs';
    const res = await fetch(url, {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async getUsers() {
    const res = await fetch('/api/v1/auth/users', {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async getEmployees() {
    const res = await fetch('/api/v1/employees', {
      headers: defaultHeaders()
    });
    return res.json();
  },

  async createEmployee(data: { nome: string; email: string; lojaId: string; status?: 'ACTIVE' | 'INACTIVE' }) {
    const res = await fetch('/api/v1/employees', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateEmployeeStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const res = await fetch(`/api/v1/employees/${id}/status`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  async updateEmployeeStore(id: string, lojaId: string) {
    const res = await fetch(`/api/v1/employees/${id}/store`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify({ lojaId })
    });
    return res.json();
  },

  async resendEmployeeInvite(id: string) {
    const res = await fetch(`/api/v1/employees/${id}/resend-invite`, {
      method: 'POST',
      headers: defaultHeaders()
    });
    return res.json();
  },

  async getInvitation(token: string) {
    const res = await fetch(`/api/v1/invitations/${token}`);
    return res.json();
  },

  async acceptInvitation(token: string, data: { pin?: string; name?: string }) {
    const res = await fetch(`/api/v1/invitations/${token}/accept`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  }
};

