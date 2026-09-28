import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useApi } from '../../hooks/useApi';

interface Alert {
  id: string;
  title: string;
  message: string;
  level: 'NORMAL' | 'ATENCAO' | 'CRITICO';
  storeId: string;
  timestamp: Date;
  desvios?: {
    total: number;
    percentual: number;
  };
}

interface DashboardData {
  stores: Array<{
    storeId: string;
    name: string;
    faturamento: number;
    desvio: number;
    status: string;
  }>;
  totalRevenue: number;
  totalDesvios: number;
  pendingAlerts: Alert[];
}

export const DashboardDono: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { data } = useWebSocket('alerts');
  const { get } = useApi();

  // Carregar dashboard ao montar
  useEffect(() => {
    loadDashboard();
  }, []);

  // Escutar notificações em tempo real via WebSocket
  useEffect(() => {
    if (data?.type === 'ALERTA_DESVIO') {
      const newAlert: Alert = {
        id: Math.random().toString(),
        title: data.title,
        message: data.message,
        level: data.level,
        storeId: data.storeId,
        timestamp: new Date(),
        desvios: data.desvios,
      };

      setAlerts((prev) => [newAlert, ...prev]);

      // Recarregar dashboard para atualizar totais
      loadDashboard();

      // Tocar som de alerta
      playAlertSound();

      // Notificação do navegador (se permitido)
      if (Notification.permission === 'granted') {
        new Notification('🚨 Desvio de Caixa Detectado', {
          body: data.message,
          icon: '/alert-icon.png',
        });
      }
    }
  }, [data]);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const response = await get('/owner/dashboard');
      setDashboard(response);
      setAlerts(response.pendingAlerts || []);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playAlertSound = () => {
    const audio = new Audio('/alert-sound.mp3');
    audio.play().catch((err) => console.log('Som não disponível:', err));
  };

  const handleMarkAlertAsRead = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Zap className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900">Dashboard do Dono</h1>
        <p className="text-gray-600 mt-1">Gestão centralizada de 3 unidades</p>
      </div>

      {/* ALERTAS CRÍTICOS (Floating) */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 flex items-start justify-between ${
                alert.level === 'CRITICO'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`w-5 h-5 mt-1 ${
                    alert.level === 'CRITICO'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}
                />
                <div>
                  <h3
                    className={`font-bold ${
                      alert.level === 'CRITICO'
                        ? 'text-red-900'
                        : 'text-yellow-900'
                    }`}
                  >
                    {alert.title}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      alert.level === 'CRITICO'
                        ? 'text-red-800'
                        : 'text-yellow-800'
                    }`}
                  >
                    {alert.message}
                  </p>
                  {alert.desvios && (
                    <p className="text-xs mt-2 opacity-75">
                      Desvio: R$ {alert.desvios.total.toFixed(2)} (
                      {alert.desvios.percentual.toFixed(2)}%)
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleMarkAlertAsRead(alert.id)}
                className="text-xs font-medium px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 whitespace-nowrap"
              >
                Descartar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm font-medium">Faturamento (Hoje)</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            R$ {(dashboard?.totalRevenue ?? 0).toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm font-medium">Desvios Detectados</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              (dashboard?.totalDesvios ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            R$ {(dashboard?.totalDesvios ?? 0).toFixed(2)}
          </p>
          {(dashboard?.totalDesvios ?? 0) > 0 && (
            <p className="text-xs text-red-600 mt-1">⚠️ Investigação recomendada</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm font-medium">Alertas Pendentes</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {alerts.length}
          </p>
        </div>
      </div>

      {/* UNIDADES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboard?.stores.map((store) => (
          <div key={store.storeId} className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">{store.name}</h3>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded ${
                  store.status === 'ATIVA'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {store.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Faturamento:</span>
                <span className="font-semibold text-green-600">
                  R$ {store.faturamento.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Desvio:</span>
                <span
                  className={`font-semibold ${
                    store.desvio > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {store.desvio > 0 && '⚠️'} R$ {store.desvio.toFixed(2)}
                </span>
              </div>
            </div>

            <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded text-sm font-semibold hover:bg-blue-700">
              Ver Detalhes
            </button>
          </div>
        ))}
      </div>

      {/* REQUEST NOTIFICATION PERMISSION */}
      {Notification.permission === 'default' && (
        <div className="fixed bottom-4 right-4 bg-blue-50 p-4 rounded-lg shadow border border-blue-200">
          <p className="text-sm text-blue-900 mb-2">
            Receba notificações de desvios em tempo real
          </p>
          <button
            onClick={() => Notification.requestPermission()}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
          >
            Ativar
          </button>
        </div>
      )}
    </div>
  );
};
