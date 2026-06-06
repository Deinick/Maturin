import prisma from '../lib/prisma';

export async function getHabits(userId:string )
{
    return prisma.habit.findMany({
        where: {userId, isActive: true},
    });
}

export async function createHabit(userId: string, name: string) 
{
    return prisma.habit.create({
        data: {userId,name},
    });
}

export async function logHabit(habitId: string, date: string, status: string)
{
    return prisma.habitLog.create({
        data: {habitId, date, status},
    });
}