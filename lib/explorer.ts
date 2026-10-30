/**
 * Walrus Mainnet Explorer & Aggregator Utility
 * Builds valid verification and download URLs for Walrus Blobs on Mainnet.
 */

// Walrus Mainnet Explorer
export const WALRUSCAN_MAINNET_URL = "https://walruscan.com/mainnet/blob";

// Walrus Mainnet Aggregator (standard endpoint defined in @mysten-incubation/memwal)
export const WALRUS_MAINNET_AGGREGATOR_URL = "https://aggregator.walrus-mainnet.walrus.space/v1/blobs";

/**
 * Returns the public explorer URL for a confirmed Walrus blob ID.
 */
export function getWalrusBlobExplorerUrl(blobId: string): string {
  if (!blobId) return "#";
  return `${WALRUSCAN_MAINNET_URL}/${encodeURIComponent(blobId.trim())}`;
}

/**
 * Returns the direct HTTP aggregator download link for a confirmed Walrus blob ID.
 */
export function getWalrusAggregatorUrl(blobId: string): string {
  if (!blobId) return "#";
  return `${WALRUS_MAINNET_AGGREGATOR_URL}/${encodeURIComponent(blobId.trim())}`;
}

/**
 * Validates whether a blob ID string is present and non-empty.
 */
export function isValidBlobId(blobId?: string | null): boolean {
  if (!blobId || typeof blobId !== "string") return false;
  const trimmed = blobId.trim();
  return trimmed.length >= 10 && !trimmed.includes(" ");
}
