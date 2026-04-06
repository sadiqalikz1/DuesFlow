
"use client";

import { useState, useMemo } from 'react';
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
  ReceiptText
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs, orderBy, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, format, isBefore, parse } from 'date-fns';
import * as XLSX from 'xlsx';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useUserRole } from '@/hooks/use-user-role';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
}

export default function UploadPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [summary, setSummary] = useState({ total: 0, imported: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [autoCreateSuppliers, setAutoCreateSuppliers] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [importType, setImportType] = useState<'invoices' | 'payments'>('invoices');

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

  const downloadTemplate = () => {
    const headers = importType === 'invoices' 
      ? [['Invoice Number', 'Date', 'Supplier Name', 'Amount', 'Credit Days']]
      : [['Reference Number', 'Date', 'Supplier Name', 'Amount Paid']];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `DuesFlow_${importType === 'invoices' ? 'Invoice' : 'Payment'}_Import_Template.xlsx`);
  };

  const cleanNumeric = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.-]/g, '');
      return parseFloat(cleaned);
    }
    return 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setSuccess(false);
    setError(null);
    setPreviewData([]);
    setSummary({ total: 0, imported: 0, skipped: 0 });
  };

  const parseFile = async () => {
    if (!file || !suppliers) return;
    
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) throw new Error('File is empty.');

        const parsed: ParsedRow[] = [];
        const today = new Date();

        rows.forEach((row, idx) => {
          // Header Mapping
          const refNo = row['Invoice Number'] || row['Reference Number'] || row['Voucher No'] || row['Ref No'] || row['Ref. No.'] || row['Reference'] || row['Bill No'] || row['Trans ID'];
          const dateStr = row['Date'] || row['Voucher Date'] || row['Invoice Date'] || row['Bill Date'] || row['Payment Date'];
          const supplierName = row['Supplier Name'] || row['Particulars'] || row['Ledger Name'] || row['Party Name'] || row['Vendor'];
          const amount = cleanNumeric(row['Amount'] || row['Value'] || row['Debit'] || row['Credit'] || row['Gross Amount'] || row['Amount Paid']);
          const creditDays = parseInt(row['Credit Days'] || row['Credit Period'] || '30');

          if (!refNo || !supplierName || isNaN(amount)) return;

          const supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toString().trim().toLowerCase());
          
          let dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) {
            try {
              dateObj = parse(dateStr.toString(), 'dd-MM-yyyy', new Date());
            } catch {
              dateObj = today;
            }
          }

          const dueDate = importType === 'invoices' ? addDays(dateObj, creditDays) : null;

          parsed.push({
            id: `row-${idx}`,
            refNumber: refNo.toString(),
            date: format(dateObj, 'yyyy-MM-dd'),
            supplierName: supplierName.toString().trim(),
            amount,
            creditDays: importType === 'invoices' ? creditDays : undefined,
            dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
            isUnregistered: !supplier,
            isValid: true
          });
        });

        setPreviewData(parsed);
        setUploading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to parse file.');
        setUploading(false);
      }
    };
    reader.readAsBinaryString(file);
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

      const existingSupplier = suppliers?.find(s => s.name.toLowerCase() === row.supplierName.toLowerCase());
      
      if (!existingSupplier && autoCreateSuppliers) {
        try {
          const newSupDoc = await addDoc(collection(firestore, 'suppliers'), {
            name: row.supplierName,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            status: 'active'
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
          const dueDate = new Date(row.dueDate!);
          const status = isBefore(dueDate, new Date()) ? 'Overdue' : 'Pending';

          addDocumentNonBlocking(collection(firestore, 'invoices'), {
            branchId: selectedBranchId,
            supplierId,
            invoiceNumber: row.refNumber,
            invoiceDate: row.date,
            dueDate: row.dueDate,
            invoiceAmount: row.amount,
            creditDays: row.creditDays,
            remainingBalance: row.amount,
            status,
            uploadedAt: serverTimestamp(),
            uploadedByUserId: user.uid
          });
        } else {
          // Payment Import
          const paymentRef = await addDoc(collection(firestore, 'payments'), {
            branchId: selectedBranchId,
            supplierId,
            referenceNumber: row.refNumber,
            paymentDate: row.date,
            amountPaid: row.amount,
            paymentMethod: 'Imported',
            paidByUserId: user.uid,
            createdAt: serverTimestamp()
          });

          // Apply FIFO
          await applyFIFO(supplierId, row.amount, paymentRef.id, selectedBranchId);
        }
        imported++;
      } else {
        skipped++;
      }
      setProgress(Math.round(((i + 1) / previewData.length) * 100));
    }

    setSummary({ total: previewData.length, imported, skipped });
    setSuccess(true);
    setUploading(false);
    setPreviewData([]);
  };

  if (isRoleLoading) return <div className="p-8"><Progress value={30} className="h-1" /></div>;
  if (!isAdmin) {
    return (
      <main className="p-8 flex items-center justify-center min-h-screen bg-slate-50">
        <Alert variant="destructive" className="max-w-md bg-white border-red-100 shadow-xl">
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
            setPreviewData([]);
            setSuccess(false);
          }}>
            <TabsList className="bg-slate-100/50 p-1">
              <TabsTrigger value="invoices" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ReceiptText className="w-3.5 h-3.5 mr-2" /> Purchases
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <CreditCard className="w-3.5 h-3.5 mr-2" /> Payments
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
              <div className="h-1 bg-primary" />
              <CardHeader>
                <CardTitle className="text-lg capitalize">{importType} Data Feed</CardTitle>
                <CardDescription>Upload exports from Tally, Busy, or Excel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination Branch</Label>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="bg-slate-50 border-none h-11 focus:ring-primary/20">
                      <SelectValue placeholder="Target Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Auto-register New Parties</Label>
                    <p className="text-[10px] text-muted-foreground">Add unknown suppliers on the fly</p>
                  </div>
                  <Switch checked={autoCreateSuppliers} onCheckedChange={setAutoCreateSuppliers} />
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center bg-slate-50/50 hover:bg-slate-50 transition-all group">
                  <FileSpreadsheet className="w-12 h-12 text-primary mx-auto mb-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  <Input type="file" id="file-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild className="rounded-full px-6"><span>{file ? 'Replace File' : 'Drop File Here'}</span></Button>
                  </Label>
                  {file && <p className="mt-3 text-[11px] font-bold text-primary truncate max-w-full px-4">{file.name}</p>}
                </div>

                <div className="pt-2 flex gap-3">
                  <Button 
                    className="flex-1 shadow-lg shadow-primary/10 rounded-full h-10" 
                    disabled={!file || uploading || !selectedBranchId} 
                    onClick={parseFile}
                  >
                    Run Analyzer
                  </Button>
                  <Button variant="ghost" size="icon" onClick={downloadTemplate} className="rounded-full w-10 h-10" title="Template">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Alert className="bg-slate-900 border-none text-white rounded-2xl">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertTitle className="text-xs font-bold text-blue-400">Smart Allocation</AlertTitle>
              <AlertDescription className="text-[11px] opacity-80 leading-relaxed mt-1">
                Imported payments will be distributed to outstanding bills using FIFO (First-In-First-Out) logic automatically.
              </AlertDescription>
            </Alert>
          </div>

          <div className="lg:col-span-8">
            {previewData.length > 0 ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-slate-50/50 border-b">
                  <div>
                    <CardTitle className="text-xl">Import Map</CardTitle>
                    <CardDescription>Verified {previewData.length} records ready for commit.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewData([])} className="rounded-full text-slate-600 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Reset
                    </Button>
                    <Button size="sm" onClick={commitImport} disabled={uploading} className="rounded-full px-6">
                      {uploading ? 'Processing...' : <><Save className="w-3.5 h-3.5 mr-2" /> Sync Records</>}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[650px] overflow-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[140px] text-xs font-bold uppercase tracking-wider py-4">Ref/Inv No</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Party Name</TableHead>
                          <TableHead className="text-right text-xs font-bold uppercase tracking-wider py-4">Amount</TableHead>
                          <TableHead className="text-center text-xs font-bold uppercase tracking-wider py-4">{importType === 'invoices' ? 'Maturity' : 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row: ParsedRow) => (
                          <TableRow key={row.id} className={row.isUnregistered ? "bg-amber-50/20" : "hover:bg-slate-50/50 transition-colors"}>
                            <TableCell className="font-mono text-[11px] text-slate-500 py-4">{row.refNumber}</TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800">{row.supplierName}</span>
                                {row.isUnregistered && (
                                  <span className="flex items-center text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                    {autoCreateSuppliers ? <UserPlus className="w-2.5 h-2.5 mr-1" /> : <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
                                    {autoCreateSuppliers ? 'Auto' : 'Missing'}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs py-4">
                              {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center text-[10px] text-slate-500 py-4">
                              {importType === 'invoices' ? row.dueDate : row.date}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : success ? (
              <Card className="border-none shadow-sm ring-1 ring-slate-100 flex flex-col items-center justify-center py-24 text-center rounded-2xl">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-500/5 transition-all animate-in zoom-in duration-500">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <CardTitle className="text-3xl font-headline font-bold text-slate-900">Sync Completed</CardTitle>
                <CardDescription className="max-w-md mt-4 text-slate-600 leading-relaxed px-8">
                  <span className="font-bold text-slate-900">{summary.imported}</span> transactions successfully merged into {importType}.
                  {summary.skipped > 0 && <p className="mt-2 text-amber-600 font-medium">{summary.skipped} records ignored due to identity gaps.</p>}
                </CardDescription>
                <Button variant="outline" className="mt-10 rounded-full px-10 border-slate-200" onClick={() => setSuccess(false)}>Import Another Batch</Button>
              </Card>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] bg-slate-50/30 text-slate-400 group hover:border-primary/20 transition-all hover:bg-slate-50/50">
                <div className="p-6 bg-white rounded-3xl shadow-sm mb-6 group-hover:scale-110 transition-transform">
                  <FileUp className="w-10 h-10 text-primary/40" />
                </div>
                <p className="text-sm font-bold text-slate-600">Waiting for Data Source</p>
                <p className="text-[11px] mt-2 opacity-60 max-w-[200px] text-center leading-relaxed">Select a file and click "Run Analyzer" to preview the {importType} before sync.</p>
              </div>
            )}
            
            {uploading && (
              <div className="mt-8 space-y-3 px-2">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span className="animate-pulse">Syncing Database...</span>
                  <span className="text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-slate-100 overflow-hidden" />
              </div>
            )}
            
            {error && (
              <Alert variant="destructive" className="mt-6 bg-red-50 border-red-100">
                <XCircle className="h-4 w-4" />
                <AlertTitle className="font-bold">Process Halted</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
