import React, { useState } from 'react';
import { 
  NotificacaoDono, 
  ConfiguracaoNotificacoesDono, 
  Empresa 
} from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { 
  X, 
  Smartphone, 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  ArrowDownCircle, 
  CheckCircle2, 
  Filter, 
  Settings, 
  MessageSquare, 
  ExternalLink, 
  Send, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Flame, 
  Building2, 
  Sparkles,
  Search,
  Lock,
  Eye,
  PhoneCall,
  BellRing
} from 'lucide-react';
import { 
  gerarLinkWhatsApp, 
  salvarConfiguracaoNotificacoes, 
  dispararNotificacaoAoDono,
  playNotificationSound 
} from '../../services/notificationService';

interface PainelNotificacoesDonoModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificacoes: NotificacaoDono[];
  configuracao: ConfiguracaoNotificacoesDono;
  onAtualizarConfiguracao: (novaConfig: ConfiguracaoNotificacoesDono) => void;
  todasEmpresas: Empresa[];
}

type TabPainel = 'WHATSAPP_MOCKUP' | 'AUDITORIA_LOG' | 'CONFIGURACOES';

export const PainelNotificacoesDonoModal: React.FC<PainelNotificacoesDonoModalProps> = ({
  isOpen,
  onClose,
  notificacoes = [],
  configuracao,
  onAtualizarConfiguracao,
  todasEmpresas = []
}) => {
  if (!isOpen) return null;

  const [abaAtiva, setAbaAtiva] = useState<TabPainel>('WHATSAPP_MOCKUP');
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('TODAS');
  const [termoBusca, setTermoBusca] = useState<string>('');

  const safeNotifs = notificacoes || [];

  // Formulário de Configurações
  const [telefonePrincipal, setTelefonePrincipal] = useState(configuracao.telefonePrincipal);
  const [telefoneSecundario, setTelefoneSecundario] = useState(configuracao.telefoneSecundario || '');
  const [nomeDono, setNomeDono] = useState(configuracao.nomeDono);
  const [notificarVendas, setNotificarVendas] = useState(configuracao.notificarVendas);
  const [valorMinimoVenda, setValorMinimoVenda] = useState(configuracao.valorMinimoVenda.toString());
  const [notificarSangrias, setNotificarSangrias] = useState(configuracao.notificarSangrias);
  const [notificarSuprimentos, setNotificarSuprimentos] = useState(configuracao.notificarSuprimentos);
  const [notificarCancelamentos, setNotificarCancelamentos] = useState(configuracao.notificarCancelamentos);
  const [notificarAberturaFechamento, setNotificarAberturaFechamento] = useState(configuracao.notificarAberturaFechamento);
  const [alertaSonoroAtivo, setAlertaSonoroAtivo] = useState(configuracao.alertaSonoroAtivo);
  const [webhookUrl, setWebhookUrl] = useState(configuracao.webhookUrl || '');
  const [salvoFeedback, setSalvoFeedback] = useState(false);
  const [testeFeedback, setTesteFeedback] = useState<string | null>(null);

  // Estatísticas Rápidas de Auditoria
  const totalVendasNotificadas = safeNotifs.filter(n => n.tipo === 'VENDA').length;
  const totalSangriasAuditadas = safeNotifs.filter(n => n.tipo === 'SANGRIA').length;
  const valorTotalSangrias = safeNotifs
    .filter(n => n.tipo === 'SANGRIA')
    .reduce((acc, n) => acc + (n.valor || 0), 0);
  const totalCancelamentosSuspeitos = safeNotifs.filter(n => n.tipo === 'CANCELAMENTO_ITEM' || n.tipo === 'ALERTA_FRAUDE').length;

  // Filtragem da Lista
  const notificacoesFiltradas = safeNotifs.filter(notif => {
    if (filtroTipo !== 'TODOS' && notif.tipo !== filtroTipo) return false;
    if (filtroEmpresa !== 'TODAS' && notif.empresaId !== filtroEmpresa) return false;
    if (termoBusca) {
      const q = termoBusca.toLowerCase();
      const match = 
        notif.titulo.toLowerCase().includes(q) ||
        notif.empresaNome.toLowerCase().includes(q) ||
        notif.operadorNome.toLowerCase().includes(q) ||
        (notif.detalhes && notif.detalhes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleSalvarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const novaConfig: ConfiguracaoNotificacoesDono = {
      ...configuracao,
      telefonePrincipal,
      telefoneSecundario,
      nomeDono,
      notificarVendas,
      valorMinimoVenda: parseFloat(valorMinimoVenda) || 0,
      notificarSangrias,
      notificarSuprimentos,
      notificarCancelamentos,
      notificarAberturaFechamento,
      alertaSonoroAtivo,
      webhookUrl
    };

    onAtualizarConfiguracao(novaConfig);
    salvarConfiguracaoNotificacoes(novaConfig);
    setSalvoFeedback(true);
    setTimeout(() => setSalvoFeedback(false), 3000);
  };

  const handleDispararTeste = () => {
    const mockVenda = dispararNotificacaoAoDono({
      tipo: 'VENDA',
      empresaId: todasEmpresas[0]?.id || 'emp-1',
      empresaNome: todasEmpresas[0]?.nomeFantasia || 'Espetinho 1',
      operadorNome: 'Jackson (Dono)',
      valor: 145.00,
      formaPagamento: 'PIX',
      detalhes: '6x Espeto Angus, 4x Chopp Brahma, 1x Porção Mandioca',
      comandaNumero: 14
    });

    if (mockVenda) {
      setTesteFeedback(`Notificação de teste enviada com sucesso para o telefone ${telefonePrincipal}!`);
      setTimeout(() => setTesteFeedback(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="painel-notificacoes-dono-modal"
        className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
      >
        {/* Topo do Modal */}
        <div className="px-6 py-4.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Smartphone className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 leading-tight">
                  Central Anti-Fraude & Notificações no Celular do Dono
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Ao Vivo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Monitoramento em tempo real no WhatsApp de Jackson (<strong className="text-slate-200">{configuracao.telefonePrincipal}</strong>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const novoEstado = !alertaSonoroAtivo;
                setAlertaSonoroAtivo(novoEstado);
                onAtualizarConfiguracao({ ...configuracao, alertaSonoroAtivo: novoEstado });
                if (novoEstado) playNotificationSound('VENDA');
              }}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                alertaSonoroAtivo 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={alertaSonoroAtivo ? 'Alerta Sonoro Ativado' : 'Alerta Sonoro Mudo'}
            >
              {alertaSonoroAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar Central"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cards de Métricas Anti-Fraude */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950/40 border-b border-slate-800/80">
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Vendas Notificadas</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
              {totalVendasNotificadas}
            </p>
            <p className="text-[10px] text-slate-500">100% transmitidas ao dono</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-rose-500/20 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-300">Sangrias Auditadas</span>
              <ArrowDownCircle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-lg font-mono font-bold text-rose-400 mt-1">
              {totalSangriasAuditadas} <span className="text-xs font-normal">({formatCurrency(valorTotalSangrias)})</span>
            </p>
            <p className="text-[10px] text-rose-400/80">Alerta com autorização PIN</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/20 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-300">Cancelamentos / Alertas</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-lg font-mono font-bold text-amber-400 mt-1">
              {totalCancelamentosSuspeitos}
            </p>
            <p className="text-[10px] text-amber-400/80">Prevenção contra desvios</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Canal Ativo</span>
              <MessageSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs font-bold text-slate-200 mt-1 truncate">
              WhatsApp + Push
            </p>
            <p className="text-[10px] text-emerald-400/90">Envio instantâneo</p>
          </div>
        </div>

        {/* Barra de Abas de Navegação */}
        <div className="flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbaAtiva('WHATSAPP_MOCKUP')}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                abaAtiva === 'WHATSAPP_MOCKUP'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>WhatsApp do Dono (Simulador em Tempo Real)</span>
            </button>

            <button
              onClick={() => setAbaAtiva('AUDITORIA_LOG')}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                abaAtiva === 'AUDITORIA_LOG'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Histórico de Auditoria Anti-Fraude ({safeNotifs.length})</span>
            </button>

            <button
              onClick={() => setAbaAtiva('CONFIGURACOES')}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                abaAtiva === 'CONFIGURACOES'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações do Telefone</span>
            </button>
          </div>

          <button
            onClick={handleDispararTeste}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
            title="Enviar uma venda simulada de teste para o celular do dono"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Testar Notificação Agora</span>
          </button>
        </div>

        {/* Mensagem de Feedback de Teste */}
        {testeFeedback && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testeFeedback}</span>
            </div>
            <a
              href={gerarLinkWhatsApp(telefonePrincipal, 'Teste de Notificação Anti-Fraude bem-sucedido!')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] underline font-bold text-emerald-200 hover:text-white"
            >
              Abrir no WhatsApp
            </a>
          </div>
        )}

        {/* Conteúdo das Abas */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {/* ABA 1: SIMULADOR DE WHATSAPP DO DONO */}
          {abaAtiva === 'WHATSAPP_MOCKUP' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Celular Virtual */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="w-full max-w-sm rounded-[36px] bg-slate-950 p-3 shadow-2xl border-4 border-slate-800 relative">
                  {/* Notch / Câmera frontal do celular */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-slate-950 rounded-full"></div>
                  </div>

                  {/* Tela do Smartphone */}
                  <div className="rounded-[28px] bg-slate-900 overflow-hidden border border-slate-800 flex flex-col h-[520px] text-slate-100">
                    {/* Barra de Status do Telefone */}
                    <div className="px-5 pt-3 pb-1 flex justify-between items-center text-[10px] text-slate-400 font-mono bg-emerald-900/60 border-b border-emerald-800/40">
                      <span>10:20</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">5G</span>
                        <div className="w-4 h-2 border border-slate-400 rounded-xs flex items-center p-0.5">
                          <div className="w-full h-full bg-emerald-400"></div>
                        </div>
                      </div>
                    </div>

                    {/* Topo do Chat do WhatsApp */}
                    <div className="px-3 py-2 bg-emerald-900/80 border-b border-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                          🛡️
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-100 leading-none">
                            Sistema Anti-Fraude Lojas
                          </p>
                          <p className="text-[9.5px] text-emerald-300">
                            Espetinho 1, 2 & Tabacaria (online)
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/80 text-emerald-100 font-mono">
                        Dono: {nomeDono}
                      </span>
                    </div>

                    {/* Feed de Mensagens do WhatsApp */}
                    <div className="flex-1 p-3 space-y-2.5 overflow-y-auto custom-scrollbar bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                      {safeNotifs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          Nenhuma notificação recente disparada.
                        </div>
                      ) : (
                        safeNotifs.map((notif) => {
                          const isSangria = notif.tipo === 'SANGRIA' || notif.tipo === 'ALERTA_FRAUDE';
                          const isCancelamento = notif.tipo === 'CANCELAMENTO_ITEM';

                          return (
                            <div 
                              key={notif.id} 
                              className={`p-3 rounded-2xl text-xs max-w-[92%] shadow-md animate-in slide-in-from-bottom-2 ${
                                isSangria
                                  ? 'bg-rose-950/80 border border-rose-700/60 text-rose-100 ml-auto'
                                  : isCancelamento
                                  ? 'bg-amber-950/80 border border-amber-700/60 text-amber-100 ml-auto'
                                  : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-100 ml-auto'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 pb-1 mb-1 border-b border-white/10 text-[10px] font-bold">
                                <span>{notif.empresaNome}</span>
                                <span className="opacity-80">{notif.horario}</span>
                              </div>

                              <p className="whitespace-pre-line text-[11px] leading-relaxed">
                                {notif.mensagemWhatsApp}
                              </p>

                              <div className="mt-2 pt-1 border-t border-white/10 flex items-center justify-between text-[9px] opacity-75">
                                <span>📱 Entregue via WhatsApp</span>
                                <span>✓✓ Lido</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Barra Inferior de Disparo */}
                    <div className="p-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                      <div className="flex-1 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                        Canal Seguro Criptografado
                      </div>
                      <button
                        onClick={handleDispararTeste}
                        className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center cursor-pointer"
                        title="Enviar nova mensagem de teste"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Painel Lateral com Instruções e Vantagens Anti-Fraude */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Como o Sistema Protege o Dono das Empresas
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    A cada transação registrada por um operador em qualquer uma das três unidades, o sistema dispara uma notificação imediata com todos os detalhes:
                  </p>

                  <ul className="mt-3 space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Vendas em Tempo Real:</strong> Notifica o valor, itens e forma de pagamento (PIX, Dinheiro, Cartão).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✓</span>
                      <span><strong>Sangrias & Retiradas:</strong> Alerta imediato sempre que dinheiro físico é removido da gaveta.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">✓</span>
                      <span><strong>Cancelamentos de Itens:</strong> Evita que funcionários cancelem itens já consumidos e pagos pelo cliente para embolsar o valor.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">✓</span>
                      <span><strong>Quebras de Caixa:</strong> Notifica na hora se houver divergência entre o dinheiro apurado e o valor do sistema.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-300">WhatsApp Oficial do Dono</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-mono">Configurado</span>
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-100">
                    {configuracao.telefonePrincipal}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cadastre múltiplos telefones de gerentes e sócios na aba de configurações.
                  </p>

                  <div className="mt-3">
                    <a
                      href={gerarLinkWhatsApp(configuracao.telefonePrincipal, 'Olá Jackson! Sistema de Alertas das Lojas operando 100%.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Abrir Canal no WhatsApp Web</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: LOG DETALHADO DE AUDITORIA */}
          {abaAtiva === 'AUDITORIA_LOG' && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">Tipo:</span>
                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="bg-transparent text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="TODOS" className="bg-slate-900">Todos os Eventos</option>
                      <option value="VENDA" className="bg-slate-900">Vendas</option>
                      <option value="SANGRIA" className="bg-slate-900">Sangrias (Retiradas)</option>
                      <option value="CANCELAMENTO_ITEM" className="bg-slate-900">Cancelamentos (Auditoria)</option>
                      <option value="SUPRIMENTO" className="bg-slate-900">Suprimentos (Entradas)</option>
                      <option value="ABERTURA_CAIXA" className="bg-slate-900">Abertura de Caixa</option>
                      <option value="FECHAMENTO_CAIXA" className="bg-slate-900">Fechamento de Caixa</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">Unidade:</span>
                    <select
                      value={filtroEmpresa}
                      onChange={(e) => setFiltroEmpresa(e.target.value)}
                      className="bg-transparent text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="TODAS" className="bg-slate-900">Todas as Lojas</option>
                      {todasEmpresas.map(emp => (
                        <option key={emp.id} value={emp.id} className="bg-slate-900">{emp.nomeFantasia}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar por operador, item..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tabela / Lista de Notificações */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <div className="divide-y divide-slate-800">
                  {notificacoesFiltradas.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Nenhum registro encontrado para os filtros selecionados.
                    </div>
                  ) : (
                    notificacoesFiltradas.map((item) => {
                      const isCritico = item.nivel === 'CRITICO';
                      const isAtencao = item.nivel === 'ATENCAO';

                      return (
                        <div 
                          key={item.id}
                          className="p-4 hover:bg-slate-900/60 transition-colors flex items-start justify-between gap-4"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5">
                              {item.tipo === 'SANGRIA' ? (
                                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                                  <ArrowDownCircle className="w-4 h-4" />
                                </div>
                              ) : item.tipo === 'CANCELAMENTO_ITEM' ? (
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                  <ShieldCheck className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                  <TrendingUp className="w-4 h-4" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isCritico 
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                                    : isAtencao 
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                }`}>
                                  {item.tipo.replace('_', ' ')}
                                </span>
                                <span className="text-xs font-bold text-slate-100">{item.titulo}</span>
                              </div>

                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {item.detalhes || item.titulo}
                              </p>

                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                                <span>🏢 <strong>{item.empresaNome}</strong></span>
                                <span>👤 Operador: <strong>{item.operadorNome}</strong></span>
                                <span>📱 Enviado para: <strong className="text-slate-300">{item.enviadoParaTelefone}</strong></span>
                                <span>⏰ {item.horario}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {item.valor !== undefined && (
                              <p className={`text-sm font-mono font-bold ${
                                item.tipo === 'SANGRIA' ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {item.tipo === 'SANGRIA' ? '-' : ''}{formatCurrency(item.valor)}
                              </p>
                            )}

                            <a
                              href={gerarLinkWhatsApp(item.enviadoParaTelefone, item.mensagemWhatsApp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline"
                              title="Reabrir mensagem no WhatsApp"
                            >
                              <span>Reenviar</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: CONFIGURAÇÕES DO TELEFONE DO DONO */}
          {abaAtiva === 'CONFIGURACOES' && (
            <form onSubmit={handleSalvarConfig} className="max-w-2xl mx-auto space-y-6">
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-400" />
                  Números de Telefone para Notificação
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nome do Proprietário / Responsável
                    </label>
                    <input
                      type="text"
                      value={nomeDono}
                      onChange={(e) => setNomeDono(e.target.value)}
                      placeholder="Ex: Jackson (Dono)"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-emerald-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Telefone Principal (WhatsApp com DDD)
                    </label>
                    <input
                      type="text"
                      value={telefonePrincipal}
                      onChange={(e) => setTelefonePrincipal(e.target.value)}
                      placeholder="Ex: (11) 98765-4321"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Telefone Secundário (Sócio / Gerente Geral - Opcional)
                  </label>
                  <input
                    type="text"
                    value={telefoneSecundario}
                    onChange={(e) => setTelefoneSecundario(e.target.value)}
                    placeholder="Ex: (11) 99888-7766"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Regras Anti-Fraude e Gatilhos de Disparo */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-400" />
                  Gatilhos de Notificação no Celular
                </h3>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Notificar Todas as Vendas Realizadas</p>
                      <p className="text-[11px] text-slate-400">Dispara mensagem a cada venda de PDV ou comanda paga.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificarVendas}
                      onChange={(e) => setNotificarVendas(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-rose-500/20 cursor-pointer hover:border-rose-500/40">
                    <div>
                      <p className="text-xs font-bold text-rose-300">🚨 Alerta Crítico: Sangria de Dinheiro</p>
                      <p className="text-[11px] text-slate-400">Notifica imediatamente retiradas de dinheiro físico da gaveta.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificarSangrias}
                      onChange={(e) => setNotificarSangrias(e.target.checked)}
                      className="w-4 h-4 accent-rose-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-amber-500/20 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <p className="text-xs font-bold text-amber-300">⚠️ Auditoria Anti-Fraude: Cancelamento de Itens</p>
                      <p className="text-[11px] text-slate-400">Alerta quando operadores excluem itens de comandas em atendimento.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificarCancelamentos}
                      onChange={(e) => setNotificarCancelamentos(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Abertura e Fechamento de Turnos</p>
                      <p className="text-[11px] text-slate-400">Envia resumo de fechamento e alerta de eventuais quebras de caixa.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificarAberturaFechamento}
                      onChange={(e) => setNotificarAberturaFechamento(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Alerta Sonoro no Navegador / Terminal</p>
                      <p className="text-[11px] text-slate-400">Toca tom de alerta acústico a cada transação.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={alertaSonoroAtivo}
                      onChange={(e) => setAlertaSonoroAtivo(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Botão Salvar Configurações */}
              <div className="flex items-center justify-between pt-2">
                {salvoFeedback ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Configurações do telefone salvas com sucesso!
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    Sincronizado em tempo real com todos os terminais
                  </span>
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Salvar Preferências do Dono
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
