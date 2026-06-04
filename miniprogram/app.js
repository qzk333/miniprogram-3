// app.js
App({
  globalData: {
    env: 'cloud1-0gaxhtt078d18f40',
    isLoggedIn: false,
    openid: '',
    userInfo: null,
    /** 预约成功后一次性提示，首页 onShow 消费后清空 */
    pendingOrderTip: null,
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
    // 从本地存储恢复登录状态
    this.restoreLoginState();
  },

  restoreLoginState() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
      this.globalData.isLoggedIn = true;
      this.globalData.userInfo = wx.getStorageSync('userInfo') || null;
    }
  },

  /**
   * 需要登录才能执行的操作，未登录则弹窗提示跳转我的页面
   */
  requireLogin(callback) {
    if (this.globalData.isLoggedIn) {
      callback();
      return;
    }
    wx.showModal({
      title: '请先登录',
      content: '登录后即可使用租借功能',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/mine/mine' });
        }
      },
    });
  },
});
