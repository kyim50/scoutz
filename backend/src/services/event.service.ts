import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import reputationService from './reputation.service';
import pushService from './push.service';
import { AppError, notFound, forbidden, assertUuid } from '../utils/errors';

export interface CreateEventData {
  userId: string;
  location: {
    lat: number;
    lng: number;
  };
  title: string;
  description?: string;
  category: string;
  startTime: string;
  endTime: string;
  maxAttendees?: number;
  tags?: string[];
  photoUrl?: string;
  locationName?: string;
  building?: string;
  room?: string;
  isRecurring?: boolean;
  groupId?: string;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'custom';
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    endDate?: string;
  };
}

export class EventService {
  async createEvent(data: CreateEventData) {
    try {
      // If recurring, create the series
      if (data.isRecurring && data.recurrencePattern) {
        return await this.createRecurringEvent(data);
      }

      // Create single event
      const { data: event, error } = await supabaseAdmin
        .from('events')
        .insert({
          user_id: data.userId,
          location: `POINT(${data.location.lng} ${data.location.lat})`,
          title: data.title,
          description: data.description,
          category: data.category,
          start_time: data.startTime,
          end_time: data.endTime,
          max_attendees: data.maxAttendees,
          tags: data.tags || [],
          photo_url: data.photoUrl,
          location_name: data.locationName,
          building: data.building,
          room: data.room,
          status: 'scheduled',
          is_recurring: false,
          ...(data.groupId ? { group_id: data.groupId } : {}),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating event:', error);
        throw new Error('Failed to create event');
      }

      // Atomic increment — the previous read-modify-write lost increments when
      // a user created two events concurrently.
      const { error: counterError } = await supabaseAdmin.rpc('increment_user_events_created', {
        uid: data.userId,
      });
      if (counterError) {
        logger.error('Failed to increment events_created counter:', counterError);
      }

      // Award reputation for creating an event
      await reputationService.award(data.userId, 'create_event');

      return event;
    } catch (error) {
      logger.error('Error in createEvent:', error);
      throw error;
    }
  }

  async createRecurringEvent(data: CreateEventData) {
    try {
      if (!data.recurrencePattern) {
        throw new Error('Recurrence pattern is required');
      }

      // Create parent event
      const { data: parentEvent, error: parentError } = await supabaseAdmin
        .from('events')
        .insert({
          user_id: data.userId,
          location: `POINT(${data.location.lng} ${data.location.lat})`,
          title: data.title,
          description: data.description,
          category: data.category,
          start_time: data.startTime,
          end_time: data.endTime,
          max_attendees: data.maxAttendees,
          tags: data.tags || [],
          photo_url: data.photoUrl,
          location_name: data.locationName,
          building: data.building,
          room: data.room,
          status: 'scheduled',
          is_recurring: true,
          recurrence_pattern: data.recurrencePattern
        })
        .select()
        .single();

      if (parentError) {
        logger.error('Error creating parent event:', parentError);
        throw new Error('Failed to create recurring event');
      }

      // Generate instances
      const instances = this.generateRecurringInstances(parentEvent, data.recurrencePattern);
      
      if (instances.length > 0) {
        const { error: instancesError } = await supabaseAdmin
          .from('events')
          .insert(instances);

        if (instancesError) {
          logger.error('Error creating event instances:', instancesError);
          // Don't fail the whole operation, parent event is created
        }
      }

      return parentEvent;
    } catch (error) {
      logger.error('Error in createRecurringEvent:', error);
      throw error;
    }
  }

  private generateRecurringInstances(parentEvent: any, pattern: any): any[] {
    const instances = [];
    const startDate = new Date(parentEvent.start_time);
    const endDate = pattern.endDate ? new Date(pattern.endDate) : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // Default 90 days
    const eventDuration = new Date(parentEvent.end_time).getTime() - new Date(parentEvent.start_time).getTime();

    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1);

    const maxInstances = 52;
    let instanceCount = 0;

    while (currentDate <= endDate && instanceCount < maxInstances) {
      let shouldCreate = false;

      if (pattern.frequency === 'daily') {
        shouldCreate = true;
      } else if (pattern.frequency === 'weekly' && pattern.daysOfWeek) {
        shouldCreate = pattern.daysOfWeek.includes(currentDate.getDay());
      }

      if (shouldCreate) {
        const instanceStartTime = new Date(currentDate);
        instanceStartTime.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
        const instanceEndTime = new Date(instanceStartTime.getTime() + eventDuration);

        instances.push({
          user_id: parentEvent.user_id,
          location: parentEvent.location,
          title: parentEvent.title,
          description: parentEvent.description,
          category: parentEvent.category,
          start_time: instanceStartTime.toISOString(),
          end_time: instanceEndTime.toISOString(),
          max_attendees: parentEvent.max_attendees,
          tags: parentEvent.tags,
          photo_url: parentEvent.photo_url,
          location_name: parentEvent.location_name,
          building: parentEvent.building,
          room: parentEvent.room,
          status: 'scheduled',
          is_recurring: false,
          parent_event_id: parentEvent.id
        });

        instanceCount++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return instances;
  }

  async getEventSeries(parentEventId: string) {
    try {
      // Validated before interpolation: PostgREST `.or()` takes a filter
      // expression, so an unchecked id containing commas or parentheses would
      // let a caller rewrite the query.
      assertUuid(parentEventId);

      const { data, error } = await supabaseAdmin
        .from('events')
        .select('*')
        .or(`id.eq.${parentEventId},parent_event_id.eq.${parentEventId}`)
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('Error getting event series:', error);
        throw new Error('Failed to get event series');
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getEventSeries:', error);
      throw error;
    }
  }

  async updateEventSeries(parentEventId: string, userId: string, updateData: Partial<CreateEventData>) {
    try {
      assertUuid(parentEventId);

      // Check if user owns the parent event
      const parentEvent = await this.getEventById(parentEventId);
      if (!parentEvent) {
        throw notFound('Event');
      }
      if (parentEvent.user_id !== userId) {
        throw forbidden();
      }

      // Update all future instances
      const now = new Date().toISOString();
      const updates: any = {};
      
      if (updateData.title) updates.title = updateData.title;
      if (updateData.description !== undefined) updates.description = updateData.description;
      if (updateData.category) updates.category = updateData.category;
      if (updateData.maxAttendees !== undefined) updates.max_attendees = updateData.maxAttendees;
      if (updateData.locationName !== undefined) updates.location_name = updateData.locationName;
      if (updateData.building !== undefined) updates.building = updateData.building;
      if (updateData.room !== undefined) updates.room = updateData.room;
      if (updateData.photoUrl !== undefined) updates.photo_url = updateData.photoUrl;

      const { error } = await supabaseAdmin
        .from('events')
        .update(updates)
        .or(`id.eq.${parentEventId},parent_event_id.eq.${parentEventId}`)
        .gte('start_time', now);

      if (error) {
        logger.error('Error updating event series:', error);
        throw new Error('Failed to update event series');
      }

      return true;
    } catch (error) {
      logger.error('Error in updateEventSeries:', error);
      throw error;
    }
  }

  async getUpcomingEvents(lat: number, lng: number, radius: number = 5000, hoursAhead: number = 168, userId?: string) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_upcoming_events', {
          lat,
          lng,
          radius_meters: radius,
          hours_ahead: hoursAhead,
          p_user_id: userId || null,
        });

      if (error) {
        logger.error('Error getting upcoming events:', error);
        throw new Error('Failed to get events');
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getUpcomingEvents:', error);
      throw error;
    }
  }

  parseWKBHex(wkbHex: string): { lat: number; lng: number } | null {
    try {
      // Remove '01' prefix if exists (byte order marker)
      let hex = wkbHex.replace(/^01/, '');
      
      // WKB format for POINT with SRID:
      // 01 (byte order) + 00000020 (geometry type with SRID flag) + E6100000 (SRID 4326) + coordinates
      
      // Skip to the coordinate data (after SRID)
      // Remove geometry type (4 bytes) and SRID (4 bytes) = 8 bytes = 16 hex chars
      const coordHex = hex.slice(16);
      
      // Extract X (longitude) - first 8 bytes (16 hex chars)
      const lngHex = coordHex.slice(0, 16);
      // Extract Y (latitude) - next 8 bytes (16 hex chars)
      const latHex = coordHex.slice(16, 32);
      
      // Convert hex to double (little-endian)
      const lngBuffer = Buffer.from(lngHex, 'hex');
      const latBuffer = Buffer.from(latHex, 'hex');
      
      const lng = lngBuffer.readDoubleLE(0);
      const lat = latBuffer.readDoubleLE(0);
      
      return { lat, lng };
    } catch (error) {
      logger.error('Error parsing WKB hex:', error);
      return null;
    }
  }

  async getEventByIdWithCoords(eventId: string) {
    try {
      // First get the event data
      const event = await this.getEventById(eventId);
      if (!event) return null;

      // Extract coordinates from PostGIS WKB format
      if (event.location) {
        try {
          let locationString = event.location;
          
          // If location is an object, convert to string
          if (typeof locationString === 'object') {
            // Convert buffer-like object to hex string
            const values = Object.values(locationString as any);
            locationString = values.map((v: any) => {
              const hex = v.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');
          }
          
          logger.info(`Parsing location string: ${locationString.substring(0, 50)}...`);
          
          const coords = this.parseWKBHex(locationString);
          if (coords) {
            event.event_lat = coords.lat;
            event.event_lng = coords.lng;
            logger.info(`Extracted coordinates: lat=${coords.lat}, lng=${coords.lng}`);
          } else {
            logger.warn('Could not parse WKB hex coordinates');
          }
        } catch (coordError) {
          logger.error('Error extracting coordinates:', coordError);
        }
      }

      return event;
    } catch (error) {
      logger.error('Error in getEventByIdWithCoords:', error);
      return await this.getEventById(eventId);
    }
  }

  async getEventById(eventId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('events')
        .select(`
          *,
          creator:users!events_user_id_fkey (
            id,
            name,
            avatar_url,
            reputation_score
          ),
          attendees:event_attendees (
            user_id,
            status,
            user:users (
              name,
              avatar_url
            )
          )
        `)
        .eq('id', eventId)
        .single();

      if (error) {
        logger.error('Error getting event:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error in getEventById:', error);
      return null;
    }
  }

  async updateEvent(eventId: string, userId: string, updateData: Partial<CreateEventData>) {
    try {
      // Check if user owns the event
      const event = await this.getEventById(eventId);
      if (!event) {
        throw notFound('Event');
      }
      if (event.user_id !== userId) {
        throw forbidden();
      }

      const updates: any = {};
      if (updateData.title) updates.title = updateData.title;
      if (updateData.description !== undefined) updates.description = updateData.description;
      if (updateData.category) updates.category = updateData.category;
      if (updateData.startTime) updates.start_time = updateData.startTime;
      if (updateData.endTime) updates.end_time = updateData.endTime;
      if (updateData.maxAttendees !== undefined) updates.max_attendees = updateData.maxAttendees;
      if (updateData.tags) updates.tags = updateData.tags;
      if (updateData.photoUrl !== undefined) updates.photo_url = updateData.photoUrl;
      if (updateData.locationName !== undefined) updates.location_name = updateData.locationName;
      if (updateData.building !== undefined) updates.building = updateData.building;
      if (updateData.room !== undefined) updates.room = updateData.room;
      if (updateData.location) {
        updates.location = `POINT(${updateData.location.lng} ${updateData.location.lat})`;
      }

      const { data, error } = await supabaseAdmin
        .from('events')
        .update(updates)
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating event:', error);
        throw new Error('Failed to update event');
      }

      return data;
    } catch (error) {
      logger.error('Error in updateEvent:', error);
      throw error;
    }
  }

  async cancelEvent(eventId: string, userId: string) {
    try {
      // Check if user owns the event
      const event = await this.getEventById(eventId);
      if (!event) {
        throw notFound('Event');
      }
      if (event.user_id !== userId) {
        throw forbidden();
      }

      const { error } = await supabaseAdmin
        .from('events')
        .update({ status: 'cancelled' })
        .eq('id', eventId);

      if (error) {
        logger.error('Error cancelling event:', error);
        throw new Error('Failed to cancel event');
      }

      // Notify all 'going' attendees (fire-and-forget)
      Promise.resolve(supabaseAdmin
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('status', 'going')
        .neq('user_id', userId)
      ).then(({ data: attendees }) => {
          const ids = (attendees || []).map((a: any) => a.user_id);
          if (ids.length) {
            return pushService.notifyUsers(
              ids,
              'Event cancelled',
              `"${event.title}" has been cancelled by the organizer`,
              { type: 'event_cancelled', eventId }
            );
          }
          return;
        })
        .catch(() => {});

      return true;
    } catch (error) {
      logger.error('Error in cancelEvent:', error);
      throw error;
    }
  }

  async generateShareToken(eventId: string, token: string) {
    try {
      const event = await this.getEventById(eventId);
      if (!event) {
        throw notFound('Event');
      }

      const { error } = await supabaseAdmin
        .from('events')
        .update({ share_token: token })
        .eq('id', eventId);

      if (error) {
        logger.error('Error generating share token:', error);
        throw new Error('Failed to generate share token');
      }

      // Return the shareable URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
      return `${baseUrl}/events/${token}`;
    } catch (error) {
      logger.error('Error in generateShareToken:', error);
      throw error;
    }
  }

  async rsvpEvent(eventId: string, userId: string, status: 'interested' | 'going') {
    try {
      // Capacity check and insert happen inside one locked transaction in the
      // database. Doing it here in two statements let concurrent RSVPs both
      // pass the check and overfill the event.
      const { data, error } = await supabaseAdmin.rpc('rsvp_event', {
        p_event_id: eventId,
        p_user_id: userId,
        p_status: status,
      });

      if (error) {
        if (error.message?.includes('EVENT_AT_CAPACITY')) {
          throw new AppError('EVENT_AT_CAPACITY', 'This event is at capacity', 409);
        }
        if (error.message?.includes('EVENT_NOT_FOUND')) {
          throw notFound('Event');
        }
        logger.error('Error RSVP to event:', error);
        throw new AppError('RSVP_FAILED', 'Failed to RSVP', 500);
      }

      // Notify event creator (fire-and-forget)
      if (status === 'going') {
        void this.notifyCreatorOfRsvp(eventId, userId);
      }

      return data;
    } catch (error) {
      logger.error('Error in rsvpEvent:', error);
      throw error;
    }
  }

  private async notifyCreatorOfRsvp(eventId: string, actorId: string) {
    try {
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('user_id, title')
        .eq('id', eventId)
        .single();

      if (event?.user_id && event.user_id !== actorId) {
        await pushService.notifyUsers(
          [event.user_id],
          'New RSVP',
          `Someone is going to your event "${event.title}"`,
          { type: 'rsvp', eventId }
        );
      }
    } catch {
      // Push is non-critical — never fail an RSVP because a notification failed.
    }
  }

  async cancelRsvp(eventId: string, userId: string) {
    try {
      // Delete and recount happen under the same row lock as rsvp_event, so
      // current_attendees can't drift when RSVPs and cancellations interleave.
      const { error } = await supabaseAdmin.rpc('cancel_rsvp', {
        p_event_id: eventId,
        p_user_id: userId,
      });

      if (error) {
        logger.error('Error canceling RSVP:', error);
        throw new AppError('CANCEL_RSVP_FAILED', 'Failed to cancel RSVP', 500);
      }

      void this.notifyCreatorOfCancellation(eventId, userId);

      return true;
    } catch (error) {
      logger.error('Error in cancelRsvp:', error);
      throw error;
    }
  }

  private async notifyCreatorOfCancellation(eventId: string, actorId: string) {
    try {
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('user_id, title')
        .eq('id', eventId)
        .single();

      if (event?.user_id && event.user_id !== actorId) {
        await pushService.notifyUsers(
          [event.user_id],
          'RSVP cancelled',
          `Someone cancelled their RSVP for "${event.title}"`,
          { type: 'rsvp_cancelled', eventId }
        );
      }
    } catch {
      // Push is non-critical.
    }
  }
}

export default new EventService();
