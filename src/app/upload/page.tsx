'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  MapPin,
  RefreshCw,
  SearchCode,
  Loader2
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs, orderBy, doc, writeBatch } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, format, isBefore, parse, isValid as isValidDate } from 'date-fns';
import * as XLSX from 'xlsx';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useUserRole } from '@/hooks/use-user-role';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface ParsedRow {
  id: string;
  refNumber: string;
  date: string;
  supplierName: string;
  amount: number;
  creditDays?: number;
  dueDate?: string;
  isUnregistered: boolean;
  isValid: boolean;
  error?: string;
}

const SYSTEM_COLUMNS = {
  invoices: [
    { key: 'refNumber', label: 'Invoice No', required: true, icons: <ReceiptText className="w-3 h-3" /> },
    { key: 'date', label: 'Invoice Date', required: true, icons: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Supplier/Party', required: true, icons: <UserPlus className="w-3 h-3" /> },
    { key: 'amount', label: 'Bill Amount', required: true, icons: <CreditCard className="w-3 h-3" /> },
    { key: 'creditDays', label: 'Credit Days', required: false, icons: <RefreshCw className="w-3 h-3" /> },
  ],
  payments: [
    { key: 'refNumber', label: 'Ref Number', required: true, icons: <ReceiptText className="w-3 h-3" /> },
    { key: 'date', label: 'Payment Date', required: true, icons: <FileUp className="w-3 h-3" /> },
    { key: 'supplierName', label: 'Party Name', required: true, icons: <UserPlus className="w-3 h-3" /> },
    { key: 'amount', label: 'Amount Paid', required: true, icons: <CreditCard className="w-3 h-3" /> },
  ]
};

const DEFAULT_HEURISTICS = {
  refNumber: ['invoice number', 'inv no', 'bill no', 'ref no', 'vouch', 'bill', 'number'],
  date: ['invoice date', 'dated', 'inv date', 'date', 'dt'],
  supplierName: ['party nme', 'party name', 'supplier', 'name', 'vendor', 'account'],
  amount: ['invoice value', 'amount', 'balance', 'total', 'amt', 'val'],
  creditDays: ['credit period', 'credit days', 'terms', 'period', 'limit']
};

export default function UploadPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [summary, setSummary] = useState({ total: 0, imported: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [autoCreateSuppliers, setAutoCreateSuppliers] = useState(true);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [importType, setImportType] = useState<'invoices' | 'payments'>('invoices');
  const [mappingState, setMappingState] = useState<Record<string, string>>({});
  const [isMappingMode, setIsMappingMode] = useState(false);

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

  // Auto-Mapping Heuristic
  useEffect(() => {
    if (fileHeaders.length > 0) {
      const newMapping: Record<string, string> = {};
      const currentSystemCols = SYSTEM_COLUMNS[importType];
      const heuristicsMap = DEFAULT_HEURISTICS as Record<string, string[]>;
      
      currentSystemCols.forEach(sysCol => {
        const heuristics = heuristicsMap[sysCol.key] || [];
        const match = fileHeaders.find(h => 
          heuristics.some((heuristic: string) => h.toLowerCase().includes(heuristic.toLowerCase()))
        );
        if (match) newMapping[sysCol.key] = match;
      });
      setMappingState(newMapping);
    }
  }, [fileHeaders, importType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;

    setFile(selectedFile);
    setSuccess(false);
    setError(null);
    setPreviewData([]);
    setIsMappingMode(false);
    
    // Quick parse to get headers
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
          const headers = data[0].filter(h => h && h.toString().trim() !== '');
          setFileHeaders(headers.map(h => h.toString()));
          // Full data for later
          const fullData = XLSX.utils.sheet_to_json(ws) as any[];
          setFileData(fullData);
        }
      } catch (err) {
        setError('Could not read headers from file.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const runAnalyzer = () => {
    if (!file || fileData.length === 0) {
      setError('Please upload a valid file first.');
      return;
    }
    setIsMappingMode(true);
  };

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
    
    // Excel date number
    if (typeof val === 'number') {
      const date = XLSX.SSF.parse_date_code(val);
      return new Date(date.y, date.m - 1, date.d);
    }

    const str = val.toString().trim();
    let date = new Date(str);
    if (isValidDate(date)) return date;

    const formats = ['dd-MM-yyyy', 'dd/MM/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd'];
    for (const f of formats) {
      try {
        date = parse(str, f, new Date());
        if (isValidDate(date)) return date;
      } catch {}
    }
    return new Date();
  };

  const processMapping = () => {
    const required = SYSTEM_COLUMNS[importType].filter(c => c.required);
    const missing = required.filter(c => !mappingState[c.key]);

    if (missing.length > 0) {
      setError(`Please map the following required columns: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setError(null);
    const parsed: ParsedRow[] = [];
    const today = new Date();

    fileData.forEach((row, idx) => {
      const refNo = row[mappingState['refNumber']];
      const dateVal = row[mappingState['date']];
      const supplierName = row[mappingState['supplierName']];
      const amount = cleanNumeric(row[mappingState['amount']]);
      const creditDays = mappingState['creditDays'] ? parseInt(row[mappingState['creditDays']]) : 30;

      if (!refNo || !supplierName || isNaN(amount)) return;

      const dateObj = parseDate(dateVal);
      const supplier = suppliers?.find(s => s.name.toLowerCase().trim() === supplierName.toString().trim().toLowerCase());
      const dueDate = importType === 'invoices' ? addDays(dateObj, creditDays || 30) : null;

      parsed.push({
        id: `row-${idx}`,
        refNumber: refNo.toString().trim(),
        date: format(dateObj, 'yyyy-MM-dd'),
        supplierName: supplierName.toString().trim(),
        amount,
        creditDays: importType === 'invoices' ? (creditDays || 30) : undefined,
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        isUnregistered: !supplier,
        isValid: true
      });
    });

    setPreviewData(parsed);
    setIsMappingMode(false);
  };

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
        const newBalance = balance - paymentToApply;
        updateDocumentNonBlocking(docSnap.ref, {
          remainingBalance: newBalance,
          status: newBalance <= 0 ? 'Paid' : 'Partially Paid'
        });

        addDocumentNonBlocking(collection(firestore, 'invoiceAllocations'), {
          paymentId,
          invoiceId: docSnap.id,
          amountApplied: paymentToApply,
          allocatedAt: serverTimestamp(),
          branchId
        });
        remaining -= paymentToApply;
      }
    }
  };

  const commitImport = async () => {
    if (!firestore || !user || previewData.length === 0 || !selectedBranchId) return;

    setUploading(true);
    setProgress(0);
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < previewData.length; i++) {
      const row = previewData[i];
      let supplierId = '';

      const existingSupplier = suppliers?.find(s => s.name.toLowerCase().trim() === row.supplierName.toLowerCase().trim());
      
      if (!existingSupplier && autoCreateSuppliers) {
        try {
          const newSupDoc = await addDoc(collection(firestore, 'suppliers'), {
            name: row.supplierName,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            status: 'active',
            defaultCreditDays: row.creditDays || 30
          });
          supplierId = newSupDoc.id;
        } catch (e) {
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
            supplierId: supplierId,
            branchId: selectedBranchId,
            date: row.date,
            dueDate: row.dueDate,
            totalAmount: row.amount,
            paidAmount: 0,
            status: 'unpaid',
            createdAt: new Date().toISOString()
          });
        } else {
          await addDocumentNonBlocking(collection(firestore, 'payments'), {
            paymentNumber: row.refNumber,
            supplierId: supplierId,
            branchId: selectedBranchId,
            date: row.date,
            amount: row.amount,
            method: 'Bank Transfer',
            reference: 'Imported',
            createdAt: new Date().toISOString()
          });
        }
        imported++;
      } else {
        skipped++;
      }
    }

    setSummary({ total: previewData.length, imported, skipped });
    setSuccess(true);
    setUploading(false);
    setPreviewData([]);
  };

  const downloadTemplate = () => {
    const headers = importType === 'invoices' 
      ? [['Invoice Number', 'Date', 'Supplier Name', 'Amount', 'Credit Days']]
      : [['Reference Number', 'Date', 'Supplier Name', 'Amount Paid']];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `DuesFlow_${importType === 'invoices' ? 'Invoice' : 'Payment'}_Import_Template.xlsx`);
  };

  if (isRoleLoading) return <div className="p-8 h-screen flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="mt-4 text-slate-500 font-medium">Validating Permissions...</p></div>;
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

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Sync Accounting Center</h2>
        <div className="ml-auto flex items-center gap-2">
          <Tabs defaultValue="invoices" value={importType} onValueChange={(v: any) => {
            setImportType(v);
            setFileData([]);
            setFileHeaders([]);
            setPreviewData([]);
            setMappingState({});
            setFile(null);
            setSuccess(false);
          }} className="w-[300px]" key={importType}>
            <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100/50 p-1 rounded-full">
              <TabsTrigger value="invoices" className="rounded-full text-[10px] font-bold uppercase tracking-wider">Purchases</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-full text-[10px] font-bold uppercase tracking-wider">Payments</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 bg-slate-50/40">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto w-full">
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

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary" /> Auto-register Parties
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Add unknown suppliers to master</p>
                  </div>
                  <Switch checked={autoCreateSuppliers} onCheckedChange={setAutoCreateSuppliers} />
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center bg-slate-50/50 hover:bg-slate-50 transition-all group relative overflow-hidden">
                  <div className="relative z-10">
                    <FileSpreadsheet className="w-12 h-12 text-primary mx-auto mb-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
                    <Input type="file" id="file-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild className="rounded-full px-6 border-slate-200 bg-white"><span>{file ? 'Change Dataset' : 'Drop File Here'}</span></Button>
                    </Label>
                    {file && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                         <div className="bg-green-100 text-green-700 p-1.5 rounded-full"><CheckCircle2 className="w-3 h-3" /></div>
                         <p className="text-[11px] font-bold text-slate-600 truncate max-w-[150px]">{file.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 shadow-lg shadow-primary/20 rounded-full h-11 text-xs font-bold uppercase tracking-wider" 
                      disabled={!file || uploading || !selectedBranchId} 
                      onClick={runAnalyzer}
                    >
                      <SearchCode className="w-4 h-4 mr-2" /> Run Analyzer
                    </Button>
                    <Button variant="ghost" size="icon" onClick={downloadTemplate} className="rounded-full w-11 h-11 bg-slate-100 hover:bg-slate-200" title="Template">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {!file && !uploading && (
                    <Button 
                      variant="link" 
                      className="text-[10px] h-auto p-0 font-bold text-primary/60 hover:text-primary transition-colors"
                      onClick={() => {
                        const sampleData = importType === 'invoices' ? [
                          ['PO Date', 'PO Ref.No', 'Party Nme', 'Invoice Date', 'Invoice Number', 'Invoice Value', 'Credit Period'],
                          ['01-01-26', 'PO-101', 'ABBAR & SONS FOOD CO.LTD', '03-05-26', 'INV-9901', '24840.00', '30'],
                          ['01-05-26', 'PO-102', 'ADEL M AL-ALI TRADING EST', '01-13-26', 'INV-9902', '3047.50', '90'],
                          ['01-10-26', 'PO-103', 'AFIA INTERNATIONAL', '03-18-26', 'INV-9903', '185545.80', '45'],
                          ['01-15-26', 'PO-104', 'AL ETIHAD NATIONAL TRADING LLC', '01-06-26', 'INV-9904', '14490.00', '60'],
                        ] : [
                          ['Payment Ref', 'Payment Date', 'Party Nme', 'Amount Paid'],
                          ['PAY-001', '04-15-2026', 'ABBAR & SONS FOOD CO.LTD', '10000.00'],
                          ['PAY-002', '04-20-2026', 'AFIA INTERNATIONAL', '50000.00'],
                        ];
                        
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.aoa_to_sheet(sampleData);
                        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
                        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
                        
                        const s2ab = (s: string) => {
                          const buf = new ArrayBuffer(s.length);
                          const view = new Uint8Array(buf);
                          for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
                          return buf;
                        };
                        
                        const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
                        const fakeFile = new File([blob], `DuesFlow_Sample_${importType}_Export.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                        
                        const event = { target: { files: [fakeFile] } } as any;
                        handleFileChange(event);
                      }}
                    >
                      Click here to generate & auto-load a sample dataset for testing
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Alert className="bg-slate-900 border-none text-white rounded-[2rem] p-6">
              <Info className="h-5 w-5 text-blue-400" />
              <AlertTitle className="text-sm font-bold text-blue-400">Intelligent FIFO</AlertTitle>
              <AlertDescription className="text-xs opacity-70 leading-relaxed mt-2 italic">
                Our analyzer automatically links payments to your oldest outstanding bills first, keeping your aging reports accurate.
              </AlertDescription>
            </Alert>
          </div>

          <div className="lg:col-span-8">
            {isMappingMode ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-[2.5rem] animate-in fade-in slide-in-from-right-4 duration-500">
                <CardHeader className="bg-slate-50/50 border-b pb-6 px-8 pt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-2xl">
                        <RefreshCw className="w-6 h-6 text-primary animate-spin-slow" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Map Source Columns</CardTitle>
                        <CardDescription>Targeting {fileHeaders.length} headers found in "{file?.name}"</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsMappingMode(false)} className="rounded-full bg-white">Cancel</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {SYSTEM_COLUMNS[importType].map((sysCol) => (
                      <div key={sysCol.key} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                            {sysCol.icons} {sysCol.label} {sysCol.required && <span className="text-red-500">*</span>}
                          </Label>
                          {mappingState[sysCol.key] && (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-100 text-[9px] uppercase">Auto-Linked</Badge>
                          )}
                        </div>
                        <Select 
                          value={mappingState[sysCol.key] || ''} 
                          onValueChange={(val) => setMappingState(prev => ({ ...prev, [sysCol.key]: val }))}
                        >
                          <SelectTrigger className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-medium">
                            <SelectValue placeholder={`Select field for ${sysCol.label}`} />
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

                  <div className="pt-8 border-t flex flex-col items-center">
                    <Button onClick={processMapping} className="w-full max-w-sm h-12 rounded-full font-bold shadow-xl shadow-primary/30">
                      Generate View & Verify
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-4 text-center">
                      Analyzer will validate row formats and cross-reference party names.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : previewData.length > 0 ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 pb-6 bg-slate-50/50 border-b px-8 pt-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-2xl">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Verification Table</CardTitle>
                      <CardDescription>Verified {previewData.length} entries for "{branches?.find(b => b.id === selectedBranchId)?.name}"</CardDescription>
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
                  <div className="max-h-[600px] overflow-auto custom-scrollbar">
                    <Table>
                      <TableHeader className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10">
                        <TableRow className="hover:bg-transparent border-b-slate-100">
                          <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-widest py-5 pl-8">Ref/Inv Identity</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Party Reconciliation</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-5">Amount</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-5 px-8">{importType === 'invoices' ? 'Due Window' : 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row: ParsedRow) => (
                          <TableRow key={row.id} className={`${row.isUnregistered ? "bg-amber-50/30" : ""} hover:bg-slate-50/50 transition-colors border-b-slate-50`}>
                            <TableCell className="font-mono text-[11px] text-slate-500 font-bold pl-8 py-5 tracking-tight">{row.refNumber}</TableCell>
                            <TableCell className="py-5">
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] font-bold text-slate-800">{row.supplierName}</span>
                                {row.isUnregistered && (
                                  <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${autoCreateSuppliers ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                    {autoCreateSuppliers ? 'New Party' : 'Missing'}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-black text-[13px] py-5">
                              {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center text-[11px] font-bold text-slate-500 py-5 pr-8">
                               <div className="flex flex-col items-center">
                                  <span>{importType === 'invoices' ? row.dueDate : row.date}</span>
                                  {importType === 'invoices' && <span className="text-[9px] opacity-50 uppercase tracking-tighter mt-0.5">{row.creditDays} Day Term</span>}
                               </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : success ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 flex flex-col items-center justify-center py-24 text-center rounded-[2.5rem] animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center mb-8 ring-[12px] ring-green-500/5 transition-all animate-in zoom-in duration-700">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <CardTitle className="text-3xl font-headline font-black text-slate-900">Sync Pipeline Complete</CardTitle>
                <div className="max-w-md mt-6 space-y-4 px-8">
                   <p className="text-slate-600 leading-relaxed font-medium">
                    Successfully reconciled and imported <span className="text-primary font-black px-1.5 py-0.5 bg-primary/5 rounded">{summary.imported}</span> records into your ledger.
                   </p>
                   {summary.skipped > 0 && (
                     <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl text-xs font-bold border border-amber-100">
                        <AlertTriangle className="w-4 h-4" /> {summary.skipped} records skipped (identity resolution failed)
                     </div>
                   )}
                </div>
                <Button variant="outline" className="mt-12 rounded-full px-12 h-11 border-slate-200 font-bold hover:bg-slate-50" onClick={() => setSuccess(false)}>Re-run Import System</Button>
              </Card>
            ) : file ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-slate-50/30 text-slate-400 group hover:border-primary/20 transition-all duration-500 hover:bg-white shadow-inner animate-in fade-in">
                <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 mb-8 transform group-hover:scale-110 transition-transform duration-500 ring-1 ring-slate-100">
                  <SearchCode className="w-12 h-12 text-primary animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-slate-700 tracking-tight">Dataset Staged: {file.name}</h3>
                <p className="text-xs mt-3 opacity-60 max-w-[280px] text-center leading-relaxed font-medium">
                  Financial data detected. Click the <strong>"Run Analyzer"</strong> button on the left to initialize the synchronization pipeline.
                </p>
                <div className="mt-8">
                  <Button onClick={runAnalyzer} className="rounded-full px-8 shadow-lg shadow-primary/20 bg-primary/90 hover:bg-primary font-bold">
                    Begin Analysis Now
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-slate-50/30 text-slate-400 group hover:border-primary/20 transition-all duration-500 hover:bg-white shadow-inner">
                <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 mb-8 transform group-hover:rotate-6 transition-transform duration-500 ring-1 ring-slate-100">
                  <FileUp className="w-12 h-12 text-primary opacity-20" />
                </div>
                <h3 className="text-lg font-black text-slate-700 tracking-tight">Financial Dataset Required</h3>
                <p className="text-xs mt-3 opacity-60 max-w-[280px] text-center leading-relaxed font-medium">
                  Initialize the sync pipeline by uploading your ledger export. Analyzer will map your columns and verify party identities.
                </p>
              </div>
            )}
            
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
                   <div 
                    className="h-full bg-primary transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }}
                   />
                </div>
              </div>
            )}
            
            {error && (
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
