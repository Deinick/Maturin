import { useState, useRef, useEffect } from 'react';
import type { Project, ProjectMember } from '../types';
import {
  updateProject, createPhase, updatePhase, deletePhase,
  createMilestone, updateMilestone, deleteMilestone,
  getProjects, deleteProject, setDependencies,
} from '../api/client';

const MEMBER_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500',
];
function memberColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}

interface EditPhase {
  id?: string;
  title: string;
  description: string;
  dependsOnIds: string[];
  _deleted: boolean;
}
interface EditMilestone {
  id?: string;
  title: string;
  dueDate: string;
  assigneeIds: string[];
  _deleted: boolean;
}

interface Props {
  project: Project;
  isOwner?: boolean;
  canAssign?: boolean;
  onClose: () => void;
  onSaved: (updated: Project[], pendingCount: number) => void;
  onDeleted: (id: string) => void;
}

export default function EditProjectModal({
  project, isOwner = true, canAssign = false, onClose, onSaved, onDeleted,
}: Props) {
  const [form, setForm] = useState({
    title: project.title,
    description: project.description ?? '',
    targetEndDate: project.targetEndDate ?? '',
  });

  const sorted = [...project.phases].sort((a, b) => a.order - b.order);
  const [editPhases, setEditPhases] = useState<EditPhase[]>(
    sorted.map(ph => ({
      id: ph.id,
      title: ph.title,
      description: ph.description ?? '',
      dependsOnIds: ph.dependencies?.map(d => d.dependsOnId) ?? [],
      _deleted: false,
    }))
  );
  const [editMilestonesMap, setEditMilestonesMap] = useState<Record<number, EditMilestone[]>>(() => {
    const mm: Record<number, EditMilestone[]> = {};
    sorted.forEach((ph, i) => {
      mm[i] = [...ph.milestones].sort((a, b) => a.order - b.order)
        .map(m => ({
          id: m.id,
          title: m.title,
          dueDate: m.dueDate ?? '',
          assigneeIds: m.assignees?.map(a => a.id) ?? [],
          _deleted: false,
        }));
    });
    return mm;
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Delete flow ────────────────────────────────────────────────────
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

  // ── Drag — phases ──────────────────────────────────────────────────
  const [dragPhaseIdx,     setDragPhaseIdx]     = useState<number | null>(null);
  const [dragOverPhaseIdx, setDragOverPhaseIdx] = useState<number | null>(null);

  // ── Drag — objectives (tracked per phase) ─────────────────────────
  const [dragObj,     setDragObj]     = useState<{ ph: number; obj: number } | null>(null);
  const [dragObjOver, setDragObjOver] = useState<{ ph: number; obj: number } | null>(null);

  const activePhases = editPhases.filter(p => !p._deleted);

  // Compute visible 1-based order for each raw phase index
  const visibleOrders = new Map<number, number>();
  let _vo = 0;
  editPhases.forEach((ph, i) => { if (!ph._deleted) visibleOrders.set(i, ++_vo); });

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
  }

  function reorderObjectives(phaseIdx: number, fromIdx: number, toIdx: number) {
    setEditMilestonesMap(prev => {
      const arr = [...(prev[phaseIdx] ?? [])];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return { ...prev, [phaseIdx]: arr };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
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
          const r = await updatePhase(ph.id, {
            title: ph.title,
            description: ph.description || undefined,
            order: i + 1,
          });
          if (!r.applied) pendingCount++;
          phaseIdMap[i] = ph.id;
        } else if (ph.title.trim()) {
          const created = await createPhase(project.id, ph.title.trim(), i + 1, ph.description || undefined);
          phaseIdMap[i] = created.id;
        }
      }

      for (let i = 0; i < editPhases.length; i++) {
        const ph = editPhases[i];
        if (ph._deleted) continue;
        const phaseId = phaseIdMap[i];
        if (!phaseId) continue;
        const resolvedDeps = ph.dependsOnIds
          .map(depId => {
            if (!depId.startsWith('__new_')) return depId;
            const j = parseInt(depId.replace('__new_', ''), 10);
            return phaseIdMap[j] ?? null;
          })
          .filter((id): id is string => id !== null);
        await setDependencies(phaseId, resolvedDeps);
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
        const withDate    = [...active.filter(m => m.dueDate)].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const withoutDate = active.filter(m => !m.dueDate);
        const ordered     = [...withDate, ...withoutDate];

        let order = 1;
        for (const m of ordered) {
          if (m.id) {
            const r = await updateMilestone(m.id, {
              title: m.title,
              dueDate: m.dueDate || undefined,
              order: order++,
              ...(canAssign && { assigneeIds: m.assigneeIds }),
            });
            if (!r.applied) pendingCount++;
          } else if (m.title.trim()) {
            await createMilestone(
              phaseId, m.title.trim(), order++,
              m.dueDate || undefined,
              canAssign ? m.assigneeIds : undefined,
            );
          }
        }
      }

      const updated = await getProjects();
      onSaved(updated, pendingCount);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-semibold text-stone-800">Edit Project</h2>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => setDeleteStep('confirm')}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors text-base"
                title="Delete project"
              >🗑</button>
            )}
            <button
              onClick={onClose}
              className="text-stone-300 hover:text-stone-500 text-xl leading-none w-8 h-8 flex items-center justify-center"
            >×</button>
          </div>
        </div>

        {/* ── Delete overlay — step 1 ───────────────────────────── */}
        {deleteStep === 'confirm' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center px-8 gap-5 z-10">
            <div className="text-4xl">⚠️</div>
            <div className="text-center">
              <p className="text-base font-semibold text-stone-800">Delete this project?</p>
              <p className="text-sm text-stone-500 mt-1">Permanent and cannot be undone. All phases and objectives will be lost.</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => setDeleteStep('idle')} className="flex-1 py-2.5 rounded-lg text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">No, keep it</button>
              <button onClick={() => { setDeleteTyped(''); setDeleteStep('type'); }} className="flex-1 py-2.5 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 transition-colors font-medium">Yes, delete</button>
            </div>
          </div>
        )}

        {/* ── Delete overlay — step 2 ───────────────────────────── */}
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
              >{deleting ? 'Deleting…' : 'Delete forever'}</button>
            </div>
          </div>
        )}

        {/* ── Scrollable body ────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Project Details ───────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Project Details</p>
            <div>
              <label className="text-xs font-medium text-stone-500">Name *</label>
              <input
                autoFocus
                className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Description</label>
              <textarea
                rows={2}
                className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                placeholder="What will this project accomplish?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Target date</label>
              <input
                type="date"
                className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.targetEndDate}
                onChange={e => setForm(f => ({ ...f, targetEndDate: e.target.value }))}
              />
            </div>
          </section>

          {/* ── Divider ─────────────────────────────────────────── */}
          <div className="border-t border-stone-100 pt-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Phases & Objectives</p>
              <span className="text-[10px] text-stone-400">Drag ⠿ to reorder</span>
            </div>
            <p className="text-xs text-stone-400">Each phase holds a set of objectives. Click phases that must complete <em>before</em> this one starts.</p>
          </div>

          {/* ── Phase cards ─────────────────────────────────────── */}
          <div className="space-y-4">
            {editPhases.map((ph, i) => {
              if (ph._deleted) return null;
              const visOrder    = visibleOrders.get(i) ?? i + 1;
              const isDragOver  = dragOverPhaseIdx === i && dragPhaseIdx !== i;
              const isDragging  = dragPhaseIdx === i;
              const objectives  = editMilestonesMap[i] ?? [];
              const activeObjs  = objectives.filter(m => !m._deleted);

              return (
                <div
                  key={i}
                  onDragOver={e => { e.preventDefault(); setDragOverPhaseIdx(i); }}
                  onDragEnter={e => { e.preventDefault(); setDragOverPhaseIdx(i); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragPhaseIdx !== null && dragPhaseIdx !== i) reorderPhases(dragPhaseIdx, i);
                    setDragPhaseIdx(null); setDragOverPhaseIdx(null);
                  }}
                  className={`rounded-xl border transition-all ${
                    isDragOver  ? 'bg-blue-50 border-blue-300 border-dashed'
                    : isDragging ? 'opacity-40 bg-stone-100 border-stone-200'
                    : 'bg-stone-50 border-stone-100'
                  }`}
                >
                  {/* Phase header row */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100">
                    <span
                      draggable
                      onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDragPhaseIdx(i); }}
                      onDragEnd={() => { setDragPhaseIdx(null); setDragOverPhaseIdx(null); }}
                      className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing text-base select-none leading-none shrink-0"
                    >⠿</span>
                    <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide shrink-0 w-14">
                      Phase {visOrder}
                    </span>
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-stone-800 placeholder:text-stone-300 focus:ring-0"
                      placeholder="Phase title"
                      value={ph.title}
                      onChange={e => setEditPhases(prev => prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p))}
                    />
                    {activePhases.length > 1 && (
                      <button
                        onClick={() => setEditPhases(prev => prev.map((p, j) => j === i ? { ...p, _deleted: true } : p))}
                        className="text-stone-300 hover:text-red-400 text-lg leading-none shrink-0 transition-colors"
                        title="Remove phase"
                      >×</button>
                    )}
                  </div>

                  {/* Phase body */}
                  <div className="px-4 py-3 space-y-3">

                    {/* Description */}
                    <input
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-stone-300"
                      placeholder="Description — what happens in this phase?"
                      value={ph.description}
                      onChange={e => setEditPhases(prev => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))}
                    />

                    {/* Dependencies */}
                    {activePhases.length > 1 && (
                      <div>
                        <p className="text-[10px] text-stone-400 mb-1.5">
                          <span className="font-semibold uppercase tracking-wide">Starts after:</span>{' '}
                          which phases must complete before this one begins?
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {editPhases.map((other, j) => {
                            if (other._deleted || j === i) return null;
                            const otherId  = other.id ?? `__new_${j}`;
                            const selected = ph.dependsOnIds.includes(otherId);
                            return (
                              <button
                                key={j}
                                onClick={() => setEditPhases(prev => prev.map((p, k) => {
                                  if (k !== i) return p;
                                  return {
                                    ...p,
                                    dependsOnIds: selected
                                      ? p.dependsOnIds.filter(id => id !== otherId)
                                      : [...p.dependsOnIds, otherId],
                                  };
                                }))}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                                  selected
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-white text-stone-500 border-stone-200 hover:border-blue-300 hover:text-blue-500'
                                }`}
                              >
                                {other.title.trim() || `Phase ${j + 1}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Objectives */}
                    <div>
                      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
                        Objectives
                        {activeObjs.length > 0 && (
                          <span className="ml-1.5 font-normal normal-case text-stone-300">({activeObjs.length})</span>
                        )}
                      </p>

                      <div className="space-y-1.5">
                        {objectives.map((m, j) => {
                          if (m._deleted) return null;
                          const isDragObjOver  = dragObjOver?.ph === i && dragObjOver?.obj === j && dragObj?.obj !== j;
                          const isDragObjThis  = dragObj?.ph === i && dragObj?.obj === j;

                          return (
                            <div
                              key={j}
                              onDragOver={e => { e.preventDefault(); setDragObjOver({ ph: i, obj: j }); }}
                              onDragEnter={e => { e.preventDefault(); setDragObjOver({ ph: i, obj: j }); }}
                              onDrop={e => {
                                e.preventDefault();
                                if (dragObj && dragObj.ph === i && dragObj.obj !== j) {
                                  reorderObjectives(i, dragObj.obj, j);
                                }
                                setDragObj(null); setDragObjOver(null);
                              }}
                              className={`rounded-lg border p-2.5 transition-all ${
                                isDragObjOver ? 'bg-blue-50 border-blue-200 border-dashed'
                                : isDragObjThis ? 'opacity-40 bg-stone-100 border-stone-200'
                                : 'bg-white border-stone-200'
                              }`}
                            >
                              {/* Title row */}
                              <div className="flex items-center gap-2">
                                <span
                                  draggable
                                  onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDragObj({ ph: i, obj: j }); }}
                                  onDragEnd={() => { setDragObj(null); setDragObjOver(null); }}
                                  className="text-stone-300 hover:text-stone-500 cursor-grab text-sm select-none leading-none shrink-0"
                                >⠿</span>
                                <input
                                  className="flex-1 bg-transparent border-none outline-none text-sm text-stone-800 placeholder:text-stone-300 focus:ring-0"
                                  placeholder="Objective title"
                                  value={m.title}
                                  onChange={e => setEditMilestonesMap(prev => ({
                                    ...prev,
                                    [i]: prev[i].map((ms, k) => k === j ? { ...ms, title: e.target.value } : ms),
                                  }))}
                                />
                                <button
                                  onClick={() => setEditMilestonesMap(prev => ({
                                    ...prev,
                                    [i]: prev[i].map((ms, k) => k === j ? { ...ms, _deleted: true } : ms),
                                  }))}
                                  className="text-stone-300 hover:text-red-400 text-base leading-none shrink-0 transition-colors"
                                >×</button>
                              </div>

                              {/* Due date + assignees */}
                              <div className="flex items-center gap-2 mt-2 ml-5">
                                <input
                                  type="date"
                                  className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs bg-stone-50 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white"
                                  value={m.dueDate}
                                  onChange={e => setEditMilestonesMap(prev => ({
                                    ...prev,
                                    [i]: prev[i].map((ms, k) => k === j ? { ...ms, dueDate: e.target.value } : ms),
                                  }))}
                                />
                                {canAssign && project.members && project.members.length > 0 && (
                                  <div className="flex-1 min-w-0">
                                    <AssigneePickerDropdown
                                      members={project.members}
                                      selectedIds={m.assigneeIds}
                                      onChange={ids => setEditMilestonesMap(prev => ({
                                        ...prev,
                                        [i]: prev[i].map((ms, k) => k === j ? { ...ms, assigneeIds: ids } : ms),
                                      }))}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setEditMilestonesMap(prev => ({
                          ...prev,
                          [i]: [...(prev[i] ?? []), { title: '', dueDate: '', assigneeIds: [], _deleted: false }],
                        }))}
                        className="mt-2 text-xs text-stone-400 hover:text-blue-500 transition-colors"
                      >+ Add objective</button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setEditPhases(prev => [...prev, { title: '', description: '', dependsOnIds: [], _deleted: false }])}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-sm text-stone-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
          >+ Add phase</button>

        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="px-6 pb-6 pt-4 border-t border-stone-100 shrink-0">
          {saveError && <p className="text-xs text-red-500 mb-3 text-center">{saveError}</p>}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors"
            >Cancel</button>
            <button
              disabled={saving || !form.title.trim()}
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 transition-colors font-medium"
            >{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Assignee picker dropdown ─────────────────────────────────────────
function AssigneePickerDropdown({
  members, selectedIds, onChange,
}: {
  members: ProjectMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q        = search.toLowerCase();
  const filtered = members.filter(m =>
    m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q)
  );
  const selected = members.filter(m => selectedIds.includes(m.userId));

  function toggle(userId: string) {
    onChange(selectedIds.includes(userId)
      ? selectedIds.filter(id => id !== userId)
      : [...selectedIds, userId]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-500 hover:border-blue-300 transition-colors min-h-[28px]"
      >
        {selected.length === 0 ? (
          <span className="text-stone-400">Assign…</span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex items-center -space-x-1">
              {selected.slice(0, 3).map(m => (
                <div key={m.userId} title={m.user.name}
                  className={`w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[7px] font-semibold shrink-0 ${memberColor(m.user.name)}`}
                >
                  {m.user.name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-stone-600 truncate">
              {selected[0].user.name.split(' ')[0]}{selected.length > 1 ? ` +${selected.length - 1}` : ''}
            </span>
          </div>
        )}
        <svg className={`w-3 h-3 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[200px] bg-white border border-stone-200 rounded-xl shadow-lg z-30">
          <div className="p-2 border-b border-stone-100">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <ul className="max-h-44 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-stone-400">No members found</li>
            ) : filtered.map(mem => {
              const isSel = selectedIds.includes(mem.userId);
              return (
                <li key={mem.userId}>
                  <button
                    type="button"
                    onClick={() => toggle(mem.userId)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-stone-50 ${isSel ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${memberColor(mem.user.name)}`}>
                      {mem.user.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-700 truncate">{mem.user.name}</p>
                      <p className="text-[10px] text-stone-400 truncate">{mem.user.email}</p>
                    </div>
                    {isSel && (
                      <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
