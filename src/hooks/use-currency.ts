
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

/**
 * Custom hook to manage and format currencies based on user settings.
 * Defaults to INR if no settings are found.
 */
export function useCurrency() {
  const { user } = useUser();
  const { firestore } = useFirestore();

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'userSettings', user.uid);
  }, [firestore, user?.uid]);

  const { data: settings } = useDoc(settingsRef);

  const currencyCode = settings?.currency || 'INR';

  /**
   * Formats a numeric value into the user's preferred currency format.
   * Uses 'en-IN' for INR specifically to support lakhs/crores, otherwise 'en-US'.
   */
  const formatCurrency = (amount: number) => {
    const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return { currencyCode, formatCurrency };
}
