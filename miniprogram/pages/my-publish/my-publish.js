const db = wx.cloud.database();

Page({
  data: {
    itemList: [],
    isEmpty: false
  },

  onShow() {
    this.fetchMyItems();
  },

  fetchMyItems() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ isEmpty: true });
      return;
    }
    wx.showLoading({ title: '加载中' });
    db.collection('items')
      .where({ publisherOpenid: openid })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        wx.hideLoading();
        this.setData({
          itemList: res.data,
          isEmpty: res.data.length === 0
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  goToPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  }
});
