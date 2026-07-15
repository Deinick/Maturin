import { Router } from 'express';
import {
    register, login, getMe, updateProfile, changePassword, deleteAccount,
    forgotPassword, resetPassword, verifyEmail, resendVerification,
    confirmRegistration, resendRegistrationCode,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post  ('/register',         register);
router.post  ('/login',            login);
router.get   ('/me',               requireAuth, getMe);
router.patch ('/me',               requireAuth, updateProfile);
router.patch ('/password',         requireAuth, changePassword);
router.delete('/account',          requireAuth, deleteAccount);
router.post  ('/forgot-password',  forgotPassword);
router.post  ('/reset-password',   resetPassword);
router.post  ('/verify-email',     verifyEmail);
router.post  ('/resend-verification', requireAuth, resendVerification);
router.post  ('/confirm-registration',    confirmRegistration);
router.post  ('/resend-registration-code', resendRegistrationCode);

export default router;
