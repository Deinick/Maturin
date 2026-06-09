import { Router } from 'express';
import * as suggestionController from '../controllers/suggestionController';

const router=Router();
router.get('/', suggestionController.getSuggestions);

export default router;