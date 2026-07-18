import prisma from '../lib/prisma';
import { FRONTEND_URL, sendEmail, emailShell } from '../lib/emailTemplate';

// Sends one digest email per user who has unresolved tasks from before today —
// the same set the in-app rollover modal surfaces (see taskService.getOverdueTasks),
// just batched across all users and delivered on a schedule instead of on page load.
export async function sendOverdueTaskReminders(today: string = new Date().toISOString().split('T')[0])
{
    const overdueTasks = await prisma.shortTask.findMany({
        where: {
            dateAssigned: { lt: today },
            completed: false,
            status: { not: 'dismissed' },
        },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { dateAssigned: 'asc' },
    });

    const byUser = new Map<string, { email: string; name: string; tasks: typeof overdueTasks }>();
    for (const task of overdueTasks)
    {
        const existing = byUser.get(task.userId);
        if (existing) existing.tasks.push(task);
        else byUser.set(task.userId, { email: task.user.email, name: task.user.name, tasks: [task] });
    }

    let sent = 0;
    for (const { email, name, tasks } of byUser.values())
    {
        await sendEmail('overdue-reminder', {
            to: email,
            subject: `You have ${tasks.length} unfinished task${tasks.length !== 1 ? 's' : ''} on Chelone`,
            html: overdueReminderEmailHtml({ name, tasks: tasks.map(t => ({ text: t.text, dateAssigned: t.dateAssigned })) }),
        });
        sent++;
    }

    return { usersNotified: sent, tasksIncluded: overdueTasks.length };
}

function overdueReminderEmailHtml({ name, tasks }: { name: string; tasks: { text: string; dateAssigned: string }[] })
{
    const rows = tasks.slice(0, 10).map(t => `
      <li style="color:#44403c;font-size:14px;line-height:1.6;margin-bottom:4px;">
        ${t.text} <span style="color:#a8a29e;font-size:12px;">(${t.dateAssigned})</span>
      </li>
    `).join('');
    const more = tasks.length > 10 ? `<p style="color:#a8a29e;font-size:12px;margin:8px 0 0;">+${tasks.length - 10} more</p>` : '';

    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 16px;">
        You have ${tasks.length} unfinished task${tasks.length !== 1 ? 's' : ''} from before today:
      </p>
      <ul style="margin:0 0 20px;padding-left:18px;">${rows}</ul>
      ${more}
      <a href="${FRONTEND_URL}/tasks"
        style="display:inline-block;background:#C4601A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Review tasks →
      </a>
    `);
}
