import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';

export interface WhatsAppAlertDto {
  tenantId: string;
  storeName: string;
  alertType: 'DESVIO_CAIXA' | 'VENDA_ALTA' | 'VENDA_BAIXA' | 'SANGRIA' | 'SUPRIMENTO';
  message: string;
  details?: Record<string, any>;
}

@Injectable()
export class WhatsAppService {
  private client: twilio.Twilio;
  private logger = new Logger('WhatsAppService');

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials não configuradas. WhatsApp desativado.');
      return;
    }

    this.client = twilio(accountSid, authToken);
  }

  /**
   * Enviar alerta via WhatsApp ao proprietário
   * CRÍTICO: Notificação imediata de desvios e vendas altas
   */
  async sendAlert(
    ownerPhoneNumber: string,
    alert: WhatsAppAlertDto,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.client) {
        this.logger.error('Twilio client não inicializado');
        return { success: false, error: 'WhatsApp não configurado' };
      }

      // Formatar número: garantir que começa com +55 (Brasil)
      const formattedPhone = this.formatPhoneNumber(ownerPhoneNumber);

      // Compor mensagem com emojis e formatação
      const whatsappMessage = this.formatMessage(alert);

      // Enviar via Twilio WhatsApp API
      const message = await this.client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // ex: whatsapp:+5585988888888
        to: `whatsapp:${formattedPhone}`,
        body: whatsappMessage,
      });

      this.logger.log(
        `✅ WhatsApp enviado para ${formattedPhone} - ID: ${message.sid}`,
      );

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar WhatsApp: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Enviar alertas em BATCH para múltiplos proprietários
   */
  async sendAlertsToMultiple(
    phoneNumbers: string[],
    alert: WhatsAppAlertDto,
  ): Promise<Array<{ phone: string; success: boolean }>> {
    const results = await Promise.all(
      phoneNumbers.map(async (phone) => ({
        phone,
        success: (await this.sendAlert(phone, alert)).success,
      })),
    );

    return results;
  }

  /**
   * Formatar número de telefone para padrão internacional
   */
  private formatPhoneNumber(phone: string): string {
    // Remover caracteres especiais
    const cleaned = phone.replace(/\D/g, '');

    // Se já começar com 55 (código Brasil), retornar como está
    if (cleaned.startsWith('55')) {
      return `+${cleaned}`;
    }

    // Se começar com 0, remover (formato nacional)
    if (cleaned.startsWith('0')) {
      return `+55${cleaned.substring(1)}`;
    }

    // Caso contrário, adicionar código Brasil
    return `+55${cleaned}`;
  }

  /**
   * Formatar mensagem WhatsApp com emojis e contexto
   */
  private formatMessage(alert: WhatsAppAlertDto): string {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    let header = '';
    let body = '';

    switch (alert.alertType) {
      case 'DESVIO_CAIXA':
        header = '🚨 ALERTA CRÍTICO - DESVIO DE CAIXA';
        body = `
*Loja:* ${alert.storeName}
*Mensagem:* ${alert.message}
${alert.details ? `*Valor do Desvio:* R$ ${alert.details.desvio || '0'}` : ''}
${alert.details ? `*Percentual:* ${alert.details.percentual || '0'}%` : ''}
*Horário:* ${timestamp}

⚠️ Investigação recomendada imediatamente!
        `;
        break;

      case 'VENDA_ALTA':
        header = '📈 ÓTIMA NOTÍCIA - VENDA ACIMA DO NORMAL';
        body = `
*Loja:* ${alert.storeName}
*Valor:* R$ ${alert.details?.valor || '0'}
*Hora:* ${timestamp}

🎉 Dia está sendo produtivo!
        `;
        break;

      case 'VENDA_BAIXA':
        header = '📉 ALERTA - VENDAS ABAIXO DO ESPERADO';
        body = `
*Loja:* ${alert.storeName}
*Valor:* R$ ${alert.details?.valor || '0'}
*Hora:* ${timestamp}

💡 Verificar operação da loja
        `;
        break;

      case 'SANGRIA':
        header = '💰 MOVIMENTAÇÃO - SANGRIA REALIZADA';
        body = `
*Loja:* ${alert.storeName}
*Valor da Sangria:* R$ ${alert.details?.valor || '0'}
*Operador:* ${alert.details?.operator || 'N/A'}
*Horário:* ${timestamp}
        `;
        break;

      case 'SUPRIMENTO':
        header = '💵 MOVIMENTAÇÃO - SUPRIMENTO REALIZADO';
        body = `
*Loja:* ${alert.storeName}
*Valor do Suprimento:* R$ ${alert.details?.valor || '0'}
*Operador:* ${alert.details?.operator || 'N/A'}
*Horário:* ${timestamp}
        `;
        break;

      default:
        header = '📢 NOTIFICAÇÃO ESPETO';
        body = alert.message;
    }

    return `${header}\n${body}`.trim();
  }

  /**
   * Verificar se WhatsApp está configurado
   */
  isConfigured(): boolean {
    return !!this.client;
  }

  /**
   * Teste de conexão
   */
  async testConnection(testPhoneNumber: string): Promise<boolean> {
    try {
      const result = await this.sendAlert(testPhoneNumber, {
        tenantId: 'test',
        storeName: 'Teste',
        alertType: 'DESVIO_CAIXA',
        message: '✅ Conexão WhatsApp funcionando corretamente!',
      });

      return result.success;
    } catch (error) {
      this.logger.error('Teste de conexão falhou:', error);
      return false;
    }
  }
}
