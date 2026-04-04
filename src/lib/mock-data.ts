
import { addDays, format, isAfter, isBefore, subDays } from 'date-fns';
import { Branch, Supplier, Invoice, Statistics } from './types';

export const BRANCHES: Branch[] = [
  { id: 'b1', name: 'Mumbai North', location: 'Andheri' },
  { id: 'b2', name: 'Pune Central', location: 'Baner' },
  { id: 'b3', name: 'Delhi NCR', location: 'Gurgaon' },
];

export const SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'Global Logistics Inc.', category: 'Logistics', defaultCreditDays: 30, contactPerson: 'John Doe', email: 'john@global.com', phone: '+91 98765 43210' },
  { id: 's2', name: 'Tech Solutions Ltd.', category: 'IT Services', defaultCreditDays: 45, contactPerson: 'Jane Smith', email: 'jane@tech.com', phone: '+91 87654 32109' },
  { id: 's3', name: 'Office Depot', category: 'Supplies', defaultCreditDays: 15, contactPerson: 'Robert Brown', email: 'robert@depot.com', phone: '+91 76543 21098' },
  { id: 's4', name: 'Energy Co.', category: 'Utilities', defaultCreditDays: 10, contactPerson: 'Sarah Wilson', email: 'sarah@energy.co', phone: '+91 65432 10987' },
  { id: 's5', name: 'BuildRight Construction', category: 'Repairs', defaultCreditDays: 60, contactPerson: 'Mike Ross', email: 'mike@buildright.com', phone: '+91 54321 09876' },
];

const generateInvoices = (): Invoice[] => {
  const invoices: Invoice[] = [];
  const today = new Date();

  // Overdue Invoices
  for (let i = 0; i < 15; i++) {
    const invDate = subDays(today, 60 + i * 5);
    const creditDays = 30;
    const dueDate = addDays(invDate, creditDays);
    const amount = 50000 + (i * 1234);
    invoices.push({
      id: `inv-od-${i}`,
      branchId: BRANCHES[i % 3].id,
      supplierId: SUPPLIERS[i % 5].id,
      invoiceNumber: `INV/23-24/OD/${100 + i}`,
      invoiceDate: format(invDate, 'yyyy-MM-dd'),
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      creditDays,
      amount,
      paidAmount: i % 2 === 0 ? amount * 0.2 : 0,
      remainingBalance: i % 2 === 0 ? amount * 0.8 : amount,
      status: 'Overdue'
    });
  }

  // Upcoming Invoices
  for (let i = 0; i < 20; i++) {
    const invDate = subDays(today, 10 - i);
    const creditDays = 30;
    const dueDate = addDays(invDate, creditDays);
    const amount = 35000 + (i * 987);
    invoices.push({
      id: `inv-up-${i}`,
      branchId: BRANCHES[i % 3].id,
      supplierId: SUPPLIERS[i % 5].id,
      invoiceNumber: `INV/24-25/UP/${200 + i}`,
      invoiceDate: format(invDate, 'yyyy-MM-dd'),
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      creditDays,
      amount,
      paidAmount: 0,
      remainingBalance: amount,
      status: 'Pending'
    });
  }

  return invoices;
};

export const INVOICES = generateInvoices();

export const getStats = (branchId?: string): Statistics => {
  const filteredInvoices = branchId ? INVOICES.filter(inv => inv.branchId === branchId) : INVOICES;
  const today = new Date();
  
  return {
    totalOutstanding: filteredInvoices.reduce((sum, inv) => sum + inv.remainingBalance, 0),
    totalOverdue: filteredInvoices
      .filter(inv => isBefore(new Date(inv.dueDate), today) && inv.status !== 'Paid')
      .reduce((sum, inv) => sum + inv.remainingBalance, 0),
    upcoming7Days: filteredInvoices
      .filter(inv => {
        const d = new Date(inv.dueDate);
        return isAfter(d, today) && isBefore(d, addDays(today, 7));
      })
      .reduce((sum, inv) => sum + inv.remainingBalance, 0),
    upcoming15Days: filteredInvoices
      .filter(inv => {
        const d = new Date(inv.dueDate);
        return isAfter(d, today) && isBefore(d, addDays(today, 15));
      })
      .reduce((sum, inv) => sum + inv.remainingBalance, 0),
    upcoming30Days: filteredInvoices
      .filter(inv => {
        const d = new Date(inv.dueDate);
        return isAfter(d, today) && isBefore(d, addDays(today, 30));
      })
      .reduce((sum, inv) => sum + inv.remainingBalance, 0),
  };
};
