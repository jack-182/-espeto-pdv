import { useAuth } from './useAuth';
import { useTenant } from './useTenant';

export const useApi = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const apiCall = async (
    method: string,
    endpoint: string,
    body?: any,
  ) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.accessToken}`,
      'X-Tenant-Id': tenant?.tenantId || '',
      'X-Store-Id': tenant?.storeId || '',
    };

    const response = await fetch(
      `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}${endpoint}`,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Error');
    }

    return await response.json();
  };

  return {
    get: (endpoint: string) => apiCall('GET', endpoint),
    post: (endpoint: string, body: any) => apiCall('POST', endpoint, body),
    put: (endpoint: string, body: any) => apiCall('PUT', endpoint, body),
    patch: (endpoint: string, body: any) => apiCall('PATCH', endpoint, body),
    delete: (endpoint: string) => apiCall('DELETE', endpoint),
  };
};
