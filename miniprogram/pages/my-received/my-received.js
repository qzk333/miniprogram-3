const db = wx.cloud.database();

Page({
  data: {
    orderList: [],
    isEmpty: false,
  },

  onShow() {
    this.fetchReceivedOrders();
    getApp().refreshMineTabBadge();
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

  statusLabel(status) {
    const map = {
      awaiting_confirm: '待确认',
      pending: '待面交',
      active: '借用中',
      done: '已结束',
    };
    return map[status] || status;
  },

  goToOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order/order?id=${id}` });
  },

  respondBooking(e) {
    const { id, action, title } = e.currentTarget.dataset;
    if (!id || !action) return;

    const isAccept = action === 'accept';
    wx.showModal({
      title: isAccept ? '接受预约' : '拒绝预约',
      content: isAccept
        ? `确定接受「${title || '该物品'}」的预约？`
        : `确定拒绝「${title || '该物品'}」的预约？拒绝后订单将删除。`,
      confirmColor: isAccept ? '#00561F' : '#E53E3E',
      success: (res) => {
        if (res.confirm) this.doRespondBooking(id, action);
      },
    });
  },

  doRespondBooking(orderId, action) {
    wx.showLoading({ title: '处理中' });
    wx.cloud.callFunction({
      name: 'respondBooking',
      data: { orderId, action },
      success: (res) => {
        wx.hideLoading();
        const result = res.result || {};
        if (result.success) {
          wx.showToast({
            title: action === 'accept' ? '已接受' : '已拒绝',
            icon: 'success',
          });
          this.fetchReceivedOrders();
          getApp().refreshMineTabBadge();
        } else {
          wx.showToast({ title: result.errMsg || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '服务不可用', icon: 'none' });
      },
    });
  },

  goToPublish() {
    wx.switchTab({ url: '/pages/my-publish/my-publish' });
  },
});
