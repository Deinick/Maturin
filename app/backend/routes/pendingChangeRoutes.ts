import { Router } from 'express';
import * as ctrl from '../controllers/pendingChangeController';

const router=Router();

router.get('/',                   ctrl.getAllPendingChangeCounts);
router.post('/:changeId/approve', ctrl.approvePendingChange);
router.post('/:changeId/reject',  ctrl.rejectPendingChange);

export default router;
