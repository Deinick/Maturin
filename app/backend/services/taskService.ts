import prisma from '../lib/prisma';

export async function getTasks(userId: string,date: string)
{
    return prisma.shortTask.findMany({
        where: { userId, dateAssigned: date}, });
}

export async function createTask(userId: string, data: {
    text: string;
    dateAssigned: string;
    priority?: number;
})
{
    return prisma.shortTask.create({
        data:{
            userId,
            text: data.text,
            dateAssigned: data.dateAssigned,
            priority: data.priority ?? 1,
            status: 'pending',
        },
    });
}

export async function updateTask(id: string, data:{
    status?: string,
    completed?: boolean,
} )
{
    return prisma.shortTask.update({
        where: {id},
        data,
    });
}