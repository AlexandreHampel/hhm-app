
import { Router } from 'express';
import { VisitsController } from './visits.controller.js';
import visitMovementsRoutes from '../visit-movements/visit-movements.routes.js';

const router = Router();
const controller = new VisitsController();

// No DELETE route: visits are historical records and are never physically removed.
router.post('/', controller.create);
router.get('/', controller.findAll);
router.get('/active-patients', controller.findActivePatients);
router.get('/patient/:patientId', controller.findByPatient);
router.get('/id/:id', controller.findById);
router.put('/id/:id', controller.update);
router.use('/id/:id/movements', visitMovementsRoutes);

export default router;
