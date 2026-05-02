import { Router } from 'express';
import {
  getContacts, getContact, createContact, updateContact, deleteContact,
  bulkImportContacts, mergeContacts, getContactGroups, createContactGroup,
} from '../controllers/contactController';

const router = Router();

router.get('/', getContacts);
router.post('/', createContact);
router.post('/bulk-import', bulkImportContacts);
router.post('/merge', mergeContacts);
router.get('/groups', getContactGroups);
router.post('/groups', createContactGroup);
router.get('/:id', getContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
