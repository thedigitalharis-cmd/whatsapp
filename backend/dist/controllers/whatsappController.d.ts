import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getAccounts: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createAccount: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateAccount: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteAccount: (req: AuthRequest, res: Response) => Promise<void>;
export declare const verifyAccount: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateProfile: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTemplates: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createTemplate: (req: AuthRequest, res: Response) => Promise<void>;
export declare const submitTemplateForApproval: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncTemplates: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const sendWhatsAppMessage: (phoneNumberId: string, accessToken: string, to: string, payload: any) => Promise<any>;
export declare const sendTemplateMessage: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const handleWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getMediaUrl: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=whatsappController.d.ts.map