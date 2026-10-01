export type Device = 'mobile' | 'pc';
export type RankingCategory = 'all' | Device;
export const CATEGORY_LABELS: Record<RankingCategory, string> = { all: '全体', mobile: 'スマホ', pc: 'PC' };

// Touch-capable PCs remain PCs; iPadOS may identify itself as a Mac.
export function deviceType(userAgent: string, maxTouchPoints = 0, mobileHint = false): Device {
  return mobileHint || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) ? 'mobile' : 'pc';
}
