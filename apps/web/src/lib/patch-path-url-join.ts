/**
 * Path URL join patch - disabled for Edge runtime compatibility
 * This file is kept as a no-op to maintain import compatibility
 */

export function patchJoinForFileUrls(): void {
  // No-op: Edge runtime doesn't need this patch
  // The path module is not available in Edge runtime
}

export default patchJoinForFileUrls;
