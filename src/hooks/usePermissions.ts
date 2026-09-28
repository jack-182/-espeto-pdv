import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, Operador } from '../types';
import { auth, googleAuthProvider } from '../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { setApiAuthToken, api } from '../services/api';
import { getSocket } from '../services/socket';

export type User = Operador;

export interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isOperator: boolean;
  token: string | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  canAccess: (requiredRole: UserRole | UserRole[]) => boolean;
  validateAdminPin: (inputPin: string) => Promise<boolean>;
  allUsers: User[];
  updateAdminPin: (newPin: string) => Promise<{ success: boolean; message?: string }>;
  updateUserPin: (userId: string, newPin: string) => { success: boolean; message?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Sincroniza lista de usuários se o usuário autenticado for Administrador
  useEffect(() => {
    async function carregarUsuarios() {
      if (!token || !currentUser) {
        setAllUsers([]);
        return;
      }
      if (currentUser.role === 'ADMINISTRADOR' || currentUser.role === 'SUPER_ADMIN') {
        try {
          const res = await api.getUsers();
          if (res.sucesso && Array.isArray(res.data)) {
            const mapped: User[] = res.data.map((u: any) => ({
              id: u.id,
              nome: u.nome,
              cargo: u.role === 'ADMINISTRADOR' ? 'Administrador Geral' : 'Operador Autorizado',
              role: u.role,
              email: u.email,
              lojaId: u.lojaId,
              active: u.active !== false
            }));
            setAllUsers(mapped);
            return;
          }
        } catch (e) {
          console.warn('[Auth] Falha ao listar usuários corporativos:', e);
        }
      }
      setAllUsers([currentUser]);
    }
    carregarUsuarios();
  }, [currentUser?.id, currentUser?.role, token]);

  // Monitora autenticação real do Firebase Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsLoading(true);
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          setApiAuthToken(idToken);
          getSocket(idToken);

          // Valida a sessão diretamente no backend PostgreSQL
          const meRes = await api.getAuthMe();
          if (meRes.sucesso && meRes.user) {
            setCurrentUser({
              id: meRes.user.uid,
              nome: meRes.user.name,
              cargo: meRes.user.role === 'ADMINISTRADOR' ? 'Administrador Geral' : 'Operador Autorizado',
              role: meRes.user.role,
              email: meRes.user.email,
              lojaId: meRes.user.storeId || undefined,
              active: meRes.user.active !== false
            });
          } else {
            console.warn('[Auth] Backend rejeitou o usuário. Limpando credenciais...');
            await signOut(auth);
            setCurrentUser(null);
            setToken(null);
            setApiAuthToken(null);
          }
        } catch (err) {
          console.error('[Auth] Falha ao verificar perfil no backend:', err);
          await signOut(auth);
          setCurrentUser(null);
          setToken(null);
          setApiAuthToken(null);
        }
      } else {
        setCurrentUser(null);
        setToken(null);
        setApiAuthToken(null);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = currentUser ? (currentUser.role === 'ADMINISTRADOR' || currentUser.role === 'SUPER_ADMIN') : false;
  const isOperator = currentUser ? (currentUser.role === 'OPERADOR' || currentUser.role === 'CAIXA') : false;

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setToken(idToken);
      setApiAuthToken(idToken);
      getSocket(idToken);

      const meRes = await api.getAuthMe();
      if (meRes.sucesso && meRes.user) {
        setCurrentUser({
          id: meRes.user.uid,
          nome: meRes.user.name,
          cargo: meRes.user.role === 'ADMINISTRADOR' ? 'Administrador Geral' : 'Operador Autorizado',
          role: meRes.user.role,
          email: meRes.user.email,
          lojaId: meRes.user.storeId || undefined,
          active: true
        });
      }
    } catch (err) {
      console.error('[Auth] Erro ao autenticar com Google:', err);
      setIsLoading(false);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await cred.user.getIdToken();
      setToken(idToken);
      setApiAuthToken(idToken);
      getSocket(idToken);

      const meRes = await api.getAuthMe();
      if (meRes.sucesso && meRes.user) {
        setCurrentUser({
          id: meRes.user.uid,
          nome: meRes.user.name,
          cargo: meRes.user.role === 'ADMINISTRADOR' ? 'Administrador Geral' : 'Operador Autorizado',
          role: meRes.user.role,
          email: meRes.user.email,
          lojaId: meRes.user.storeId || undefined,
          active: true
        });
      }
    } catch (err) {
      console.error('[Auth] Erro ao autenticar com Email/Senha:', err);
      setIsLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[Auth] Erro ao sair do Firebase:', err);
    } finally {
      setCurrentUser(null);
      setToken(null);
      setFirebaseUser(null);
      setApiAuthToken(null);
      setIsLoading(false);
    }
  };

  const canAccess = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(currentUser.role);
    }
    return currentUser.role === requiredRole;
  };

  const validateAdminPin = async (inputPin: string): Promise<boolean> => {
    try {
      const res = await api.verifySupervisorPin(inputPin, currentUser?.lojaId);
      return res.sucesso && !!res.supervisor;
    } catch {
      return false;
    }
  };

  const updateAdminPin = async (newPin: string): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!isAdmin) {
        return { success: false, message: 'Apenas administradores podem atualizar o PIN de supervisor.' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateUserPin = (userId: string, newPin: string): { success: boolean; message?: string } => {
    try {
      if (!isAdmin) {
        return { success: false, message: 'Apenas administradores podem atualizar o PIN de operadores.' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const value: AuthContextType = {
    user: currentUser,
    role: currentUser?.role || null,
    isAdmin,
    isOperator,
    token,
    firebaseUser,
    isAuthenticated: !!currentUser && !!token,
    isLoading,
    loginWithGoogle,
    loginWithEmail,
    logout,
    canAccess,
    validateAdminPin,
    allUsers,
    updateAdminPin,
    updateUserPin
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export function usePermissions() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('usePermissions deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}

export const useAuth = usePermissions;
export default usePermissions;
