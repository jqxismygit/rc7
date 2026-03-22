Component({
  data: {
    selected: 0,
    safeAreaBottom: 0,
    bubbleLeft: 12.5,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        icon: "/static/home.png",
        iconActive: "/static/home-active.png",
      },
      {
        pagePath: "/pages/my-tickets/my-tickets",
        text: "票夹",
        icon: "/static/ticket.png",
        iconActive: "/static/ticket-active.png",
      },
      {
        pagePath: "/pages/game/game",
        text: "互动",
        icon: "/static/game.png",
        iconActive: "/static/game-active.png",
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "/static/profile.png",
        iconActive: "/static/profile-active.png",
      },
    ],
  },

  attached: function () {
    var that = this;
    var payload = {};
    try {
      var sys = wx.getSystemInfoSync();
      var bottom = 0;
      if (sys.safeAreaInsets && typeof sys.safeAreaInsets.bottom === "number") {
        bottom = sys.safeAreaInsets.bottom;
      } else if (sys.safeArea && sys.screenHeight) {
        bottom = Math.max(0, sys.screenHeight - sys.safeArea.bottom);
      }
      payload.safeAreaBottom = bottom;
    } catch (e) {}
    var app = getApp();
    var prev = app._tabBarSelected !== undefined ? app._tabBarSelected : 0;
    payload.bubbleLeft = 12.5 + prev * 25;
    that.setData(payload);
  },

  observers: {
    selected: function (val) {
      var app = getApp();
      app._tabBarSelected = val;
      var left = 12.5 + (val || 0) * 25;
      var that = this;
      clearTimeout(that._bubbleTimer);
      that._bubbleTimer = setTimeout(function () {
        that._bubbleTimer = null;
        that.setData({ bubbleLeft: left });
      }, 32);
    },
  },

  methods: {
    switchTab: function (e) {
      var index = e.currentTarget.dataset.index;
      var item = this.data.list[index];
      wx.switchTab({
        url: item.pagePath,
      });
    },
  },
});
