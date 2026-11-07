
import { Router } from 'express';
import { PatientsController } from './patients.controller.js';

const router = Router();
const controller = new PatientsController();

router.post('/', controller.create);
router.get('/', controller.findAll);
router.get('/cpf/:cpf', controller.findByCpf);
router.get('/id/:id', controller.findById);
router.put('/id/:id', controller.update);
router.delete('/id/:id', controller.delete);

export default router;
