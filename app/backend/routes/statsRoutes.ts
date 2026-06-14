import {Router} from 'express';
import * as statsController from '../controllers/statsController';

const router: Router = Router();

router.get('/productivity', statsController.getProductivity);
router.get('/completion-rate', statsController.getCompletionRate);
router.get('/weekly', statsController.getWeeklySummary);
router.get('/yearly', statsController.getYearlyStats);

export default router;