import {Request, Response} from 'express';
import * as suggestionService from '../services/suggestionService';

export async function getSuggestions(req: Request, res: Response) : Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    if(!userId)
    {
        res.status(400).json({error: 'Missing user ID'});
        return;
    }
    const suggestions=await suggestionService.getSuggestions(userId);
    res.json(suggestions);
}