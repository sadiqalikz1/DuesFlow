
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CreditCard, Info, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default function PaymentsPage() {
  const { firestore } = useFirestore();
  const { user } = useUser();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const pendingInvoicesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedSupplierId) return null;
    return query(
      collection(firestore, 'invoices'), 
      where('supplierId', '==', selectedSupplierId),
      where('status', 'in', ['Pending', 'Partially Paid', 'Overdue']),
      orderBy('dueDate', 'asc')
    );
  }, [firestore, selectedSupplierId]);
  const { data: invoices } = useCollection(pendingInvoicesQuery);

  const fifoDistribution = useMemo(() => {
    if (!invoices || !amount || isNaN(parseFloat(amount))) return [];
    
    let remainingPayment = parseFloat(amount);
    const distribution = [];
    
    for (const inv of invoices) {
      if (remainingPayment <= 0) break;
      
      const balance = inv.remainingBalance || 0;
      const paymentToApply = Math.min(balance, remainingPayment);
      
      if (paymentToApply > 0) {
        distribution.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          dueDate: inv.dueDate,
          pending: balance,
          allocation: paymentToApply
        });
        remainingPayment -= paymentToApply;
      }
    }
    return distribution;
  }, [invoices, amount]);

  const handleProcess = () => {
    if (!user || !selectedSupplierId || !amount || fifoDistribution.length === 0 || !firestore) return;
    
    setProcessing(true);
    
    // 1. Record the Payment
    const paymentData = {
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      amountPaid: parseFloat(amount),
      paymentMethod: 'Bank Transfer',
      referenceNumber: reference,
      paidByUserId: user.uid,
      createdAt: serverTimestamp(),
      branchId: invoices?.[0]?.branchId || 'unknown'
    };

    addDocumentNonBlocking(collection(firestore, 'payments'), paymentData)
      .then((paymentRef) => {
        // 2. Apply FIFO allocations to invoices
        fifoDistribution.forEach(dist => {
          const invRef = doc(firestore, 'invoices', dist.invoiceId);
          const newBalance = dist.pending - dist.allocation;
          
          updateDocumentNonBlocking(invRef, {
            remainingBalance: newBalance,
            status: newBalance <= 0 ? 'Paid' : 'Partially Paid'
          });

          addDocumentNonBlocking(collection(firestore, 'invoiceAllocations'), {
            paymentId: paymentRef?.id,
            invoiceId: dist.invoiceId,
            amountApplied: dist.allocation,
            allocatedAt: serverTimestamp(),
            branchId: invoices?.[0]?.branchId || 'unknown'
          });
        });

        setProcessing(false);
        setSuccess(true);
        setAmount('');
        setReference('');
        setTimeout(() => setSuccess(false), 3000);
      });
  };

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight">Log Payment</h2>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-muted-foreground">Apply payments to pending invoices using First In, First Out (FIFO) logic.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Payment Entry</CardTitle>
              <CardDescription>Specify supplier and amount to distribute</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="w-full bg-slate-50">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map(s => (
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
                <Input 
                  placeholder="UTR # / Cheque #" 
                  className="bg-slate-50" 
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
              </div>

              <Button 
                className="w-full bg-primary" 
                onClick={handleProcess}
                disabled={processing || !amount || !selectedSupplierId}
              >
                {processing ? 'Processing FIFO...' : 'Process Payment'}
              </Button>

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-xs font-bold border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Payment Distributed and Recorded.
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
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold min-w-[100px]">Invoice</TableHead>
                      <TableHead className="font-bold min-w-[100px]">Due Date</TableHead>
                      <TableHead className="font-bold text-right min-w-[100px]">Pending</TableHead>
                      <TableHead className="font-bold text-right min-w-[100px]">Allocation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fifoDistribution.length > 0 ? (
                      fifoDistribution.map((dist, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{dist.invoiceNumber}</TableCell>
                          <TableCell>{dist.dueDate}</TableCell>
                          <TableCell className="text-right">₹{dist.pending.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600 font-bold">₹{dist.allocation.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm italic">
                          {selectedSupplierId ? 'No pending invoices for this supplier.' : 'Select a supplier to see outstanding invoices.'}
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
                    DuesFlow ensures the oldest dues are cleared first to minimize interest penalties. 
                    Any excess amount is automatically pushed to the next oldest entry until the full payment is utilized.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
