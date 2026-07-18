import crypto from "crypto";
import prisma from "../lib/prisma";
import {PermissionError} from "./projectService";
import { FRONTEND_URL, sendEmail, emailShell } from "../lib/emailTemplate";

//handle error

export class InviteError extends Error
{
    readonly status:number;
    constructor(message:string, status = 400)
    {
        super(message);
        this.name='InviteError';
        this.status=status;
    }
}

export async function createInvite(projectId:string,createdBy:string,invitedEmail:string,role: 'contributor'|'viewer',)
{
    const who=await prisma.projectMember.findUnique({where:{projectId_userId:{projectId, userId:createdBy}}});
    if(!who || who.role!=='owner') throw new PermissionError();

    const invitedUser=await prisma.user.findUnique({where:{email:invitedEmail}});
    if(invitedUser)
    {
        const existingMember=await prisma.projectMember.findUnique({where:{projectId_userId:{projectId, userId:invitedUser.id}}});
        if(existingMember) throw new InviteError('User is already a member of this project',400);
    }

    await prisma.projectInvite.updateMany({
        where:{projectId, invitedEmail, usedAt:null},
        data:{usedAt:new Date()},
    })

    const token=crypto.randomBytes(32).toString('hex');
    const expiresAt=new Date(Date.now()+7*24*60*60*1000);
    const [project,creator]=await Promise.all([
        prisma.project.findUniqueOrThrow({where:{id:projectId},select:{title:true}}),
        prisma.user.findUniqueOrThrow({where:{id:createdBy},select:{name:true}}),
    ]);

    const invite=await prisma.projectInvite.create({
        data:{
            projectId,
            invitedEmail,
            role,
            token,
            expiresAt,
            createdBy,
        }
    });

    const inviteUrl=`${FRONTEND_URL}/invite/${token}`;

    await sendEmail('invite', {
        to: invitedEmail,
        subject: `${creator.name} invited you to "${project.title}" on Maturin`,
        html: emailHtml({ inviterName: creator.name, projectTitle: project.title, role, inviteUrl }),
    });

    return invite;
}

export async function getInviteDetails(token:string)
{
    const invite=await prisma.projectInvite.findUnique({
        where:{token},
        include:{
            project:{ select:{ id:true, title:true } },
            creator:{ select:{ name:true } },
        },
    });
    if(!invite) return null;

    const status=invite.usedAt ? 'used' : invite.expiresAt < new Date() ? 'expired' : 'pending';
    return { ...invite, status } as typeof invite & { status:'pending'|'used'|'expired' };
}

export async function acceptInvite(token: string, userId: string)
{
    const invite=await prisma.projectInvite.findUnique({
        where:{ token },
        include:{ project:{select:{id:true,title:true}}},
    });
    if(!invite) throw new InviteError('Invite not found', 404);
    if (invite.usedAt) throw new InviteError('This invite has already been used');
    if (invite.expiresAt<new Date()) throw new InviteError('This invite has expired');

    const existing=await prisma.projectMember.findUnique({
        where:{projectId_userId:{projectId:invite.projectId,userId } },
    });
    if(existing)throw new InviteError('You are already a member of this project');

    await prisma.$transaction([
        prisma.projectMember.create({
            data:{ projectId: invite.projectId, userId, role: invite.role },
        }),
        prisma.projectInvite.update({
            where:{ token },
            data:{ usedAt: new Date() },
        }),
    ]);
    return invite.project;
}

function emailHtml({ inviterName, projectTitle, role, inviteUrl }:{
    inviterName: string; projectTitle: string; role: string; inviteUrl: string;
})
{
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">
        <strong>${inviterName}</strong> invited you to collaborate on
        <strong>"${projectTitle}"</strong> as a <strong>${role}</strong>.
      </p>
      <p style="color:#78716c;font-size:13px;margin:0 0 28px;">This invitation expires in 7 days.</p>
      <a href="${inviteUrl}"
        style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Accept invitation →
      </a>
    `, `
      <p style="color:#a8a29e;font-size:11px;margin:0;word-break:break-all;">
        Or copy this link: ${inviteUrl}
      </p>
    `);
}
