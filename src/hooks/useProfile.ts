import { useStore } from '../store/useStore';

export function useProfile() {
  const { currentUser, isAuthLoading, checkAuth, updateUser } = useStore();

  return {
    profile: currentUser,
    loading: isAuthLoading,
    refreshProfile: checkAuth,
    updateProfile: updateUser,
  };
}
