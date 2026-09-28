import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Store, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  Filter, 
  Lock,
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

interface Employee {
  id: string;
  nome: string;
  email: string;
  role: 'OPERADOR';
  lojaId: string;
  lojaNome: string;
  status: 'ACTIVE' | 'INACTIVE';
  active: boolean;
  createdAt: string;
  convite?: {
    invitationId: string;
    status: 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'NAO_ENVIADO';
    expiresAt: string;
    acceptedAt?: string;
  } | null;
}

interface StoreOption {
  id: string;
  nome: string;
}

interface UsuariosFuncionariosProps {
  lojasDisponiveis?: Array<{ id: string; nome: string }>;
}

export const UsuariosFuncionarios: React.FC<UsuariosFuncionariosProps> = ({ lojasDisponiveis = [] }) => {
  const { user: authUser, isAdmin } = usePermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [storesList, setStoresList] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ACTIVE' | 'INACTIVE'>('TODOS');

  // Modal Novo Funcionário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaLojaId, setNovaLojaId] = useState('');
  const [novoStatus, setNovoStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [salvando, setSalvando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conviteGerado, setConviteGerado] = useState<{
    link: string;
    nome: string;
    email: string;
    lojaNome: string;
    expiresAt: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Modal Alterar Loja
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [lojaSelecionadaEdicao, setLojaSelecionadaEdicao] = useState('');
  const [salvandoLoja, setSalvandoLoja] = useState(false);

  // Carregar lista de funcionários e lojas
  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [empRes, storesRes] = await Promise.all([
        api.getEmployees(),
        api.getStores()
      ]);

      if (empRes.sucesso) {
        setEmployees(empRes.data || []);
      } else {
        setError(empRes.erro || 'Falha ao carregar funcionários.');
      }

      const rawStores = storesRes.data || storesRes.lojas || [];
      const mappedStores: StoreOption[] = rawStores.map((s: any) => ({
        id: s.storeId || s.id,
        nome: s.tradeName || s.corporateName || s.name || s.nomeFantasia || `Loja ${s.storeId || s.id}`
      }));
      setStoresList(mappedStores);

      if (mappedStores.length > 0 && !novaLojaId) {
        setNovaLojaId(mappedStores[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Submeter novo funcionário
  const handleSubmitNovoFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setFormError('Informe o nome completo do funcionário.');
      return;
    }
    if (!novoEmail.trim() || !novoEmail.includes('@')) {
      setFormError('Informe um e-mail corporativo válido.');
      return;
    }
    if (!novaLojaId) {
      setFormError('Selecione a loja a ser vinculada.');
      return;
    }

    try {
      setSalvando(true);
      setFormError(null);

      // Enviamos estritamente os campos solicitados: nome, email, lojaId, status
      // A role é estritamente fixada no backend como OPERADOR (requisitos 4, 7 e 9)
      const res = await api.createEmployee({
        nome: novoNome.trim(),
        email: novoEmail.trim(),
        lojaId: novaLojaId,
        status: novoStatus
      });

      if (res.sucesso && res.data) {
        const emp = res.data;
        setConviteGerado({
          link: emp.convite?.conviteLink || `${window.location.origin}?convite=${emp.convite?.token}`,
          nome: emp.nome,
          email: emp.email,
          lojaNome: emp.lojaNome,
          expiresAt: emp.convite?.expiresAt
        });
        // Atualiza a lista
        await carregarDados();
      } else {
        setFormError(res.erro || 'Não foi possível cadastrar o funcionário.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Erro inesperado ao cadastrar funcionário.');
    } finally {
      setSalvando(false);
    }
  };

  const handleCopiarConvite = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const fecharModalNovoFuncionario = () => {
    setIsModalOpen(false);
    setConviteGerado(null);
    setNovoNome('');
    setNovoEmail('');
    setFormError(null);
    setCopiado(false);
  };

  // Alternar Status (Ativar / Desativar)
  const handleToggleStatus = async (emp: Employee) => {
    const novoStatus: 'ACTIVE' | 'INACTIVE' = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.updateEmployeeStatus(emp.id, novoStatus);
      if (res.sucesso) {
        setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, status: novoStatus, active: novoStatus === 'ACTIVE' } : item));
      } else {
        alert(res.erro || 'Falha ao alterar status.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status.');
    }
  };

  // Reenviar Convite
  const handleReenviarConvite = async (emp: Employee) => {
    try {
      const res = await api.resendEmployeeInvite(emp.id);
      if (res.sucesso && res.data) {
        const link = res.data.conviteLink || `${window.location.origin}?convite=${res.data.token}`;
        handleCopiarConvite(link);
        alert(`Novo link de convite gerado e copiado para a área de transferência:\n\n${link}`);
        await carregarDados();
      } else {
        alert(res.erro || 'Falha ao reenviar convite.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao reenviar convite.');
    }
  };

  // Alterar Loja Vinculada
  const handleSalvarNovaLoja = async () => {
    if (!editingEmployee || !lojaSelecionadaEdicao) return;
    try {
      setSalvandoLoja(true);
      const res = await api.updateEmployeeStore(editingEmployee.id, lojaSelecionadaEdicao);
      if (res.sucesso) {
        setEmployees(prev => prev.map(item => item.id === editingEmployee.id ? {
          ...item,
          lojaId: lojaSelecionadaEdicao,
          lojaNome: res.data.lojaNome || lojaSelecionadaEdicao
        } : item));
        setEditingEmployee(null);
      } else {
        alert(res.erro || 'Falha ao vincular nova loja.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao vincular nova loja.');
    } finally {
      setSalvandoLoja(false);
    }
  };

  // Filtragem de funcionários
  const filteredEmployees = employees.filter(emp => {
    const matchTexto = 
      emp.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      emp.email.toLowerCase().includes(filtroTexto.toLowerCase());
    const matchLoja = filtroLoja === 'TODAS' || emp.lojaId === filtroLoja;
    const matchStatus = filtroStatus === 'TODOS' || emp.status === filtroStatus;
    return matchTexto && matchLoja && matchStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 text-slate-100 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Gestão de Acessos & Equipe
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Perfil Restrito: OPERADOR
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Usuários / Funcionários
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Cadastro, vinculação a lojas físicas e emissão de convites seguros para operadores do PDV.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            id="btn-atualizar-funcionarios"
            onClick={carregarDados}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-novo-funcionario"
            onClick={() => {
              setIsModalOpen(true);
              setConviteGerado(null);
              setFormError(null);
            }}
            className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Funcionário</span>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Busca por texto */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-busca-funcionarios"
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filtro por Loja */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <Store className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="select-filtro-loja"
              value={filtroLoja}
              onChange={e => setFiltroLoja(e.target.value)}
              className="bg-transparent text-xs sm:text-sm text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="TODAS" className="bg-slate-900 text-slate-100">Todas as Lojas</option>
              {storesList.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="select-filtro-status"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value as any)}
              className="bg-transparent text-xs sm:text-sm text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900 text-slate-100">Todos os Status</option>
              <option value="ACTIVE" className="bg-slate-900 text-emerald-400">Ativos</option>
              <option value="INACTIVE" className="bg-slate-900 text-rose-400">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* LISTA / TABELA DE FUNCIONÁRIOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-xs sm:text-sm">Carregando quadro de funcionários...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
            <p className="text-sm">{error}</p>
            <button
              onClick={carregarDados}
              className="text-xs text-amber-400 hover:underline cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Users className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">Nenhum funcionário encontrado.</p>
            <p className="text-xs text-slate-500">
              Clique em "Novo Funcionário" para cadastrar e emitir convite com perfil OPERADOR.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">Loja Vinculada</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Convite / Acesso</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredEmployees.map(emp => {
                  const isAtivo = emp.status === 'ACTIVE' && emp.active;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                      {/* Funcionário */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                            {emp.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{emp.nome}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Loja Vinculada */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-medium truncate">{emp.lojaNome}</span>
                          <button
                            onClick={() => {
                              setEditingEmployee(emp);
                              setLojaSelecionadaEdicao(emp.lojaId);
                            }}
                            className="text-[10px] text-slate-400 hover:text-amber-400 hover:underline ml-1 cursor-pointer"
                            title="Trocar loja vinculada"
                          >
                            (Alterar)
                          </button>
                        </div>
                      </td>

                      {/* Perfil */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Lock className="w-2.5 h-2.5" />
                          OPERADOR
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isAtivo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-2.5 h-2.5" />
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Convite / Acesso */}
                      <td className="py-3.5 px-4">
                        {emp.convite?.status === 'ACEITO' ? (
                          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Conta Ativa
                          </span>
                        ) : emp.convite?.status === 'EXPIRADO' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expirado
                            </span>
                            <button
                              onClick={() => handleReenviarConvite(emp)}
                              className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                            >
                              Reenviar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" />
                              Pendente
                            </span>
                            <button
                              onClick={() => handleReenviarConvite(emp)}
                              className="text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                            >
                              Copiar Link
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          id={`btn-toggle-status-${emp.id}`}
                          onClick={() => handleToggleStatus(emp)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                            isAtivo
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isAtivo ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: NOVO FUNCIONÁRIO (CONFORME REQUISITOS 1, 2, 4, 6, 9) */}
      {isModalOpen && (
        <div 
          id="modal-novo-funcionario-backdrop"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            id="modal-novo-funcionario"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
          >
            {/* Header do Modal */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Novo Funcionário</h3>
                  <p className="text-xs text-slate-400">Perfil fixo: OPERADOR (Frente de Caixa / PDV)</p>
                </div>
              </div>
              <button
                onClick={fecharModalNovoFuncionario}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Modal: se convite gerado, exibe tela de sucesso com link de convite */}
            {conviteGerado ? (
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">Funcionário Cadastrado com Sucesso!</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      O funcionário <strong className="text-white">{conviteGerado.nome}</strong> foi cadastrado como <strong className="text-white">OPERADOR</strong> na unidade <strong className="text-white">{conviteGerado.lojaNome}</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Link de Convite para o Funcionário Criar/Acessar sua Conta:
                  </label>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-xs text-slate-200">
                    <span className="truncate flex-1">{conviteGerado.link}</span>
                    <button
                      id="btn-copiar-convite"
                      type="button"
                      onClick={() => handleCopiarConvite(conviteGerado.link)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      {copiado ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                      <span>{copiado ? 'Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    O convite é válido por 7 dias. Envie o link acima ao funcionário.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    id="btn-concluir-modal-funcionario"
                    onClick={fecharModalNovoFuncionario}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                  >
                    Concluir e Voltar à Lista
                  </button>
                </div>
              </div>
            ) : (
              /* Formulário de Cadastro: Campos nome, e-mail, loja vinculada e status */
              <form onSubmit={handleSubmitNovoFuncionario} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Banner de Garantia de Role */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2.5">
                  <Lock className="w-4 h-4 shrink-0 text-blue-400" />
                  <span>
                    <strong>Perfil OPERADOR (Obrigatório):</strong> Este fluxo cadastra exclusivamente operadores de frente de caixa com acesso restrito à loja vinculada.
                  </span>
                </div>

                {/* Campo 1: Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Nome Completo <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-funcionario-nome"
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo Silva"
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                {/* Campo 2: E-mail */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    E-mail do Funcionário <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-funcionario-email"
                    type="email"
                    required
                    placeholder="carlos.silva@empresa.com.br"
                    value={novoEmail}
                    onChange={e => setNovoEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    O funcionário receberá o link para ativar e definir suas credenciais.
                  </span>
                </div>

                {/* Campo 3: Loja Vinculada (Única) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Loja Vinculada <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      id="select-funcionario-loja"
                      required
                      value={novaLojaId}
                      onChange={e => setNovaLojaId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                    >
                      <option value="" disabled>Selecione a loja física...</option>
                      {storesList.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    O funcionário operará exclusivamente nesta loja selecionada.
                  </span>
                </div>

                {/* Campo 4: Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Status Inicial <span className="text-rose-400">*</span>
                  </label>
                  <select
                    id="select-funcionario-status"
                    value={novoStatus}
                    onChange={e => setNovoStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                  >
                    <option value="ACTIVE" className="bg-slate-900 text-emerald-400">Ativo (Habilitado para operar)</option>
                    <option value="INACTIVE" className="bg-slate-900 text-rose-400">Inativo (Acesso bloqueado)</option>
                  </select>
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={fecharModalNovoFuncionario}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    id="btn-salvar-funcionario"
                    type="submit"
                    disabled={salvando}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {salvando ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Cadastrando...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 text-slate-950" />
                        <span>Cadastrar & Gerar Convite</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ALTERAR LOJA VINCULADA */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-400" />
              Alterar Loja Vinculada
            </h3>
            <p className="text-xs text-slate-400">
              Selecione a nova loja para o operador <strong className="text-white">{editingEmployee.nome}</strong>:
            </p>

            <div className="space-y-1.5">
              <select
                id="select-alterar-loja"
                value={lojaSelecionadaEdicao}
                onChange={e => setLojaSelecionadaEdicao(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
              >
                {storesList.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingEmployee(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-alterar-loja"
                onClick={handleSalvarNovaLoja}
                disabled={salvandoLoja}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {salvandoLoja ? 'Salvando...' : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
