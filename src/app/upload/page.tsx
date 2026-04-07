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
  ArrowLeft,
  Filter,
  Check,
  RotateCcw,
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
  creditAmount?: number;
  creditDays?: number;
  dueDate?: string;
  reason?: string;
  isUnregistered: boolean;
  isSkipped: boolean;   // rejected by user in confirmation dialog
  isValid: boolean;
  voucherType?: 'invoices' | 'debitNote';  // For mixed uploads, detected from "Vch Type" column
  errorCode?: 'DUPLICATE_REF' | 'MISSING_DATA' | 'INVALID_DATE' | 'ZERO_AMOUNT' | 'NEGATIVE_AMOUNT';
  errorDetail?: string;
}

interface FileMetadata {
  rowCount: number;
  minDate: Date | null;
  maxDate: Date | null;
  totalVolume: number;
  unmappedCols: number;
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
  debitNote: [
    { key: 'refNumber', label: 'Debit Note No', required: true, icon: <ReceiptText className="w-3 h-3" /> },
    { key: 'date', label: 'Debit Note Date', required: true, icon: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Supplier / Party', required: true, icon: <UserPlus className="w-3 h-3" /> },
    { key: 'amount', label: 'Debit Amount', required: true, icon: <CreditCard className="w-3 h-3" /> },
    { key: 'reason', label: 'Reason / Description', required: false, icon: <Info className="w-3 h-3" /> },
  ],
  creditNote: [
    { key: 'refNumber', label: 'Credit Note No', required: true, icon: <ReceiptText className="w-3 h-3" /> },
    { key: 'date', label: 'Credit Note Date', required: true, icon: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Supplier / Party', required: true, icon: <UserPlus className="w-3 h-3" /> },
    { key: 'amount', label: 'Credit Amount', required: true, icon: <CreditCard className="w-3 h-3" /> },
    { key: 'reason', label: 'Reason / Description', required: false, icon: <Info className="w-3 h-3" /> },
  ],
  mixed: [
    { key: 'date', label: 'Date', required: true, icon: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Particulars / Supplier', required: true, icon: <UserPlus className="w-3 h-3" /> },
    { key: 'vchType', label: 'Vch Type', required: false, icon: <FileSpreadsheet className="w-3 h-3" /> },
    { key: 'refNumber', label: 'Vch No. / Reference', required: true, icon: <ReceiptText className="w-3 h-3" /> },
    { key: 'amount', label: 'Debit / Transaction Amount', required: true, icon: <CreditCard className="w-3 h-3" /> },
    { key: 'creditAmount', label: 'Credit Amount', required: true, icon: <CreditCard className="w-3 h-3" /> },
    { key: 'creditDays', label: 'Credit Days', required: false, icon: <RefreshCw className="w-3 h-3" /> },
    { key: 'reason', label: 'Reason / Description', required: false, icon: <Info className="w-3 h-3" /> },
  ],
};

// ─── PRESET MAPPINGS (Tally standard exports) ────────────────────────────────

const BUILTIN_PRESETS: Record<string, { label: string; type: 'invoices' | 'payments' | 'debitNote' | 'creditNote' | 'both'; mapping: Record<string, string> }> = {
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
  tally_mixed_purchase_debit: {
    label: 'Tally — Mixed (Purchases + Debit Notes)',
    type: 'both',
    mapping: {
      date: 'Date',
      supplierName: 'Particulars',
      vchType: 'Vch Type',
      refNumber: 'Vch No.',
      amount: 'Debit Amount',
      creditAmount: 'Credit Amount',
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
  duesflow_standard_debit_note: {
    label: 'DuesFlow Standard — Debit Notes',
    type: 'debitNote',
    mapping: {
      refNumber: 'Debit Note No',
      date: 'Date',
      supplierName: 'Supplier Name',
      amount: 'Amount',
      reason: 'Reason',
    },
  },
  duesflow_standard_credit_note: {
    label: 'DuesFlow Standard — Credit Notes',
    type: 'creditNote',
    mapping: {
      refNumber: 'Credit Note No',
      date: 'Date',
      supplierName: 'Supplier Name',
      amount: 'Amount',
      reason: 'Reason',
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
  const [importType, setImportType] = useState<'invoices' | 'payments' | 'debitNote' | 'creditNote'>('invoices');
  const [mappingState, setMappingState] = useState<Record<string, string>>({});
  const [isMappingMode, setIsMappingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'verify' | 'commit' | 'success'>('upload');
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [batchMemo, setBatchMemo] = useState('');
  const [accountingPeriod, setAccountingPeriod] = useState('');
  const [fallbackDate, setFallbackDate] = useState<string>('');
  const [isMixedMode, setIsMixedMode] = useState(false);  // Auto-detect mixed mode
  const [vchTypeColumn, setVchTypeColumn] = useState<string>('');  // Track the Vch Type column

  // Supplier confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [newSuppliersToConfirm, setNewSuppliersToConfirm] = useState<NewSupplierEntry[]>([]);
  const [pendingParsed, setPendingParsed] = useState<ParsedRow[]>([]);
  const [newSupplierCreditDays, setNewSupplierCreditDays] = useState<Map<string, number>>(new Map());

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
        
        if (!data || data.length === 0) {
          setError('File is empty. Please upload a file with data.');
          return;
        }

        // Find first row with data (skip empty rows at the top)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(data.length, 5); i++) {
          if (Array.isArray(data[i]) && data[i].some(cell => cell !== null && cell !== undefined && cell !== '')) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = data[headerRowIdx] || [];
        const headers = headerRow
          .map((h: any) => {
            const str = h?.toString().trim() || '';
            return str;
          })
          .filter((h: string) => h !== ''); // Remove empty header cells

        if (headers.length === 0) {
          setError('No valid column headers found. Please check your file format.');
          return;
        }

        // Rebuild data array with actual headers if they weren't in row 0
        let processedData = data;
        if (headerRowIdx > 0) {
          // Insert header row at index 0
          processedData = [headerRow, ...data.slice(headerRowIdx + 1)];
        }

        setFileHeaders(headers);
        setFileData(processedData);
        detectFileMetadata(processedData);
        
        // Auto-detect mixed mode: Check for "Vch Type" column
        const vchTypeIdx = headers.findIndex(h => 
          h.toLowerCase().includes('vch type') || 
          h.toLowerCase().includes('vchtype') ||
          h.toLowerCase() === 'type'
        );
        
        if (vchTypeIdx !== -1) {
          setIsMixedMode(true);
          setVchTypeColumn(headers[vchTypeIdx]);
          setImportType('invoices');  // Default for display, won't be used in mixed mode
        } else {
          setIsMixedMode(false);
          setVchTypeColumn('');
        }
        
        setCurrentStep('upload');
      } catch (err) {
        console.error('File read error:', err);
        setError('Could not read file. Ensure it is a valid Excel (.xlsx, .xls) or CSV file.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const detectFileMetadata = (data: any[][]) => {
    if (data.length <= 1) return;
    let minD = new Date(8640000000000000);
    let maxD = new Date(-8640000000000000);
    let total = 0;
    let validDates = 0;

    data.slice(1).forEach(row => {
      if (!Array.isArray(row)) return;
      row.forEach(cell => {
        if (cell === undefined || cell === null) return;
        // Check for numbers
        if (typeof cell === 'number' && cell > 1000) {
          // Could be a date code (approx 1990 to 2050)
          if (cell > 32874 && cell < 55000) { 
            const d = parseDate(cell);
            if (isValidDate(d)) {
              if (d < minD) minD = d;
              if (d > maxD) maxD = d;
              validDates++;
            }
          }
        }
      });
    });

    setFileMetadata({
      rowCount: data.length - 1,
      minDate: validDates > 0 ? minD : null,
      maxDate: validDates > 0 ? maxD : null,
      totalVolume: total,
      unmappedCols: data[0].length,
    });
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

  const detectVoucherType = (vchTypeRaw: string): 'invoices' | 'debitNote' | null => {
    if (!vchTypeRaw) return null;
    const vchType = vchTypeRaw.toLowerCase().trim();
    if (vchType.includes('purchase') || vchType.includes('invoice') || vchType === 'pur') return 'invoices';
    if (vchType.includes('debit') || vchType === 'dn') return 'debitNote';
    return null;
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
    setCurrentStep('mapping');
  };

  // ── Process Mapping → detect new suppliers → show confirm dialog ──────────

  const processMapping = () => {
    // In mixed mode, we need Date, Supplier Name, Amount, Credit Amount, and Ref Number
    let requiredColumns: string[] = [];
    
    if (isMixedMode) {
      requiredColumns = ['refNumber', 'supplierName', 'date', 'amount', 'creditAmount'];
    } else {
      const currentCols = SYSTEM_COLUMNS[importType];
      requiredColumns = currentCols.filter(c => c.required && !(c.key === 'date' && fallbackDate)).map(c => c.key);
    }
    
    // Check mandatory mappings for mixed mode
    const missing = requiredColumns.filter(key => !mappingState[key]);
    if (missing.length > 0) {
      const labels = missing.map(k => {
        if (k === 'refNumber') return 'Vch No.';
        if (k === 'supplierName') return 'Particulars';
        if (k === 'date') return 'Date';
        if (k === 'amount') return 'Debit Amount';
        return k;
      });
      setError(`Mandatory mapping required: ${labels.join(', ')}`);
      return;
    }

    setError(null);
    const headerIndices: Record<string, number> = {};
    
    // Get indices for required columns
    requiredColumns.forEach(key => {
      const mappedHeader = mappingState[key];
      if (mappedHeader) {
        const idx = fileHeaders.indexOf(mappedHeader);
        if (idx !== -1) headerIndices[key] = idx;
      }
    });

    // Get optional indices
    ['creditDays', 'reason'].forEach(key => {
      const mappedHeader = mappingState[key];
      if (mappedHeader) {
        const idx = fileHeaders.indexOf(mappedHeader);
        if (idx !== -1) headerIndices[key] = idx;
      }
    });

    // In mixed mode, get the Vch Type column index (can be auto-detected or user-mapped)
    let vchTypeIndex = -1;
    if (isMixedMode) {
      // First check if user explicitly mapped vchType
      if (mappingState['vchType']) {
        vchTypeIndex = fileHeaders.indexOf(mappingState['vchType']);
      }
      // Otherwise use auto-detected column
      if (vchTypeIndex === -1 && vchTypeColumn) {
        vchTypeIndex = fileHeaders.indexOf(vchTypeColumn);
      }
    }

    const unindexed = requiredColumns.filter(key => {
      if (key === 'date' && fallbackDate) return false;
      return headerIndices[key] === undefined;
    });
    
    if (unindexed.length > 0) {
      const labels = unindexed.map(u => {
        if (u === 'refNumber') return 'Vch No.';
        if (u === 'supplierName') return 'Particulars';
        if (u === 'date') return 'Date';
        if (u === 'amount') return 'Debit Amount';
        return u;
      });
      setError(`Could not find indices for: ${labels.join(', ')}. Please re-map.`);
      return;
    }

    const parsed: ParsedRow[] = [];
    const seenRefs = new Set<string>();

    fileData.slice(1).forEach((row: any[], idx: number) => {
      if (!row || row.length === 0) return;
      
      // Get basic fields (all should be mapped in mixed mode)
      const refNoRaw = row[headerIndices['refNumber']];
      const dateVal = row[headerIndices['date']];
      const supplierNameRaw = row[headerIndices['supplierName']];
      const amountRaw = row[headerIndices['amount']];
      const reasonRaw = row[headerIndices['reason']];
      
      // Get voucher type for mixed mode
      let detectedType: 'invoices' | 'debitNote' = 'invoices';
      if (isMixedMode && vchTypeIndex !== -1) {
        const vchTypeRaw = row[vchTypeIndex]?.toString() || '';
        const detected = detectVoucherType(vchTypeRaw);
        if (detected) {
          detectedType = detected;
        } else {
          // Skip rows with unrecognized voucher types
          return;
        }
      } else if (!isMixedMode) {
        detectedType = importType as any;
      }
      
      const refNumber = refNoRaw?.toString().trim() || '';
      const supplierName = supplierNameRaw?.toString().trim() || '';
      const amount = cleanNumeric(amountRaw);
      const reason = reasonRaw?.toString().trim() || '';
      const creditAmountRaw = row[headerIndices['creditAmount']];
      const creditAmount = cleanNumeric(creditAmountRaw);
      const cdIdx = headerIndices['creditDays'];
      const creditDays = cdIdx !== undefined ? parseInt(row[cdIdx]) || 30 : 30;

      let isValid = true;
      let errorCode: ParsedRow['errorCode'];
      let errorDetail: string | undefined;

      if (!refNumber || !supplierName) {
        isValid = false;
        errorCode = 'MISSING_DATA';
        errorDetail = 'Reference Number and Party Name are mandatory.';
      } else if ((isNaN(amount) || amount === 0) && (isNaN(creditAmount) || creditAmount === 0)) {
        isValid = false;
        errorCode = 'ZERO_AMOUNT';
        errorDetail = 'Transaction must have either a Debit Amount or Credit Amount greater than zero.';
      } else if (amount < 0) {
        isValid = false;
        errorCode = 'NEGATIVE_AMOUNT';
        errorDetail = 'Negative amounts should be uploaded as separate adjustments.';
      } else if (creditAmount < 0) {
        isValid = false;
        errorCode = 'NEGATIVE_AMOUNT';
        errorDetail = 'Negative credit amounts should be uploaded as separate adjustments.';
      } else if (seenRefs.has(refNumber)) {
        isValid = false;
        errorCode = 'DUPLICATE_REF';
        errorDetail = `Duplicate reference found in file: ${refNumber}`;
      }

      const dateObj = headerIndices['date'] !== undefined ? parseDate(dateVal) : (fallbackDate ? parseDate(fallbackDate) : new Date());
      
      // If no date mapping and no fallback, mark as invalid
      if (headerIndices['date'] === undefined && !fallbackDate) {
        isValid = false;
        errorCode = 'INVALID_DATE';
        errorDetail = 'Date column not mapped and no fallback date set.';
      } else if (!isValidDate(dateObj)) {
        isValid = false;
        errorCode = 'INVALID_DATE';
        errorDetail = 'Could not parse date format.';
      }

      if (isValid) seenRefs.add(refNumber);

      const supplier = suppliers?.find(
        s => s.name.toLowerCase().trim() === supplierName.toLowerCase().trim()
      );
      const dueDate = detectedType === 'invoices' && isValid ? addDays(dateObj, creditDays) : null;

      parsed.push({
        id: `row-${idx}`,
        refNumber,
        date: isValidDate(dateObj) ? format(dateObj, 'yyyy-MM-dd') : 'Invalid',
        supplierName,
        amount,
        creditAmount: !isNaN(creditAmount) ? creditAmount : undefined,
        creditDays: detectedType === 'invoices' ? creditDays : undefined,
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        reason: (detectedType === 'debitNote') ? reason : undefined,
        voucherType: detectedType,
        isUnregistered: !supplier,
        isSkipped: !isValid, // Auto-skip invalid rows
        isValid,
        errorCode,
        errorDetail,
      });
    });

    if (parsed.filter(r => r.isValid).length === 0) {
      // Generate detailed error report
      const errorSummary: Record<string, number> = {};
      const sampleErrors: any[] = [];
      
      parsed.forEach((row, idx) => {
        if (!row.isValid && sampleErrors.length < 5) {
          sampleErrors.push({
            row: idx + 1,
            data: {
              refNumber: row.refNumber,
              supplier: row.supplierName,
              amount: row.amount,
              creditAmount: row.creditAmount,
              date: row.date,
            },
            error: row.errorCode,
            detail: row.errorDetail,
          });
        }
        if (row.errorCode) {
          errorSummary[row.errorCode] = (errorSummary[row.errorCode] || 0) + 1;
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ VALIDATION REPORT - All rows failed');
        console.warn('Errors by type:', errorSummary);
        console.warn('Sample errors:', sampleErrors);
      }

      const errorDetails = Object.entries(errorSummary)
        .map(([code, count]) => `${count}x ${code}`)
        .join(', ');

      setError(
        `Analysis Failed: All ${fileData.length - 1} rows have validation errors.\n\n📋 Error Breakdown: ${errorDetails}\n\n🔍 First Error:\n${sampleErrors[0]?.data?.refNumber || '—'} | ${sampleErrors[0]?.detail || 'Unknown error'}`
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
      setCurrentStep('verify');
      setIsMappingMode(false);
    }
  };

  const handleNewSupplierConfirm = (confirmedNames: Set<string>, creditDaysMap: Map<string, number>) => {
    // Store credit days for later use in commitImport
    setNewSupplierCreditDays(creditDaysMap);
    
    // Mark rows for skipped suppliers
    const updated = pendingParsed.map(row => ({
      ...row,
      isSkipped: row.isSkipped || (row.isUnregistered && !confirmedNames.has(row.supplierName)),
      creditDays: creditDaysMap.get(row.supplierName) || row.creditDays || 30,
    }));
    setPreviewData(updated);
    setCurrentStep('verify');
    setIsMappingMode(false);
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
        // Determine the actual import type for this row (in mixed mode, use voucherType)
        const rowImportType = isMixedMode ? (row.voucherType || 'invoices') : importType;
        
        if (rowImportType === 'invoices') {
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
        } else if (rowImportType === 'payments') {
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
        } else if (rowImportType === 'debitNote') {
          await addDocumentNonBlocking(collection(firestore, 'debitNotes'), {
            referenceNumber: row.refNumber,
            supplierId,
            branchId: selectedBranchId,
            date: row.date,
            amount: row.amount,
            reason: row.reason || 'Imported Debit Note',
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          });
        } else if (rowImportType === 'creditNote') {
          await addDocumentNonBlocking(collection(firestore, 'creditNotes'), {
            referenceNumber: row.refNumber,
            supplierId,
            branchId: selectedBranchId,
            date: row.date,
            amount: row.amount,
            reason: row.reason || 'Imported Credit Note',
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          });
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
      const historyRef = await addDoc(collection(firestore, 'uploadHistory'), {
        type: isMixedMode ? 'mixed' : importType,
        branchId: selectedBranchId,
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
        fileName: file?.name || 'Unknown',
        totalRows: previewData.length,
        importedCount: imported,
        skippedCount: skipped,
        newSuppliersCreated,
        batchMemo: batchMemo.trim() || 'Standard Sync',
        accountingPeriod: accountingPeriod.trim() || format(new Date(), 'MMM yyyy'),
      });

      // Save detailed records as subcollection for easy lookup
      const detailsBatch = writeBatch(firestore);
      previewData.forEach((row, idx) => {
        const detailRef = doc(collection(firestore, 'uploadHistory', historyRef.id, 'details'));
        detailsBatch.set(detailRef, {
          refNumber: row.refNumber || '',
          supplierName: row.supplierName || '',
          amount: row.amount || 0,
          creditAmount: row.creditAmount || 0,
          date: row.date || '',
          voucherType: row.voucherType || 'invoices',
          isSkipped: row.isSkipped || false,
          ...(row.errorCode && { errorCode: row.errorCode }),
          ...(row.errorDetail && { errorDetail: row.errorDetail }),
        });
      });
      await detailsBatch.commit();
    } catch (e) {
      console.error('Failed to log upload history', e);
    }

    setSummary({ total: previewData.length, imported, skipped, newSuppliers: newSuppliersCreated });
    setSuccess(true);
    setCurrentStep('success');
    setUploading(false);
    setPreviewData([]);
  };

  // ── Template Download ─────────────────────────────────────────────────────

  const downloadTemplate = () => {
    let headers: string[][] = [];
    let filename = 'DuesFlow_Template';
    
    if (importType === 'invoices') {
      headers = [['Voucher No.', 'Date', "Party's Name", 'Amount', 'Credit Period']];
      filename = 'DuesFlow_Purchase_Template.xlsx';
    } else if (importType === 'payments') {
      headers = [['Voucher No.', 'Date', "Party's Name", 'Amount']];
      filename = 'DuesFlow_Payment_Template.xlsx';
    } else if (importType === 'debitNote') {
      headers = [['Debit Note No', 'Date', "Party's Name", 'Amount', 'Reason']];
      filename = 'DuesFlow_DebitNote_Template.xlsx';
    } else if (importType === 'creditNote') {
      headers = [['Credit Note No', 'Date', "Party's Name", 'Amount', 'Reason']];
      filename = 'DuesFlow_CreditNote_Template.xlsx';
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headers), 'Template');
    XLSX.writeFile(wb, filename);
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
      <header className="sticky top-0 z-10 flex h-20 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        
        <div className="flex flex-col">
          <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Sync Accounting Center</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            {[
              { id: 'upload', label: 'Analysis' },
              { id: 'mapping', label: 'Mapping' },
              { id: 'verify', label: 'Verify' },
              { id: 'commit', label: 'Sync' },
            ].map((step, i, arr) => (
              <div key={step.id} className="flex items-center">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  currentStep === step.id ? 'text-primary' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
                {i < arr.length - 1 && <div className="w-4 h-px bg-slate-200 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/upload/history">
            <Button variant="ghost" size="sm" className="rounded-full text-xs font-bold text-slate-500 hover:text-primary gap-1.5 h-9 px-4">
              <History className="w-3.5 h-3.5" /> View History
            </Button>
          </Link>
          <div className="h-8 w-px bg-slate-100 mx-1" />
          {isMixedMode ? (
            <div className="px-4 py-2 bg-blue-50/80 border border-blue-100 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Mixed Mode: 2 Types</span>
            </div>
          ) : (
            <Tabs defaultValue="invoices" value={importType} onValueChange={(v: any) => {
              if (currentStep !== 'upload' && !confirm('Switching import type will reset your current progress. Proceed?')) return;
              setImportType(v);
              setFileData([]);
              setFileHeaders([]);
              setPreviewData([]);
              setMappingState({});
              setFile(null);
              setSuccess(false);
              setCurrentStep('upload');
              setFallbackDate('');
            }} className="w-[360px]">
              <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-100/50 p-1 rounded-full">
                <TabsTrigger value="invoices" className="rounded-full text-[9px] font-bold uppercase tracking-wider">Purchases</TabsTrigger>
                <TabsTrigger value="payments" className="rounded-full text-[9px] font-bold uppercase tracking-wider">Payments</TabsTrigger>
                <TabsTrigger value="debitNote" className="rounded-full text-[9px] font-bold uppercase tracking-wider">Debit Notes</TabsTrigger>
                <TabsTrigger value="creditNote" className="rounded-full text-[9px] font-bold uppercase tracking-wider">Credit Notes</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
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
                    {importType === 'invoices' ? <ReceiptText className="w-4 h-4 text-primary" /> : importType === 'payments' ? <CreditCard className="w-4 h-4 text-primary" /> : importType === 'debitNote' ? <AlertTriangle className="w-4 h-4 text-primary" /> : <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  {importType === 'invoices' ? 'Purchase Sync' : importType === 'payments' ? 'Payment Sync' : importType === 'debitNote' ? 'Debit Note Sync' : 'Credit Note Sync'}
                </CardTitle>
                <CardDescription className="text-xs">Configure where and how data is synced.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Branch */}
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Destination Branch</Label>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={currentStep !== 'upload'}>
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

                {/* Audit Context (Hidden in initial upload step unless file exists) */}
                {(currentStep === 'verify' || currentStep === 'commit') && (
                  <div className="space-y-4 pt-2 border-t border-slate-50 animate-in fade-in duration-500">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Accounting Period</Label>
                      <Input 
                        placeholder="e.g. April 2024" 
                        value={accountingPeriod}
                        onChange={e => setAccountingPeriod(e.target.value)}
                        className="h-11 bg-slate-50 border-none rounded-2xl px-4 text-sm font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Batch Memo / Reference</Label>
                      <Input 
                        placeholder="e.g. Final Audit Export" 
                        value={batchMemo}
                        onChange={e => setBatchMemo(e.target.value)}
                        className="h-11 bg-slate-50 border-none rounded-2xl px-4 text-sm font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* File Drop Zone (Only in upload step) */}
                {currentStep === 'upload' && (
                  <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center bg-slate-50/50 hover:bg-slate-50 transition-all group relative overflow-hidden">
                    <div className="relative z-10">
                      <FileSpreadsheet className="w-12 h-12 text-primary mx-auto mb-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
                      <Input type="file" id="file-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild className="rounded-full px-6 border-slate-200 bg-white shadow-sm">
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
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col gap-3">
                  {currentStep === 'upload' && (
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 shadow-lg shadow-primary/20 rounded-full h-11 text-xs font-bold uppercase tracking-wider"
                        disabled={!file || uploading || !selectedBranchId}
                        onClick={runAnalyzer}
                      >
                        <SearchCode className="w-4 h-4 mr-2" /> Start Analysis
                      </Button>
                      <Button variant="ghost" size="icon" onClick={downloadTemplate} className="rounded-full w-11 h-11 bg-slate-100 hover:bg-slate-200" title="Download Template">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {currentStep !== 'upload' && (
                    <Button
                      variant="outline"
                      className="rounded-full h-11 text-xs font-bold uppercase tracking-wider border-slate-200"
                      onClick={() => {
                        if (confirm('Return to file selection? Current mapping will be kept.')) {
                          setCurrentStep('upload');
                        }
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Source
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File Insights Card */}
            {fileMetadata && (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">File Insights</p>
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Rows Found</p>
                      <p className="text-lg font-black text-slate-900">{fileMetadata.rowCount}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Columns</p>
                      <p className="text-lg font-black text-slate-900">{fileMetadata.unmappedCols}</p>
                    </div>
                  </div>
                  {fileMetadata.minDate && fileMetadata.maxDate && (
                    <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                      <p className="text-[9px] font-bold text-blue-500 uppercase mb-1">Detected Period</p>
                      <p className="text-[11px] font-black text-blue-700">
                        {format(fileMetadata.minDate, 'dd MMM yyyy')} — {format(fileMetadata.maxDate, 'dd MMM yyyy')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Alert className="bg-slate-900 border-none text-white rounded-[2rem] p-6">
              <Info className="h-5 w-5 text-blue-400" />
              <AlertTitle className="text-sm font-bold text-blue-400">Step Guidance</AlertTitle>
              <AlertDescription className="text-xs opacity-70 leading-relaxed mt-2 italic">
                {currentStep === 'upload' && "Upload your Excel file to begin the analysis. We'll automatically scan for dates and total volumes."}
                {currentStep === 'mapping' && "Tell us which columns in your file represent the Invoice No, Date, Party, and Amount."}
                {currentStep === 'verify' && "Review the detected transactions. Any duplicate or invalid rows will be automatically flagged for your attention."}
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
                  {/* Mixed Mode Info */}
                  {isMixedMode && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-bold text-blue-700">Mixed Voucher Mode Detected</p>
                      </div>
                      <p className="text-[11px] text-blue-600">File contains "{vchTypeColumn}" column with multiple voucher types (Purchases & Debit Notes). Only essential columns need to be mapped.</p>
                    </div>
                  )}
                  
                  {/* Mapping Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {isMixedMode ? (
                      // Mixed mode: show all Tally columns
                      SYSTEM_COLUMNS['mixed'].map((sysCol) => (
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
                              {fileHeaders.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400">File Columns ({fileHeaders.length})</div>
                                  {fileHeaders.map(header => (
                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                  ))}
                                  {SYSTEM_COLUMNS['mixed'].some(col => !fileHeaders.includes(col.label)) && (
                                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400">Available Fields</div>
                                  )}
                                </>
                              )}
                              {SYSTEM_COLUMNS['mixed'].map(col => (
                                <SelectItem key={col.key} value={col.label} className="italic text-slate-500">
                                  {col.label} {fileHeaders.includes(col.label) ? '' : '(not in file)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))
                    ) : (
                      // Regular mode: show all columns for selected type
                      SYSTEM_COLUMNS[importType].map((sysCol) => (
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
                              {fileHeaders.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400">File Columns ({fileHeaders.length})</div>
                                  {fileHeaders.map(header => (
                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                  ))}
                                  {SYSTEM_COLUMNS[importType].some(col => !fileHeaders.includes(col.label)) && (
                                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400">Available Fields</div>
                                  )}
                                </>
                              )}
                              {SYSTEM_COLUMNS[importType].map(col => (
                                <SelectItem key={col.key} value={col.label} className="italic text-slate-500">
                                  {col.label} {fileHeaders.includes(col.label) ? '' : '(not in file)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Invoice Date Fallback Option (for invoice/DN/CN types) */}
                  {(importType === 'invoices' || importType === 'debitNote' || importType === 'creditNote' || isMixedMode) && !mappingState['date'] && (
                    <div className="border-l-4 border-amber-400 bg-amber-50/80 p-5 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-xs font-bold text-amber-800">Date Column Not Mapped</p>
                      </div>
                      <p className="text-xs text-amber-700">Since you haven't mapped a date column, set a default date for all records in this batch:</p>
                      <div className="flex items-center gap-3">
                        <Input
                          type="date"
                          value={fallbackDate}
                          onChange={(e) => setFallbackDate(e.target.value)}
                          className="flex-1 h-10 rounded-xl border-amber-200 bg-white"
                        />
                        {fallbackDate && (
                          <Badge className="bg-green-100 text-green-700 border-none text-xs font-bold">
                            {format(new Date(fallbackDate), 'MMM d, yyyy')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

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
                    <Button variant="outline" size="sm" onClick={() => { setPreviewData([]); setCurrentStep('upload'); }} className="rounded-full text-slate-600 hover:text-blue-600 bg-white border-slate-200">
                      <RotateCcw className="w-3.5 h-3.5 mr-2" /> Resync
                    </Button>
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
                  <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                    <Table className="w-full">
                      <TableHeader className="bg-slate-100 sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="min-w-[80px] text-[9px] font-bold uppercase tracking-wide py-2 px-3">Date</TableHead>
                          <TableHead className="min-w-[150px] text-[9px] font-bold uppercase tracking-wide py-2 px-3">Particulars</TableHead>
                          <TableHead className="min-w-[60px] text-[9px] font-bold uppercase tracking-wide py-2 px-3 text-center">Type</TableHead>
                          <TableHead className="min-w-[150px] text-[9px] font-bold uppercase tracking-wide py-2 px-3">Vch No.</TableHead>
                          <TableHead className="min-w-[100px] text-[9px] font-bold uppercase tracking-wide py-2 px-3 text-right">Debit</TableHead>
                          {isMixedMode && (
                            <TableHead className="min-w-[100px] text-[9px] font-bold uppercase tracking-wide py-2 px-3 text-right">Credit</TableHead>
                          )}
                          <TableHead className="min-w-[70px] text-[9px] font-bold uppercase tracking-wide py-2 px-3 text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row: ParsedRow) => (
                          <TableRow
                            key={row.id}
                            className={`${
                              row.isSkipped
                                ? 'bg-red-50'
                                : row.isUnregistered
                                ? 'bg-blue-50'
                                : 'hover:bg-slate-50'
                            } border-b border-slate-100 transition-colors`}
                          >
                            <TableCell className="text-[10px] font-semibold text-slate-700 py-1.5 px-3 whitespace-nowrap">
                              {row.date}
                            </TableCell>
                            <TableCell className="text-[10px] font-bold text-slate-900 py-1.5 px-3 truncate">
                              {row.supplierName}
                            </TableCell>
                            <TableCell className="text-[8px] font-bold py-1.5 px-3 text-center">
                              {row.voucherType === 'invoices' ? (
                                <Badge className="bg-blue-100 text-blue-700 border-0 text-[8px]">PUR</Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-[8px]">DN</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] font-semibold text-slate-700 py-1.5 px-3">
                              {row.refNumber}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] font-bold text-slate-900 py-1.5 px-3">
                              {row.amount.toFixed(2)}
                            </TableCell>
                            {isMixedMode && (
                              <TableCell className="text-right font-mono text-[10px] font-bold text-slate-700 py-1.5 px-3">
                                {row.creditAmount !== undefined ? row.creditAmount.toFixed(2) : '—'}
                              </TableCell>
                            )}
                            <TableCell className="text-center py-1.5 px-3">
                              {row.isSkipped ? (
                                <Badge className="text-[7px] font-bold px-1.5 py-0 bg-red-100 text-red-700 border-0">
                                  SKIP
                                </Badge>
                              ) : row.isUnregistered ? (
                                <Badge className="text-[7px] font-bold px-1.5 py-0 bg-blue-100 text-blue-700 border-0">
                                  NEW
                                </Badge>
                              ) : (
                                <Badge className="text-[7px] font-bold px-1.5 py-0 bg-green-100 text-green-700 border-0">
                                  OK
                                </Badge>
                              )}
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
