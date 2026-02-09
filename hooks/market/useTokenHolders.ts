/**
 * useTokenHolders Hook
 * Fetches token holders data using Mobula API
 * Based on MTT's useCombinedHolders implementation
 */

import { toMobulaBlockchainName } from "@/constants/chains";
import { getMobulaClient } from "@/lib/api/mobula/mobulaClient";
import { Holder, useTokenStore } from "@/store/tokenStore";
import { useCallback, useEffect, useRef } from "react";

interface UseTokenHoldersOptions {
  address: string;
  blockchain: string;
  enabled?: boolean;
  limit?: number;
}

export function useTokenHolders({
  address,
  blockchain,
  enabled = true,
  limit = 50,
}: UseTokenHoldersOptions) {
  const setHolders = useTokenStore((s) => s.setHolders);
  const setIsLoadingHolders = useTokenStore((s) => s.setIsLoadingHolders);
  const holders = useTokenStore((s) => s.holders);
  const isLoadingHolders = useTokenStore((s) => s.isLoadingHolders);

  const isMounted = useRef(true);
  const isFetchingRef = useRef(false);
  const lastFetchedTokenRef = useRef<string | null>(null);

  const fetchHolders = useCallback(async () => {
    if (!address || !blockchain) return;

    const tokenKey = `${address}-${blockchain}`;

    // Skip if already fetching or already fetched this token
    if (isFetchingRef.current || lastFetchedTokenRef.current === tokenKey) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingHolders(true);

    try {
      const client = getMobulaClient();

      // Convert blockchain to Mobula API format (e.g., "bnb" -> "BNB Smart Chain (BEP20)")
      const mobulaBlockchain = toMobulaBlockchainName(blockchain);

      // Fetch token holders using Mobula SDK
      // API: fetchMarketTokenHolders
      const response = await client.fetchMarketTokenHolders({
        blockchain: mobulaBlockchain,
        asset: address,
        limit,
      });

      if (!isMounted.current) return;

      if (response?.data) {
        // Calculate total balance to compute percentages
        // API might return percentage field directly, or we calculate from amounts
        const holdersData = response.data as any[];

        // First pass: check if API provides percentage, otherwise calculate
        let totalBalance = 0;
        const hasPercentage = holdersData.some(
          (h: any) =>
            h.percentage !== undefined || h.percentageOwned !== undefined,
        );

        if (!hasPercentage) {
          // Calculate total balance from all holders
          totalBalance = holdersData.reduce((sum: number, h: any) => {
            return sum + (Number(h.amount) || 0);
          }, 0);
        }

        // Map API response to our Holder format
        const mappedHolders: Holder[] = holdersData.map((holder: any) => {
          const balance = Number(holder.amount) || 0;
          // Use API percentage if available, otherwise calculate
          let percentage =
            Number(holder.percentage) || Number(holder.percentageOwned) || 0;
          if (!percentage && totalBalance > 0) {
            percentage = (balance / totalBalance) * 100;
          }

          return {
            address: holder.address || "",
            balance,
            percentage,
            isContract: holder.isContract,
            label: holder.tag || undefined,
          };
        });

        setHolders(mappedHolders);
        lastFetchedTokenRef.current = `${address}-${blockchain}`;
      } else {
        setHolders([]);
        lastFetchedTokenRef.current = `${address}-${blockchain}`;
      }
    } catch (err) {
      console.error("Error fetching token holders:", err);
      // Don't set error, just log it - holders are not critical
      setHolders([]);
      // Don't mark as fetched on error so it can retry
    } finally {
      isFetchingRef.current = false;
    }
  }, [address, blockchain, limit, setHolders, setIsLoadingHolders]);

  // Reset tracking and clear old holders when token changes
  useEffect(() => {
    const tokenKey = `${address}-${blockchain}`;
    // If token changed, reset the last fetched ref and clear old holders
    if (
      lastFetchedTokenRef.current &&
      lastFetchedTokenRef.current !== tokenKey
    ) {
      lastFetchedTokenRef.current = null;
      // Clear old holders immediately to prevent showing stale data
      setHolders([]);
    }
  }, [address, blockchain, setHolders]);

  // Fetch when enabled and token params are available
  useEffect(() => {
    isMounted.current = true;

    if (enabled && address && blockchain) {
      fetchHolders();
    }

    return () => {
      isMounted.current = false;
    };
  }, [enabled, address, blockchain, fetchHolders]);

  return {
    holders,
    isLoading: isLoadingHolders,
    refetch: fetchHolders,
  };
}

export default useTokenHolders;
