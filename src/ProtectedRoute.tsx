import React from 'react';
import { useAuth } from './AuthContext';
import Login from './Login';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={() => {}} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
