import { useState } from 'react';
import type { Project } from '../types';
import {
  updateProject, createPhase, updatePhase, deletePhase,
  createMilestone, updateMilestone, deleteMilestone,
  getProjects, deleteProject,
} from '../api/client';

type Step = 'project' | 'phases' | 'milestones';
interface EditPhase { id?: string; title: string; _deleted: boolean; }
interface EditMilestone { id?: string; title: string; dueDate: string; _deleted: boolean; }

interface Props {
  project: Project;
  isOwner?: boolean;
  onClose: () => void;
  onSaved: (updated: Project[], pendingCount: number) => void;
  onDeleted: (id: string) => void;
}

export default function EditProjectModal({ project, isOwner = true, onClose, onSaved, onDeleted }: Props) {
  const [step, setStep] = useState<Step>('project');
  const [form, setForm] = useState({
    title: project.title,
    description: project.description ?? '',
    targetEndDate: project.targetEndDate ?? '',
  });

  const sorted = [...project.phases].sort((a, b) => a.order - b.order);
  const [editPhases, setEditPhases] = useState<EditPhase[]>(
    sorted.map(ph => ({ id: ph.id, title: ph.title, _deleted: false }))
  );
  const [editMilestonesMap, setEditMilestonesMap] = useState<Record<number, EditMilestone[]>>(() => {
    const mm: Record<number, EditMilestone[]> = {};
    sorted.forEach((ph, i) => {
      mm[i] = [...ph.milestones].sort((a, b) => a.order - b.order)
        .map(m => ({ id: m.id, title: m.title, dueDate: m.dueDate ?? '', _deleted: false }));
    });
    return mm;
  });

  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Delete flow ───────────────────────────────────────────
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'type'>('idle');
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteTarget = `delete ${project.title}`;

  async function handleDelete() {
    if (deleteTyped.trim().toLowerCase() !== deleteTarget.toLowerCase()) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
    } finally {
      setDeleting(false);
    }
  }

  // Drag state — phases
  const [dragPhaseIdx, setDragPhaseIdx] = useState<number | null>(null);
  const [dragOverPhaseIdx, setDragOverPhaseIdx] = useState<number | null>(null);
  // Drag state — milestones
  const [dragMilestoneIdx, setDragMilestoneIdx] = useState<number | null>(null);
  const [dragOverMilestoneIdx, setDragOverMilestoneIdx] = useState<number | null>(null);

  const activePhases = editPhases.filter(p => !p._deleted);
  const canGoToMilestones = activePhases.some(p => p.title.trim());

  function goToStep(s: Step) {
    if (s === 'milestones' && !canGoToMilestones) return;
    if (s === 'milestones') {
      setEditMilestonesMap(prev => {
        const next = { ...prev };
        editPhases.forEach((_, i) => { if (!next[i]) next[i] = []; });
        return next;
      });
      const first = editPhases.findIndex(p => !p._deleted);
      setActivePhaseIdx(first >= 0 ? first : 0);
    }
    setStep(s);
  }

  function reorderPhases(fromIdx: number, toIdx: number) {
    const indices = editPhases.map((_, i) => i);
    const [rem] = indices.splice(fromIdx, 1);
    indices.splice(toIdx, 0, rem);
    const newMap: Record<number, EditMilestone[]> = {};
    indices.forEach((oldIdx, newIdx) => { newMap[newIdx] = editMilestonesMap[oldIdx] ?? []; });
    setEditPhases(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
    setEditMilestonesMap(newMap);
    if (activePhaseIdx === fromIdx) setActivePhaseIdx(toIdx);
  }

  function reorderMilestones(phaseIdx: number, fromIdx: number, toIdx: number) {
    setEditMilestonesMap(prev => {
      const arr = [...(prev[phaseIdx] ?? [])];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return { ...prev, [phaseIdx]: arr };
    });
  }

  async function handleSave() {
    setSaving(true);
    let pendingCount = 0;
    try {
      const projResult = await updateProject(project.id, {
        title: form.title.trim() || project.title,
        description: form.description || undefined,
        targetEndDate: form.targetEndDate || undefined,
      });
      if (!projResult.applied) pendingCount++;

      for (const ph of editPhases) {
        if (ph._deleted && ph.id) await deletePhase(ph.id);
      }
      const phaseIdMap: Record<number, string> = {};
      for (let i = 0; i < editPhases.length; i++) {
        const ph = editPhases[i];
        if (ph._deleted) continue;
        if (ph.id) {
          const r = await updatePhase(ph.id, { title: ph.title, order: i + 1 });
          if (!r.applied) pendingCount++;
          phaseIdMap[i] = ph.id;
        } else if (ph.title.trim()) {
          const created = await createPhase(project.id, ph.title.trim(), i + 1);
          phaseIdMap[i] = created.id;
        }
      }
      for (let i = 0; i < editPhases.length; i++) {
        if (editPhases[i]._deleted) continue;
        const phaseId = phaseIdMap[i];
        if (!phaseId) continue;
        const milestones = editMilestonesMap[i] ?? [];

        for (const m of milestones) {
          if (m._deleted && m.id) await deleteMilestone(m.id);
        }

        const active = milestones.filter(m => !m._deleted);
        const withDate = [...active.filter(m => m.dueDate)].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const withoutDate = active.filter(m => !m.dueDate);
        const sorted = [...withDate, ...withoutDate];

        let order = 1;
        for (const m of sorted) {
          if (m.id) {
            const r = await updateMilestone(m.id, { title: m.title, dueDate: m.dueDate || undefined, order: order++ });
            if (!r.applied) pendingCount++;
          } else if (m.title.trim()) {
            await createMilestone(phaseId, m.title.trim(), order++, m.dueDate || undefined);
          }
        }
      }
      const updated = await getProjects();
      onSaved(updated, pendingCount);
    } finally {
      setSaving(false);
    }
  }

  const STEPS: Step[] = ['project', 'phases', 'milestones'];
  const LABELS = ['Details', 'Phases', 'Milestones'];
  const curIdx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-800">Edit Project</h2>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => setDeleteStep('confirm')}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors text-base"
                title="Delete project"
              >
                🗑
              </button>
            )}
            <button onClick={onClose} className="text-stone-300 hover:text-stone-500 text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
          </div>
        </div>

        {/* ── Delete confirmation step 1 ── */}
        {deleteStep === 'confirm' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center px-8 gap-5 z-10">
            <div className="text-4xl">⚠️</div>
            <div className="text-center">
              <p className="text-base font-semibold text-stone-800">Delete this project?</p>
              <p className="text-sm text-stone-500 mt-1">This action is permanent and cannot be undone. All phases and milestones will be lost.</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => setDeleteStep('idle')} className="flex-1 py-2.5 rounded-lg text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">No, keep it</button>
              <button onClick={() => { setDeleteTyped(''); setDeleteStep('type'); }} className="flex-1 py-2.5 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 transition-colors font-medium">Yes, delete</button>
            </div>
          </div>
        )}

        {/* ── Delete confirmation step 2 ── */}
        {deleteStep === 'type' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center px-8 gap-5 z-10">
            <div className="text-4xl">🗑</div>
            <div className="text-center">
              <p className="text-base font-semibold text-stone-800">Confirm deletion</p>
              <p className="text-sm text-stone-500 mt-1">
                Type <span className="font-mono text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{deleteTarget}</span> to confirm
              </p>
            </div>
            <input
              autoFocus
              className="w-full max-w-xs border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder={deleteTarget}
              value={deleteTyped}
              onChange={e => setDeleteTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
            />
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => setDeleteStep('idle')} className="flex-1 py-2.5 rounded-lg text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteTyped.trim().toLowerCase() !== deleteTarget.toLowerCase() || deleting}
                className="flex-1 py-2.5 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 transition-colors font-medium"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}

        {/* Clickable step indicator */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-stone-100">
          {STEPS.map((s, i) => {
            const disabled = s === 'milestones' && !canGoToMilestones;
            return (
              <div key={s} className="flex items-center gap-2">
                <button
                  onClick={() => !disabled && goToStep(s)}
                  disabled={disabled}
                  title={disabled ? 'Add at least one phase first' : undefined}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                    ${disabled
                      ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                      : curIdx === i
                      ? 'bg-blue-500 text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-blue-100 hover:text-blue-600 cursor-pointer'}`}
                >
                  {i + 1}
                </button>
                <span className={`text-xs ${curIdx === i ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>
                  {LABELS[i]}
                </span>
                {i < 2 && <div className="w-6 h-px bg-stone-200 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="px-6 py-5">

          {/* ── Step 1: Project details ── */}
          {step === 'project' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-stone-800">Project details</h3>
              <div>
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Title *</label>
                <input autoFocus
                  className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Description</label>
                <textarea
                  className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Target end date</label>
                <input type="date"
                  className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.targetEndDate}
                  onChange={e => setForm(f => ({ ...f, targetEndDate: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Phases with drag-to-reorder ── */}
          {step === 'phases' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-stone-800">Phases</h3>
                <p className="text-xs text-stone-400 mt-0.5">Grab ⠿ to reorder</p>
              </div>
              <div className="space-y-2">
                {editPhases.map((ph, i) => ph._deleted ? null : (
                  <div key={i}
                    onDragOver={e => { e.preventDefault(); setDragOverPhaseIdx(i); }}
                    onDragEnter={e => { e.preventDefault(); setDragOverPhaseIdx(i); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragPhaseIdx !== null && dragPhaseIdx !== i) reorderPhases(dragPhaseIdx, i);
                      setDragPhaseIdx(null); setDragOverPhaseIdx(null);
                    }}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-all
                      ${dragOverPhaseIdx === i && dragPhaseIdx !== i
                        ? 'bg-blue-50 border-blue-300 border-dashed'
                        : dragPhaseIdx === i
                        ? 'bg-stone-100 border-stone-200 opacity-40'
                        : 'bg-stone-50 border-transparent'}`}
                  >
                    {/* Drag handle — only this part is draggable */}
                    <span
                      draggable
                      onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDragPhaseIdx(i); }}
                      onDragEnd={() => { setDragPhaseIdx(null); setDragOverPhaseIdx(null); }}
                      className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing text-base select-none leading-none shrink-0 px-0.5"
                    >
                      ⠿
                    </span>
                    <span className="text-xs text-stone-400 w-16 shrink-0">Phase {i + 1}</span>
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-sm text-stone-800 focus:ring-0"
                      value={ph.title}
                      placeholder="Phase title"
                      onChange={e => setEditPhases(prev => prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p))}
                    />
                    {activePhases.length > 1 && (
                      <button
                        onClick={() => setEditPhases(prev => prev.map((p, j) => j === i ? { ...p, _deleted: true } : p))}
                        className="text-stone-400 hover:text-red-400 text-base leading-none shrink-0 transition-colors">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditPhases(prev => [...prev, { title: '', _deleted: false }])}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-sm text-stone-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
                + Add phase
              </button>
            </div>
          )}

          {/* ── Step 3: Milestones with drag-to-reorder ── */}
          {step === 'milestones' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-stone-800">
                  Milestones for {editPhases[activePhaseIdx]?.title?.trim() || `Phase ${activePhaseIdx + 1}`}:
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Grab ⠿ to reorder within a phase</p>
              </div>
              {/* Phase tabs */}
              <div className="flex gap-2 flex-wrap">
                {editPhases.map((ph, i) => ph._deleted ? null : (
                  <button key={i}
                    onClick={() => { setActivePhaseIdx(i); setDragMilestoneIdx(null); setDragOverMilestoneIdx(null); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                      ${activePhaseIdx === i ? 'bg-blue-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                    {ph.title || `Phase ${i + 1}`}
                  </button>
                ))}
              </div>
              {/* Milestones for active phase */}
              <div className="space-y-2">
                {(editMilestonesMap[activePhaseIdx] ?? []).map((m, i) => m._deleted ? null : (
                  <div key={i}
                    onDragOver={e => { e.preventDefault(); setDragOverMilestoneIdx(i); }}
                    onDragEnter={e => { e.preventDefault(); setDragOverMilestoneIdx(i); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragMilestoneIdx !== null && dragMilestoneIdx !== i) reorderMilestones(activePhaseIdx, dragMilestoneIdx, i);
                      setDragMilestoneIdx(null); setDragOverMilestoneIdx(null);
                    }}
                    className={`rounded-xl p-3 border transition-all
                      ${dragOverMilestoneIdx === i && dragMilestoneIdx !== i
                        ? 'bg-blue-50 border-blue-300 border-dashed'
                        : dragMilestoneIdx === i
                        ? 'bg-stone-100 border-stone-200 opacity-40'
                        : 'bg-stone-50 border-transparent'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* Drag handle */}
                      <span
                        draggable
                        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDragMilestoneIdx(i); }}
                        onDragEnd={() => { setDragMilestoneIdx(null); setDragOverMilestoneIdx(null); }}
                        className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing text-base select-none leading-none shrink-0 px-0.5"
                      >
                        ⠿
                      </span>
                      <input
                        className="flex-1 bg-transparent border-none outline-none text-sm text-stone-800 focus:ring-0"
                        placeholder="Milestone title"
                        value={m.title}
                        onChange={e => setEditMilestonesMap(prev => ({
                          ...prev,
                          [activePhaseIdx]: prev[activePhaseIdx].map((ms, j) => j === i ? { ...ms, title: e.target.value } : ms),
                        }))}
                      />
                      <button
                        onClick={() => setEditMilestonesMap(prev => ({
                          ...prev,
                          [activePhaseIdx]: prev[activePhaseIdx].map((ms, j) =>
                            j === i ? { ...ms, _deleted: true } : ms),
                        }))}
                        className="text-stone-400 hover:text-red-400 text-base leading-none shrink-0 transition-colors">
                        ×
                      </button>
                    </div>
                    <input type="date"
                      className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                      value={m.dueDate}
                      onChange={e => setEditMilestonesMap(prev => ({
                        ...prev,
                        [activePhaseIdx]: prev[activePhaseIdx].map((ms, j) => j === i ? { ...ms, dueDate: e.target.value } : ms),
                      }))}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditMilestonesMap(prev => ({
                  ...prev,
                  [activePhaseIdx]: [...(prev[activePhaseIdx] ?? []), { title: '', dueDate: '', _deleted: false }],
                }))}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-sm text-stone-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
                + Add milestone
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={step === 'project' ? onClose : () => goToStep(step === 'milestones' ? 'phases' : 'project')}
            className="flex-1 py-2.5 rounded-lg text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">
            {step === 'project' ? 'Cancel' : '← Back'}
          </button>
          <button
            disabled={saving || (!form.title.trim())}
            onClick={step === 'milestones' ? handleSave : () => goToStep(step === 'project' ? 'phases' : 'milestones')}
            className="flex-1 py-2.5 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 transition-colors font-medium">
            {saving ? 'Saving…' : step === 'milestones' ? 'Save Changes' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
