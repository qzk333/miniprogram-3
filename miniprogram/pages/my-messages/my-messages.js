const db = wx.cloud.database();

Page({
  data: {
    list: [],
    isEmpty: false,
  },

  onShow() {
    this.fetchMessages();
  },

  fetchMessages() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ list: [], isEmpty: true });
      return;
    }
    wx.showLoading({ title: '加载中' });
    db.collection('notifications')
      .where({ recipientOpenid: openid })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
      .then((res) => {
        wx.hideLoading();
        const list = res.data.map((n) => ({
          ...n,
          typeText: this.typeText(n.type),
        }));
        this.setData({
          list,
          isEmpty: list.length === 0,
        });
        this.markAllRead(res.data);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  typeText(type) {
    if (type === 'reply') return '回复了您的评论';
    if (type === 'item_reply') return '在您的物品下回复';
    return '在您的物品下留言';
  },

  markAllRead(notifications) {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const app = getApp();
    Promise.all(
      unread.map((n) =>
        db.collection('notifications').doc(n._id).update({
          data: { isRead: true },
        })
      )
    ).then(() => {
      app.globalData.unreadMessagesCount = 0;
      app.markMessagesBadgeSeen(0);
    });
  },

  goToDetail(e) {
    const itemId = e.currentTarget.dataset.itemId;
    if (!itemId) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${itemId}` });
  },
});
