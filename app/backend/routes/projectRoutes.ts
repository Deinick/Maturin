import {Router} from 'express';
import * as projectController from '../controllers/projectController';

const router=Router();

router.get('/', projectController.getProjects);
router.get('/:id/members', projectController.getProjectMembers);
router.get('/:id/insights', projectController.getProjectInsights);
router.post('/', projectController.createProject);
router.post('/:projectId/phases', projectController.createPhase);
router.post('/phases/:phaseId/milestones', projectController.createMilestone);
router.patch('/phases/:id', projectController.updatePhase);
router.patch('/milestones/:id', projectController.updateMilestone);
router.patch('/:id', projectController.updateProject);
router.delete('/phases/:id', projectController.deletePhase);
router.delete('/milestones/:id', projectController.deleteMilestone);
router.delete('/:id', projectController.deleteProject);


export default router;