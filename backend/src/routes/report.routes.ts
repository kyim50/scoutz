import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, reportController.createReport);
router.get('/nearby/clustered', optionalAuthenticate, reportController.getReportsNearbyClustered);
router.get('/nearby', optionalAuthenticate, reportController.getReportsNearby);
router.get('/pin/:pinId', reportController.getReportsByPin);
router.get('/:reportId', reportController.getReportById);
router.delete('/:reportId', authenticate, reportController.deleteReport);

export default router;
