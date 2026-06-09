import {Router} from 'express';
import * as rolloverController from '../controllers/rolloverController';

const router=Router();

router.post('/', rolloverController.runRollover);

export default router;