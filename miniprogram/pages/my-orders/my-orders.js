const db = wx.cloud.database();

Page({
  data: {
    orderList: [],
    isEmpty: false,
    highlightOrderId: '',
  },

  onLoad(options) {
    if (options.highlight) {
      this.setData({ highlightOrderId: options.highlight });
      setTimeout(() => {
        this.setData({ highlightOrderId: '' });
      }, 3000);
    }
  },

  onShow() {
    this.fetchMyOrders();
  },

  fetchMyOrders() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ orderList: [], isEmpty: true });
      return;
    }
    wx.showLoading({ title: '加载中' });
    db.collection('orders')
      .where({ borrowerOpenid: openid })
      .orderBy('createTime', 'desc')
      .get()
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

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
