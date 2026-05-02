import { Router } from 'express';
import {
  getDashboardStats, getConversionFunnel, getAgentPerformance,
  getLeadsBySource, getRevenueChart, getMessageVolume,
} from '../controllers/analyticsController';

const router = Router();

router.get('/dashboard', getDashboardStats);
router.get('/funnel', getConversionFunnel);
router.get('/agents', getAgentPerformance);
router.get('/leads-by-source', getLeadsBySource);
router.get('/revenue', getRevenueChart);
router.get('/messages', getMessageVolume);

export default router;
