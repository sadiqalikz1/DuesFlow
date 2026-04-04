
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
  XCircle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorLog, setErrorLog] = useState<{row: number, msg: string}[]>([]);
  const [success, setSuccess] = useState(false);

  const handleUpload = () => {
    if (!file) return;
    
    setUploading(true);
    setSuccess(false);
    setErrorLog([]);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          setSuccess(true);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">Import Purchase Data</h2>
          <p className="text-muted-foreground mt-1">Upload Excel sheets from Tally for automated due date calculation.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">New Daily Purchases</CardTitle>
              <CardDescription>Supported format: .xlsx, .csv standard template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <FileUp className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="text-sm font-bold mb-1">Select Excel Template</h4>
                  <p className="text-xs text-muted-foreground mb-6">Drag and drop your extracted Tally report here</p>
                  <Input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <Label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Choose File</span>
                    </Button>
                  </Label>
                  {file && <p className="mt-4 text-xs font-bold text-primary">{file.name}</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  className="flex-1 bg-primary" 
                  disabled={!file || uploading}
                  onClick={handleUpload}
                >
                  {uploading ? 'Processing Batch...' : 'Import & Calculate Dues'}
                </Button>
                <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/5">
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Validating 245 Rows</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}

              {success && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    Processed 245 invoices successfully. Due dates updated using Credit Terms.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Validation Rules</CardTitle>
              <CardDescription>Ensuring data integrity during atomic batch writes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border">
                  <div className="mt-1">
                    <Info className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold">Automatic Due Calculation</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      System automatically reads "Credit Days" per row. If missing, it uses the Supplier's default defined in master settings.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border">
                  <div className="mt-1">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold">Unregistered Suppliers</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      New suppliers found in Excel will be flagged for review before the batch is committed.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border">
                  <div className="mt-1">
                    <XCircle className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold">Rollback Policy</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transactions are atomic. If even one row fails structural validation, the entire batch is rejected.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
