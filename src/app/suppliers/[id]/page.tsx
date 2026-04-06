
"use client";

import { use } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, ExternalLink, IndianRupee, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params);
  const { firestore } = useFirestore();

  // 1. Fetch Supplier Details
  const supplierRef = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return doc(firestore, 'suppliers', supplierId);
  }, [firestore, supplierId]);
  const { data: supplier, isLoading: supplierLoading } = useDoc(supplierRef);

  // 2. Fetch Invoices for this Supplier
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !supplierId) return null;
    return query(
      collection(firestore, 'invoices'), 
      where('supplierId', '==', supplierId),
      orderBy('dueDate', 'desc')
    );
  }, [firestore, supplierId]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesQuery);

  // 3. Aggregate Stats
  const stats = useMemoFirebase(() => {
    if (!invoices) return { total: 0, outstanding: 0, overdue: 0 };
    return invoices.reduce((acc, inv) => ({
      total: acc.total + inv.invoiceAmount,
      outstanding: acc.outstanding + (inv.remainingBalance || 0),
      overdue: acc.overdue + (inv.status === 'Overdue' ? inv.remainingBalance : 0)
    }), { total: 0, outstanding: 0, overdue: 0 });
  }, [invoices]);

  if (supplierLoading) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/suppliers">
              <Button variant="outline" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">
                {supplier?.name}
              </h2>
              <p className="text-muted-foreground mt-1">Vendor Ledger & Transaction History</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Statement
            </Button>
            <Link href="/payments">
              <Button className="bg-primary">Log Payment</Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Billing</p>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">₹{stats.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Outstanding Balance</p>
                <IndianRupee className="h-4 w-4 text-accent" />
              </div>
              <p className="text-2xl font-bold text-primary">₹{stats.outstanding.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white border-l-4 border-l-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-destructive uppercase tracking-wider">Overdue Amount</p>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-destructive">₹{stats.overdue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Purchase Register</CardTitle>
            <CardDescription>Detailed list of all invoices received from {supplier?.name}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50 border-t">
                <TableRow>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Invoice #</TableHead>
                  <TableHead className="font-bold">Due Date</TableHead>
                  <TableHead className="font-bold text-right">Original Amount</TableHead>
                  <TableHead className="font-bold text-right">Balance Due</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm">{inv.invoiceDate}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{inv.dueDate}</TableCell>
                    <TableCell className="text-right">₹{inv.invoiceAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-primary">₹{(inv.remainingBalance || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={inv.status === 'Overdue' ? 'destructive' : 'secondary'}
                        className="font-bold text-[10px] uppercase px-2"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!invoices || invoices.length === 0) && !invoicesLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                      No invoices found for this supplier.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
