import React from 'react';
import { AuthProvider, useAuth } from './src/AuthContext';
import Login from './src/Login';
import App from './App';

const AppContent: React.FC = () => {
  const { isAuthenticated, user, login } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  return <App />;
};

const AppWrapper: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default AppWrapper;
