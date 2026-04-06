
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Search, Download, Filter } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'), orderBy('dueDate', 'desc'));
  }, [firestore]);
  const { data: invoices, isLoading } = useCollection(invoicesQuery);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'branches');
  }, [firestore]);
  const { data: branches } = useCollection(branchesQuery);

  const filteredInvoices = invoices?.filter(inv => {
    const supplier = suppliers?.find(s => s.id === inv.supplierId)?.name || '';
    return (
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) || [];

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight">Ledger Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-muted-foreground">Detailed transaction history and outstanding balances.</p>
        </div>

        <Card className="border-none shadow-sm mb-8">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search invoice or supplier..." 
                  className="pl-10 bg-slate-50 border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground self-start md:self-auto">
                <Filter className="mr-2 h-4 w-4" />
                Advanced Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-t">
                <TableRow>
                  <TableHead className="font-bold min-w-[100px]">Date</TableHead>
                  <TableHead className="font-bold min-w-[120px]">Invoice #</TableHead>
                  <TableHead className="font-bold min-w-[150px]">Supplier</TableHead>
                  <TableHead className="font-bold hidden lg:table-cell">Branch</TableHead>
                  <TableHead className="font-bold text-right min-w-[100px]">Amount</TableHead>
                  <TableHead className="font-bold text-right min-w-[100px]">Balance</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm">{inv.invoiceDate}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-medium">
                      {suppliers?.find(s => s.id === inv.supplierId)?.name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {branches?.find(b => b.id === inv.branchId)?.name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.invoiceAmount || 0)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(inv.remainingBalance || 0)}</TableCell>
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
                {filteredInvoices.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground italic">
                      No matching records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </SidebarInset>
  );
}
