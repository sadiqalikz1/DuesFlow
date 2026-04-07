'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Plus, Mail, Phone, ExternalLink, LayoutList, Upload, Search,
  Building2, ShieldCheck, CreditCard, Users, Loader2
} from 'lucide-react';
import { SupplierImportDialog } from '@/components/suppliers/supplier-import-dialog';

export default function SuppliersPage() {
  const firestore = useFirestore();
  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers, isLoading } = useCollection(suppliersQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    category: '',
    email: '',
    phone: '',
    address: '',
    vatNumber: '',
    defaultCreditDays: 30,
  });

  const handleAddSupplier = () => {
    if (!newSupplier.name || !firestore) return;
    addDocumentNonBlocking(collection(firestore, 'suppliers'), {
      ...newSupplier,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewSupplier({ name: '', category: '', email: '', phone: '', address: '', vatNumber: '', defaultCreditDays: 30 });
    setIsDialogOpen(false);
  };

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!searchTerm.trim()) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.category?.toLowerCase().includes(term) ||
      s.vatNumber?.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Supplier Master</h2>
          {suppliers && (
            <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-500 font-bold text-xs ml-1">
              {suppliers.length}
            </Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-slate-50 border-slate-100 rounded-full text-xs w-48 focus:w-64 transition-all"
            />
          </div>

          {/* Import from Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="rounded-full border-slate-200 gap-1.5 h-9 text-xs font-bold"
          >
            <Upload className="w-3.5 h-3.5" /> Import Excel
          </Button>

          {/* Add Supplier Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full shadow-lg shadow-primary/20 gap-1.5 h-9 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" /> Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem] max-w-md border-none shadow-2xl p-0 overflow-hidden">
              <div className="bg-slate-900 px-8 py-7">
                <DialogHeader>
                  <DialogTitle className="text-white text-lg font-black">Register New Supplier</DialogTitle>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-4 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Supplier Name *</Label>
                  <Input
                    value={newSupplier.name}
                    onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="Company Name"
                    className="bg-slate-50 border-none rounded-2xl h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Category</Label>
                    <Input
                      value={newSupplier.category}
                      onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })}
                      placeholder="e.g. Food & Beverages"
                      className="bg-slate-50 border-none rounded-2xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Credit Days</Label>
                    <Input
                      type="number"
                      value={newSupplier.defaultCreditDays}
                      onChange={e => setNewSupplier({ ...newSupplier, defaultCreditDays: parseInt(e.target.value) || 30 })}
                      className="bg-slate-50 border-none rounded-2xl h-11"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Phone</Label>
                    <Input
                      value={newSupplier.phone}
                      onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                      placeholder="+971-50-000-0000"
                      className="bg-slate-50 border-none rounded-2xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Email</Label>
                    <Input
                      value={newSupplier.email}
                      onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="email@company.com"
                      className="bg-slate-50 border-none rounded-2xl h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wide text-slate-400">VAT / TRN Number</Label>
                  <Input
                    value={newSupplier.vatNumber}
                    onChange={e => setNewSupplier({ ...newSupplier, vatNumber: e.target.value })}
                    placeholder="e.g. TRN100234567890003"
                    className="bg-slate-50 border-none rounded-2xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wide text-slate-400">Address</Label>
                  <Input
                    value={newSupplier.address}
                    onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    placeholder="City, Country"
                    className="bg-slate-50 border-none rounded-2xl h-11"
                  />
                </div>
                <Button className="w-full rounded-full h-11 font-bold shadow-lg shadow-primary/20 mt-2" onClick={handleAddSupplier}>
                  <Plus className="w-4 h-4 mr-2" /> Save Supplier
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Mobile search */}
      <div className="md:hidden px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-slate-50 border-slate-100 rounded-full text-xs w-full"
          />
        </div>
      </div>

      <main className="p-4 md:p-8">
        <SupplierImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium text-sm">Loading suppliers...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed rounded-[2.5rem] bg-slate-50/50">
            <Users className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="font-bold text-slate-500">{searchTerm ? 'No suppliers match your search.' : 'No suppliers yet.'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm ? 'Try a different term.' : 'Add one manually or import from Excel.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSuppliers.map((supplier) => (
              <Card
                key={supplier.id}
                className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-[2rem] bg-white ring-1 ring-slate-100 hover:ring-primary/20 group"
              >
                <CardHeader className="pb-3 px-6 pt-6">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base font-black truncate text-slate-900 leading-tight">{supplier.name}</CardTitle>
                      {supplier.category && (
                        <CardDescription className="truncate text-xs mt-0.5">{supplier.category}</CardDescription>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 shrink-0 font-black text-xs">
                      {supplier.defaultCreditDays || 30}d
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <div className="space-y-2">
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                        <span className="truncate">{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                    {supplier.vatNumber && (
                      <div className="flex items-center gap-2 text-xs">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/40" />
                        <span className="font-mono text-[10px] font-bold text-slate-500 tracking-tight">{supplier.vatNumber}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex gap-2">
                    <Link href={`/suppliers/${supplier.id}`} className="flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-primary hover:bg-primary/5 rounded-xl text-xs font-bold"
                      >
                        <LayoutList className="mr-1.5 h-3.5 w-3.5" />
                        View Ledger
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </SidebarInset>
  );
}
