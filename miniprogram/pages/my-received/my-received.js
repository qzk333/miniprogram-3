const db = wx.cloud.database();

Page({
  data: {
    orderList: [],
    isEmpty: false,
  },

  onShow() {
    this.fetchReceivedOrders();
  },

  fetchReceivedOrders() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ orderList: [], isEmpty: true });
      return;
    }
    const _ = db.command;
    wx.showLoading({ title: '加载中' });
    db.collection('items')
      .where({ publisherOpenid: openid })
      .field({ _id: true })
      .get()
      .then((itemsRes) => {
        const itemIds = itemsRes.data.map((i) => i._id);
        const cond = itemIds.length
          ? _.or([{ publisherOpenid: openid }, { itemId: _.in(itemIds) }])
          : { publisherOpenid: openid };
        return db.collection('orders').where(cond).orderBy('createTime', 'desc').get();
      })
      .then((res) => {
        wx.hideLoading();
        this.setData({
          orderList: res.data,
          isEmpty: res.data.length === 0,
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  goToOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order/order?id=${id}` });
  },

  goToPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  },
});
