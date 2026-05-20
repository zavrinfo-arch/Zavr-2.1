/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateSafely(dateStr: string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '';
  try {
    const parsed = parseISO(dateStr);
    if (isValid(parsed)) {
      return format(parsed, formatStr);
    }
  } catch (e) {}
  return '';
}

export function formatCurrency(amount: number, currency: string = 'INR') {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency === 'INR' ? 'INR' : currency === 'USD' ? 'USD' : 'EUR',
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries: number = 3,
  attempt: number = 0
): Promise<Response> {
  const delays = [1000, 2000, 3000];
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error: any) {
    const isNetworkError = 
      error?.message === 'Failed to fetch' || 
      error?.name === 'TypeError' ||
      error?.message?.includes('NetworkError') ||
      error?.message?.includes('network') ||
      error?.message?.includes('api.supabase.com');
    
    if (attempt < retries && isNetworkError) {
      const waitTime = delays[attempt] || 3000;
      console.warn(`[RETRY] Fetch failed (${error.message}). Retrying attempt ${attempt + 1}/${retries} in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return fetchWithRetry(url, options, retries, attempt + 1);
    }
    throw error;
  }
}
