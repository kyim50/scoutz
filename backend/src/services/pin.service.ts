import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import aiService from './ai.service';
import socketService from './socket.service';
import reputationService from './reputation.service';
import pushService from './push.service';

const PIN_BASE_TTL_DAYS = 30;
const PIN_VERIFIED_THRESHOLD = 3;
/** Only verifications from the last N days count toward "verified" (pin stays up). */
const PIN_VERIFICATION_WINDOW_DAYS = 90;
/** When a pin drops below threshold, set expires_at this many days from now. */
const PIN_GRACE_PERIOD_DAYS = 7;
/** Unique inaccurate votes within this window trigger a grace-period expiry. */
const PIN_INACCURATE_THRESHOLD = 5;
const PIN_INACCURATE_WINDOW_DAYS = 30;

export interface CreatePinData {
  userId: string;
  location: {
    lat: number;
    lng: number;
  };
  type: string;
  title: string;
  description?: string;
  tags?: string[];
  building?: string;
  floor?: string;
  accessNotes?: string;
  photoUrls?: string[];
  groupId?: string;
}

export interface SearchPinsData {
  lat: number;
  lng: number;
  radius?: number; // meters
  type?: string;
  tags?: string[];
  limit?: number;
  userId?: string;
}

export class PinService {
  /**
   * Create a new pin
   */
  async createPin(data: CreatePinData) {
    try {
      // Spatial deduplication: reject if a pin of the same type exists within 20m
      // No p_user_id — we check public pins only for dedup purposes
      const { data: nearby } = await supabaseAdmin.rpc('get_nearby_pins', {
        lat: data.location.lat,
        lng: data.location.lng,
        radius_meters: 20,
        pin_type: data.type,
        limit_count: 1,
      });

      if (nearby && nearby.length > 0) {
        const err: any = new Error('A similar pin already exists nearby');
        err.code = 'DUPLICATE_PIN';
        err.existingPin = nearby[0];
        throw err;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + PIN_BASE_TTL_DAYS * 24 * 60 * 60 * 1000);

      // Insert pin immediately with no embedding; generate embedding asynchronously
      const { data: pin, error } = await supabaseAdmin
        .from('pins')
        .insert({
          user_id: data.userId,
          location: `POINT(${data.location.lng} ${data.location.lat})`,
          type: data.type,
          title: data.title,
          description: data.description,
          tags: data.tags || [],
          building: data.building,
          floor: data.floor,
          access_notes: data.accessNotes,
          photo_urls: data.photoUrls || [],
          embedding: null,
          expires_at: expiresAt.toISOString(),
          ...(data.groupId ? { group_id: data.groupId } : {}),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating pin:', error);
        throw new Error('Failed to create pin');
      }

      logger.info('Pin created:', { pinId: pin.id, userId: data.userId });

      // Broadcast to all connected clients immediately
      socketService.broadcastNewPin(pin);

      // Fire-and-forget: generate embedding and backfill
      setImmediate(async () => {
        try {
          const embeddingText = `${data.title} ${data.description || ''} ${(data.tags || []).join(' ')}`;
          const embedding = await aiService.generateEmbedding(embeddingText);
          await supabaseAdmin.from('pins').update({ embedding }).eq('id', pin.id);
        } catch (embErr) {
          logger.error('Async embedding failed for pin', pin.id, embErr);
        }
      });

      // Increment user pin counter (atomic RPC preferred, fallback to manual)
      try {
        await supabaseAdmin.rpc('increment_user_pins_created', { uid: data.userId });
      } catch (rpcError) {
        logger.warn('increment_user_pins_created RPC failed, using fallback:', rpcError);
        try {
          const { data: u } = await supabaseAdmin
            .from('users')
            .select('pins_created')
            .eq('id', data.userId)
            .single();
          if (u) {
            await supabaseAdmin.from('users').update({ pins_created: (u.pins_created || 0) + 1 }).eq('id', data.userId);
          }
        } catch (fallbackError) {
          logger.error('Failed to increment pins_created counter:', fallbackError);
        }
      }

      // Award reputation for creating a pin
      await reputationService.award(data.userId, 'create_pin');

      return pin;
    } catch (error) {
      logger.error('Error in createPin:', error);
      throw error;
    }
  }

  /**
   * Search for nearby pins
   */
  async searchNearby(params: SearchPinsData) {
    try {
      const { lat, lng, radius = 1000, type, tags, limit = 20, userId } = params;

      const { data, error } = await supabaseAdmin
        .rpc('get_nearby_pins', {
          lat,
          lng,
          radius_meters: radius,
          pin_type: type || null,
          limit_count: limit,
          p_user_id: userId || null,
        });

      if (error) {
        logger.error('Error searching pins:', error);
        throw new Error('Failed to search pins');
      }

      // Filter by tags if provided
      let filteredData = data;
      if (tags && tags.length > 0) {
        filteredData = data.filter((pin: any) => 
          tags.some(tag => pin.tags?.includes(tag))
        );
      }

      return filteredData || [];
    } catch (error) {
      logger.error('Error in searchNearby:', error);
      throw error;
    }
  }

  /**
   * Get pin by ID
   */
  async getPinById(pinId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pins')
        .select(`
          *,
          creator:users!pins_user_id_fkey (
            id,
            name,
            avatar_url,
            reputation_score
          ),
          verifications:pin_verifications (
            user_id,
            is_accurate,
            comment,
            created_at,
            user:users (
              name,
              avatar_url
            )
          )
        `)
        .eq('id', pinId)
        .single();

      if (error) {
        logger.error('Error getting pin:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error in getPinById:', error);
      return null;
    }
  }

  /**
   * Update pin (owner only)
   */
  async updatePin(pinId: string, userId: string, updates: Partial<CreatePinData>) {
    try {
      // First check if user owns the pin
      const { data: existingPin } = await supabaseAdmin
        .from('pins')
        .select('user_id')
        .eq('id', pinId)
        .single();

      if (!existingPin || existingPin.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) updateFields.title = updates.title;
      if (updates.description !== undefined) updateFields.description = updates.description;
      if (updates.tags !== undefined) updateFields.tags = updates.tags;
      if (updates.building !== undefined) updateFields.building = updates.building;
      if (updates.floor !== undefined) updateFields.floor = updates.floor;
      if (updates.accessNotes !== undefined) updateFields.access_notes = updates.accessNotes;

      const { data, error } = await supabaseAdmin
        .from('pins')
        .update(updateFields)
        .eq('id', pinId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating pin:', error);
        throw new Error('Failed to update pin');
      }

      return data;
    } catch (error) {
      logger.error('Error in updatePin:', error);
      throw error;
    }
  }

  /**
   * Delete pin (owner only)
   */
  async deletePin(pinId: string, userId: string) {
    try {
      // Check ownership
      const { data: existingPin } = await supabaseAdmin
        .from('pins')
        .select('user_id')
        .eq('id', pinId)
        .single();

      if (!existingPin || existingPin.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const { error } = await supabaseAdmin
        .from('pins')
        .delete()
        .eq('id', pinId);

      if (error) {
        logger.error('Error deleting pin:', error);
        throw new Error('Failed to delete pin');
      }

      logger.info('Pin deleted:', { pinId, userId });

      socketService.broadcastDeletedPin(pinId);

      try {
        const { data: u } = await supabaseAdmin
          .from('users')
          .select('pins_created')
          .eq('id', userId)
          .single();
        if (u) {
          await supabaseAdmin.from('users').update({ pins_created: Math.max(0, (u.pins_created || 0) - 1) }).eq('id', userId);
        }
      } catch (counterError) {
        logger.error('Failed to decrement pins_created counter:', counterError);
      }

      // Deduct reputation for removing own pin
      await reputationService.award(userId, 'delete_pin');

      return true;
    } catch (error) {
      logger.error('Error in deletePin:', error);
      throw error;
    }
  }

  /**
   * Verify pin. When verification_count (accurate) reaches PIN_VERIFIED_THRESHOLD, set expires_at = NULL so the pin never expires.
   */
  async verifyPin(pinId: string, userId: string, isAccurate: boolean, comment?: string) {
    try {
      // Fetch pin metadata for notifications
      const { data: pin } = await supabaseAdmin
        .from('pins')
        .select('user_id, title')
        .eq('id', pinId)
        .single();

      const { data, error } = await supabaseAdmin
        .from('pin_verifications')
        .upsert({
          pin_id: pinId,
          user_id: userId,
          is_accurate: isAccurate,
          comment: comment
        })
        .select()
        .single();

      if (error) {
        logger.error('Error verifying pin:', error);
        throw new Error('Failed to verify pin');
      }

      if (isAccurate) {
        const cutoff = new Date(Date.now() - PIN_VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from('pin_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('pin_id', pinId)
          .eq('is_accurate', true)
          .gte('created_at', cutoff);
        if (count != null && count >= PIN_VERIFIED_THRESHOLD) {
          await supabaseAdmin
            .from('pins')
            .update({ expires_at: null })
            .eq('id', pinId);
          logger.info('Pin marked permanent (verified, recent count)', { pinId, verificationCount: count });

          // Notify pin creator their pin is now verified
          if (pin?.user_id && pin.user_id !== userId) {
            pushService.notifyUsers(
              [pin.user_id],
              'Pin verified!',
              `Your pin "${pin.title}" has been verified as accurate and is now permanent`,
              { type: 'pin_verified', pinId }
            ).catch(() => {});
          }
        }
      } else {
        // Count unique users who marked inaccurate within the rolling window
        const inaccurateCutoff = new Date(Date.now() - PIN_INACCURATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data: inaccurateVotes } = await supabaseAdmin
          .from('pin_verifications')
          .select('user_id')
          .eq('pin_id', pinId)
          .eq('is_accurate', false)
          .gte('created_at', inaccurateCutoff);

        const uniqueInaccurateVoters = new Set((inaccurateVotes || []).map((v: { user_id: string }) => v.user_id)).size;

        if (uniqueInaccurateVoters >= PIN_INACCURATE_THRESHOLD) {
          // Enter grace period — pin expires in PIN_GRACE_PERIOD_DAYS unless re-verified
          const graceExpiry = new Date(Date.now() + PIN_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
          await supabaseAdmin
            .from('pins')
            .update({ expires_at: graceExpiry })
            .eq('id', pinId)
            // Don't override if already in a shorter expiry window
            .or(`expires_at.is.null,expires_at.gt.${graceExpiry}`);
          logger.info('Pin entered grace period due to inaccurate votes', { pinId, uniqueInaccurateVoters });

          // Notify pin creator their pin is in danger
          if (pin?.user_id && pin.user_id !== userId) {
            pushService.notifyUsers(
              [pin.user_id],
              'Pin flagged as inaccurate',
              `Your pin "${pin.title}" has been flagged and may expire soon — verify it to keep it alive`,
              { type: 'pin_grace_period', pinId }
            ).catch(() => {});
          }
        }
      }

      // Award reputation for the verification action
      await reputationService.award(
        userId,
        isAccurate ? 'verify_pin_accurate' : 'verify_pin_inaccurate',
      );

      return data;
    } catch (error) {
      logger.error('Error in verifyPin:', error);
      throw error;
    }
  }

  /**
   * Delete pins whose expires_at has passed. Then re-check pins with expires_at NULL:
   * only recent verifications (within VERIFICATION_WINDOW_DAYS) count; if below threshold, set expires_at to now + GRACE_PERIOD_DAYS.
   * Called by the scheduler.
   */
  async cleanupExpiredPins() {
    try {
      const now = new Date().toISOString();
      const { data: deleted, error } = await supabaseAdmin
        .from('pins')
        .delete()
        .not('expires_at', 'is', null)
        .lt('expires_at', now)
        .select('id');

      if (error) {
        logger.error('Error cleaning up expired pins:', error);
        return;
      }

      if (deleted && deleted.length > 0) {
        logger.info(`Deleted ${deleted.length} expired pins`);
        deleted.forEach((p: { id: string }) => socketService.broadcastDeletedPin(p.id));
      }

      await this.revokeExpiredVerifications();
    } catch (error) {
      logger.error('Error in cleanupExpiredPins:', error);
    }
  }

  /**
   * Pins with expires_at NULL must have >= PIN_VERIFIED_THRESHOLD recent (within window) accurate verifications.
   * If not, set expires_at = now + GRACE_PERIOD_DAYS so they expire unless re-verified.
   */
  private async revokeExpiredVerifications() {
    try {
      const cutoff = new Date(Date.now() - PIN_VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const graceEnd = new Date(Date.now() + PIN_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: permanentPins, error: fetchError } = await supabaseAdmin
        .from('pins')
        .select('id')
        .is('expires_at', null);

      if (fetchError || !permanentPins?.length) return;

      const { data: recentCounts } = await supabaseAdmin
        .from('pin_verifications')
        .select('pin_id')
        .eq('is_accurate', true)
        .gte('created_at', cutoff);

      const countByPin: Record<string, number> = {};
      (recentCounts || []).forEach((r: { pin_id: string }) => {
        countByPin[r.pin_id] = (countByPin[r.pin_id] || 0) + 1;
      });

      const toRevoke = permanentPins.filter(
        (p: { id: string }) => (countByPin[p.id] || 0) < PIN_VERIFIED_THRESHOLD
      );
      if (toRevoke.length === 0) return;

      const { error: updateError } = await supabaseAdmin
        .from('pins')
        .update({ expires_at: graceEnd })
        .in('id', toRevoke.map((p: { id: string }) => p.id));

      if (!updateError) {
        logger.info('Revoked permanent status for pins with expired verifications', { count: toRevoke.length });
      }
    } catch (error) {
      logger.error('Error in revokeExpiredVerifications:', error);
    }
  }
}

export default new PinService();
