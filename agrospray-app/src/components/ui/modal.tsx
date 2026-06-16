import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl2 border border-line bg-card p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-[17px] font-bold tracking-tight">{title}</h3>
            {sub && <div className="text-[12.5px] text-mut">{sub}</div>}
          </div>
          <button onClick={onClose} className="rounded-full border border-line p-1.5 text-mut hover:text-ink">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
