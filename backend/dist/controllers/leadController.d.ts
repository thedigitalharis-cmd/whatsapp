import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getLeads: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createLead: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateLead: (req: AuthRequest, res: Response) => Promise<void>;
export declare const convertLead: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const bulkAssignLeads: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=leadController.d.ts.map