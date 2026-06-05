const db = wx.cloud.database();

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_action', label: '待处理' },
  { key: 'ongoing', label: '进行中' },
  { key: 'done', label: '已完成' },
];

function matchFilter(order, filterKey) {
  const status = order.status;
  if (filterKey === 'all') return true;
  if (filterKey === 'pending_action') return status === 'awaiting_confirm';
  if (filterKey === 'ongoing') return status === 'pending' || status === 'active';
  if (filterKey === 'done') return status === 'done';
  return true;
}

Page({
  data: {
    orderList: [],
    allOrders: [],
    isEmpty: false,
    filterTabs: FILTER_TABS,
    activeFilter: 'all',
  },

  onShow() {
    this.fetchReceivedOrders();
    getApp().refreshMineTabBadge();
  },

  onPullDownRefresh() {
    this.fetchReceivedOrders(() => wx.stopPullDownRefresh());
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeFilter) return;
    this.setData({ activeFilter: key }, () => this.applyFilter());
  },

  applyFilter() {
    const { allOrders, activeFilter } = this.data;
    const orderList = allOrders.filter((o) => matchFilter(o, activeFilter));
    this.setData({
      orderList,
      isEmpty: orderList.length === 0,
    });
  },

  fetchReceivedOrders(done) {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ orderList: [], allOrders: [], isEmpty: true });
      if (typeof done === 'function') done();
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
        this.setData({ allOrders: res.data }, () => {
          this.applyFilter();
          if (typeof done === 'function') done();
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
        if (typeof done === 'function') done();
      });
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
