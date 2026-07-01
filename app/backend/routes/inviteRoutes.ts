import { Router } from 'express';
import * as inviteController from '../controllers/inviteController';

const router = Router();

router.post('/:token/accept', inviteController.acceptInvite);

export default router;
