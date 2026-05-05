import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const generateAIReply: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const summarizeConversation: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const predictLeadScore: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const translateMessage: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const generateMessageTemplate: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const smartRouting: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=aiController.d.ts.map