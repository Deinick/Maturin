import { useState } from 'react';
import type { PendingChange, Project } from '../types';
import { approvePendingChange, rejectPendingChange } from '../api/client';

type Step = 'project' | 'phases' | 'milestones';

const STEPS: { key: Step; label: string }[] = [
    { key: 'project',    label: 'Details'    },
    { key: 'phases',     label: 'Phases'     },
    { key: 'milestones', label: 'Milestones' },
];

function findChange(
    changes: PendingChange[],
    entityType: string,
    entityId: string,
    field: string,
): PendingChange | undefined {
    return changes.find(c =>
        c.entityType === entityType &&
        c.entityId === entityId &&
        field in c.newData
    );
}

function FieldRow({ label, currentValue, change, acting, onApprove, onReject }: {
    label: string;
    currentValue?: string | null;
    change?: PendingChange;
    acting: boolean;
    onApprove: () => void;
    onReject: () => void;
}) {
    const field  = change ? Object.keys(change.newData)[0] : null;
    const oldVal = field ? (change!.oldData[field] ?? null) : null;
    const newVal = field ? (change!.newData[field] ?? null) : null;

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
                    {label}
                    {change && (
                        <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center shrink-0">!</span>
                    )}
                </span>
                {change && (
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                            onClick={onApprove}
                            disabled={acting}
                            title="Approve"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-colors text-xs border border-emerald-200 font-bold"
                        >✓</button>
                        <button
                            onClick={onReject}
                            disabled={acting}
                            title="Reject"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors text-xs border border-red-200 font-bold"
                        >✕</button>
                    </div>
                )}
            </div>
            {change ? (
                <div className="flex items-start gap-2 flex-wrap">
                    <span className="px-2.5 py-1.5 rounded-lg text-xs bg-stone-100 text-stone-600 border border-stone-200 break-words">
                        {oldVal || <span className="italic text-stone-300">empty</span>}
                    </span>
                    <span className="text-stone-300 self-center text-sm">→</span>
                    <span className="px-2.5 py-1.5 rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium break-words">
                        {newVal || <span className="italic font-normal text-stone-300">empty</span>}
                    </span>
                </div>
            ) : (
                <div className="px-3 py-2.5 rounded-lg bg-stone-50 border border-stone-100 text-sm text-stone-600 min-h-[38px] break-words">
                    {currentValue || <span className="text-stone-300 italic text-xs">—</span>}
                </div>
            )}
        </div>
    );
}

interface Props {
    project: Project;
    changes: PendingChange[];
    onResolved: (changeId: string) => void;
    onClose: () => void;
}

export default function PendingChangesModal({ project, changes, onResolved, onClose }: Props) {
    const sortedPhases = [...project.phases].sort((a, b) => a.order - b.order);
    const [step,           setStep]           = useState<Step>('project');
    const [activePhaseIdx, setActivePhaseIdx] = useState(0);
    const [acting,         setActing]         = useState<string | null>(null);

    const stepIdx      = STEPS.findIndex(s => s.key === step);
    const totalPending = changes.length;

    const hasChangesFor = (entityType: string) => changes.some(c => c.entityType === entityType);

    async function handleApprove(change: PendingChange) {
        setActing(change.id);
        try { await approvePendingChange(change.id); onResolved(change.id); }
        finally { setActing(null); }
    }

    async function handleReject(change: PendingChange) {
        setActing(change.id);
        try { await rejectPendingChange(change.id); onResolved(change.id); }
        finally { setActing(null); }
    }

    function fc(entityType: string, entityId: string, field: string) {
        return findChange(changes, entityType, entityId, field);
    }

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
                    <h2 className="text-lg font-semibold text-stone-800">Review changes</h2>
                    <div className="flex items-center gap-3">
                        {totalPending > 0 && (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                                {totalPending} pending
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="text-stone-300 hover:text-stone-500 text-xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
                        >×</button>
                    </div>
                </div>

                {/* Step indicator — mirrors EditProjectModal */}
                <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-stone-100">
                    {STEPS.map((s, i) => {
                        const hasChanges = s.key === 'project'
                            ? hasChangesFor('project')
                            : s.key === 'phases'
                            ? hasChangesFor('phase')
                            : hasChangesFor('milestone');
                        const isActive = step === s.key;
                        return (
                            <div key={s.key} className="flex items-center gap-2">
                                <button
                                    onClick={() => setStep(s.key)}
                                    className={`relative w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                                        isActive
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-stone-100 text-stone-500 hover:bg-blue-100 hover:text-blue-600'
                                    }`}
                                >
                                    {i + 1}
                                    {hasChanges && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" />
                                    )}
                                </button>
                                <span className={`text-xs ${isActive ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>
                                    {s.label}
                                </span>
                                {i < 2 && <div className="w-6 h-px bg-stone-200 mx-1" />}
                            </div>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">

                    {/* Step 1: Details */}
                    {step === 'project' && (
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-stone-800">Project details</h3>
                            {(
                                [
                                    { field: 'title',         label: 'Title',           value: project.title         },
                                    { field: 'description',   label: 'Description',     value: project.description   },
                                    { field: 'targetEndDate', label: 'Target end date', value: project.targetEndDate },
                                ] as const
                            ).map(({ field, label, value }) => {
                                const change = fc('project', project.id, field);
                                return (
                                    <FieldRow
                                        key={field}
                                        label={label}
                                        currentValue={value}
                                        change={change}
                                        acting={acting === change?.id}
                                        onApprove={() => change && handleApprove(change)}
                                        onReject={() => change && handleReject(change)}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Step 2: Phases */}
                    {step === 'phases' && (
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-stone-800">Phases</h3>
                            {sortedPhases.length === 0 ? (
                                <p className="text-sm text-stone-400 text-center py-8">No phases yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {sortedPhases.map((ph, i) => {
                                        const titleChange = fc('phase', ph.id, 'title');
                                        return (
                                            <div key={ph.id} className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                                                <p className="text-xs text-stone-400 mb-2.5">Phase {i + 1}</p>
                                                <FieldRow
                                                    label="Title"
                                                    currentValue={ph.title}
                                                    change={titleChange}
                                                    acting={acting === titleChange?.id}
                                                    onApprove={() => titleChange && handleApprove(titleChange)}
                                                    onReject={() => titleChange && handleReject(titleChange)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Milestones */}
                    {step === 'milestones' && (
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-stone-800">
                                Milestones for {sortedPhases[activePhaseIdx]?.title || `Phase ${activePhaseIdx + 1}`}
                            </h3>
                            {/* Phase tabs */}
                            <div className="flex gap-2 flex-wrap">
                                {sortedPhases.map((ph, i) => {
                                    const hasPhaseChanges = changes.some(
                                        c => c.entityType === 'milestone' && ph.milestones.some(m => m.id === c.entityId)
                                    );
                                    return (
                                        <button
                                            key={ph.id}
                                            onClick={() => setActivePhaseIdx(i)}
                                            className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                                activePhaseIdx === i
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                            }`}
                                        >
                                            {ph.title || `Phase ${i + 1}`}
                                            {hasPhaseChanges && (
                                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Milestones for active phase */}
                            <div className="space-y-4">
                                {sortedPhases[activePhaseIdx]
                                    ? [...sortedPhases[activePhaseIdx].milestones]
                                        .sort((a, b) => a.order - b.order)
                                        .map(m => {
                                            const titleChange   = fc('milestone', m.id, 'title');
                                            const dueDateChange = fc('milestone', m.id, 'dueDate');
                                            return (
                                                <div key={m.id} className="rounded-xl bg-stone-50 border border-stone-100 p-3 space-y-3">
                                                    <FieldRow
                                                        label="Title"
                                                        currentValue={m.title}
                                                        change={titleChange}
                                                        acting={acting === titleChange?.id}
                                                        onApprove={() => titleChange && handleApprove(titleChange)}
                                                        onReject={() => titleChange && handleReject(titleChange)}
                                                    />
                                                    <FieldRow
                                                        label="Due date"
                                                        currentValue={m.dueDate}
                                                        change={dueDateChange}
                                                        acting={acting === dueDateChange?.id}
                                                        onApprove={() => dueDateChange && handleApprove(dueDateChange)}
                                                        onReject={() => dueDateChange && handleReject(dueDateChange)}
                                                    />
                                                </div>
                                            );
                                        })
                                    : <p className="text-sm text-stone-400 text-center py-8">No milestones in this phase</p>
                                }
                                {sortedPhases[activePhaseIdx]?.milestones.length === 0 && (
                                    <p className="text-sm text-stone-400 text-center py-8">No milestones in this phase</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100">
                    <button
                        onClick={stepIdx === 0 ? onClose : () => setStep(STEPS[stepIdx - 1].key)}
                        className="px-4 py-2.5 rounded-lg text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors"
                    >
                        {stepIdx === 0 ? 'Close' : '← Back'}
                    </button>
                    {totalPending === 0
                        ? <span className="text-xs text-emerald-600 font-medium">✓ All resolved</span>
                        : <span className="text-xs text-stone-400">{totalPending} remaining</span>
                    }
                    {stepIdx < 2 ? (
                        <button
                            onClick={() => setStep(STEPS[stepIdx + 1].key)}
                            className="px-4 py-2.5 rounded-lg text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-lg text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
