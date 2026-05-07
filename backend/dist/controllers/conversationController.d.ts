import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getConversations: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getConversation: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const assignConversation: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateConversationStatus: (req: AuthRequest, res: Response) => Promise<void>;
export declare const archiveConversation: (req: AuthRequest, res: Response) => Promise<void>;
export declare const unarchiveConversation: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deleteConversation: (req: AuthRequest, res: Response) => Promise<void>;
export declare const toggleBot: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMessages: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/** Hide message only for the current agent (CRM inbox). */
export declare const deleteMessageForMe: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/** Remove message content for all agents in this CRM (WhatsApp consumer "delete for everyone" is not available on Cloud API). */
export declare const deleteMessageForEveryone: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const sendMessage: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const addNote: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=conversationController.d.ts.map