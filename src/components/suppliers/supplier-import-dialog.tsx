'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet, CheckCircle2, Upload, Trash2, Save, ArrowRight, ArrowLeft, Loader2, XCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';

interface ParsedSupplier {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  vatNumber: string;
  creditDays: number;
  isValid: boolean;
}

const SUPPLIER_SYSTEM_COLS = [
  { key: 'name', label: 'Supplier Name', required: true },
  { key: 'category', label: 'Category / Group', required: false },
  { key: 'phone', label: 'Phone Number', required: false },
  { key: 'email', label: 'Email Address', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'vatNumber', label: 'VAT / TRN Number', required: false },
  { key: 'creditDays', label: 'Default Credit Days', required: false },
];

type Step = 'upload' | 'map' | 'preview' | 'done';

interface SupplierImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SupplierImportDialog({ open, onOpenChange }: SupplierImportDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileData, setFileData] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ParsedSupplier[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState({ imported: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setFileHeaders([]);
      setFileData([]);
      setMapping({});
      setPreview([]);
      setError(null);
      setSummary({ imported: 0, skipped: 0 });
    }
  }, [open]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
          setFileHeaders(data[0].map((h: any) => h?.toString() || ''));
          setFileData(data);
          setStep('map');
        }
      } catch {
        setError('Could not read file. Please use .xlsx, .xls, or .csv format.');
      }
    };
    reader.readAsBinaryString(f);
  };

  const processMapping = () => {
    const missing = SUPPLIER_SYSTEM_COLS.filter(c => c.required && !mapping[c.key]);
    if (missing.length > 0) {
      setError(`Required: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setError(null);
    const indices: Record<string, number> = {};
    SUPPLIER_SYSTEM_COLS.forEach(col => {
      const h = mapping[col.key];
      if (h) {
        const idx = fileHeaders.indexOf(h);
        if (idx !== -1) indices[col.key] = idx;
      }
    });

    const parsed: ParsedSupplier[] = [];
    fileData.slice(1).forEach((row, idx) => {
      if (!row || row.length === 0) return;
      const name = row[indices['name']]?.toString()?.trim();
      if (!name) return;

      parsed.push({
        id: `row-${idx}`,
        name,
        category: indices['category'] !== undefined ? row[indices['category']]?.toString()?.trim() ?? '' : '',
        phone: indices['phone'] !== undefined ? row[indices['phone']]?.toString()?.trim() ?? '' : '',
        email: indices['email'] !== undefined ? row[indices['email']]?.toString()?.trim() ?? '' : '',
        address: indices['address'] !== undefined ? row[indices['address']]?.toString()?.trim() ?? '' : '',
        vatNumber: indices['vatNumber'] !== undefined ? row[indices['vatNumber']]?.toString()?.trim() ?? '' : '',
        creditDays: indices['creditDays'] !== undefined ? parseInt(row[indices['creditDays']]) || 30 : 30,
        isValid: true,
      });
    });

    if (parsed.length === 0) {
      setError('No valid supplier rows found. Ensure the Name column has values.');
      return;
    }

    setPreview(parsed);
    setStep('preview');
  };

  const commitImport = async () => {
    if (!firestore || !user || preview.length === 0) return;
    setImporting(true);
    let imported = 0;
    let skipped = 0;

    for (const s of preview) {
      try {
        await addDocumentNonBlocking(collection(firestore, 'suppliers'), {
          name: s.name,
          category: s.category,
          phone: s.phone,
          email: s.email,
          address: s.address,
          vatNumber: s.vatNumber,
          defaultCreditDays: s.creditDays,
          status: 'active',
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    setSummary({ imported, skipped });
    setImporting(false);
    setStep('done');
  };

  const downloadTemplate = () => {
    const data = [
      ['Supplier Name', 'Category', 'Phone', 'Email', 'Address', 'VAT/TRN Number', 'Credit Days'],
      ['Example Co. LLC', 'Food & Beverages', '+971-50-0000000', 'contact@example.com', 'Dubai, UAE', 'TRN12345', '30'],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Suppliers');
    XLSX.writeFile(wb, 'DuesFlow_Supplier_Import_Template.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Steps Header */}
        <div className="bg-slate-900 px-8 pt-7 pb-6">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-black">Import Suppliers from Excel</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Upload your supplier master list to register multiple vendors at once.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-5">
            {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => {
              const labels = ['Upload File', 'Map Columns', 'Preview', 'Done'];
              const isActive = step === s;
              const isDone = ['upload', 'map', 'preview', 'done'].indexOf(step) > i;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                    isActive ? 'bg-primary text-white' : isDone ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-500'
                  }`}>
                    {isDone && !isActive ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                    {labels[i]}
                  </div>
                  {i < 3 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-8">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center bg-slate-50/50 hover:bg-slate-50 transition-all">
                <FileSpreadsheet className="w-14 h-14 text-primary mx-auto mb-4 opacity-40" />
                <Input id="sup-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                <Label htmlFor="sup-file" className="cursor-pointer">
                  <Button variant="outline" asChild className="rounded-full px-8 border-slate-200 bg-white">
                    <span>Choose Excel / CSV File</span>
                  </Button>
                </Label>
                <p className="text-xs text-slate-400 mt-4 font-medium">Supports .xlsx, .xls, .csv</p>
              </div>
              <Button variant="link" onClick={downloadTemplate} className="w-full text-xs text-primary/60 hover:text-primary">
                Download Supplier Import Template
              </Button>
              {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}
            </div>
          )}

          {/* Step: Map */}
          {step === 'map' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h3 className="font-black text-slate-900">Map Columns</h3>
                  <p className="text-xs text-slate-500 mt-1">{fileHeaders.length} columns found in "{file?.name}"</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="rounded-full">
                  <ArrowLeft className="w-3 h-3 mr-1" /> Back
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {SUPPLIER_SYSTEM_COLS.map((col) => (
                  <div key={col.key} className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                      {col.label} {col.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select
                      value={mapping[col.key] || ''}
                      onValueChange={(val) => setMapping(prev => ({ ...prev, [col.key]: val }))}
                    >
                      <SelectTrigger className="h-11 bg-slate-50 border-none rounded-2xl">
                        <SelectValue placeholder={`Select column for ${col.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- No Mapping --</SelectItem>
                        {fileHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {error && <p className="text-xs text-red-500 font-bold">{error}</p>}

              <Button onClick={processMapping} className="w-full h-11 rounded-full shadow-lg shadow-primary/20 font-bold">
                Generate Preview <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h3 className="font-black text-slate-900">Preview ({preview.length} suppliers)</h3>
                  <p className="text-xs text-slate-500 mt-1">Review before committing to Firestore</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep('map')} className="rounded-full">
                    <ArrowLeft className="w-3 h-3 mr-1" /> Back
                  </Button>
                  <Button size="sm" onClick={commitImport} disabled={importing} className="rounded-full px-6 shadow-lg shadow-primary/20">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {importing ? 'Importing...' : 'Commit Import'}
                  </Button>
                </div>
              </div>

              <div className="max-h-[350px] overflow-auto rounded-2xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Category</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Phone</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">VAT / TRN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Credit Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-bold text-sm">{s.name}</TableCell>
                        <TableCell className="text-xs text-slate-500">{s.category || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{s.phone || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{s.vatNumber || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-xs">
                            {s.creditDays}d
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center text-center py-8 space-y-5">
              <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center ring-[10px] ring-green-500/10">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">Import Complete!</h3>
                <p className="text-slate-500 text-sm mt-2">
                  <span className="text-primary font-black">{summary.imported}</span> suppliers added to your master list.
                </p>
                {summary.skipped > 0 && (
                  <p className="text-amber-600 text-xs font-bold mt-1 flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" /> {summary.skipped} records failed
                  </p>
                )}
              </div>
              <Button onClick={() => onOpenChange(false)} className="rounded-full px-10 h-11 font-bold">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
