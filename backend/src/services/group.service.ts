import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';

export class GroupService {
  // ─── Create ──────────────────────────────────────────────────

  async createGroup(ownerId: string, name: string) {
    try {
      const { data: group, error } = await supabaseAdmin
        .from('groups')
        .insert({ name: name.trim(), owner_id: ownerId })
        .select()
        .single();

      if (error) {
        logger.error('Error creating group:', error);
        throw new Error('Failed to create group');
      }

      // Insert owner as a member with role 'owner'
      const { error: memberError } = await supabaseAdmin
        .from('group_members')
        .insert({ group_id: group.id, user_id: ownerId, role: 'owner' });

      if (memberError) {
        logger.error('Error adding owner as member:', memberError);
        // Roll back the group
        await supabaseAdmin.from('groups').delete().eq('id', group.id);
        throw new Error('Failed to initialise group membership');
      }

      return group;
    } catch (error) {
      logger.error('Error in createGroup:', error);
      throw error;
    }
  }

  // ─── Read ─────────────────────────────────────────────────────

  async getUserGroups(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('group_members')
        .select(`
          role,
          joined_at,
          groups (
            id,
            name,
            owner_id,
            invite_code,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user groups:', error);
        return [];
      }

      return (data ?? []).map((row: any) => ({
        ...row.groups,
        role: row.role,
        joined_at: row.joined_at,
      }));
    } catch (error) {
      logger.error('Error in getUserGroups:', error);
      return [];
    }
  }

  async getGroupById(groupId: string, requestingUserId: string) {
    try {
      // Verify membership before returning details
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', requestingUserId)
        .single();

      if (!membership) return null;

      const { data: group, error } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error || !group) return null;

      // Fetch members with user info
      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select(`
          role,
          joined_at,
          users (
            id,
            name,
            username,
            avatar_url
          )
        `)
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      return {
        ...group,
        requesting_user_role: membership.role,
        members: (members ?? []).map((m: any) => ({
          ...m.users,
          role: m.role,
          joined_at: m.joined_at,
        })),
      };
    } catch (error) {
      logger.error('Error in getGroupById:', error);
      throw error;
    }
  }

  // ─── Update ───────────────────────────────────────────────────

  async renameGroup(groupId: string, ownerId: string, name: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('groups')
        .update({ name: name.trim() })
        .eq('id', groupId)
        .eq('owner_id', ownerId)
        .select()
        .single();

      if (error || !data) {
        throw new Error('Group not found or insufficient permissions');
      }

      return data;
    } catch (error) {
      logger.error('Error in renameGroup:', error);
      throw error;
    }
  }

  async refreshInviteCode(groupId: string, ownerId: string) {
    try {
      // Generate a new invite code in Postgres using the same expression as the default
      const { data, error } = await supabaseAdmin
        .rpc('refresh_group_invite_code', { p_group_id: groupId, p_owner_id: ownerId });

      if (error) {
        logger.error('Error refreshing invite code:', error);
        throw new Error('Failed to refresh invite code');
      }

      return data as string;
    } catch (error) {
      logger.error('Error in refreshInviteCode:', error);
      throw error;
    }
  }

  // ─── Delete ───────────────────────────────────────────────────

  async deleteGroup(groupId: string, ownerId: string) {
    try {
      const { error } = await supabaseAdmin
        .from('groups')
        .delete()
        .eq('id', groupId)
        .eq('owner_id', ownerId);

      if (error) {
        logger.error('Error deleting group:', error);
        throw new Error('Group not found or insufficient permissions');
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteGroup:', error);
      throw error;
    }
  }

  // ─── Members ──────────────────────────────────────────────────

  async addMemberByUsername(groupId: string, ownerId: string, username: string) {
    try {
      // Only owner can add members
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('id')
        .eq('id', groupId)
        .eq('owner_id', ownerId)
        .single();

      if (!group) throw Object.assign(new Error('Group not found or insufficient permissions'), { code: 'FORBIDDEN' });

      // Resolve username → user
      const { data: targetUser } = await supabaseAdmin
        .from('users')
        .select('id, name, username, avatar_url')
        .eq('username', username.toLowerCase().trim())
        .single();

      if (!targetUser) throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });

      // Insert membership (ignore duplicate)
      const { error } = await supabaseAdmin
        .from('group_members')
        .insert({ group_id: groupId, user_id: targetUser.id, role: 'member' });

      if (error) {
        if (error.code === '23505') {
          throw Object.assign(new Error('User is already a member'), { code: 'ALREADY_MEMBER' });
        }
        logger.error('Error adding member:', error);
        throw new Error('Failed to add member');
      }

      return targetUser;
    } catch (error) {
      logger.error('Error in addMemberByUsername:', error);
      throw error;
    }
  }

  async removeMember(groupId: string, requestingUserId: string, targetUserId: string) {
    try {
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      if (!group) throw new Error('Group not found');

      const isOwner = group.owner_id === requestingUserId;
      const isSelf  = requestingUserId === targetUserId;

      // Owner can remove anyone except themselves; members can only remove themselves
      if (!isOwner && !isSelf) {
        throw Object.assign(new Error('Insufficient permissions'), { code: 'FORBIDDEN' });
      }
      if (isOwner && isSelf) {
        throw Object.assign(new Error('Owner cannot leave their own group — transfer ownership or delete it'), { code: 'OWNER_LEAVE' });
      }

      const { error } = await supabaseAdmin
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) {
        logger.error('Error removing member:', error);
        throw new Error('Failed to remove member');
      }

      return true;
    } catch (error) {
      logger.error('Error in removeMember:', error);
      throw error;
    }
  }

  // ─── Join via invite code ─────────────────────────────────────

  async joinByInviteCode(inviteCode: string, userId: string) {
    try {
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('id, name, owner_id')
        .eq('invite_code', inviteCode.trim())
        .single();

      if (!group) throw Object.assign(new Error('Invalid invite code'), { code: 'INVALID_CODE' });

      const { error } = await supabaseAdmin
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId, role: 'member' });

      if (error) {
        if (error.code === '23505') {
          throw Object.assign(new Error('Already a member of this group'), { code: 'ALREADY_MEMBER' });
        }
        logger.error('Error joining group:', error);
        throw new Error('Failed to join group');
      }

      return group;
    } catch (error) {
      logger.error('Error in joinByInviteCode:', error);
      throw error;
    }
  }

  // ─── Membership check (used by other services) ───────────────

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();
    return !!data;
  }
}

export default new GroupService();
