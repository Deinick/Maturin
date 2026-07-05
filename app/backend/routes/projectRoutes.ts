import {Router} from 'express';
import * as projectController from '../controllers/projectController';
import * as inviteController  from '../controllers/inviteController';
import * as pendingCtrl       from '../controllers/pendingChangeController';

const router=Router();

router.get('/my-objectives', projectController.getMyObjectives);
router.get('/', projectController.getProjects);
router.post('/:id/invites', inviteController.createInvite);
router.get('/:id/members', projectController.getProjectMembers);
router.get('/:id/performance', projectController.getMemberPerformance);
router.patch('/:id/members/:memberId/permissions', pendingCtrl.setMemberPermission);
router.get('/:id/pending-changes', pendingCtrl.getPendingChanges);
router.get('/:id/insights', projectController.getProjectInsights);
router.post('/', projectController.createProject);
router.post('/:projectId/phases', projectController.createPhase);
router.post('/phases/:phaseId/milestones', projectController.createMilestone);
router.patch('/phases/:id', projectController.updatePhase);
router.put('/phases/:phaseId/dependencies', projectController.setDependencies);
router.patch('/milestones/:id', projectController.updateMilestone);
router.patch('/:id', projectController.updateProject);
router.delete('/phases/:id', projectController.deletePhase);
router.delete('/milestones/:id', projectController.deleteMilestone);
router.delete('/:id', projectController.deleteProject);


export default router;