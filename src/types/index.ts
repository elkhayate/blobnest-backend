import { Request } from 'express';

export interface UserRequest extends Request {
    user?: {
        id: string;
        user_metadata?: {
            role?: string;
            display_name?: string;
            company_name?: string;
            company_id?: string;
        };
    };
}