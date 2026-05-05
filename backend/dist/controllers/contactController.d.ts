import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getContacts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getContact: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createContact: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateContact: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteContact: (req: AuthRequest, res: Response) => Promise<void>;
export declare const archiveContact: (req: AuthRequest, res: Response) => Promise<void>;
export declare const unarchiveContact: (req: AuthRequest, res: Response) => Promise<void>;
export declare const bulkArchiveContacts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const bulkDeleteContacts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const bulkImportContacts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const mergeContacts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getContactGroups: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createContactGroup: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=contactController.d.ts.map