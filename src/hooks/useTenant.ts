import { useState, useEffect } from 'react';

export interface Tenant {
  tenantId: string;
  storeId: string;
  name: string;
}

export const useTenant = () => {
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    // Recuperar tenant do localStorage ou contexto
    const stored = localStorage.getItem('current_tenant');
    if (stored) {
      try {
        setTenant(JSON.parse(stored));
      } catch (err) {
        console.error('Erro ao parsear tenant:', err);
      }
    }
  }, []);

  const switchTenant = (newTenant: Tenant) => {
    setTenant(newTenant);
    localStorage.setItem('current_tenant', JSON.stringify(newTenant));
  };

  return { tenant, switchTenant };
};
