import { Router} from 'express';
import * as habitController from '../controllers/habitController';

const router=Router();

router.get('/', habitController.getHabits);
router.post('/', habitController.createHabit);
router.post('/:id/log', habitController.logHabit);

export default router;