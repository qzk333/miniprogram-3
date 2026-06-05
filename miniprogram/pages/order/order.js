const db = wx.cloud.database();

const STATUS_TITLE = {
  pending: '待面交',
  active: '借用中',
  done: '已完成',
};

const STATUS_TEXT = {
  pending: '待面交',
  active: '借用中',
  done: '已归还',
};

const PAY_STATUS_TEXT = {
  unpaid: '待支付',
  paid: '托管中',
  settled: '已结算',
};

function normalizeOrder(order) {
  const o = { ...order };
  const pastHandover = o.status === 'active' || o.status === 'done';
  const pastReturn = o.status === 'done';
  if (o.borrowerHandoverOk === undefined) o.borrowerHandoverOk = pastHandover;
  if (o.publisherHandoverOk === undefined) o.publisherHandoverOk = pastHandover;
  if (o.borrowerReturnOk === undefined) o.borrowerReturnOk = pastReturn;
  if (o.publisherReturnOk === undefined) o.publisherReturnOk = pastReturn;
  if (!o.payStatus) o.payStatus = 'unpaid';
  return o;
}

function formatRentDisplay(rentTotal) {
  if (rentTotal === undefined || rentTotal === null || rentTotal === '') return '—';
  const n = parseFloat(rentTotal);
  return Number.isNaN(n) ? '—' : `¥${n.toFixed(2)}`;
}

Page({
  data: {
    orderId: '',
    order: {},
    statusText: '',
    payStatusText: '',
    rentDisplay: '—',
    roleLabel: '',
    isBorrower: false,
    isPublisher: false,
    canOperate: false,
    showHandoverSuccess: false,
    showReturnSuccess: false,
    stepStates: ['done', 'current', '', ''],
  },

  onLoad(options) {
    this.setData({ orderId: options.id });
    this.fetchOrder();
  },

  onShow() {
    if (this.data.orderId) {
      this.fetchOrder();
    }
  },

  fetchOrder() {
    const openid = getApp().globalData.openid || '';
    db.collection('orders')
      .doc(this.data.orderId)
      .get({
        success: (res) => {
          const order = normalizeOrder(res.data);
          const status = order.status || 'pending';
          const isBorrower = !!(openid && order.borrowerOpenid === openid);
          const isPublisher = !!(openid && order.publisherOpenid === openid);
          let roleLabel = '访客';
          if (isBorrower && isPublisher) roleLabel = '借方/出借方';
          else if (isBorrower) roleLabel = '借方';
          else if (isPublisher) roleLabel = '出借方';

          if (!this.data.showHandoverSuccess && !this.data.showReturnSuccess) {
            wx.setNavigationBarTitle({ title: STATUS_TITLE[status] || '订单详情' });
          }
          this.setData({
            order,
            statusText: STATUS_TEXT[status] || status,
            payStatusText: PAY_STATUS_TEXT[order.payStatus] || order.payStatus,
            rentDisplay: formatRentDisplay(order.rentTotal),
            roleLabel,
            isBorrower,
            isPublisher,
            canOperate: isBorrower || isPublisher,
            stepStates: this.computeStepStates(status),
          });
        },
      });
  },

  uploadPhoto(field) {
    if (!this.data.isBorrower) {
      return wx.showToast({ title: '请由借方上传照片', icon: 'none' });
    }
    getApp().requireLogin(() => {
      this.doUploadPhoto(field);
    });
  },

  doUploadPhoto(field) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        wx.showLoading({ title: '上传证据中' });
        const cloudPath = `proofs/${Date.now()}.jpg`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: res.tempFiles[0].tempFilePath,
          success: (uploadRes) => {
            db.collection('orders')
              .doc(this.data.orderId)
              .update({
                data: { [field]: uploadRes.fileID },
                success: () => {
                  wx.hideLoading();
                  this.fetchOrder();
                },
                fail: () => {
                  wx.hideLoading();
                  wx.showToast({ title: '保存失败', icon: 'none' });
                },
              });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          },
        });
      },
    });
  },

  uploadHandoverPhotos() {
    this.uploadPhoto('handoverImage');
  },

  uploadReturnPhotos() {
    this.uploadPhoto('returnImage');
  },

  computeStepStates(status) {
    const map = {
      pending: ['done', 'current', '', ''],
      active: ['done', 'done', 'current', ''],
      done: ['done', 'done', 'done', 'done'],
    };
    return map[status] || ['done', '', '', ''];
  },

  borrowerConfirmHandover() {
    if (!this.data.isBorrower) return;
    getApp().requireLogin(() => {
      if (!this.data.order.handoverImage) {
        return wx.showToast({ title: '请先上传面交照片', icon: 'none' });
      }
      this.updateHandoverFlag('borrowerHandoverOk', true);
    });
  },

  publisherConfirmHandover() {
    if (!this.data.isPublisher) return;
    getApp().requireLogin(() => {
      this.updateHandoverFlag('publisherHandoverOk', true);
    });
  },

  updateHandoverFlag(field, value) {
    wx.showLoading({ title: '提交中' });
    db.collection('orders')
      .doc(this.data.orderId)
      .update({
        data: { [field]: value },
        success: () => {
          wx.hideLoading();
          this.fetchOrder();
          this.tryActivateOrder();
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  tryActivateOrder() {
    const { order } = this.data;
    if (order.status !== 'pending') return;
    if (
      !order.handoverImage ||
      !order.borrowerHandoverOk ||
      !order.publisherHandoverOk
    ) {
      return;
    }
    wx.showLoading({ title: '确认交接' });
    db.collection('orders')
      .doc(this.data.orderId)
      .update({
        data: { status: 'active' },
        success: () => {
          wx.hideLoading();
          wx.setNavigationBarTitle({ title: '面交成功' });
          this.setData({
            showHandoverSuccess: true,
            'order.status': 'active',
            statusText: STATUS_TEXT.active,
            stepStates: this.computeStepStates('active'),
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  borrowerConfirmReturn() {
    if (!this.data.isBorrower) return;
    getApp().requireLogin(() => {
      if (!this.data.order.returnImage) {
        return wx.showToast({ title: '请先上传归还照片', icon: 'none' });
      }
      this.updateReturnFlag('borrowerReturnOk', true);
    });
  },

  publisherConfirmReturn() {
    if (!this.data.isPublisher) return;
    getApp().requireLogin(() => {
      this.updateReturnFlag('publisherReturnOk', true);
    });
  },

  updateReturnFlag(field, value) {
    wx.showLoading({ title: '提交中' });
    db.collection('orders')
      .doc(this.data.orderId)
      .update({
        data: { [field]: value },
        success: () => {
          wx.hideLoading();
          this.fetchOrder();
          this.tryCompleteOrder();
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  tryCompleteOrder() {
    const { order } = this.data;
    if (order.status !== 'active') return;
    if (
      !order.returnImage ||
      !order.borrowerReturnOk ||
      !order.publisherReturnOk
    ) {
      return;
    }
    wx.showLoading({ title: '结束订单' });
    db.collection('orders')
      .doc(this.data.orderId)
      .update({
        data: { status: 'done' },
        success: () => {
          wx.hideLoading();
          wx.setNavigationBarTitle({ title: '归还成功' });
          this.setData({
            showReturnSuccess: true,
            'order.status': 'done',
            statusText: STATUS_TEXT.done,
            stepStates: this.computeStepStates('done'),
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  goToMyOrders() {
    this.setData({ showHandoverSuccess: false, showReturnSuccess: false });
    if (this.data.isPublisher && !this.data.isBorrower) {
      wx.navigateTo({ url: '/pages/my-received/my-received' });
      return;
    }
    wx.switchTab({ url: '/pages/my-orders/my-orders' });
  },

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
