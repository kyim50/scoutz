import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { groupAPI } from '../services/api';
import { useAuth } from './AuthContext';

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  role?: 'owner' | 'member';
  member_count?: number;
}

export interface GroupMember {
  id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  user: {
    id: string;
    name: string;
    username?: string;
    avatar_url?: string;
  };
}

interface GroupContextType {
  activeGroup: Group | null;
  setActiveGroup: (group: Group | null) => void;
  groups: Group[];
  loadGroups: () => Promise<void>;
  loadingGroups: boolean;
}

const GroupContext = createContext<GroupContextType>({
  activeGroup: null,
  setActiveGroup: () => {},
  groups: [],
  loadGroups: async () => {},
  loadingGroups: false,
});

const ACTIVE_GROUP_KEY = 'activeGroupId';

export const GroupProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [activeGroup, setActiveGroupState] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingGroups(true);
    try {
      const res = await groupAPI.getUserGroups();
      console.log('[GroupContext] raw API response:', JSON.stringify(res));
      const fetched: Group[] = res?.data?.groups ?? [];
      console.log('[GroupContext] fetched groups:', JSON.stringify(fetched));
      setGroups(fetched);

      // Restore active group from storage, validating it still exists
      const storedId = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
      if (storedId) {
        const match = fetched.find(g => g.id === storedId);
        if (match) {
          setActiveGroupState(match);
        } else {
          await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
          setActiveGroupState(null);
        }
      }
    } catch {
      // ignore — stay with empty groups
    } finally {
      setLoadingGroups(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadGroups();
    } else {
      setGroups([]);
      setActiveGroupState(null);
    }
  }, [isAuthenticated]);

  const setActiveGroup = useCallback(async (group: Group | null) => {
    setActiveGroupState(group);
    if (group) {
      await AsyncStorage.setItem(ACTIVE_GROUP_KEY, group.id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
    }
  }, []);

  return (
    <GroupContext.Provider value={{ activeGroup, setActiveGroup, groups, loadGroups, loadingGroups }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => useContext(GroupContext);
