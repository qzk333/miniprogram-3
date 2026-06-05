// app.js
const MINE_TAB_INDEX = 3;

App({
  globalData: {
    env: 'cloud1-0gaxhtt078d18f40',
    isLoggedIn: false,
    openid: '',
    userInfo: null,
    /** 预约成功后一次性提示，首页 onShow 消费后清空 */
    pendingOrderTip: null,
    highlightOrderId: '',
    receivedOrdersCount: 0,
    lastReceivedBadgeSeenCount: 0,
    unreadMessagesCount: 0,
    lastMessagesBadgeSeenCount: 0,
    /** 演示模式：模拟支付租金，无需商户号 */
    MOCK_PAY: true,
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
    this.globalData.lastReceivedBadgeSeenCount =
      wx.getStorageSync('lastReceivedBadgeSeenCount') || 0;
    this.globalData.lastMessagesBadgeSeenCount =
      wx.getStorageSync('lastMessagesBadgeSeenCount') || 0;
    this.restoreLoginState();
  },

  restoreLoginState() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
      this.globalData.isLoggedIn = true;
      this.globalData.userInfo = wx.getStorageSync('userInfo') || null;
      this.refreshMineTabBadge();
    }
  },

  /** 查询出借方进行中的预约数量 */
  fetchReceivedOrdersCount(openid) {
    if (!openid) return Promise.resolve(0);
    const db = wx.cloud.database();
    const _ = db.command;
    return db
      .collection('items')
      .where({ publisherOpenid: openid })
      .field({ _id: true })
      .get()
      .then((itemsRes) => {
        const itemIds = itemsRes.data.map((i) => i._id);
        const cond = itemIds.length
          ? _.or([{ publisherOpenid: openid }, { itemId: _.in(itemIds) }])
          : { publisherOpenid: openid };
        return db
          .collection('orders')
          .where(_.and([cond, { status: _.in(['pending', 'active']) }]))
          .count();
      })
      .then((res) => res.total)
      .catch(() => 0);
  },

  /** 查询未读私信数量 */
  fetchUnreadMessagesCount(openid) {
    if (!openid) return Promise.resolve(0);
    const db = wx.cloud.database();
    return db
      .collection('notifications')
      .where({ recipientOpenid: openid, isRead: false })
      .count()
      .then((res) => res.total)
      .catch(() => 0);
  },

  /** 根据未读预约/私信更新「我的」Tab 红点（进入「我的」页面前显示） */
  refreshMineTabBadge() {
    const openid = this.globalData.openid;
    if (!openid || !this.globalData.isLoggedIn) {
      wx.hideTabBarRedDot({ index: MINE_TAB_INDEX });
      return;
    }
    Promise.all([
      this.fetchReceivedOrdersCount(openid),
      this.fetchUnreadMessagesCount(openid),
    ]).then(([orderCount, msgCount]) => {
      this.globalData.receivedOrdersCount = orderCount;
      this.globalData.unreadMessagesCount = msgCount;
      const orderSeen = this.globalData.lastReceivedBadgeSeenCount || 0;
      const msgSeen = this.globalData.lastMessagesBadgeSeenCount || 0;
      const hasNewOrders = orderCount > orderSeen && orderCount > 0;
      const hasNewMessages = msgCount > msgSeen && msgCount > 0;
      if (hasNewOrders || hasNewMessages) {
        wx.showTabBarRedDot({ index: MINE_TAB_INDEX });
      }
    });
  },

  /** 仅隐藏 Tab 栏红点（进入「我的」时立即调用） */
  hideMineTabRedDot() {
    wx.hideTabBarRedDot({ index: MINE_TAB_INDEX });
  },

  /** 记录已读预约数量，用于判断后续是否再显示 Tab 红点 */
  markReceivedBadgeSeen(receivedCount) {
    this.globalData.lastReceivedBadgeSeenCount = receivedCount;
    this.globalData.receivedOrdersCount = receivedCount;
    wx.setStorageSync('lastReceivedBadgeSeenCount', receivedCount);
  },

  markMessagesBadgeSeen(unreadCount) {
    this.globalData.lastMessagesBadgeSeenCount = unreadCount;
    this.globalData.unreadMessagesCount = unreadCount;
    wx.setStorageSync('lastMessagesBadgeSeenCount', unreadCount);
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
