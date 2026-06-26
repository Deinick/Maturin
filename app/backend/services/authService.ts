import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const SECRET = process.env.JWT_SECRET!;

export async function register(email: string, name: string, password: string)
{
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, name, passwordHash } });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '30d' });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export async function login(email: string, password: string)
{
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new Error('INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '30d' });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export async function getMe(userId: string)
{
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) throw new Error('NOT_FOUND');
    return user;
}
