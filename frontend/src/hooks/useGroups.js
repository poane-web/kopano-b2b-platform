import { useQuery } from 'react-query';
import { api } from '../api/client';

export function useGroups(category) {
  const params = new URLSearchParams();
  params.set('status', 'open');
  if (category) params.set('category', category);

  return useQuery(['groups', category], () => api.groups.list(params.toString()), {
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useGroup(id) {
  return useQuery(['group', id], () => api.groups.get(id), {
    enabled: !!id,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
}
