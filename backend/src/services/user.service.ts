import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import { withCoordinates } from '../utils/geo';

export interface UpdateUserData {
  name?: string;
  username?: string;
  bio?: string;
  school?: string;
  major?: string;
  avatar_url?: string;
}

export interface NearbyLiveUser {
  userId: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

/**
 * Columns safe to expose on the public profile endpoint. Never widen this to
 * `*` — the users row also holds email, live GPS coordinates, the push token
 * and supabase_auth_id, and GET /api/users/:id is unauthenticated.
 */
const PUBLIC_PROFILE_COLUMNS =
  'id, name, username, bio, avatar_url, school, major, reputation_score, pins_created, events_created, created_at';

/**
 * Build a YYYY-MM-DD formatter for a specific IANA time zone, falling back to
 * UTC if the zone is unrecognised (an old client, or a hand-edited value).
 */
function dayFormatter(timeZone: string): (date: Date) => string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a plain string.
  return (date: Date) => formatter.format(date);
}

export class UserService {
  async getUserProfile(userId: string, timeZone?: string) {
    try {
      const [profileResult, streak] = await Promise.all([
        supabaseAdmin.from('users').select(PUBLIC_PROFILE_COLUMNS).eq('id', userId).single(),
        this.getStreak(userId, timeZone),
      ]);

      const { data, error } = profileResult;

      if (error) {
        logger.error('Error getting user profile:', error);
        return null;
      }

      return { ...data, streak };
    } catch (error) {
      logger.error('Error in getUserProfile:', error);
      return null;
    }
  }

  async savePushToken(userId: string, token: string) {
    try {
      await supabaseAdmin
        .from('users')
        .update({ push_token: token })
        .eq('id', userId);
    } catch (err) {
      logger.error('Error saving push token:', err);
    }
  }

  async updateUserProfile(userId: string, updateData: UpdateUserData) {
    try {
      const updates: any = {};

      if (updateData.name) updates.name = updateData.name;
      if (updateData.bio !== undefined) updates.bio = updateData.bio;
      if (updateData.avatar_url !== undefined) updates.avatar_url = updateData.avatar_url;

      if (updateData.username !== undefined) {
        const clean = updateData.username.replace(/^@/, '').toLowerCase();
        if (clean) {
          // Uniqueness check — exclude current user
          const { data: taken } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', clean)
            .neq('id', userId)
            .single();
          if (taken) throw new Error('Username is already taken');
          updates.username = clean;
        } else {
          updates.username = null;
        }
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user profile:', error);
        throw new Error('Failed to update profile');
      }

      return data;
    } catch (error) {
      logger.error('Error in updateUserProfile:', error);
      throw error;
    }
  }

  async getUserPins(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting user pins:', error);
        return [];
      }

      // select('*') returns the PostGIS column as hex EWKB, which no caller can
      // read. Flatten it to lat/lng here so every consumer gets coordinates.
      return (data || []).map(withCoordinates);
    } catch (error) {
      logger.error('Error in getUserPins:', error);
      return [];
    }
  }

  async getUserReports(userId: string) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('last_activity_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Error getting user reports:', error);
        return [];
      }

      // select('*') returns the PostGIS column as hex EWKB, which no caller can
      // read. Flatten it to lat/lng here so every consumer gets coordinates.
      return (data || []).map(withCoordinates);
    } catch (error) {
      logger.error('Error in getUserReports:', error);
      return [];
    }
  }

  async getUserEvents(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false });

      if (error) {
        logger.error('Error getting user events:', error);
        return [];
      }

      // select('*') returns the PostGIS column as hex EWKB, which no caller can
      // read. Flatten it to lat/lng here so every consumer gets coordinates.
      return (data || []).map(withCoordinates);
    } catch (error) {
      logger.error('Error in getUserEvents:', error);
      return [];
    }
  }

  /**
   * Consecutive days with at least one contribution.
   *
   * `timeZone` is the user's IANA zone (e.g. "America/New_York"). Day
   * boundaries must be computed there, not in UTC: a contribution at 8pm in
   * UTC-5 lands on the *next* UTC day, so UTC bucketing silently broke streaks
   * for anyone west of Greenwich.
   */
  async getStreak(userId: string, timeZone = 'UTC'): Promise<number> {
    try {
      // Look back up to 366 days to cover any realistic streak
      const since = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString();

      const [pinsResult, eventsResult, reportsResult] = await Promise.all([
        supabaseAdmin.from('pins').select('created_at').eq('user_id', userId).gte('created_at', since),
        supabaseAdmin.from('events').select('created_at').eq('user_id', userId).gte('created_at', since),
        supabaseAdmin.from('reports').select('created_at').eq('user_id', userId).gte('created_at', since),
      ]);

      const localDay = dayFormatter(timeZone);

      const activeDays = new Set<string>();
      const addRows = (rows: any[]) => {
        for (const row of rows || []) {
          activeDays.add(localDay(new Date(row.created_at as string)));
        }
      };
      addRows(pinsResult.data || []);
      addRows(eventsResult.data || []);
      addRows(reportsResult.data || []);

      // Walk backwards from today in the user's local calendar.
      let streak = 0;
      for (let i = 0; i < 366; i++) {
        const day = localDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000));

        if (activeDays.has(day)) {
          streak++;
        } else if (i === 0) {
          // Today may simply not have happened yet — don't break the streak.
          continue;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error('Error in getStreak:', error);
      return 0;
    }
  }

  async getUserActivity(userId: string, days: number = 91) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [pinsResult, eventsResult, reportsResult] = await Promise.all([
        supabaseAdmin.from('pins').select('created_at').eq('user_id', userId).gte('created_at', since),
        supabaseAdmin.from('events').select('created_at').eq('user_id', userId).gte('created_at', since),
        supabaseAdmin.from('reports').select('created_at').eq('user_id', userId).gte('created_at', since),
      ]);

      const counts: Record<string, number> = {};
      const addRows = (rows: any[]) => {
        for (const row of rows || []) {
          const day = (row.created_at as string).slice(0, 10);
          counts[day] = (counts[day] || 0) + 1;
        }
      };
      addRows(pinsResult.data || []);
      addRows(eventsResult.data || []);
      addRows(reportsResult.data || []);

      const activity: { date: string; count: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().slice(0, 10);
        activity.push({ date: dateStr, count: counts[dateStr] || 0 });
      }
      return activity;
    } catch (error) {
      logger.error('Error in getUserActivity:', error);
      return [];
    }
  }

  async updateLiveLocation(userId: string, lat: number, lng: number) {
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          live_lat: lat,
          live_lng: lng,
          live_location_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error updating live location:', error);
        throw new Error('Failed to update location');
      }
    } catch (error) {
      logger.error('Error in updateLiveLocation:', error);
      throw error;
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    try {
      // Read the Supabase Auth id up front. It is a different id from our own
      // users.id — passing users.id to auth.admin.deleteUser always fails.
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('supabase_auth_id')
        .eq('id', userId)
        .single();

      // Delete all user content first (cascade-safe order)
      await Promise.all([
        supabaseAdmin.from('pins').delete().eq('user_id', userId),
        supabaseAdmin.from('reports').delete().eq('user_id', userId),
        supabaseAdmin.from('events').delete().eq('user_id', userId),
        supabaseAdmin.from('event_attendees').delete().eq('user_id', userId),
        supabaseAdmin.from('pin_verifications').delete().eq('user_id', userId),
        supabaseAdmin.from('group_members').delete().eq('user_id', userId),
        supabaseAdmin.from('saved_items').delete().eq('user_id', userId),
        supabaseAdmin.from('reviews').delete().eq('user_id', userId),
        supabaseAdmin.from('event_messages').delete().eq('user_id', userId),
        supabaseAdmin.from('report_messages').delete().eq('user_id', userId),
      ]);

      // Groups owned by this user go too — otherwise they are left orphaned
      // with an owner_id pointing at a deleted row.
      await supabaseAdmin.from('groups').delete().eq('owner_id', userId);

      // Delete the user row from our users table
      const { error: userRowError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (userRowError) {
        logger.error('Error deleting user row:', userRowError);
        throw new Error('Failed to delete user data');
      }

      // Delete the Supabase Auth account, if this user has one. Password-only
      // accounts have no auth record, and a failure here must not surface as an
      // error: the app data is already gone and the client needs to sign out.
      if (userRow?.supabase_auth_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
          userRow.supabase_auth_id
        );
        if (authError) {
          logger.error('Error deleting Supabase auth user:', authError);
        }
      }

      logger.info('Account deleted:', { userId });
    } catch (error) {
      logger.error('Error in deleteAccount:', error);
      throw error;
    }
  }

  async getNearbyLiveUsers(
    userId: string,
    lat: number,
    lng: number,
    radius: number = 500,
    activeWithinMinutes: number = 5
  ): Promise<NearbyLiveUser[]> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_nearby_live_users', {
        p_user_id: userId,
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: radius,
        p_active_within_minutes: activeWithinMinutes,
      });

      if (error) {
        logger.error('Error getting nearby live users:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        userId: row.user_id,
        lat: Number(row.lat),
        lng: Number(row.lng),
        distanceMeters: Number(row.distance_meters || 0),
      }));
    } catch (error) {
      logger.error('Error in getNearbyLiveUsers:', error);
      return [];
    }
  }

  async getLeaderboard(limit: number = 10) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name, username, avatar_url, reputation_score, pins_created, events_created')
        .order('reputation_score', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error getting leaderboard:', error);
        return [];
      }

      return (data || []).map((u: any, i: number) => ({
        rank: i + 1,
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatar_url,
        reputationScore: u.reputation_score ?? 0,
        pinsCreated: u.pins_created ?? 0,
        eventsCreated: u.events_created ?? 0,
      }));
    } catch (error) {
      logger.error('Error in getLeaderboard:', error);
      return [];
    }
  }

  async getUserRSVPs(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('event_attendees')
        .select(`
          *,
          event:events (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'going')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting user RSVPs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getUserRSVPs:', error);
      return [];
    }
  }
}

export default new UserService();
