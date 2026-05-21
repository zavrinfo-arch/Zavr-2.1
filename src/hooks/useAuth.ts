import { useAuthContext } from '../context/AuthContext';

export function useAuth() {
  const { user, session, loading, logout, getCurrentUserId } = useAuthContext();

  return {
    user,
    session,
    loading,
    userId: getCurrentUserId(),
    getCurrentUser: getCurrentUserId,
    logout
  };
}
