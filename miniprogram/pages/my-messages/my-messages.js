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
        this.markAllRead(list);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  typeText(type) {
    if (type === 'order_new') return '新预约';
    if (type === 'order_accepted') return '预约已接受';
    if (type === 'order_rejected') return '预约已拒绝';
    if (type === 'reply') return '回复了您的评论';
    if (type === 'item_reply') return '在您的物品下回复';
    return '在您的物品下留言';
  },

  markAllRead(notifications) {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) {
      getApp().syncMessagesBadge(0);
      return;
    }

    const readList = notifications.map((n) => ({ ...n, isRead: true }));
    this.setData({ list: readList });
    getApp().syncMessagesBadge(0);

    wx.cloud
      .callFunction({ name: 'markNotificationsRead' })
      .then((res) => {
        if (!res.result || !res.result.success) {
          wx.showToast({ title: '部分已读状态同步失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.showToast({ title: '部分已读状态同步失败', icon: 'none' });
      });
  },

  goToItemPreview(e) {
    const { itemId, orderId, notifyType, fromNickname, content } =
      e.currentTarget.dataset;
    if (!itemId) return;
    const params = [`id=${itemId}`];
    if (orderId) params.push(`orderId=${orderId}`);
    if (notifyType) params.push(`notifyType=${notifyType}`);
    if (fromNickname) {
      params.push(`fromNickname=${encodeURIComponent(fromNickname)}`);
    }
    if (content) {
      params.push(`content=${encodeURIComponent(content)}`);
    }
    wx.navigateTo({ url: `/pages/item-preview/item-preview?${params.join('&')}` });
  },
});
