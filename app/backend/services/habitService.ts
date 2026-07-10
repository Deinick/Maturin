import prisma from '../lib/prisma';

export async function getHabits(userId:string )
{
    return prisma.habit.findMany({
        where: {userId, isActive: true},
        include: { logs: true },
    });
}

export async function createHabit(userId: string, name: string, difficulty?: string, activeDays?: string)
{
    return prisma.habit.create({
        data: {
            userId,
            name,
            difficulty: difficulty ?? 'medium',
            activeDays: activeDays ?? '1,2,3,4,5,6,7',
        },
    });
}

export async function logHabit(habitId: string, date: string, status: string)
{
    return prisma.habitLog.create({
        data: {habitId, date, status},
    });
}

export async function updateHabit(id: string, name?: string, difficulty?: string, activeDays?: string)
{
    return prisma.habit.update({
        where: {id},
        data: {
            ...(name       !== undefined ? {name}       : {}),
            ...(difficulty !== undefined ? {difficulty} : {}),
            ...(activeDays !== undefined ? {activeDays} : {}),
        },
    });
}

export async function updateHabitLog(id: string, status: string)
{
    return prisma.habitLog.update({
        where: {id},
        data: {status},
    });
}

export async function deleteHabit(id: string)
{
    return prisma.habit.delete({
        where: {id},
    });
}