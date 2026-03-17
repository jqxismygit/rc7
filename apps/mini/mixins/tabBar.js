export default function createTabBarMixin(tabIndex) {
  return {
    onShow() {
      // #ifdef MP-WEIXIN
      var page = this.$scope
      if (page && typeof page.getTabBar === 'function') {
        var result = page.getTabBar(function (tabBar) {
          tabBar.setData({ selected: tabIndex })
        })
        if (result && typeof result.setData === 'function') {
          result.setData({ selected: tabIndex })
        }
      }
      // #endif
    }
  }
}
