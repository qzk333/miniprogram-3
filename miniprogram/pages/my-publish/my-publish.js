const db = wx.cloud.database();

Page({
  data: {
    isLoggedIn: false,
    itemList: [],
    isEmpty: false,
  },

  onShow() {
    const app = getApp();
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
    app.refreshMineTabBadge();
    if (app.globalData.isLoggedIn) {
      this.fetchMyItems();
    } else {
      this.setData({ itemList: [], isEmpty: true });
    }
  },

  goLogin() {
    wx.switchTab({ url: '/pages/mine/mine' });
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
      .then((res) => {
        wx.hideLoading();
        this.setData({
          itemList: res.data,
          isEmpty: res.data.length === 0,
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  goToPublishForm() {
    getApp().requireLogin(() => {
      wx.navigateTo({ url: '/pages/publish/publish' });
    });
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '该物品';
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${title}」？无进行中预约时方可删除。`,
      confirmColor: '#E53E3E',
      success: (res) => {
        if (res.confirm) this.doDeleteItem(id);
      },
    });
  },

  doDeleteItem(itemId) {
    const _ = db.command;
    wx.showLoading({ title: '检查中' });
    db.collection('orders')
      .where({
        itemId,
        status: _.in(['pending', 'active']),
      })
      .get()
      .then((res) => {
        if (res.data.length > 0) {
          wx.hideLoading();
          return this.showDeleteBlockedModal(res.data);
        }
        wx.showLoading({ title: '删除中' });
        return db.collection('items').doc(itemId).remove();
      })
      .then((result) => {
        if (!result || !result.stats) return;
        wx.hideLoading();
        wx.showToast({ title: '已删除', icon: 'success' });
        this.fetchMyItems();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '删除失败', icon: 'none' });
      });
  },

  showDeleteBlockedModal(orders) {
    const nameCache = {};
    const fetchName = (openid) => {
      if (!openid) return Promise.resolve('未知用户');
      if (nameCache[openid]) return Promise.resolve(nameCache[openid]);
      return db
        .collection('users')
        .doc(openid)
        .get()
        .then((r) => {
          const name = r.data && r.data.nickname ? r.data.nickname : '微信用户';
          nameCache[openid] = name;
          return name;
        })
        .catch(() => {
          nameCache[openid] = '微信用户';
          return '微信用户';
        });
    };

    return Promise.all(
      orders.map((order) =>
        fetchName(order.borrowerOpenid).then((name) => {
          const period =
            order.startDate && order.endDate
              ? `${order.startDate} 至 ${order.endDate}`
              : '时间未记录';
          return `${name}：${period}`;
        }),
      ),
    ).then((lines) => {
      wx.showModal({
        title: '无法删除',
        content: `该物品有正在进行的预约，暂无法删除。\n\n${lines.join('\n')}`,
        showCancel: false,
        confirmText: '我知道了',
      });
    });
  },
});
