import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getDashboardStats: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getConversionFunnel: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getAgentPerformance: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getLeadsBySource: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getRevenueChart: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMessageVolume: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=analyticsController.d.ts.map