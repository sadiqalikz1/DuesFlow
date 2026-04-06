
"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  FileSpreadsheet
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirestore, useUser, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, format, isBefore, parse } from 'date-fns';
import * as XLSX from 'xlsx';

export default function UploadPage() {
  const { firestore } = useFirestore();
  const { user } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [summary, setSummary] = useState({ total: 0, imported: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [unregisteredSuppliers, setUnregisteredSuppliers] = useState<string[]>([]);

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
    const headers = [['Invoice Number', 'Date (YYYY-MM-DD)', 'Supplier Name', 'Amount', 'Credit Days']];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Tally_Import_Template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setSuccess(false);
    setError(null);
    setUnregisteredSuppliers([]);
    setSummary({ total: 0, imported: 0, skipped: 0 });
  };

  const handleUpload = async () => {
    if (!file || !selectedBranchId || !user || !firestore || !suppliers) return;
    
    setUploading(true);
    setSuccess(false);
    setError(null);
    setProgress(5);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) {
          throw new Error('The file is empty or formatted incorrectly.');
        }

        setProgress(20);
        const unregistered: string[] = [];
        const today = new Date();
        let importedCount = 0;
        let skippedCount = 0;

        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          // Robust column mapping for various Tally exports
          const invNo = row['Invoice Number'] || row['Voucher No'] || row['Ref No'] || row['Reference'];
          const invDateStr = row['Date (YYYY-MM-DD)'] || row['Date'] || row['Voucher Date'];
          const supplierName = row['Supplier Name'] || row['Particulars'] || row['Ledger Name'];
          const amount = parseFloat(row['Amount'] || row['Debit'] || row['Credit'] || row['Value']);
          const creditDays = parseInt(row['Credit Days'] || row['Credit Period'] || '30');

          if (!invNo || !supplierName || isNaN(amount)) {
            skippedCount++;
            continue;
          }

          const supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toString().toLowerCase());

          if (!supplier) {
            unregistered.push(supplierName.toString());
            skippedCount++;
          } else {
            // Attempt to parse date robustly
            let invDate = new Date(invDateStr);
            if (isNaN(invDate.getTime())) {
              // Try common Tally format DD-MM-YYYY
              try {
                invDate = parse(invDateStr, 'dd-MM-yyyy', new Date());
              } catch (e) {
                invDate = today; 
              }
            }

            const dueDate = addDays(invDate, creditDays);
            const status = isBefore(dueDate, today) ? 'Overdue' : 'Pending';

            addDocumentNonBlocking(collection(firestore, 'invoices'), {
              branchId: selectedBranchId,
              supplierId: supplier.id,
              invoiceNumber: invNo.toString(),
              invoiceDate: format(invDate, 'yyyy-MM-dd'),
              dueDate: format(dueDate, 'yyyy-MM-dd'),
              invoiceAmount: amount,
              creditDays: creditDays,
              remainingBalance: amount,
              status: status,
              isOpeningBalance: false,
              uploadedAt: serverTimestamp(),
              uploadedByUserId: user.uid
            });
            importedCount++;
          }
          setProgress(20 + Math.floor((index / rows.length) * 80));
        }

        if (unregistered.length > 0) {
          setUnregisteredSuppliers([...new Set(unregistered)]);
        }
        
        setSummary({ total: rows.length, imported: importedCount, skipped: skippedCount });
        setUploading(false);
        setSuccess(true);
        setProgress(100);
      } catch (err: any) {
        setError(err.message || 'Failed to parse file.');
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file.');
      setUploading(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">Import Purchase Data</h2>
          <p className="text-muted-foreground mt-1">Directly import extracted Tally reports for automated credit tracking.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Batch Upload Tool</CardTitle>
              <CardDescription>Upload .xlsx, .xls, or .csv files exported from your accounting software.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Destination Branch</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-full bg-slate-50">
                    <SelectValue placeholder="Which branch does this data belong to?" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="text-sm font-bold mb-1">Select Tally File</h4>
                  <p className="text-xs text-muted-foreground mb-6">Drop your file or click to browse</p>
                  <Input 
                    type="file" 
                    id="file-upload" 
                    accept=".xlsx, .xls, .csv"
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  <Label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Browse Files</span>
                    </Button>
                  </Label>
                  {file && <p className="mt-4 text-xs font-bold text-primary">{file.name}</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  className="flex-1 bg-primary" 
                  disabled={!file || uploading || !selectedBranchId}
                  onClick={handleUpload}
                >
                  {uploading ? 'Parsing & Saving...' : 'Process Import'}
                </Button>
                <Button variant="ghost" className="text-primary" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Get Template
                </Button>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Import Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}

              {success && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Import Complete</AlertTitle>
                  <AlertDescription>
                    {summary.imported} invoices added successfully. {summary.skipped} records skipped or requiring attention.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Import Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {unregisteredSuppliers.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>Unknown Suppliers Detected</AlertTitle>
                  <AlertDescription>
                    <p className="text-xs mb-2">The following suppliers are not in your master list. Please add them first:</p>
                    <div className="flex flex-wrap gap-1">
                      {unregisteredSuppliers.map((s, idx) => (
                        <span key={idx} className="text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200 font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Import Guidelines</CardTitle>
              <CardDescription>Tips for successful Tally synchronization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border">
                <div className="mt-1"><Info className="w-4 h-4 text-primary" /></div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900">Name Matching</h5>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ensure "Supplier Name" in your Excel exactly matches the names registered in DuesFlow. The system is case-insensitive but spaces and symbols must match.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border">
                <div className="mt-1"><Info className="w-4 h-4 text-primary" /></div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900">Date Formats</h5>
                  <p className="text-xs text-muted-foreground mt-1">
                    We support YYYY-MM-DD and DD-MM-YYYY formats. If the system can't read a date, it defaults to today's date for safety.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border">
                <div className="mt-1"><AlertCircle className="w-4 h-4 text-orange-500" /></div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900">Credit Control</h5>
                  <p className="text-xs text-muted-foreground mt-1">
                    If "Credit Days" is not provided in your sheet, DuesFlow defaults to 30 days or the supplier's specific default setting.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
