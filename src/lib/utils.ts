/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  delay: number = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error: any) {
    const isNetworkError = error.message === 'Failed to fetch' || 
                         error.name === 'TypeError' ||
                         error.message.includes('NetworkError') ||
                         error.message.includes('network');
    
    if (retries > 0 && isNetworkError) {
      console.warn(`Fetch failed (${error.message}), retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    throw error;
  }
}
