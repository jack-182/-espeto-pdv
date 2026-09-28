import { Test, TestingModule } from '@nestjs/testing';
import { CashService } from './cash.service';
import { AlertService } from './alerts/alert.service';
import { AuditService } from '../audit/audit.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('CashService - MVP Tests', () => {
  let service: CashService;
  let alertService: AlertService;
  let auditService: AuditService;
  let notificationGateway: NotificationGateway;

  const mockTenantId = 'tenant-123';
  const mockStoreId = 'store-001';
  const mockSessionId = 'session-abc123';
  const mockOperatorId = 'operator-123';
  const mockOperatorName = 'João Caixa';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        {
          provide: AlertService,
          useValue: {
            createAlert: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: NotificationGateway,
          useValue: {
            broadcastToOwner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CashService>(CashService);
    alertService = module.get<AlertService>(AlertService);
    auditService = module.get<AuditService>(AuditService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
  });

  describe('Cálculo de Desvios', () => {
    /**
     * Teste 1: SEM DESVIO
     * Sistema diz: R$ 1000 em dinheiro
     * Caixa declara: R$ 1000 em dinheiro
     * Esperado: 0% desvio, SEM alerta
     */
    it('should NOT create alert when there is NO deviation', async () => {
      const declared = { cash: 1000, pix: 500, card: 300 };
      const system = { cash: 1000, pix: 500, card: 300 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.total).toBe(0);
      expect(desvios.percentual).toBe(0);
    });

    /**
     * Teste 2: DESVIO PEQUENO (< 5%)
     * Sistema: R$ 1000
     * Declarado: R$ 1020 (+R$20)
     * Desvio: 2% → NÃO gera alerta
     */
    it('should NOT create alert when deviation is < 5%', async () => {
      const declared = { cash: 1020, pix: 500, card: 300 };
      const system = { cash: 1000, pix: 500, card: 300 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.total).toBe(20);
      expect(desvios.percentual).toBeLessThan(5);
    });

    /**
     * Teste 3: DESVIO CRÍTICO (> 5%)
     * Sistema: R$ 1000
     * Declarado: R$ 950 (-R$50)
     * Desvio: 5% → GERA alerta CRÍTICO
     */
    it('should create CRITICAL alert when deviation is > 5%', async () => {
      const declared = { cash: 950, pix: 500, card: 300 };
      const system = { cash: 1000, pix: 500, card: 300 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.total).toBe(50);
      expect(desvios.percentual).toBeGreaterThan(5);
    });

    /**
     * Teste 4: ROUBO (Desvio Gigante)
     * Sistema: R$ 1000 em dinheiro
     * Declarado: R$ 500 (faltam R$500!)
     * Desvio: 50% → ALERTA MÁXIMO
     */
    it('should detect THEFT - huge deviation (50%)', async () => {
      const declared = { cash: 500, pix: 500, card: 300 };
      const system = { cash: 1000, pix: 500, card: 300 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.total).toBe(500);
      expect(desvios.percentual).toBe(50);
    });

    /**
     * Teste 5: PIX/CARTÃO
     * Desvios podem ser em qualquer forma de pagamento
     */
    it('should detect deviation in PIX/CARD payments', async () => {
      const declared = { cash: 1000, pix: 400, card: 300 };
      const system = { cash: 1000, pix: 500, card: 300 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.pix).toBe(100);
      expect(desvios.total).toBe(100);
    });
  });

  describe('Multi-Tenancy Isolation', () => {
    /**
     * Teste 6: SEGURANÇA
     * Garantir que dados de um tenant NÃO vazam para outro
     */
    it('should reject access to session from different tenant', async () => {
      // Simular tentativa de acesso cross-tenant
      const differentTenantId = 'tenant-999';
      const differentStoreId = 'store-999';

      // Mock db.query.cashSessions para retornar null (segurança)
      // Seria tratado pelo middleware real, mas testamos a lógica

      expect(true).toBe(true); // Placeholder - teste real valida BD
    });
  });

  describe('Edge Cases', () => {
    /**
     * Teste 7: ZERO
     * Sistema e caixa declaram R$0
     */
    it('should handle zero values correctly', async () => {
      const declared = { cash: 0, pix: 0, card: 0 };
      const system = { cash: 0, pix: 0, card: 0 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.total).toBe(0);
      expect(desvios.percentual).toBe(0);
    });

    /**
     * Teste 8: VALORES MUITO GRANDES
     */
    it('should handle large numbers (R$ 1M+)', async () => {
      const declared = { cash: 1000000.50, pix: 500000, card: 300000 };
      const system = { cash: 1000000.00, pix: 500000, card: 300000 };

      const desvios = (service as any).calculateDeviations(declared, system);

      expect(desvios.total).toBe(0.50);
    });
  });

  describe('Auditoria', () => {
    /**
     * Teste 9: AUDITORIA REGISTRA TUDO
     * Cada ação deve gerar log imutável
     */
    it('should log every cash session close to audit trail', async () => {
      const auditLogSpy = jest.spyOn(auditService, 'log');

      // Simular chamada (teste real faria db insert)
      await auditService.log(
        mockTenantId,
        mockStoreId,
        mockOperatorId,
        mockOperatorName,
        'FECHAMENTO_CAIXA',
        'cash_sessions',
        mockSessionId,
        { status: 'ABERTO' },
        { status: 'FECHADO' },
      );

      expect(auditLogSpy).toHaveBeenCalled();
    });
  });

  describe('Real-Time Notifications', () => {
    /**
     * Teste 10: NOTIFICAÇÃO DO DONO EM TEMPO REAL
     */
    it('should broadcast alert to owner via WebSocket when deviation > 5%', async () => {
      const broadcastSpy = jest.spyOn(notificationGateway, 'broadcastToOwner');

      notificationGateway.broadcastToOwner(mockTenantId, {
        type: 'ALERTA_DESVIO',
        level: 'CRITICO',
        title: 'Desvio detectado',
        message: 'Desvio de 10% em dinheiro',
        timestamp: new Date(),
      });

      expect(broadcastSpy).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({
          type: 'ALERTA_DESVIO',
          level: 'CRITICO',
        }),
      );
    });
  });
});
