import {Router} from 'express';
import * as statsController from '../controllers/statsController';

const router: Router = Router();

router.get('/productivity', statsController.getProductivity);

export default router;