import { useEffect, useState, type ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/client';
import Modal from './Modal';

function resizeImageToDataUrl(file: File, maxDim = 256, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.onload = () => {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('Canvas not supported')); return; }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    });
}

export default function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { user, updateUser } = useAuth();
    const [name,  setName]  = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(user?.avatarUrl);
    const [error,     setError]     = useState<string | null>(null);
    const [saving,    setSaving]    = useState(false);
    const [processingImage, setProcessingImage] = useState(false);

    // Modal stays mounted between opens (for the close animation), so re-seed
    // the form from the current user each time it's opened rather than only once.
    useEffect(() => {
        if (!open) return;
        setName(user?.name ?? '');
        setEmail(user?.email ?? '');
        setAvatarPreview(user?.avatarUrl);
        setError(null);
    }, [open, user]);

    async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Please choose an image file'); return; }

        setError(null);
        setProcessingImage(true);
        try {
            const dataUrl = await resizeImageToDataUrl(file);
            setAvatarPreview(dataUrl);
        } catch {
            setError('Failed to process image');
        } finally {
            setProcessingImage(false);
        }
    }

    async function handleSubmit() {
        setError(null);
        if (!name.trim())  { setError('Name cannot be empty');  return; }
        if (!email.trim()) { setError('Email cannot be empty'); return; }

        setSaving(true);
        try {
            const updated = await updateProfile({
                name,
                email,
                ...(avatarPreview !== user?.avatarUrl ? { avatarUrl: avatarPreview ?? null } : {}),
            });
            updateUser(updated);
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={open} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-[#E0CFC4]">
                <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">Edit profile</h2>

                <div className="flex flex-col items-center mb-5">
                    <label className="relative cursor-pointer group">
                        <div className="w-20 h-20 rounded-full bg-[#c8eadf] flex items-center justify-center text-2xl font-bold text-[#16342d] overflow-hidden border-2 border-[#E0CFC4]">
                            {avatarPreview
                                ? <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                                : (name?.[0]?.toUpperCase() ?? '?')}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                            {processingImage ? '…' : 'Change'}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {avatarPreview && (
                        <button
                            type="button"
                            onClick={() => setAvatarPreview(null)}
                            className="text-xs font-medium text-[#8A7265] hover:text-[#ba1a1a] transition-colors mt-2"
                        >
                            Remove photo
                        </button>
                    )}
                </div>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-xs font-medium text-[#8A7265] mb-1 block">Name</label>
                        <input
                            className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[#8A7265] mb-1 block">Email</label>
                        <input
                            type="email"
                            className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>
                </div>

                {error && <p className="text-xs text-[#ba1a1a] mb-4">{error}</p>}

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#3A2A22] bg-[#F0E9E0] border border-[#E0CFC4] hover:bg-[#E0CFC4] transition-colors disabled:opacity-40">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || processingImage || !name.trim() || !email.trim()}
                        className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#A84E14] transition-colors font-semibold disabled:opacity-40">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
        </Modal>
    );
}
