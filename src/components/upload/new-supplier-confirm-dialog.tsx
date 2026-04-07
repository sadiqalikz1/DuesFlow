'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { UserPlus, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface NewSupplierEntry {
  name: string;
  rowCount: number;
}

interface NewSupplierConfirmDialogProps {
  open: boolean;
  suppliers: NewSupplierEntry[];
  onConfirm: (confirmedNames: Set<string>) => void;
  onCancel: () => void;
}

export function NewSupplierConfirmDialog({
  open,
  suppliers,
  onConfirm,
  onCancel,
}: NewSupplierConfirmDialogProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      // Default: all checked (approved)
      setChecked(new Set(suppliers.map((s) => s.name)));
    }
  }, [open, suppliers]);

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setChecked(new Set(suppliers.map((s) => s.name)));
  const clearAll = () => setChecked(new Set());

  const approvedCount = checked.size;
  const rejectedCount = suppliers.length - approvedCount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 px-8 pt-8 pb-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-amber-100 rounded-2xl">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <DialogTitle className="text-xl font-black text-slate-900">
                New Suppliers Detected
              </DialogTitle>
              <Badge className="bg-amber-500 text-white border-none text-xs font-black ml-auto">
                {suppliers.length} New
              </Badge>
            </div>
            <DialogDescription className="text-sm text-slate-600 leading-relaxed">
              The following parties are <strong>not in your supplier master</strong>. 
              Check the ones you want to register and create during this import. 
              Unchecked suppliers will be <strong>skipped</strong>.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Supplier List */}
        <div className="px-8 py-4 max-h-[320px] overflow-y-auto space-y-2">
          <div className="flex items-center justify-between mb-3 pb-2 border-b">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Supplier Name
            </span>
            <div className="flex gap-3">
              <button
                onClick={selectAll}
                className="text-[10px] font-black uppercase tracking-wider text-primary hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-200">|</span>
              <button
                onClick={clearAll}
                className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:underline"
              >
                Reject All
              </button>
            </div>
          </div>

          {suppliers.map((s) => {
            const isChecked = checked.has(s.name);
            return (
              <div
                key={s.name}
                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${
                  isChecked
                    ? 'border-primary/20 bg-primary/5'
                    : 'border-red-100 bg-red-50/50'
                }`}
                onClick={() => toggle(s.name)}
              >
                <Checkbox
                  id={`sup-${s.name}`}
                  checked={isChecked}
                  onCheckedChange={() => toggle(s.name)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`sup-${s.name}`}
                    className="text-sm font-bold text-slate-800 truncate block cursor-pointer"
                  >
                    {s.name}
                  </Label>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {s.rowCount} {s.rowCount === 1 ? 'record' : 'records'} in this upload
                  </p>
                </div>
                <div className="shrink-0">
                  {isChecked ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Create
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-red-500 bg-red-50 px-2 py-1 rounded-full">
                      <XCircle className="w-2.5 h-2.5" /> Skip
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <DialogFooter className="px-8 pb-8 pt-4 border-t flex-col gap-3">
          {/* Summary */}
          <div className="flex items-center gap-3 w-full mb-1">
            <div className="flex-1 p-3 bg-primary/5 rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-black text-primary">{approvedCount} will be created</span>
            </div>
            {rejectedCount > 0 && (
              <div className="flex-1 p-3 bg-red-50 rounded-2xl flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-black text-red-500">{rejectedCount} will be skipped</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 rounded-full border-slate-200 h-11 font-bold"
            >
              Back to Mapping
            </Button>
            <Button
              onClick={() => onConfirm(checked)}
              className="flex-1 rounded-full h-11 font-bold shadow-lg shadow-primary/25"
              disabled={approvedCount === 0 && suppliers.length > 0}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Confirm &amp; Proceed
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
