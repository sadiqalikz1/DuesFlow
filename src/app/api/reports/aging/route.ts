import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api/auth';
import { successResponse, handleApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const db = getAdminFirestore();
    const invoicesRef = db.collection('invoices');

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');

    let q = invoicesRef.where('status', '!=', 'Paid');
    if (branchId) {
      q = q.where('branchId', '==', branchId);
    }

    const snapshot = await q.get();
    const invoices: any[] = [];

    snapshot.forEach((doc: any) => {
      invoices.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Calculate aging buckets based on dueDate
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.toISOString().split('T')[0];

    const buckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    invoices.forEach((invoice) => {
      // Only process unpaid invoices
      if (invoice.status === 'Paid' || !invoice.dueDate) return;
      
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      // Only count invoices that are overdue (dueDate < today)
      if (dueDate >= now) return;
      
      const daysOverdue = Math.ceil(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const balance = invoice.remainingBalance || 0;
      
      if (daysOverdue <= 30) {
        buckets['0-30'] += balance;
      } else if (daysOverdue <= 60) {
        buckets['31-60'] += balance;
      } else if (daysOverdue <= 90) {
        buckets['61-90'] += balance;
      } else {
        buckets['90+'] += balance;
      }
    });

    return successResponse({
      buckets,
      asOfDate: today,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
