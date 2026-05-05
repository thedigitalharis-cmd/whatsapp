import { Request, Response } from 'express';
export declare const register: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const refreshToken: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
export declare const setup2FA: (req: any, res: Response) => Promise<void>;
export declare const verify2FA: (req: any, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getProfile: (req: any, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=authController.d.ts.map