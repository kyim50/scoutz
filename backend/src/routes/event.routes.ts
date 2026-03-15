import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import * as eventController from '../controllers/event.controller';
import * as chatController from '../controllers/chat.controller';
import * as feedController from '../controllers/feed.controller';

const router = Router();

// Event CRUD routes
router.post('/', authenticate, eventController.createEvent);
router.get('/upcoming', optionalAuthenticate, eventController.getUpcomingEvents);

// Chat unread + read routes (defined before the generic :id route)
router.get('/unread', authenticate, chatController.getEventUnreadCounts);
router.post('/:eventId/read', authenticate, chatController.markEventAsRead);

router.get('/:id', eventController.getEventById);
router.put('/:id', authenticate, eventController.updateEvent);
router.delete('/:id', authenticate, eventController.cancelEvent);

// RSVP routes
router.post('/:id/rsvp', authenticate, eventController.rsvpEvent);
router.delete('/:id/rsvp', authenticate, eventController.cancelRsvp);

// Sharing route
router.post('/:id/share', authenticate, eventController.generateShareToken);

// Chat routes
router.get('/:eventId/messages', authenticate, chatController.getEventMessages);
router.delete('/messages/:messageId', authenticate, chatController.deleteMessage);

// Feed routes
router.post('/:eventId/feed', authenticate, feedController.createPost);
router.get('/:eventId/feed', feedController.getFeed);
router.post('/feed/:postId/reaction', authenticate, feedController.addReaction);
router.delete('/feed/:postId/reaction', authenticate, feedController.removeReaction);
router.delete('/feed/:postId', authenticate, feedController.deletePost);

export default router;
