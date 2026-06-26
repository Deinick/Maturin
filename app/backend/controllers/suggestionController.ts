import { Request, Response } from 'express';
import * as suggestionService from '../services/suggestionService';
import { AuthRequest } from '../middleware/auth';

export async function getSuggestions(req: Request, res: Response): Promise<void>
{
    const userId      = (req as AuthRequest).userId;
    const suggestions = await suggestionService.getSuggestions(userId);
    res.json(suggestions);
}
