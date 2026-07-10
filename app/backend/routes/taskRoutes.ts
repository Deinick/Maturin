import {Router} from 'express';
import * as taskController from '../controllers/taskController';

const router=Router();

router.get('/overdue', taskController.getOverdueTasks);
router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
router.patch('/:id', taskController.updateTask);
router.post('/:id/rollover', taskController.rolloverTask);
router.delete('/:id', taskController.deleteTask);

export default router;