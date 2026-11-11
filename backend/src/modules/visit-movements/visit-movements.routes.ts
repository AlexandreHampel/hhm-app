
import { Router } from 'express';
import { VisitMovementsController } from './visit-movements.controller.js';

// Mounted under /api/visits/id/:id/movements. Movements are append-only:
// no PUT, PATCH or DELETE routes are exposed.
const router = Router({ mergeParams: true });
const controller = new VisitMovementsController();

router.post('/', controller.create);
router.get('/', controller.findByVisit);

export default router;
