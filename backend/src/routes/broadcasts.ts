import { Router } from 'express';
import { getBroadcasts, createBroadcast, launchBroadcast, pauseBroadcast, getBroadcastStats } from '../controllers/broadcastController';

const router = Router();

router.get('/', getBroadcasts);
router.post('/', createBroadcast);
router.post('/:id/launch', launchBroadcast);
router.post('/:id/pause', pauseBroadcast);
router.get('/:id/stats', getBroadcastStats);

export default router;
