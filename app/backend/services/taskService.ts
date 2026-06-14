import prisma from '../lib/prisma';

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ['communication', ['call', 'email', 'message', 'text', 'reply', 'respond', 'contact', 'reach', 'send', 'dm', 'slack', 'meeting', 'notify', 'ping', 'chat', 'letter', 'write to', 'talk to', 'follow up']],
  ['admin', ['form', 'submit', 'fill', 'apply', 'schedule', 'book', 'register', 'pay', 'bill', 'renew', 'update', 'tax', 'paperwork', 'document', 'sign', 'file', 'cancel', 'order', 'invoice', 'receipt']],
  ['creative', ['design', 'draw', 'paint', 'create', 'make', 'build', 'code', 'develop', 'edit', 'record', 'film', 'compose', 'draft', 'write']],
  ['learning', ['read', 'watch', 'study', 'research', 'learn', 'review', 'course', 'tutorial', 'practice', 'listen', 'explore']],
  ['physical', ['gym', 'exercise', 'workout', 'run', 'walk', 'stretch', 'clean', 'cook', 'shop', 'buy', 'pick', 'move', 'lift', 'cycle', 'yoga', 'swim']],
  ['health', ['doctor', 'dentist', 'appointment', 'medication', 'therapy', 'checkup', 'prescription', 'pharmacy']],
];

function detectCategory(text: string): string | null
{
  const lower=text.toLowerCase();
  for (const [category,keywords] of CATEGORY_KEYWORDS)
  {
    if(keywords.some(kw=>lower.includes(kw))) return category;
  }
  return null;
}

export async function getTasks(userId: string, date: string)
{
  return prisma.shortTask.findMany({
    where:{ userId, dateAssigned: date},
  });
}

export async function createTask(userId: string, data:
{
  text: string;
  description?: string;
  dateAssigned: string;
  priority?: number;
  timeEstimate?: string;
}) {
  return prisma.shortTask.create({
    data: {
      userId,
      text: data.text,
      description: data.description,
      dateAssigned: data.dateAssigned,
      priority: data.priority ?? 1,
      timeEstimate: data.timeEstimate ?? null,
      category: detectCategory(data.text),
      status: 'pending',
    },
  });
}

export async function updateTask(id: string, data: {
  status?: string;
  completed?: boolean;
  text?: string;
  description?: string;
  priority?: number;
  timeEstimate?: string;
}) {
  return prisma.shortTask.update({
    where: { id },
    data,
  });
}

export async function rolloverTask(id: string, today: string) {
  const task=await prisma.shortTask.findUnique({ where: { id } });
  if (!task) throw new Error('Task not found');
  return prisma.shortTask.update({
    where: { id },
    data: { dateAssigned: today, rolloverCount: task.rolloverCount + 1, status: 'pending' },
  });
}

export async function deleteTask(id: string) {
  return prisma.shortTask.delete({ where: { id } });
}
