import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapProduct, CurtainWallProduct, CurtainWallHardware } from '@/api/entities';

/** ম্যাপ Product DB — জানালা/সিলিং/কার্টেন ওয়াল ক্যালকুলেটর এখান থেকে রেট নেয়। */
export const useMapProducts = () => useQuery({
  queryKey: ['map-products'],
  queryFn: () => MapProduct.list('product_code', 5000),
  staleTime: 5 * 60 * 1000,
});

export const useCurtainWallProducts = () => useQuery({
  queryKey: ['curtain-wall-products'],
  queryFn: () => CurtainWallProduct.list('company', 5000),
  staleTime: 5 * 60 * 1000,
});

export const useCurtainWallHardware = () => useQuery({
  queryKey: ['curtain-wall-hardware'],
  queryFn: () => CurtainWallHardware.list('item_key', 100),
  staleTime: 5 * 60 * 1000,
});

/**
 * useState that survives a page reload — ক্যালকুলেটরে লেখা মাপ হঠাৎ রিফ্রেশে হারাবে না।
 * Storage can be blocked (private mode), so every access is guarded.
 */
export function useSavedState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}
