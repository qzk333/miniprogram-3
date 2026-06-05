const db = wx.cloud.database();

const ORDER_STATUS_TEXT = {
  awaiting_confirm: '等待出借方确认',
  pending: '待面交',
  active: '借用中',
  done: '已结束',
};

const NOTIFY_TYPE_TEXT = {
  order_new: '新预约',
  order_accepted: '预约已接受',
  order_rejected: '预约已拒绝',
  reply: '回复了您的评论',
  item_reply: '在您的物品下回复',
  item_comment: '在您的物品下留言',
};

Page({
  data: {
    itemId: '',
    loading: true,
    item: {},
    isOwner: false,
    notifySummary: null,
    orderInfo: null,
  },

  onLoad(options) {
    this.itemId = options.id || '';
    this.orderId = options.orderId || '';
    const notifySummary = this.buildNotifySummary(options);
    this.setData({ itemId: this.itemId, notifySummary });
    if (!this.itemId) {
      this.redirectDeleted();
      return;
    }
    this.loadItem();
  },

  buildNotifySummary(options) {
    if (!options.notifyType && !options.content) return null;
    return {
      typeText: NOTIFY_TYPE_TEXT[options.notifyType] || '相关通知',
      fromNickname: options.fromNickname ? decodeURIComponent(options.fromNickname) : '',
      content: options.content ? decodeURIComponent(options.content) : '',
    };
  },

  redirectDeleted() {
    wx.redirectTo({ url: '/pages/item-deleted/item-deleted' });
  },

  loadItem() {
    const openid = getApp().globalData.openid || '';
    wx.showLoading({ title: '加载中' });
    db.collection('items')
      .doc(this.itemId)
      .get()
      .then((res) => {
        const item = res.data;
        if (!item || !item.title) {
          wx.hideLoading();
          this.redirectDeleted();
          return;
        }
        const isOwner = !!(openid && item.publisherOpenid === openid);
        this.setData({
          item,
          isOwner,
          loading: false,
        });
        wx.hideLoading();
        if (this.orderId) {
          this.loadOrder(this.orderId);
        }
      })
      .catch(() => {
        wx.hideLoading();
        this.redirectDeleted();
      });
  },

  loadOrder(orderId) {
    db.collection('orders')
      .doc(orderId)
      .get()
      .then((res) => {
        const order = res.data;
        if (!order) return;
        this.setData({
          orderInfo: {
            ...order,
            statusText: ORDER_STATUS_TEXT[order.status] || order.status,
          },
        });
      })
      .catch(() => {});
  },

  goToDetail() {
    wx.navigateTo({ url: `/pages/detail/detail?id=${this.itemId}` });
  },

  goToOrder() {
    const id = this.data.orderInfo && this.data.orderInfo._id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order/order?id=${id}` });
  },
});
