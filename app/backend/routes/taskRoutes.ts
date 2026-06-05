import {Router} from 'express';
import * as taskController from '../controllers/taskController';

const router=Router();

router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
router.patch('/:id', taskController.updateTask);

export default router;