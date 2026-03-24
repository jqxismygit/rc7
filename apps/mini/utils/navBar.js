/**
 * 自定义导航栏占位高度（状态栏 + 88rpx 导航行），单位 px
 */
export function getNavBarInsetPx() {
  const sys = uni.getSystemInfoSync();
  const statusBarHeight = sys.statusBarHeight || 0;
  const winW = sys.windowWidth || 375;
  const navInnerPx = (88 * winW) / 750;
  return statusBarHeight + navInnerPx;
}
