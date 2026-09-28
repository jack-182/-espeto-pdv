import { 
  NotificacaoDono, 
  ConfiguracaoNotificacoesDono, 
  TipoNotificacaoDono, 
  NivelAlertaDono 
} from '../types';
import { formatCurrency } from '../utils/formatters';
import { getSocket } from './socket';

const STORAGE_KEY_CONFIG = 'pdv_config_notificacoes_dono_v1';
const STORAGE_KEY_NOTIFICACOES = 'pdv_historico_notificacoes_dono_v1';

export const configNotificacoesPadrao: ConfiguracaoNotificacoesDono = {
  telefonePrincipal: '(11) 98765-4321',
  telefoneSecundario: '(11) 99888-7766',
  nomeDono: 'Jackson (Proprietário)',
  notificarVendas: true,
  valorMinimoVenda: 0,
  notificarSangrias: true,
  notificarSuprimentos: true,
  notificarCancelamentos: true,
  notificarAberturaFechamento: true,
  notificarQuebraCaixa: true,
  alertaSonoroAtivo: true,
  canalEnvio: 'WHATSAPP_SIMULADO',
  webhookUrl: ''
};

export const historicoInicialNotificacoes: NotificacaoDono[] = [
  {
    id: 'notif-1',
    tipo: 'VENDA',
    nivel: 'NORMAL',
    titulo: 'Venda Concluída - Espetinho 1',
    mensagemWhatsApp: `*NOVA VENDA RECEBIDA!*\n🏢 *Unidade:* Espetinho 1\n💰 *Valor:* R$ 88,00 (PIX)\n📝 *Itens:* 4x Espeto Angus, 2x Chopp Brahma\n👤 *Operador:* Juliana Mendes\n⏰ *Horário:* 10:15:30\n✅ *Status:* Dinheiro/Pix confirmado`,
    empresaId: 'emp-1',
    empresaNome: 'Espetinho 1',
    valor: 88.00,
    operadorNome: 'Juliana Mendes',
    detalhes: '4x Espeto Angus, 2x Chopp Brahma',
    horario: '10:15:30',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    enviadoParaTelefone: '(11) 98765-4321',
    statusEnvio: 'ENVIADO',
    lido: true
  },
  {
    id: 'notif-2',
    tipo: 'SANGRIA',
    nivel: 'CRITICO',
    titulo: '🚨 ALERTA: Sangria de Gaveta - Tabacaria',
    mensagemWhatsApp: `*🚨 ALERTA DE SEGURANÇA: SANGRIA REALIZADA!*\n🏢 *Unidade:* Tabacaria\n💸 *Valor Retirado:* R$ 400,00 (Dinheiro)\n📌 *Motivo:* Recolhimento de cofre de segurança\n👤 *Operador:* Carlos Eduardo\n🔑 *Autorizado por:* Jackson (PIN Mestre)\n⏰ *Horário:* 09:40:12\n⚠️ *Atenção:* O saldo físico na gaveta foi reduzido.`,
    empresaId: 'emp-3',
    empresaNome: 'Tabacaria',
    valor: 400.00,
    operadorNome: 'Carlos Eduardo',
    detalhes: 'Recolhimento para cofre central',
    horario: '09:40:12',
    timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    enviadoParaTelefone: '(11) 98765-4321',
    statusEnvio: 'ENVIADO',
    lido: true
  },
  {
    id: 'notif-3',
    tipo: 'CANCELAMENTO_ITEM',
    nivel: 'ATENCAO',
    titulo: '⚠️ Auditoria: Item Removido de Comanda',
    mensagemWhatsApp: `*⚠️ AUDITORIA ANTI-FRAUDE: ITEM CANCELADO!*\n🏢 *Unidade:* Espetinho 2\n🚫 *Item Cancelado:* 1x Combo 6 Espetos (R$ 65,00)\n📑 *Comanda:* #08 (Mesa 03)\n👤 *Operador:* Juliana Mendes\n⏰ *Horário:* 09:12:05\n🔍 *Verifique:* Cancelamento de item após atendimento ao cliente.`,
    empresaId: 'emp-2',
    empresaNome: 'Espetinho 2',
    valor: 65.00,
    operadorNome: 'Juliana Mendes',
    detalhes: 'Item removido da Comanda #08',
    horario: '09:12:05',
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    enviadoParaTelefone: '(11) 98765-4321',
    statusEnvio: 'ENVIADO',
    lido: true
  },
  {
    id: 'notif-4',
    tipo: 'ABERTURA_CAIXA',
    nivel: 'NORMAL',
    titulo: 'Abertura de Caixa - Espetinho 1',
    mensagemWhatsApp: `*🔓 CAIXA ABERTO!*\n🏢 *Unidade:* Espetinho 1\n💵 *Fundo de Troco Inicial:* R$ 150,00\n👤 *Operador de Abertura:* Juliana Mendes\n⏰ *Horário:* 08:30:00\n📊 *Turno:* #1 do dia`,
    empresaId: 'emp-1',
    empresaNome: 'Espetinho 1',
    valor: 150.00,
    operadorNome: 'Juliana Mendes',
    detalhes: 'Fundo de troco inicial de R$ 150,00',
    horario: '08:30:00',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    enviadoParaTelefone: '(11) 98765-4321',
    statusEnvio: 'ENVIADO',
    lido: true
  }
];

// Gerar som sintético de alerta (sem arquivos externos de áudio)
export function playNotificationSound(tipo: TipoNotificacaoDono = 'VENDA') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (tipo === 'SANGRIA' || tipo === 'ALERTA_FRAUDE') {
      // Tom de alerta urgente (dois bipes de advertência)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.4);
    } else if (tipo === 'CANCELAMENTO_ITEM') {
      // Tom de aviso/cuidado
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(390, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Tom agradável de caixa registradora / venda entrando
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignora restrições de autoplay do browser
  }
}

export function carregarConfiguracaoNotificacoes(): ConfiguracaoNotificacoesDono {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      return { ...configNotificacoesPadrao, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Erro ao carregar configurações de notificação do dono:', e);
  }
  return configNotificacoesPadrao;
}

export function salvarConfiguracaoNotificacoes(config: ConfiguracaoNotificacoesDono): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.warn('Erro ao salvar configurações de notificação do dono:', e);
  }
}

export function carregarHistoricoNotificacoes(): NotificacaoDono[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICACOES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar histórico de notificações:', e);
  }
  return historicoInicialNotificacoes;
}

export function salvarHistoricoNotificacoes(lista: NotificacaoDono[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFICACOES, JSON.stringify(lista.slice(0, 100)));
  } catch (e) {
    console.warn('Erro ao persistir notificações:', e);
  }
}

export function gerarLinkWhatsApp(telefone: string, mensagem: string): string {
  // Limpa caracteres especiais do telefone
  const digits = telefone.replace(/\D/g, '');
  const phoneFull = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${phoneFull}?text=${encodeURIComponent(mensagem)}`;
}

export interface DisparoNotificacaoParams {
  tipo: TipoNotificacaoDono;
  empresaId: string;
  empresaNome: string;
  operadorNome: string;
  valor?: number;
  detalhes?: string;
  formaPagamento?: string;
  comandaNumero?: number;
  motivo?: string;
  autorizadoPor?: string;
  diferencaQuebra?: number;
}

export function formatarMensagemNotificacao(params: DisparoNotificacaoParams): {
  titulo: string;
  mensagemWhatsApp: string;
  nivel: NivelAlertaDono;
} {
  const agora = new Date().toLocaleTimeString('pt-BR');
  const valorFmt = params.valor !== undefined ? formatCurrency(params.valor) : '';

  switch (params.tipo) {
    case 'VENDA': {
      const nivel: NivelAlertaDono = 'NORMAL';
      const titulo = `Venda Realizada (${valorFmt}) - ${params.empresaNome}`;
      const mensagemWhatsApp = `*NOVA VENDA ENTRANDO!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `💰 *Valor:* ${valorFmt} ${params.formaPagamento ? `(${params.formaPagamento})` : ''}\n` +
        `👤 *Operador:* ${params.operadorNome}\n` +
        (params.detalhes ? `🛒 *Detalhes:* ${params.detalhes}\n` : '') +
        (params.comandaNumero ? `📑 *Comanda:* #${params.comandaNumero}\n` : '') +
        `⏰ *Horário:* ${agora}\n` +
        `✅ *Status:* Lançamento confirmado no caixa`;
      return { titulo, mensagemWhatsApp, nivel };
    }

    case 'SANGRIA': {
      const nivel: NivelAlertaDono = 'CRITICO';
      const titulo = `🚨 ALERTA: Sangria de ${valorFmt} - ${params.empresaNome}`;
      const mensagemWhatsApp = `*🚨 ALERTA DE SEGURANÇA: SANGRIA DE DINHEIRO!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `💸 *Valor Retirado da Gaveta:* ${valorFmt}\n` +
        `📌 *Motivo Declarado:* ${params.motivo || params.detalhes || 'Sangria de segurança'}\n` +
        `👤 *Operador do Caixa:* ${params.operadorNome}\n` +
        `🔑 *Autorizado por:* ${params.autorizadoPor || 'Senha Mestra de Administrador'}\n` +
        `⏰ *Horário:* ${agora}\n` +
        `⚠️ *Aviso ao Dono:* O dinheiro físico saiu da gaveta e foi registrado.`;
      return { titulo, mensagemWhatsApp, nivel };
    }

    case 'CANCELAMENTO_ITEM': {
      const nivel: NivelAlertaDono = 'ATENCAO';
      const titulo = `⚠️ Auditoria: Item Cancelado - ${params.empresaNome}`;
      const mensagemWhatsApp = `*⚠️ ALERTA ANTI-FRAUDE: ITEM CANCELADO EM COMANDA!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `🚫 *Item Removido:* ${params.detalhes || 'Item de consumo'}\n` +
        (params.valor ? `💰 *Valor do Item:* ${valorFmt}\n` : '') +
        (params.comandaNumero ? `📑 *Comanda:* #${params.comandaNumero}\n` : '') +
        `👤 *Operador Responsável:* ${params.operadorNome}\n` +
        `⏰ *Horário:* ${agora}\n` +
        `🔍 *Auditoria:* Verifique se o cancelamento foi legítimo ou após recebimento.`;
      return { titulo, mensagemWhatsApp, nivel };
    }

    case 'SUPRIMENTO': {
      const nivel: NivelAlertaDono = 'NORMAL';
      const titulo = `Suprimento de ${valorFmt} - ${params.empresaNome}`;
      const mensagemWhatsApp = `*💵 ENTRADA DE TROCO (SUPRIMENTO)!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `💵 *Valor Adicionado:* ${valorFmt}\n` +
        `📌 *Motivo:* ${params.motivo || params.detalhes || 'Reforço de troco em gaveta'}\n` +
        `👤 *Operador:* ${params.operadorNome}\n` +
        `⏰ *Horário:* ${agora}`;
      return { titulo, mensagemWhatsApp, nivel };
    }

    case 'ABERTURA_CAIXA': {
      const nivel: NivelAlertaDono = 'NORMAL';
      const titulo = `Abertura de Caixa - ${params.empresaNome}`;
      const mensagemWhatsApp = `*🔓 TURNO DE CAIXA INICIADO!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `💵 *Fundo de Troco Inicial:* ${valorFmt}\n` +
        `👤 *Operador de Abertura:* ${params.operadorNome}\n` +
        `⏰ *Horário:* ${agora}\n` +
        `📊 *Monitoramento:* Ativo para todas as transações`;
      return { titulo, mensagemWhatsApp, nivel };
    }

    case 'FECHAMENTO_CAIXA': {
      const temQuebra = (params.diferencaQuebra || 0) < 0;
      const nivel: NivelAlertaDono = temQuebra ? 'CRITICO' : 'NORMAL';
      const titulo = temQuebra 
        ? `🚨 Fechamento com QUEBRA DE CAIXA (${formatCurrency(params.diferencaQuebra || 0)}) - ${params.empresaNome}`
        : `Fechamento de Caixa Concluído - ${params.empresaNome}`;
      const mensagemWhatsApp = `*🔒 FECHAMENTO DE TURNO CONCLUÍDO!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `👤 *Operador de Fechamento:* ${params.operadorNome}\n` +
        (params.detalhes ? `📊 *Resumo de Vendas:* ${params.detalhes}\n` : '') +
        (params.diferencaQuebra !== undefined ? `⚖️ *Diferença de Caixa (Sobra/Quebra):* ${formatCurrency(params.diferencaQuebra)}\n` : '') +
        (params.motivo ? `📝 *Observação:* ${params.motivo}\n` : '') +
        `⏰ *Horário:* ${agora}\n` +
        (temQuebra ? `🚨 *ATENÇÃO:* Foi apurada divergência negativa na contagem física da gaveta!` : `✅ *Conferência:* Turno encerrado.`);
      return { titulo, mensagemWhatsApp, nivel };
    }

    case 'ALERTA_FRAUDE':
    default: {
      const nivel: NivelAlertaDono = 'CRITICO';
      const titulo = `🚨 ALERTA ANTI-FRAUDE: ${params.empresaNome}`;
      const mensagemWhatsApp = `*🚨 ALERTA DE SEGURANÇA E AUDITORIA!*\n` +
        `🏢 *Unidade:* ${params.empresaNome}\n` +
        `⚠️ *Ocorrência:* ${params.detalhes || 'Ação suspeita detectada no PDV'}\n` +
        `👤 *Operador:* ${params.operadorNome}\n` +
        `⏰ *Horário:* ${agora}\n` +
        `🔍 *Ação imediata recomendada:* Contate a gerência ou verifique as câmeras.`;
      return { titulo, mensagemWhatsApp, nivel };
    }
  }
}

export function dispararNotificacaoAoDono(params: DisparoNotificacaoParams): NotificacaoDono | null {
  const config = carregarConfiguracaoNotificacoes();

  // Verifica se o tipo de notificação está habilitado nas configurações
  if (params.tipo === 'VENDA' && !config.notificarVendas) return null;
  if (params.tipo === 'VENDA' && config.valorMinimoVenda > 0 && (params.valor || 0) < config.valorMinimoVenda) return null;
  if (params.tipo === 'SANGRIA' && !config.notificarSangrias) return null;
  if (params.tipo === 'SUPRIMENTO' && !config.notificarSuprimentos) return null;
  if (params.tipo === 'CANCELAMENTO_ITEM' && !config.notificarCancelamentos) return null;
  if ((params.tipo === 'ABERTURA_CAIXA' || params.tipo === 'FECHAMENTO_CAIXA') && !config.notificarAberturaFechamento) return null;

  const { titulo, mensagemWhatsApp, nivel } = formatarMensagemNotificacao(params);
  const agora = new Date().toLocaleTimeString('pt-BR');

  const novaNotificacao: NotificacaoDono = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tipo: params.tipo,
    nivel,
    titulo,
    mensagemWhatsApp,
    empresaId: params.empresaId,
    empresaNome: params.empresaNome,
    valor: params.valor,
    operadorNome: params.operadorNome,
    detalhes: params.detalhes,
    horario: agora,
    timestamp: new Date().toISOString(),
    enviadoParaTelefone: config.telefonePrincipal,
    statusEnvio: 'ENVIADO',
    lido: false
  };

  // Salvar no histórico
  const historicoAtual = carregarHistoricoNotificacoes();
  const novoHistorico = [novaNotificacao, ...historicoAtual.slice(0, 99)];
  salvarHistoricoNotificacoes(novoHistorico);

  // Alerta sonoro
  if (config.alertaSonoroAtivo) {
    playNotificationSound(params.tipo);
  }

  // Notificação via WebSocket Socket.IO
  try {
    const s = getSocket();
    s.emit('notificacao_celular_dono', novaNotificacao);
  } catch (err) {
    console.warn('Erro ao emitir evento de notificação via socket:', err);
  }

  // Se houver Webhook URL configurado, faz o disparo HTTP
  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaNotificacao)
      }).catch(err => console.warn('Erro ao disparar webhook externo do dono:', err));
    } catch {
      // Ignora falhas de webhook
    }
  }

  return novaNotificacao;
}
