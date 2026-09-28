import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Building2, 
  Percent, 
  ShieldAlert, 
  Printer, 
  Save, 
  CheckCircle2, 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  AlertCircle,
  Shield,
  Sliders,
  FileText,
  UserCheck,
  RefreshCw,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { Empresa, Operador, ConfiguracaoNotificacoesDono } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { AdminOnly, AccessDeniedFallback } from '../auth/AdminOnly';
import { 
  Smartphone, 
  Send, 
  Volume2, 
  VolumeX, 
  BellRing, 
  ArrowDownCircle, 
  ExternalLink 
} from 'lucide-react';
import { 
  carregarConfiguracaoNotificacoes, 
  salvarConfiguracaoNotificacoes, 
  dispararNotificacaoAoDono, 
  gerarLinkWhatsApp 
} from '../../services/notificationService';

interface ConfiguracoesViewProps {
  empresaAtiva: Empresa;
  onAtualizarEmpresa: (empresaAtualizada: Empresa) => void;
  operadores: Operador[];
}

type TabConfig = 'GERAL' | 'SEGURANCA' | 'NOTIFICACOES_DONO' | 'IMPRESSAO';

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  empresaAtiva,
  onAtualizarEmpresa,
  operadores = []
}) => {
  const { 
    user: operadorAtivo, 
    isAdmin, 
    validateAdminPin, 
    allUsers = [], 
    updateAdminPin, 
    updateUserPin 
  } = usePermissions();

  const listaUsuarios = (allUsers && allUsers.length > 0) 
    ? allUsers 
    : (operadores && operadores.length > 0 ? operadores : (operadorAtivo ? [operadorAtivo] : []));

  const [abaAtiva, setAbaAtiva] = useState<TabConfig>('GERAL');

  // Configurações do Telefone do Dono & Anti-Fraude
  const [configDono, setConfigDono] = useState<ConfiguracaoNotificacoesDono>(carregarConfiguracaoNotificacoes());
  const [feedbackDono, setFeedbackDono] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [testeDonoFeedback, setTesteDonoFeedback] = useState<string | null>(null);

  // Estados dos Dados Cadastrais da Empresa
  const [nomeFantasia, setNomeFantasia] = useState(empresaAtiva?.nomeFantasia || '');
  const [razaoSocial, setRazaoSocial] = useState(empresaAtiva?.razaoSocial || '');
  const [cnpj, setCnpj] = useState(empresaAtiva?.cnpj || '');
  const [telefone, setTelefone] = useState(empresaAtiva?.telefone || '');
  const [endereco, setEndereco] = useState(empresaAtiva?.endereco || '');
  const [taxaServico, setTaxaServico] = useState((empresaAtiva?.taxaServicoPadrao ?? 0).toString());
  const [limiteComanda, setLimiteComanda] = useState((empresaAtiva?.bloqueioLimiteComanda ?? 0).toString());
  const [salvo, setSalvo] = useState(false);

  // Estados de Segurança e Senha Mestra (Exclusivo Administrador)
  const [pinAtualDigitado, setPinAtualDigitado] = useState('');
  const [novoPin, setNovoPin] = useState('');
  const [confirmaPin, setConfirmaPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Estados para redefinição rápida de PIN de operadores por parte do Administrador
  const [operadorSelecionadoParaPin, setOperadorSelecionadoParaPin] = useState<string | null>(null);
  const [novoPinOperador, setNovoPinOperador] = useState('');
  const [feedbackOperadorPin, setFeedbackOperadorPin] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Estados de Impressão Térmica
  const [larguraBobina, setLarguraBobina] = useState<'80mm' | '58mm'>('80mm');
  const [imprimirViaCozinha, setImprimirViaCozinha] = useState(true);
  const [imprimirViaCliente, setImprimirViaCliente] = useState(true);
  const [mensagemRodape, setMensagemRodape] = useState('Obrigado pela preferência! Volte sempre.');

  useEffect(() => {
    if (empresaAtiva) {
      setNomeFantasia(empresaAtiva.nomeFantasia || '');
      setRazaoSocial(empresaAtiva.razaoSocial || '');
      setCnpj(empresaAtiva.cnpj || '');
      setTelefone(empresaAtiva.telefone || '');
      setEndereco(empresaAtiva.endereco || '');
      setTaxaServico((empresaAtiva.taxaServicoPadrao ?? 0).toString());
      setLimiteComanda((empresaAtiva.bloqueioLimiteComanda ?? 0).toString());
    }
  }, [empresaAtiva]);

  const handleSalvarDadosEmpresa = (e: React.FormEvent) => {
    e.preventDefault();
    onAtualizarEmpresa({
      ...empresaAtiva,
      nomeFantasia,
      razaoSocial,
      cnpj,
      telefone,
      endereco,
      taxaServicoPadrao: parseFloat(taxaServico) || 0,
      bloqueioLimiteComanda: parseFloat(limiteComanda) || 0
    });

    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  const handleAlterarPinAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinFeedback(null);

    if (!isAdmin) {
      setPinFeedback({ 
        tipo: 'erro', 
        texto: 'Acesso negado: Apenas o Administrador pode definir ou alterar a senha mestra.' 
      });
      return;
    }

    const isValidCurrent = await validateAdminPin(pinAtualDigitado);
    if (!isValidCurrent) {
      setPinFeedback({ 
        tipo: 'erro', 
        texto: 'A Senha Mestra atual digitada está incorreta.' 
      });
      return;
    }

    if (novoPin.length < 4 || novoPin.length > 6 || !/^\d+$/.test(novoPin)) {
      setPinFeedback({ 
        tipo: 'erro', 
        texto: 'O novo PIN deve conter entre 4 e 6 dígitos exclusivamente numéricos.' 
      });
      return;
    }

    if (novoPin !== confirmaPin) {
      setPinFeedback({ 
        tipo: 'erro', 
        texto: 'A confirmação do novo PIN não confere com a nova senha digitada.' 
      });
      return;
    }

    const res = await updateAdminPin(novoPin);
    if (res.success) {
      setPinFeedback({ 
        tipo: 'sucesso', 
        texto: 'Senha Mestra de Administrador salva e sincronizada com sucesso em armazenamento seguro!' 
      });
      setPinAtualDigitado('');
      setNovoPin('');
      setConfirmaPin('');
      setTimeout(() => setPinFeedback(null), 4500);
    } else {
      setPinFeedback({ tipo: 'erro', texto: res.message });
    }
  };

  const handleRedefinirPinOperador = (userId: string) => {
    if (!novoPinOperador || novoPinOperador.length < 4 || !/^\d+$/.test(novoPinOperador)) {
      setFeedbackOperadorPin({
        tipo: 'erro',
        texto: 'Digite um PIN numérico válido de 4 a 6 dígitos para o operador.'
      });
      return;
    }

    const res = updateUserPin(userId, novoPinOperador);
    if (res.success) {
      setFeedbackOperadorPin({
        tipo: 'sucesso',
        texto: `PIN do operador redefinido com sucesso!`
      });
      setNovoPinOperador('');
      setOperadorSelecionadoParaPin(null);
      setTimeout(() => setFeedbackOperadorPin(null), 3500);
    } else {
      setFeedbackOperadorPin({ tipo: 'erro', texto: res.message });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* CABEÇALHO COM TÍTULO E ABAS DE NAVEGAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Configurações & Parâmetros do Sistema
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {empresaAtiva?.nomeFantasia || 'Unidade'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão de dados cadastrais, segurança de alçada administrativa e periféricos.
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            id="tab-config-geral"
            onClick={() => setAbaAtiva('GERAL')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              abaAtiva === 'GERAL'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Dados da Unidade</span>
          </button>

          {/* ABA DE SEGURANÇA - SÓ RENDERIZA COMO DESTAQUE OU COM VISIBILIDADE CONTROLADA */}
          <AdminOnly>
            <button
              id="tab-config-seguranca"
              onClick={() => setAbaAtiva('SEGURANCA')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                abaAtiva === 'SEGURANCA'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Segurança & Senha Mestra</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          </AdminOnly>

          {/* ABA DE NOTIFICAÇÕES NO CELULAR DO DONO */}
          <AdminOnly>
            <button
              id="tab-config-notificacoes-dono"
              onClick={() => setAbaAtiva('NOTIFICACOES_DONO')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                abaAtiva === 'NOTIFICACOES_DONO'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Celular do Dono & Anti-Fraude</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          </AdminOnly>

          <button
            id="tab-config-impressao"
            onClick={() => setAbaAtiva('IMPRESSAO')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              abaAtiva === 'IMPRESSAO'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Impressão & Vias</span>
          </button>
        </div>
      </div>

      {/* ABA 1: DADOS DA EMPRESA & PARÂMETROS COMERCIAIS */}
      {abaAtiva === 'GERAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" /> 
                Informações Cadastrais da Unidade ({empresaAtiva?.nomeFantasia || 'Unidade'})
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">ID: {empresaAtiva?.id || ''}</span>
            </div>

            <form onSubmit={handleSalvarDadosEmpresa} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nome Fantasia (Exibição PDV/Comprovante)</label>
                  <input
                    type="text"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Razão Social</label>
                  <input
                    type="text"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono outline-hidden focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Telefone / WhatsApp Comercial</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Endereço Completo</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Taxa de Atendimento / Serviço Padrão (%)</label>
                  <div className="relative">
                    <Percent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="1"
                      value={taxaServico}
                      onChange={(e) => setTaxaServico(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Opcional para comanda e atendimento de mesa</span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Limite de Alerta para Comandas (R$)</label>
                  <div className="relative">
                    <ShieldAlert className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="50"
                      value={limiteComanda}
                      onChange={(e) => setLimiteComanda(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Destaca comandas que ultrapassarem este montante</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {salvo && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" /> Alterações salvas com sucesso!
                  </span>
                )}
                <button
                  type="submit"
                  id="btn-salvar-config-empresa-aba-geral"
                  className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition active:scale-98"
                >
                  <Save className="w-4 h-4" /> Salvar Parâmetros da Unidade
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400" />
                Resumo Operacional da Filial
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Tipo de Negócio:</span>
                  <span className="font-bold text-amber-400">{empresaAtiva.tipoNegocio}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Status Operação:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Aberto / Online
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Operadores Ativos:</span>
                  <span className="font-mono font-bold text-white">{operadores.length} usuários</span>
                </div>
              </div>

              <AdminOnly>
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setAbaAtiva('SEGURANCA')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Configurar Senha Mestra na Aba de Segurança</span>
                  </button>
                </div>
              </AdminOnly>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: SEGURANÇA & SENHA MESTRA ADMINISTRATIVA (EXCLUSIVA ADMINISTRADOR) */}
      {abaAtiva === 'SEGURANCA' && (
        <AdminOnly fallback={<AccessDeniedFallback modulo="Segurança & Senha Mestra" />}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
            {/* FORMULÁRIO DE ALTERAÇÃO DA SENHA MESTRA ADMIN */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 text-slate-100 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      Senha Mestra do Administrador
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        ALÇADA RESTRITA
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      PIN numérico confidencial utilizado para autorizações críticas em todo o sistema.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status de Persistência Restrita */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Armazenamento Seguro & Persistente</p>
                    <p className="text-[10px] text-slate-400">PIN gravado em estado local protegido e reativo.</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                  ATIVO
                </span>
              </div>

              <form onSubmit={handleAlterarPinAdmin} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 text-xs font-semibold flex items-center justify-between">
                    <span>1. Digite a Senha / PIN Atual do Administrador</span>
                    <span className="text-[10px] text-slate-500 font-normal">Padrão inicial: 1234</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={6}
                      placeholder="Senha atual de 4 a 6 dígitos"
                      value={pinAtualDigitado}
                      onChange={(e) => setPinAtualDigitado(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm tracking-widest outline-hidden focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 text-xs font-semibold">
                      2. Novo PIN Mestre (4 a 6 dígitos)
                    </label>
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={6}
                      placeholder="Ex: 8520"
                      value={novoPin}
                      onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm tracking-widest outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 text-xs font-semibold">
                      3. Confirmar Novo PIN
                    </label>
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={6}
                      placeholder="Repita o novo PIN"
                      value={confirmaPin}
                      onChange={(e) => setConfirmaPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm tracking-widest outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                {pinFeedback && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in ${
                    pinFeedback.tipo === 'sucesso'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/15 border border-red-500/30 text-red-300'
                  }`}>
                    {pinFeedback.tipo === 'sucesso' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{pinFeedback.texto}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="submit"
                    id="btn-gravar-senha-mestra-aba-seguranca"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 cursor-pointer transition active:scale-98"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Gravar e Persistir Nova Senha Mestra Administrativa</span>
                  </button>
                </div>
              </form>
            </div>

            {/* GERENCIAMENTO DE OPERADORES & REGRAS DE ALÇADA */}
            <div className="lg:col-span-6 space-y-6">
              {/* Painel de PINs dos Operadores Cadastrados */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      Operadores & PINs Cadastrados
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      O administrador pode redefinir o PIN de login rápido dos operadores.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{listaUsuarios.length} cadastrados</span>
                </div>

                {feedbackOperadorPin && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                    feedbackOperadorPin.tipo === 'sucesso'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/15 border border-red-500/30 text-red-300'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{feedbackOperadorPin.texto}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {listaUsuarios.map((op) => {
                    const isOpAdmin = op.role === 'ADMINISTRADOR';
                    const isEditingThis = operadorSelecionadoParaPin === op.id;

                    return (
                      <div
                        key={op.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isOpAdmin 
                            ? 'bg-amber-500/5 border-amber-500/30' 
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              {op.nome}
                              {isOpAdmin && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  ADMIN
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {op.cargo} • PIN: <strong className="font-mono text-slate-300">••••</strong>
                            </p>
                          </div>

                          {!isOpAdmin && (
                            <div>
                              {isEditingThis ? (
                                <button
                                  type="button"
                                  onClick={() => setOperadorSelecionadoParaPin(null)}
                                  className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                                >
                                  Cancelar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOperadorSelecionadoParaPin(op.id);
                                    setNovoPinOperador('');
                                  }}
                                  className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 cursor-pointer"
                                >
                                  Redefinir PIN
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Formulário inline para redefinir PIN do operador */}
                        {isEditingThis && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2">
                            <input
                              type="password"
                              maxLength={6}
                              placeholder="Novo PIN (4-6 dígitos)"
                              value={novoPinOperador}
                              onChange={(e) => setNovoPinOperador(e.target.value.replace(/\D/g, ''))}
                              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono flex-1 outline-hidden focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRedefinirPinOperador(op.id)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Salvar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabela Explicativa de Alçadas do Sistema */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 space-y-3 text-xs">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Operações que Exigem a Senha Mestra de Administrador:
                </h4>
                <ul className="space-y-2 text-[11px] text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                    <span><strong>Sangria de Caixa:</strong> Retiradas manuais de dinheiro da gaveta do turno.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                    <span><strong>Reabertura ou Ajuste de Turno Fechado:</strong> Desbloqueio de turnos já encerrados.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                    <span><strong>Cancelamento de Itens Já Enviados:</strong> Exclusão de pedidos já impressos ou produzidos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                    <span><strong>Acesso às Configurações Globais:</strong> Alteração de parâmetros fiscais e dados da empresa.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </AdminOnly>
      )}

      {/* ABA 3: IMPRESSÃO TÉRMICA & VIAS DE PEDIDO */}
      {abaAtiva === 'IMPRESSAO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" /> 
                Configuração de Impressora Térmica & Vias
              </h2>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Driver ESC/POS Integrado
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Largura da Bobina Térmica</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLarguraBobina('80mm')}
                    className={`p-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      larguraBobina === '80mm'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    80mm (Padrão PDV - 48 Colunas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLarguraBobina('58mm')}
                    className={`p-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                      larguraBobina === '58mm'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    58mm (Mini Térmica - 32 Colunas)
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-slate-400 font-medium">Vias de Impressão Automática ao Finalizar Venda</label>
                
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={imprimirViaCliente}
                      onChange={(e) => setImprimirViaCliente(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <p className="font-semibold text-slate-200">Via do Cliente (Cupom Não-Fiscal)</p>
                      <p className="text-[10px] text-slate-400">Imprime itens, valores, descontos e formas de pagamento.</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={imprimirViaCozinha}
                      onChange={(e) => setImprimirViaCozinha(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <p className="font-semibold text-slate-200">Via da Cozinha / Churrasqueira (Comanda de Preparo)</p>
                      <p className="text-[10px] text-slate-400">Imprime apenas itens de produção com observações e número da mesa.</p>
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Mensagem de Rodapé do Comprovante</label>
                <input
                  type="text"
                  value={mensagemRodape}
                  onChange={(e) => setMensagemRodape(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSalvo(true);
                    setTimeout(() => setSalvo(false), 3000);
                  }}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Salvar Preferências de Impressão
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Prévia do Cupom Térmico ({larguraBobina})
              </h3>
              
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1 shadow-inner">
                <p className="text-center font-bold text-white">{nomeFantasia.toUpperCase()}</p>
                <p className="text-center text-[10px] text-slate-400">{endereco}</p>
                <p className="text-center text-[10px] text-slate-400">CNPJ: {cnpj}</p>
                <p className="text-slate-600">--------------------------------</p>
                <div className="flex justify-between font-bold text-white">
                  <span>ITEM</span>
                  <span>TOTAL</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>2x Espeto Angus</span>
                  <span>R$ 28,00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>1x Chopp Brahma</span>
                  <span>R$ 10,00</span>
                </div>
                <p className="text-slate-600">--------------------------------</p>
                <div className="flex justify-between font-bold text-emerald-400">
                  <span>TOTAL A PAGAR</span>
                  <span>R$ 38,00</span>
                </div>
                <p className="text-slate-600">--------------------------------</p>
                <p className="text-center text-[10px] text-slate-400 pt-1">{mensagemRodape}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: NOTIFICAÇÕES NO CELULAR DO DONO & ANTI-FRAUDE */}
      {abaAtiva === 'NOTIFICACOES_DONO' && (
        <AdminOnly fallback={<AccessDeniedFallback />}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
            <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      Configuração do Celular do Dono & Sistema Anti-Fraude
                    </h2>
                    <p className="text-xs text-slate-400">
                      Receba alertas no WhatsApp para cada venda e movimentação suspeita nas 3 unidades.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const mock = dispararNotificacaoAoDono({
                      tipo: 'VENDA',
                      empresaId: empresaAtiva?.id || 'emp-1',
                      empresaNome: empresaAtiva?.nomeFantasia || 'Espetinho 1',
                      operadorNome: 'Jackson (Administrador)',
                      valor: 92.00,
                      formaPagamento: 'PIX',
                      detalhes: '4x Espeto Angus, 2x Chopp',
                      comandaNumero: 10
                    });
                    if (mock) {
                      setTesteDonoFeedback(`Disparo de teste efetuado para ${configDono.telefonePrincipal}!`);
                      setTimeout(() => setTesteDonoFeedback(null), 4000);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Testar Disparo Agora</span>
                </button>
              </div>

              {testeDonoFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
                  <span>✓ {testeDonoFeedback}</span>
                  <a
                    href={gerarLinkWhatsApp(configDono.telefonePrincipal, 'Teste de Alerta Anti-Fraude recebido!')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-emerald-200 hover:text-white"
                  >
                    Ver no WhatsApp
                  </a>
                </div>
              )}

              {feedbackDono && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedbackDono.tipo === 'sucesso' 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{feedbackDono.texto}</span>
                </div>
              )}

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  salvarConfiguracaoNotificacoes(configDono);
                  setFeedbackDono({ tipo: 'sucesso', texto: 'Configurações de alerta e telefone do dono salvas com sucesso!' });
                  setTimeout(() => setFeedbackDono(null), 3500);
                }} 
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nome do Proprietário
                    </label>
                    <input
                      type="text"
                      value={configDono.nomeDono}
                      onChange={(e) => setConfigDono({ ...configDono, nomeDono: e.target.value })}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 outline-hidden focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Telefone Principal (WhatsApp com DDD)
                    </label>
                    <input
                      type="text"
                      value={configDono.telefonePrincipal}
                      onChange={(e) => setConfigDono({ ...configDono, telefonePrincipal: e.target.value })}
                      placeholder="(11) 98765-4321"
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono outline-hidden focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Telefone Secundário (Sócio ou Gerente - Opcional)
                  </label>
                  <input
                    type="text"
                    value={configDono.telefoneSecundario || ''}
                    onChange={(e) => setConfigDono({ ...configDono, telefoneSecundario: e.target.value })}
                    placeholder="(11) 99888-7766"
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-amber-400" />
                    Regras e Gatilhos de Notificação Anti-Fraude
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Notificar Todas as Vendas no PDV e Comandas</p>
                      <p className="text-[11px] text-slate-400">Dispara alerta com valor, itens e forma de pagamento.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDono.notificarVendas}
                      onChange={(e) => setConfigDono({ ...configDono, notificarVendas: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-rose-500/20 cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-rose-300">🚨 Notificar Sangrias de Caixa (Retirada de Dinheiro)</p>
                      <p className="text-[11px] text-slate-400">Alerta de segurança máximo para evitar desvios na gaveta.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDono.notificarSangrias}
                      onChange={(e) => setConfigDono({ ...configDono, notificarSangrias: e.target.checked })}
                      className="w-4 h-4 accent-rose-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-amber-500/20 cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-amber-300">⚠️ Notificar Cancelamento de Itens em Comandas</p>
                      <p className="text-[11px] text-slate-400">Audita exclusões para evitar que funcionários cancelem pedidos pagos.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDono.notificarCancelamentos}
                      onChange={(e) => setConfigDono({ ...configDono, notificarCancelamentos: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Abertura e Fechamento de Turno</p>
                      <p className="text-[11px] text-slate-400">Comunica fundo de troco e possíveis divergências de caixa.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDono.notificarAberturaFechamento}
                      onChange={(e) => setConfigDono({ ...configDono, notificarAberturaFechamento: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Alerta Sonoro Acústico em Tempo Real</p>
                      <p className="text-[11px] text-slate-400">Bipe de confirmação sonora a cada transação.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDono.alertaSonoroAtivo}
                      onChange={(e) => setConfigDono({ ...configDono, alertaSonoroAtivo: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Salvar Configurações Anti-Fraude
                  </button>
                </div>
              </form>
            </div>

            {/* Coluna Lateral Informativa */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-3">
                <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Garantia Anti-Fraude do Dono
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Com as notificações no celular ativas, o dono Jackson é avisado no mesmo segundo em que qualquer venda é batida no caixa ou qualquer dinheiro é retirado.
                </p>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                  <p className="text-emerald-400 font-bold">✓ Espetinho 1: Monitorado</p>
                  <p className="text-emerald-400 font-bold">✓ Espetinho 2: Monitorado</p>
                  <p className="text-emerald-400 font-bold">✓ Tabacaria: Monitorada</p>
                </div>
              </div>
            </div>
          </div>
        </AdminOnly>
      )}
    </div>
  );
};
