
import { Router } from 'express';
import { PeopleController } from './people.controller.js';

const router = Router();
const controller = new PeopleController();

router.post('/', controller.create);
router.get('/', controller.findAll);
router.get('/cpf/:cpf', controller.findByCpf);
router.get('/role/:role', controller.findByRole);
router.get('/id/:id', controller.findById);
router.put('/id/:id', controller.update);
router.delete('/id/:id', controller.delete);

export default router;
