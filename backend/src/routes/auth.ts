import { Router } from 'express';
import { register, login, logout, refreshToken, setup2FA, verify2FA, getProfile } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.post('/refresh', refreshToken);
router.get('/profile', authMiddleware, getProfile);
router.post('/2fa/setup', authMiddleware, setup2FA);
router.post('/2fa/verify', authMiddleware, verify2FA);

export default router;
