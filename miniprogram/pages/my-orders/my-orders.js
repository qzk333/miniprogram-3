const db = wx.cloud.database();
const { computeNextReminder } = require('../../utils/orderReminder');

const STATUS_SORT = { active: 0, pending: 1, awaiting_confirm: 2, done: 3 };

function sortOrdersByStatus(orders) {
  return [...orders].sort((a, b) => {
    const pa = STATUS_SORT[a.status] ?? 9;
    const pb = STATUS_SORT[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
    const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
    return tb - ta;
  });
}

Page({
  data: {
    isLoggedIn: false,
    orderList: [],
    isEmpty: false,
    highlightOrderId: '',
    nextReminder: null,
  },

  onShow() {
    const app = getApp();
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
    app.refreshMineTabBadge();

    const highlight = app.globalData.highlightOrderId || '';
    if (highlight) {
      app.globalData.highlightOrderId = '';
      this.setData({ highlightOrderId: highlight });
      setTimeout(() => this.setData({ highlightOrderId: '' }), 3000);
    }

    if (app.globalData.isLoggedIn) {
      this.fetchMyOrders();
    } else {
      this.setData({ orderList: [], isEmpty: true, nextReminder: null });
    }
  },

  goLogin() {
    wx.switchTab({ url: '/pages/mine/mine' });
  },

  fetchMyOrders() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ orderList: [], isEmpty: true, nextReminder: null });
      return;
    }
    wx.showLoading({ title: '加载中' });
    db.collection('orders')
      .where({ borrowerOpenid: openid })
      .orderBy('createTime', 'desc')
      .get()
      .then((res) => {
        wx.hideLoading();
        const orderList = sortOrdersByStatus(res.data);
        this.setData({
          orderList,
          isEmpty: orderList.length === 0,
          nextReminder: computeNextReminder(orderList),
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

  goToReminderOrder() {
    const id = this.data.nextReminder && this.data.nextReminder.orderId;
    if (!id) return;
    this.goToOrder({ currentTarget: { dataset: { id } } });
  },

  goToMarket() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  deleteOrder(e) {
    const { id, status, title } = e.currentTarget.dataset;
    if (!id) return;

    if (status === 'active') {
      return wx.showModal({
        title: '无法删除',
        content: '借用中的订单需先完成归还，再删除记录。',
        showCancel: false,
      });
    }

    const isPending = status === 'pending' || status === 'awaiting_confirm';
    wx.showModal({
      title: isPending ? '取消预约' : '删除记录',
      content: isPending
        ? `确定取消「${title || '该物品'}」的预约？`
        : `确定删除「${title || '该记录'}」的租借记录？`,
      confirmColor: '#E53E3E',
      success: (res) => {
        if (res.confirm) this.doDeleteOrder(id);
      },
    });
  },

  doDeleteOrder(orderId) {
    wx.showLoading({ title: '处理中' });
    db.collection('orders')
      .doc(orderId)
      .remove()
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已删除', icon: 'success' });
        this.fetchMyOrders();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '删除失败', icon: 'none' });
      });
  },
});
