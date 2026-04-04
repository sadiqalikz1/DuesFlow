
"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SUPPLIERS } from '@/lib/mock-data';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CreditCard, History, Info, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PaymentsPage() {
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleProcess = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      setAmount('');
    }, 1500);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">Log Payment</h2>
          <p className="text-muted-foreground mt-1">Apply payments to pending invoices using First In, First Out (FIFO) logic.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Payment Entry</CardTitle>
              <CardDescription>Specify supplier and amount to distribute</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger className="w-full bg-slate-50">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIERS.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount (₹)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input placeholder="UTR # / Cheque #" className="bg-slate-50" />
              </div>

              <Button 
                className="w-full bg-primary" 
                onClick={handleProcess}
                disabled={processing || !amount || !selectedSupplier}
              >
                {processing ? 'Calculating FIFO Distribution...' : 'Process Payment'}
              </Button>

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-xs font-bold border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Payment Distributed successfully.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-headline">FIFO Distribution Preview</CardTitle>
                <CardDescription>Proposed allocation to oldest pending invoices</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold">Oldest Invoice</TableHead>
                      <TableHead className="font-bold">Due Date</TableHead>
                      <TableHead className="font-bold text-right">Pending</TableHead>
                      <TableHead className="font-bold text-right">Allocation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSupplier ? (
                      [1, 2, 3].map(i => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">INV/23-24/00{i}</TableCell>
                          <TableCell>1{i}-Jan-2024</TableCell>
                          <TableCell className="text-right">₹50,000</TableCell>
                          <TableCell className="text-right text-green-600 font-bold">₹{i === 1 ? '50,000' : '0'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm italic">
                          Select a supplier to see outstanding invoices.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="p-6 rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
              <div className="flex gap-4">
                <div className="p-2 bg-white/20 rounded-lg shrink-0 h-fit">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">How FIFO Works</h4>
                  <p className="text-xs opacity-90 leading-relaxed mt-2">
                    Our system ensures the oldest dues are cleared first to minimize interest penalties and maintain a healthy credit score. 
                    Any excess amount is automatically pushed to the next oldest entry until the full payment is utilized.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
