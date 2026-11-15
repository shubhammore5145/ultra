import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/permissions';

export const ProtectedRoute = ({ 
  children,
  allowedRoles, 
  requiredPermission 
}: { 
  children?: React.ReactNode;
  allowedRoles?: string[]; 
  requiredPermission?: string;
}) => {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user || !userData) {
    return <Navigate to="/login" replace />;
  }

  // Admin always has full access
  if (userData.role === 'admin') {
    return children ? <>{children}</> : <Outlet />;
  }

  // If a specific permission is required, check it
  if (requiredPermission && !hasPermission(userData, requiredPermission)) {
    return <Navigate to="/pos" replace />;
  }

  // Check role restrictions
  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/pos" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
