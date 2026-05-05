import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getBroadcasts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createBroadcast: (req: AuthRequest, res: Response) => Promise<void>;
export declare const launchBroadcast: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const pauseBroadcast: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getBroadcastStats: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=broadcastController.d.ts.map