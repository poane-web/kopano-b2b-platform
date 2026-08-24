import { useQuery } from 'react-query';
import { api } from '../api/client';

export function useGroups(category) {
  const params = new URLSearchParams();
  params.set('status', 'open');
  if (category) params.set('category', category);
  
  return useQuery(['groups', category], () => api.groups.list(params.toString()), {
    staleTime: 2 * 60 * 1000,
  });
}

export function useGroup(id) {
  return useQuery(['group', id], () => api.groups.get(id), {
    enabled: !!id,
  });
}
