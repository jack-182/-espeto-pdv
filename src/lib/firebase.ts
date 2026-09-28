import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Validar que Firebase está configurado
if (!firebaseConfig.projectId) {
  console.warn(
    '[Firebase] Configuração incompleta. Verifique firebase-applet-config.json',
    firebaseConfig
  );
}

// Usar config do arquivo JSON se disponível, caso contrário usar variáveis de ambiente
const config = firebaseConfig.projectId
  ? firebaseConfig
  : {
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'imagined-graph-k6pck',
      appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:260296343980:web:6c64c984f500757e8fba09',
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBkuj-Vp4oGuVSWtysV-aRP3oLSStnkrJI',
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'imagined-graph-k6pck.firebaseapp.com',
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'imagined-graph-k6pck.firebasestorage.app',
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '260296343980',
    };

const app = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Configurar scopes adicionais
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');
googleAuthProvider.setCustomParameters({
  'login_hint': 'operador@empresa.com.br',
  'prompt': 'select_account'
});
