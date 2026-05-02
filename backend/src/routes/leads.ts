import { Router } from 'express';
import { getLeads, getLead, createLead, updateLead, convertLead, bulkAssignLeads } from '../controllers/leadController';

const router = Router();

router.get('/', getLeads);
router.post('/', createLead);
router.post('/bulk-assign', bulkAssignLeads);
router.get('/:id', getLead);
router.put('/:id', updateLead);
router.post('/:id/convert', convertLead);

export default router;
