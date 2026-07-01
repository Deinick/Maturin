import { useState } from 'react';
import type { PendingChange } from '../types';
import { approvePendingChange, rejectPendingChange } from '../api/client';

const FIELD_LABELS: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    targetEndDate: 'Target end date',
    dueDate: 'Due date',
};

function DiffRow({ field, oldVal, newVal }: { field: string; oldVal: string | null; newVal: string | null }) {
    const label = FIELD_LABELS[field] ?? field;
    return (
        <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-1">{label} — before</p>
                <p className="text-stone-600 break-words">{oldVal ?? <span className="italic text-stone-300">empty</span>}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-1">{label} — after</p>
                <p className="text-stone-700 font-medium break-words">{newVal ?? <span className="italic text-stone-300">empty</span>}</p>
            </div>
        </div>
    );
}

interface Props {
    changes: PendingChange[];
    onResolved: () => void;
}

export default function PendingChangesPanel({ changes, onResolved }: Props) {
    const [acting, setActing] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(changes[0]?.id ?? null);

    if (changes.length === 0) return null;

    async function handleApprove(id: string) {
        setActing(id);
        try { await approvePendingChange(id); onResolved(); }
        finally { setActing(null); }
    }

    async function handleReject(id: string) {
        setActing(id);
        try { await rejectPendingChange(id); onResolved(); }
        finally { setActing(null); }
    }

    return (
        <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden mt-6">
            <div className="flex items-center gap-2 px-5 py-4 bg-amber-50 border-b border-amber-100">
                <span className="text-base">📋</span>
                <div>
                    <p className="text-sm font-semibold text-amber-800">
                        {changes.length} change{changes.length !== 1 ? 's' : ''} pending approval
                    </p>
                    <p className="text-xs text-amber-600">Review each change below before it takes effect.</p>
                </div>
            </div>

            <div className="divide-y divide-stone-50">
                {changes.map(c => {
                    const isOpen = expanded === c.id;
                    const fields = Object.keys(c.newData);
                    return (
                        <div key={c.id}>
                            <button
                                onClick={() => setExpanded(isOpen ? null : c.id)}
                                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-stone-50 transition-colors"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-stone-800 truncate">{c.entityLabel}</p>
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        by <span className="font-medium text-stone-500">{c.author.name}</span>
                                        {' · '}
                                        {fields.join(', ')} changed
                                    </p>
                                </div>
                                <span className="text-stone-300 text-sm ml-3 shrink-0">{isOpen ? '▲' : '▼'}</span>
                            </button>

                            {isOpen && (
                                <div className="px-5 pb-5 space-y-3">
                                    {fields.map(field => (
                                        <DiffRow
                                            key={field}
                                            field={field}
                                            oldVal={c.oldData[field] ?? null}
                                            newVal={c.newData[field] ?? null}
                                        />
                                    ))}
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => handleApprove(c.id)}
                                            disabled={acting === c.id}
                                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                        >
                                            {acting === c.id ? '…' : '✓ Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(c.id)}
                                            disabled={acting === c.id}
                                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                        >
                                            {acting === c.id ? '…' : '✕ Reject'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
