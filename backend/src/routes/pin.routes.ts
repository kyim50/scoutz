import { Router } from 'express';
import Joi from 'joi';
import { createPin, getNearbyPins, getForYouPins, getPinById, updatePin, deletePin, verifyPin } from '../controllers/pin.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { apiLimiter, pinCreateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';

const router = Router();
router.use(apiLimiter);

const createPinSchema = Joi.object({
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).required(),
  type: Joi.string()
    .valid('bathroom', 'food', 'pharmacy', 'study', 'charging', 'coffee', 'parking', 'safe_walk', 'open_late', 'other')
    .required(),
  title: Joi.string().min(1).max(80).required(),
  description: Joi.string().max(500).optional().allow(''),
  building: Joi.string().max(100).optional().allow(''),
  floor: Joi.string().max(20).optional().allow(''),
  accessNotes: Joi.string().max(500).optional().allow(''),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  photoUrls: Joi.array().items(Joi.string().uri()).max(5).optional(),
});

router.post('/', authenticate, pinCreateLimiter, validate(createPinSchema), createPin);
router.get('/nearby', optionalAuthenticate, getNearbyPins);
router.get('/for-you', optionalAuthenticate, getForYouPins);
router.get('/:id', getPinById);
router.put('/:id', authenticate, updatePin);
router.delete('/:id', authenticate, deletePin);
router.post('/:id/verify', authenticate, verifyPin);

export default router;
