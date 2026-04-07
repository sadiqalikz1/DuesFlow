'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileUp,
  Download,
  AlertCircle,
  CheckCircle2,
  Info,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Save,
  UserPlus,
  CreditCard,
  ReceiptText,
  RefreshCw,
  SearchCode,
  Loader2,
  History,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useMemoFirebase,
} from '@/firebase';
import {
  collection, serverTimestamp, addDoc, query, where, getDocs, orderBy, doc, writeBatch, setDoc
} from 'firebase/firestore';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { addDays, format, parse, isValid as isValidDate } from 'date-fns';
import * as XLSX from 'xlsx';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useUserRole } from '@/hooks/use-user-role';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { NewSupplierConfirmDialog, type NewSupplierEntry } from '@/components/upload/new-supplier-confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedRow {
  id: string;
  refNumber: string;
  date: string;
  supplierName: string;
  amount: number;
  creditDays?: number;
  dueDate?: string;
  isUnregistered: boolean;
  isSkipped: boolean;   // rejected by user in confirmation dialog
  isValid: boolean;
  error?: string;
}

// ─── System Columns ──────────────────────────────────────────────────────────

const SYSTEM_COLUMNS = {
  invoices: [
    { key: 'refNumber', label: 'Invoice No', required: true, icon: <ReceiptText className="w-3 h-3" /> },
    { key: 'date', label: 'Invoice Date', required: true, icon: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Supplier / Party', required: true, icon: <UserPlus className="w-3 h-3" /> },
    { key: 'amount', label: 'Bill Amount', required: true, icon: <CreditCard className="w-3 h-3" /> },
    { key: 'creditDays', label: 'Credit Days', required: false, icon: <RefreshCw className="w-3 h-3" /> },
  ],
  payments: [
    { key: 'refNumber', label: 'Ref Number', required: true, icon: <ReceiptText className="w-3 h-3" /> },
    { key: 'date', label: 'Payment Date', required: true, icon: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Party Name', required: true, icon: <UserPlus className="w-3 h-3" /> },
    { key: 'amount', label: 'Amount Paid', required: true, icon: <CreditCard className="w-3 h-3" /> },
  ],
};

// ─── PRESET MAPPINGS (Tally standard exports) ────────────────────────────────

const BUILTIN_PRESETS: Record<string, { label: string; type: 'invoices' | 'payments' | 'both'; mapping: Record<string, string> }> = {
  tally_purchase: {
    label: 'Tally — Purchase Register',
    type: 'invoices',
    mapping: {
      refNumber: 'Voucher No.',
      date: 'Date',
      supplierName: "Party's Name",
      amount: 'Amount',
      creditDays: 'Credit Period',
    },
  },
  tally_payment: {
    label: 'Tally — Payment Vouchers',
    type: 'payments',
    mapping: {
      refNumber: 'Voucher No.',
      date: 'Date',
      supplierName: "Party's Name",
      amount: 'Amount',
    },
  },
  duesflow_standard_invoice: {
    label: 'DuesFlow Standard — Invoices',
    type: 'invoices',
    mapping: {
      refNumber: 'Invoice Number',
      date: 'Date',
      supplierName: 'Supplier Name',
      amount: 'Amount',
      creditDays: 'Credit Days',
    },
  },
  duesflow_standard_payment: {
    label: 'DuesFlow Standard — Payments',
    type: 'payments',
    mapping: {
      refNumber: 'Reference Number',
      date: 'Date',
      supplierName: 'Supplier Name',
      amount: 'Amount Paid',
    },
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UploadPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();

  // Core state
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [summary, setSummary] = useState({ total: 0, imported: 0, skipped: 0, newSuppliers: 0 });
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [importType, setImportType] = useState<'invoices' | 'payments'>('invoices');
  const [mappingState, setMappingState] = useState<Record<string, string>>({});
  const [isMappingMode, setIsMappingMode] = useState(false);

  // Supplier confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [newSuppliersToConfirm, setNewSuppliersToConfirm] = useState<NewSupplierEntry[]>([]);
  const [pendingParsed, setPendingParsed] = useState<ParsedRow[]>([]);

  // Save preset dialog
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  // Firestore queries
  const branchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'branches');
  }, [firestore]);
  const { data: branches } = useCollection(branchesQuery);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  // Load user's saved presets from Firestore
  const savedPresetsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'mappingPresets'),
      where('createdBy', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: savedPresets } = useCollection(savedPresetsQuery);

  // ── File Handling ─────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;
    setFile(selectedFile);
    setSuccess(false);
    setError(null);
    setPreviewData([]);
    setIsMappingMode(false);
    setMappingState({}); // Start blank — no auto-mapping

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
          const headers = data[0].map((h: any) => h?.toString() || '');
          setFileHeaders(headers);
          setFileData(data);
        }
      } catch {
        setError('Could not read headers from file.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  // ── Preset Loading ────────────────────────────────────────────────────────

  const loadPreset = (presetKey: string) => {
    // Check built-ins
    if (presetKey in BUILTIN_PRESETS) {
      const preset = BUILTIN_PRESETS[presetKey];
      setMappingState(preset.mapping);
      if (preset.type !== 'both') {
        // Switch import type to match preset if possible
        // (don't force switch; user can verify)
      }
      return;
    }
    // Check user-saved presets
    const saved = savedPresets?.find(p => p.id === presetKey);
    if (saved?.mapping) {
      setMappingState(saved.mapping);
    }
  };

  // ── Save Current Mapping as Preset ───────────────────────────────────────

  const savePreset = async () => {
    if (!firestore || !user || !presetName.trim()) return;
    setSavingPreset(true);
    try {
      await addDoc(collection(firestore, 'mappingPresets'), {
        name: presetName.trim(),
        type: importType,
        mapping: mappingState,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setShowSavePreset(false);
      setPresetName('');
    } catch (err) {
      console.error('Failed to save preset', err);
    }
    setSavingPreset(false);
  };

  // ── Utilities ─────────────────────────────────────────────────────────────

  const cleanNumeric = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const parseDate = (val: any) => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
      const date = XLSX.SSF.parse_date_code(val);
      return new Date(date.y, date.m - 1, date.d);
    }
    const str = val.toString().trim();
    let date = new Date(str);
    if (isValidDate(date)) return date;
    const formats = ['dd-MM-yyyy', 'dd/MM/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd', 'dd-MMM-yy', 'dd-MMM-yyyy'];
    for (const f of formats) {
      try {
        date = parse(str, f, new Date());
        if (isValidDate(date)) return date;
      } catch {}
    }
    return new Date();
  };

  // ── Run Analyzer → open mapping mode ─────────────────────────────────────

  const runAnalyzer = () => {
    if (!file || fileData.length === 0) {
      setError('Please upload a valid file first.');
      return;
    }
    setIsMappingMode(true);
  };

  // ── Process Mapping → detect new suppliers → show confirm dialog ──────────

  const processMapping = () => {
    const currentCols = SYSTEM_COLUMNS[importType];
    const missing = currentCols.filter(c => c.required && !mappingState[c.key]);
    if (missing.length > 0) {
      setError(`Mandatory mapping required: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setError(null);
    const headerIndices: Record<string, number> = {};
    currentCols.forEach(sys => {
      const mappedHeader = mappingState[sys.key];
      if (mappedHeader) {
        const idx = fileHeaders.indexOf(mappedHeader);
        if (idx !== -1) headerIndices[sys.key] = idx;
      }
    });

    const unindexed = currentCols.filter(c => c.required && headerIndices[c.key] === undefined);
    if (unindexed.length > 0) {
      setError(`Could not find indices for: ${unindexed.map(u => u.label).join(', ')}. Please re-map.`);
      return;
    }

    const parsed: ParsedRow[] = [];
    fileData.slice(1).forEach((row: any[], idx: number) => {
      if (!row || row.length === 0) return;
      const refNo = row[headerIndices['refNumber']];
      const dateVal = row[headerIndices['date']];
      const supplierName = row[headerIndices['supplierName']];
      const amountRaw = row[headerIndices['amount']];
      const amount = cleanNumeric(amountRaw);
      const cdIdx = headerIndices['creditDays'];
      const creditDays = cdIdx !== undefined ? parseInt(row[cdIdx]) || 30 : 30;

      if (!refNo || !supplierName || isNaN(amount) || amount === 0) return;

      const dateObj = parseDate(dateVal);
      const supplier = suppliers?.find(
        s => s.name.toLowerCase().trim() === supplierName.toString().trim().toLowerCase()
      );
      const dueDate = importType === 'invoices' ? addDays(dateObj, creditDays) : null;

      parsed.push({
        id: `row-${idx}`,
        refNumber: refNo.toString().trim(),
        date: format(dateObj, 'yyyy-MM-dd'),
        supplierName: supplierName.toString().trim(),
        amount,
        creditDays: importType === 'invoices' ? creditDays : undefined,
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        isUnregistered: !supplier,
        isSkipped: false,
        isValid: true,
      });
    });

    if (parsed.length === 0) {
      setError(
        `Reconciliation failed: ${fileData.length - 1} rows analyzed, but none matched the mandatory criteria. Check if your chosen columns have values in every row.`
      );
      return;
    }

    // Detect new suppliers
    const unregistered = parsed.filter(r => r.isUnregistered);
    if (unregistered.length > 0) {
      // Group by supplier name
      const grouped: Record<string, number> = {};
      unregistered.forEach(r => {
        grouped[r.supplierName] = (grouped[r.supplierName] || 0) + 1;
      });
      const entries: NewSupplierEntry[] = Object.entries(grouped).map(([name, rowCount]) => ({ name, rowCount }));
      setPendingParsed(parsed);
      setNewSuppliersToConfirm(entries);
      setShowConfirmDialog(true);
      setIsMappingMode(false);
    } else {
      // All suppliers known — go straight to preview
      setPreviewData(parsed);
      setIsMappingMode(false);
    }
  };

  const handleNewSupplierConfirm = (confirmedNames: Set<string>) => {
    // Mark rows for skipped suppliers
    const updated = pendingParsed.map(row => ({
      ...row,
      isSkipped: row.isUnregistered && !confirmedNames.has(row.supplierName),
    }));
    setPreviewData(updated);
    setShowConfirmDialog(false);
    setPendingParsed([]);
    setNewSuppliersToConfirm([]);
  };

  const handleNewSupplierCancel = () => {
    setShowConfirmDialog(false);
    setPendingParsed([]);
    setNewSuppliersToConfirm([]);
    setIsMappingMode(true); // Return to mapping
  };

  // ── FIFO Allocation ───────────────────────────────────────────────────────

  const applyFIFO = async (supplierId: string, amountToApply: number, paymentId: string, branchId: string) => {
    if (!firestore || !supplierId || amountToApply <= 0) return;
    const invoicesQuery = query(
      collection(firestore, 'invoices'),
      where('supplierId', '==', supplierId),
      where('status', 'in', ['Pending', 'Partially Paid', 'Overdue']),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(invoicesQuery);
    let remaining = amountToApply;
    for (const docSnap of snapshot.docs) {
      if (remaining <= 0) break;
      const inv = docSnap.data();
      const balance = inv.remainingBalance || 0;
      const paymentToApply = Math.min(balance, remaining);
      if (paymentToApply > 0) {
        updateDocumentNonBlocking(docSnap.ref, {
          remainingBalance: balance - paymentToApply,
          status: (balance - paymentToApply) <= 0 ? 'Paid' : 'Partially Paid',
        });
        addDocumentNonBlocking(collection(firestore, 'invoiceAllocations'), {
          paymentId,
          invoiceId: docSnap.id,
          amountApplied: paymentToApply,
          allocatedAt: serverTimestamp(),
          branchId,
        });
        remaining -= paymentToApply;
      }
    }
  };

  // ── Commit Import ─────────────────────────────────────────────────────────

  const commitImport = async () => {
    if (!firestore || !user || previewData.length === 0 || !selectedBranchId) return;

    setUploading(true);
    setProgress(0);
    let imported = 0;
    let skipped = 0;
    let newSuppliersCreated = 0;

    const activeRows = previewData.filter(r => !r.isSkipped);

    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      let supplierId = '';

      const existingSupplier = suppliers?.find(
        s => s.name.toLowerCase().trim() === row.supplierName.toLowerCase().trim()
      );

      if (!existingSupplier && row.isUnregistered) {
        // Create new supplier (user already confirmed)
        try {
          const newSupDoc = await addDoc(collection(firestore, 'suppliers'), {
            name: row.supplierName,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            status: 'active',
            defaultCreditDays: row.creditDays || 30,
          });
          supplierId = newSupDoc.id;
          newSuppliersCreated++;
        } catch {
          skipped++;
          continue;
        }
      } else if (existingSupplier) {
        supplierId = existingSupplier.id;
      }

      if (supplierId) {
        if (importType === 'invoices') {
          await addDocumentNonBlocking(collection(firestore, 'invoices'), {
            invoiceNumber: row.refNumber,
            supplierId,
            branchId: selectedBranchId,
            date: row.date,
            dueDate: row.dueDate,
            totalAmount: row.amount,
            remainingBalance: row.amount,
            paidAmount: 0,
            status: 'Pending',
            createdAt: serverTimestamp(),
          });
        } else {
          const payRef = await addDoc(collection(firestore, 'payments'), {
            paymentNumber: row.refNumber,
            supplierId,
            branchId: selectedBranchId,
            date: row.date,
            amount: row.amount,
            method: 'Bank Transfer',
            reference: 'Imported',
            createdAt: serverTimestamp(),
          });
          // Apply FIFO automatically
          await applyFIFO(supplierId, row.amount, payRef.id, selectedBranchId);
        }
        imported++;
      } else {
        skipped++;
      }

      setProgress(Math.round(((i + 1) / activeRows.length) * 100));
    }

    // Add skipped rows count
    skipped += previewData.filter(r => r.isSkipped).length;

    // Write upload history
    try {
      await addDoc(collection(firestore, 'uploadHistory'), {
        type: importType,
        branchId: selectedBranchId,
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
        fileName: file?.name || 'Unknown',
        totalRows: previewData.length,
        importedCount: imported,
        skippedCount: skipped,
        newSuppliersCreated,
      });
    } catch (e) {
      console.error('Failed to log upload history', e);
    }

    setSummary({ total: previewData.length, imported, skipped, newSuppliers: newSuppliersCreated });
    setSuccess(true);
    setUploading(false);
    setPreviewData([]);
  };

  // ── Template Download ─────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const headers = importType === 'invoices'
      ? [['Voucher No.', 'Date', "Party's Name", 'Amount', 'Credit Period']]
      : [['Voucher No.', 'Date', "Party's Name", 'Amount']];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headers), 'Template');
    XLSX.writeFile(wb, `DuesFlow_${importType === 'invoices' ? 'Purchase' : 'Payment'}_Template.xlsx`);
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (isRoleLoading) return (
    <div className="p-8 h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-slate-500 font-medium">Validating Permissions...</p>
    </div>
  );
  if (!isAdmin) {
    return (
      <main className="p-8 flex items-center justify-center min-h-screen bg-slate-50">
        <Alert variant="destructive" className="max-w-md bg-white border-red-100 shadow-xl rounded-3xl">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900 font-bold mb-1">Administrative Access Required</AlertTitle>
          <AlertDescription className="text-slate-600 text-sm">
            Bulk data imports are restricted to verified accounts. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  // ── Active presets list ───────────────────────────────────────────────────
  const builtinPresetList = Object.entries(BUILTIN_PRESETS);
  const savedPresetList = savedPresets?.filter(p => p.type === importType || p.type === 'both') || [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SidebarInset className="flex-1 bg-background">
      {/* New Supplier Confirmation Dialog */}
      <NewSupplierConfirmDialog
        open={showConfirmDialog}
        suppliers={newSuppliersToConfirm}
        onConfirm={handleNewSupplierConfirm}
        onCancel={handleNewSupplierCancel}
      />

      {/* Save Preset Dialog */}
      <Dialog open={showSavePreset} onOpenChange={setShowSavePreset}>
        <DialogContent className="rounded-[2rem] max-w-sm border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">Save Mapping as Preset</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Give this column mapping a name so you can reload it next time.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 block">Preset Name</Label>
            <Input
              placeholder="e.g. Tally Jan Export"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              className="bg-slate-50 border-none rounded-2xl h-11"
              onKeyDown={e => e.key === 'Enter' && savePreset()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSavePreset(false)} className="rounded-full">Cancel</Button>
            <Button onClick={savePreset} disabled={savingPreset || !presetName.trim()} className="rounded-full shadow-lg shadow-primary/20">
              {savingPreset ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BookmarkCheck className="w-4 h-4 mr-2" />}
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Sync Accounting Center</h2>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/upload/history">
            <Button variant="ghost" size="sm" className="rounded-full text-xs font-bold text-slate-500 hover:text-primary gap-1.5">
              <History className="w-3.5 h-3.5" /> Upload History
            </Button>
          </Link>
          <Tabs defaultValue="invoices" value={importType} onValueChange={(v: any) => {
            setImportType(v);
            setFileData([]);
            setFileHeaders([]);
            setPreviewData([]);
            setMappingState({});
            setFile(null);
            setSuccess(false);
          }} className="w-[280px]">
            <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100/50 p-1 rounded-full">
              <TabsTrigger value="invoices" className="rounded-full text-[10px] font-bold uppercase tracking-wider">Purchases</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-full text-[10px] font-bold uppercase tracking-wider">Payments</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 bg-slate-50/40">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto w-full">

          {/* ── Left Panel ────────────────────────────────────────────── */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    {importType === 'invoices' ? <ReceiptText className="w-4 h-4 text-primary" /> : <CreditCard className="w-4 h-4 text-primary" />}
                  </div>
                  {importType === 'invoices' ? 'Purchases Data Feed' : 'Payments Data Feed'}
                </CardTitle>
                <CardDescription className="text-xs">Upload exports from Tally, Busy, or Excel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Branch */}
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Destination Branch</Label>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="h-11 bg-slate-50 border-none rounded-2xl px-4 text-sm font-medium">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* File Drop Zone */}
                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center bg-slate-50/50 hover:bg-slate-50 transition-all group relative overflow-hidden">
                  <div className="relative z-10">
                    <FileSpreadsheet className="w-12 h-12 text-primary mx-auto mb-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
                    <Input type="file" id="file-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild className="rounded-full px-6 border-slate-200 bg-white">
                        <span>{file ? 'Change Dataset' : 'Drop File Here'}</span>
                      </Button>
                    </Label>
                    {file && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <div className="bg-green-100 text-green-700 p-1.5 rounded-full"><CheckCircle2 className="w-3 h-3" /></div>
                        <p className="text-[11px] font-bold text-slate-600 truncate max-w-[150px]">{file.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 shadow-lg shadow-primary/20 rounded-full h-11 text-xs font-bold uppercase tracking-wider"
                      disabled={!file || uploading || !selectedBranchId}
                      onClick={runAnalyzer}
                    >
                      <SearchCode className="w-4 h-4 mr-2" /> Run Analyzer
                    </Button>
                    <Button variant="ghost" size="icon" onClick={downloadTemplate} className="rounded-full w-11 h-11 bg-slate-100 hover:bg-slate-200" title="Download Template">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Alert className="bg-slate-900 border-none text-white rounded-[2rem] p-6">
              <Info className="h-5 w-5 text-blue-400" />
              <AlertTitle className="text-sm font-bold text-blue-400">Intelligent FIFO</AlertTitle>
              <AlertDescription className="text-xs opacity-70 leading-relaxed mt-2 italic">
                Payments are automatically linked to your oldest outstanding bills first, keeping your aging reports accurate. New suppliers require explicit confirmation before creation.
              </AlertDescription>
            </Alert>
          </div>

          {/* ── Right Panel ───────────────────────────────────────────── */}
          <div className="lg:col-span-8">

            {/* ── Mode: Mapping ── */}
            {isMappingMode ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-[2.5rem] animate-in fade-in slide-in-from-right-4 duration-500">
                <CardHeader className="bg-slate-50/50 border-b pb-6 px-8 pt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-2xl">
                        <MapPin className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Map Source Columns</CardTitle>
                        <CardDescription>{fileHeaders.length} columns found in "{file?.name}"</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Preset Loader */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="rounded-full bg-white gap-1.5">
                            <Bookmark className="w-3.5 h-3.5" /> Load Preset <ChevronDown className="w-3 h-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[220px] rounded-2xl">
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400">Tally Presets</DropdownMenuLabel>
                          {builtinPresetList.map(([key, preset]) => (
                            <DropdownMenuItem key={key} onClick={() => loadPreset(key)} className="rounded-xl text-sm font-medium cursor-pointer">
                              {preset.label}
                            </DropdownMenuItem>
                          ))}
                          {savedPresetList.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400">Your Saved Presets</DropdownMenuLabel>
                              {savedPresetList.map(p => (
                                <DropdownMenuItem key={p.id} onClick={() => loadPreset(p.id)} className="rounded-xl text-sm font-medium cursor-pointer">
                                  {p.name}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button variant="outline" size="sm" onClick={() => setIsMappingMode(false)} className="rounded-full bg-white">Cancel</Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-8 space-y-8">
                  {/* Mapping Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {SYSTEM_COLUMNS[importType].map((sysCol) => (
                      <div key={sysCol.key} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                            {sysCol.icon} {sysCol.label} {sysCol.required && <span className="text-red-500">*</span>}
                          </Label>
                          {mappingState[sysCol.key] && (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-100 text-[9px] uppercase">Mapped</Badge>
                          )}
                        </div>
                        <Select
                          value={mappingState[sysCol.key] || ''}
                          onValueChange={(val) => setMappingState(prev => ({ ...prev, [sysCol.key]: val }))}
                        >
                          <SelectTrigger className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-medium">
                            <SelectValue placeholder={`Select column …`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null_none">-- No Mapping --</SelectItem>
                            {fileHeaders.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-100 rounded-2xl">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="pt-4 border-t flex flex-col md:flex-row items-center gap-4">
                    <Button onClick={processMapping} className="w-full md:max-w-xs h-12 rounded-full font-bold shadow-xl shadow-primary/30">
                      Generate View &amp; Verify
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSavePreset(true)}
                      className="text-xs font-bold text-slate-400 hover:text-primary rounded-full gap-1.5"
                      disabled={Object.keys(mappingState).length === 0}
                    >
                      <Bookmark className="w-3.5 h-3.5" /> Save as Preset
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Analyzer will validate rows and cross-reference party names.
                    </p>
                  </div>
                </CardContent>
              </Card>

            /* ── Mode: Preview Table ── */
            ) : previewData.length > 0 ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 pb-6 bg-slate-50/50 border-b px-8 pt-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-2xl">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Verification Table</CardTitle>
                      <CardDescription>
                        {previewData.filter(r => !r.isSkipped).length} rows ready ·{' '}
                        {previewData.filter(r => r.isSkipped).length > 0 && (
                          <span className="text-amber-600 font-bold">{previewData.filter(r => r.isSkipped).length} skipped</span>
                        )}
                        {' '}for "{branches?.find(b => b.id === selectedBranchId)?.name}"
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewData([])} className="rounded-full text-slate-600 hover:text-red-600 bg-white border-slate-200">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Discard
                    </Button>
                    <Button size="sm" onClick={commitImport} disabled={uploading} className="rounded-full px-8 shadow-lg shadow-primary/20">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                      {uploading ? 'Processing' : 'Commit Sync'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10">
                        <TableRow className="hover:bg-transparent border-b-slate-100">
                          <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-widest py-5 pl-8">Ref / Invoice</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Party</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-5">Amount</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-5 px-8">
                            {importType === 'invoices' ? 'Due Date' : 'Date'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row: ParsedRow) => (
                          <TableRow
                            key={row.id}
                            className={`${
                              row.isSkipped
                                ? 'bg-red-50/40 opacity-50'
                                : row.isUnregistered
                                ? 'bg-amber-50/30'
                                : ''
                            } hover:bg-slate-50/50 transition-colors border-b-slate-50`}
                          >
                            <TableCell className="font-mono text-[11px] text-slate-500 font-bold pl-8 py-5 tracking-tight">
                              {row.refNumber}
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] font-bold text-slate-800">{row.supplierName}</span>
                                {row.isSkipped ? (
                                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-500 border-red-100">
                                    Skipped
                                  </Badge>
                                ) : row.isUnregistered ? (
                                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border-blue-100">
                                    New Party
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-black text-[13px] py-5">
                              {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center text-[11px] font-bold text-slate-500 py-5 pr-8">
                              <div className="flex flex-col items-center">
                                <span>{importType === 'invoices' ? row.dueDate : row.date}</span>
                                {importType === 'invoices' && (
                                  <span className="text-[9px] opacity-50 uppercase tracking-tighter mt-0.5">{row.creditDays}d Term</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

            /* ── Mode: Success ── */
            ) : success ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 flex flex-col items-center justify-center py-24 text-center rounded-[2.5rem] animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center mb-8 ring-[12px] ring-green-500/5 animate-in zoom-in duration-700">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <CardTitle className="text-3xl font-headline font-black text-slate-900">Sync Complete!</CardTitle>
                <div className="max-w-md mt-6 space-y-4 px-8">
                  <p className="text-slate-600 leading-relaxed font-medium">
                    Imported <span className="text-primary font-black px-1.5 py-0.5 bg-primary/5 rounded">{summary.imported}</span> records.
                  </p>
                  {summary.newSuppliers > 0 && (
                    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-2xl text-xs font-bold border border-blue-100">
                      <UserPlus className="w-4 h-4" /> {summary.newSuppliers} new supplier{summary.newSuppliers !== 1 ? 's' : ''} created
                    </div>
                  )}
                  {summary.skipped > 0 && (
                    <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl text-xs font-bold border border-amber-100">
                      <AlertTriangle className="w-4 h-4" /> {summary.skipped} records skipped
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-12">
                  <Button variant="outline" className="rounded-full px-8 h-11 border-slate-200 font-bold hover:bg-slate-50" onClick={() => setSuccess(false)}>
                    New Import
                  </Button>
                  <Link href="/upload/history">
                    <Button variant="ghost" className="rounded-full px-8 h-11 font-bold text-primary">
                      <History className="w-4 h-4 mr-2" /> View History
                    </Button>
                  </Link>
                </div>
              </Card>

            /* ── Mode: File Staged ── */
            ) : file ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-slate-50/30 text-slate-400 group hover:border-primary/20 transition-all duration-500 hover:bg-white shadow-inner animate-in fade-in">
                <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 mb-8 transform group-hover:scale-110 transition-transform duration-500 ring-1 ring-slate-100">
                  <SearchCode className="w-12 h-12 text-primary animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-slate-700 tracking-tight">Dataset Staged: {file.name}</h3>
                <p className="text-xs mt-3 opacity-60 max-w-[280px] text-center leading-relaxed font-medium">
                  Financial data detected. Click <strong>"Run Analyzer"</strong> on the left to start column mapping.
                </p>
                <Button onClick={runAnalyzer} className="mt-8 rounded-full px-8 shadow-lg shadow-primary/20 font-bold" disabled={!selectedBranchId}>
                  Begin Analysis Now
                </Button>
                {!selectedBranchId && (
                  <p className="text-[10px] text-amber-500 font-bold mt-3">← Select a branch first</p>
                )}
              </div>

            /* ── Mode: Empty ── */
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-slate-50/30 text-slate-400 group hover:border-primary/20 transition-all duration-500 hover:bg-white shadow-inner">
                <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 mb-8 transform group-hover:rotate-6 transition-transform duration-500 ring-1 ring-slate-100">
                  <FileUp className="w-12 h-12 text-primary opacity-20" />
                </div>
                <h3 className="text-lg font-black text-slate-700 tracking-tight">Financial Dataset Required</h3>
                <p className="text-xs mt-3 opacity-60 max-w-[280px] text-center leading-relaxed font-medium">
                  Upload your Tally / Excel export. Analyzer will guide you through column mapping and party verification.
                </p>
              </div>
            )}

            {/* Progress Bar */}
            {uploading && (
              <div className="mt-8 space-y-4 px-6 bg-white p-6 rounded-[2rem] shadow-sm ring-1 ring-slate-100">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                    <span>Transmitting Ledger Data...</span>
                  </div>
                  <span className="text-primary text-sm">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && !isMappingMode && (
              <Alert variant="destructive" className="mt-8 bg-red-50 border-red-100 rounded-[2rem] p-6 shadow-sm">
                <XCircle className="h-5 w-5 mr-3" />
                <div>
                  <AlertTitle className="font-black text-sm uppercase tracking-wide">Analyzer Halted</AlertTitle>
                  <AlertDescription className="text-xs font-medium opacity-80 mt-1">{error}</AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
