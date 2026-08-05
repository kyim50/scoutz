import * as cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';
import reportService from './report.service';
import pinService from './pin.service';

export class SchedulerService {
  private tasks: cron.ScheduledTask[] = [];

  start() {
    // These cron jobs run inside the API process, so every instance would run
    // every cleanup concurrently once this scales past one dyno. Gate on an
    // explicit opt-out (default on, so single-instance deploys are unaffected)
    // and set RUN_SCHEDULER=false on all but one instance when scaling.
    if (process.env.RUN_SCHEDULER === 'false') {
      logger.info('Scheduler disabled on this instance (RUN_SCHEDULER=false)');
      return;
    }

    logger.info('Starting scheduler service...');
    
    // Run event cleanup every 5 minutes
    const cleanupTask = cron.schedule('*/5 * * * *', async () => {
      await this.cleanupExpiredEvents();
    });
    
    this.tasks.push(cleanupTask);

    // Clean up expired reports every 15 minutes
    const reportCleanupTask = cron.schedule('*/15 * * * *', async () => {
      await reportService.cleanupExpiredReports();
    });

    this.tasks.push(reportCleanupTask);

    // Clean up expired pins every 15 minutes
    const pinCleanupTask = cron.schedule('*/15 * * * *', async () => {
      await pinService.cleanupExpiredPins();
    });

    this.tasks.push(pinCleanupTask);

    logger.info('Scheduler service started');
    logger.info('- Event cleanup task: Every 5 minutes');
    logger.info('- Report expiry cleanup: Every 15 minutes');
    logger.info('- Pin expiry cleanup: Every 15 minutes');
  }

  stop() {
    logger.info('Stopping scheduler service...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    logger.info('Scheduler service stopped');
  }

  private async cleanupExpiredEvents() {
    try {
      const now = new Date().toISOString();
      
      // Update status of events past their end_time
      const { data: completedEvents, error: updateError } = await supabaseAdmin
        .from('events')
        .update({ status: 'completed' })
        .eq('status', 'scheduled')
        .lt('end_time', now)
        .select('id, title');
      
      if (updateError) {
        logger.error('Error updating expired events:', updateError);
      } else if (completedEvents && completedEvents.length > 0) {
        logger.info(`Marked ${completedEvents.length} events as completed`);
      }
      
      // Delete events completed more than 24 hours ago
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: deletedEvents, error: deleteError } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('status', 'completed')
        .lt('end_time', yesterday)
        .select('id, title');
      
      if (deleteError) {
        logger.error('Error deleting old events:', deleteError);
      } else if (deletedEvents && deletedEvents.length > 0) {
        logger.info(`Deleted ${deletedEvents.length} old completed events`);
      }
      
      // Also clean up cancelled events older than 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: cancelledEvents, error: cancelError } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('status', 'cancelled')
        .lt('created_at', weekAgo)
        .select('id, title');
      
      if (cancelError) {
        logger.error('Error deleting cancelled events:', cancelError);
      } else if (cancelledEvents && cancelledEvents.length > 0) {
        logger.info(`Deleted ${cancelledEvents.length} old cancelled events`);
      }
      
    } catch (error) {
      logger.error('Error in cleanupExpiredEvents:', error);
    }
  }

  // Manual trigger for testing
  async manualCleanup() {
    logger.info('Manual cleanup triggered');
    await this.cleanupExpiredEvents();
  }
}

export default new SchedulerService();
