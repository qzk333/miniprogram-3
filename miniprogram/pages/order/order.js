const db = wx.cloud.database();

const STATUS_TITLE = {
  awaiting_confirm: '待确认',
  pending: '待面交',
  active: '借用中',
  done: '已完成',
};

const STATUS_TEXT = {
  awaiting_confirm: '等待出借方确认',
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
    mockPay: true,
    showHandoverSuccess: false,
    showReturnSuccess: false,
    stepStates: ['done', 'current', '', ''],
  },

  onLoad(options) {
    const app = getApp();
    this.setData({
      orderId: options.id,
      mockPay: !!(app.globalData && app.globalData.MOCK_PAY),
    });
    this.fetchOrder();
  },

  onShow() {
    if (this.data.orderId) {
      this.fetchOrder();
    }
  },

  fetchOrder(onReady) {
    const openid = getApp().globalData.openid || '';
    db.collection('orders')
      .doc(this.data.orderId)
      .get({
        success: (res) => {
          const order = normalizeOrder(res.data);
          this.renderOrder(order, openid);
          if (typeof onReady === 'function') {
            onReady(order);
          } else {
            this.maybeAdvanceOrder(order);
          }
        },
      });
  },

  renderOrder(order, openid) {
    const oid = openid || getApp().globalData.openid || '';
    const status = order.status || 'pending';
    const isBorrower = !!(oid && order.borrowerOpenid === oid);
    const isPublisher = !!(oid && order.publisherOpenid === oid);
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

  /** 进入页面或刷新后，若条件已满足则补推进状态（避免双方确认后卡住） */
  maybeAdvanceOrder(order) {
    if (!order || this._advancing) return;
    if (order.status === 'pending' && this.canActivate(order)) {
      this.tryActivateOrder(order);
    } else if (order.status === 'active' && this.canComplete(order)) {
      this.tryCompleteOrder(order);
    }
  },

  canActivate(order) {
    return (
      order.payStatus === 'paid' || order.payStatus === 'settled'
    ) && !!(
      order.handoverImage &&
      order.borrowerHandoverOk &&
      order.publisherHandoverOk
    );
  },

  canComplete(order) {
    return !!(
      order.returnImage &&
      order.borrowerReturnOk &&
      order.publisherReturnOk
    );
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

  payRent() {
    if (!this.data.isBorrower) return;
    const { order, rentDisplay, mockPay } = this.data;
    if (order.payStatus === 'paid' || order.payStatus === 'settled') {
      return wx.showToast({ title: '租金已支付', icon: 'none' });
    }
    getApp().requireLogin(() => {
      const tip = mockPay
        ? `演示模式：确认将租金 ${rentDisplay} 托管至平台？`
        : `确认支付租金 ${rentDisplay}？`;
      wx.showModal({
        title: '支付租金',
        content: tip,
        confirmText: '确认支付',
        success: (res) => {
          if (res.confirm) this.doConfirmPay();
        },
      });
    });
  },

  doConfirmPay() {
    wx.showLoading({ title: '支付中' });
    wx.cloud.callFunction({
      name: 'confirmPay',
      data: {
        orderId: this.data.orderId,
        payMode: this.data.mockPay ? 'mock' : 'offline',
      },
      success: (res) => {
        wx.hideLoading();
        const result = res.result || {};
        if (result.success) {
          wx.showToast({ title: '租金已托管', icon: 'success' });
          this.fetchOrder();
        } else {
          wx.showToast({ title: result.errMsg || '支付失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '支付服务不可用', icon: 'none' });
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
      awaiting_confirm: ['current', '', '', ''],
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
          this.fetchOrder((order) => {
            wx.hideLoading();
            this.tryActivateOrder(order);
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  tryActivateOrder(order) {
    const o = order || this.data.order;
    if (!o || o.status !== 'pending' || !this.canActivate(o)) return;
    if (this._advancing) return;
    this._advancing = true;

    wx.showLoading({ title: '确认交接' });
    db.collection('orders')
      .doc(this.data.orderId)
      .update({
        data: { status: 'active' },
        success: () => {
          this._advancing = false;
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
          this._advancing = false;
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
          this.fetchOrder((order) => {
            wx.hideLoading();
            this.tryCompleteOrder(order);
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  tryCompleteOrder(order) {
    const o = order || this.data.order;
    if (!o || o.status !== 'active' || !this.canComplete(o)) return;
    if (this._advancing) return;
    this._advancing = true;

    wx.showLoading({ title: '结束订单' });
    db.collection('orders')
      .doc(this.data.orderId)
      .update({
        data: { status: 'done' },
        success: () => {
          this.invokeSettleRent(o, () => {
            this._advancing = false;
            wx.hideLoading();
            wx.setNavigationBarTitle({ title: '归还成功' });
            this.setData({
              showReturnSuccess: true,
              'order.status': 'done',
              'order.payStatus': o.payStatus === 'paid' ? 'settled' : o.payStatus,
              statusText: STATUS_TEXT.done,
              payStatusText:
                o.payStatus === 'paid' ? PAY_STATUS_TEXT.settled : PAY_STATUS_TEXT[o.payStatus],
              stepStates: this.computeStepStates('done'),
            });
          });
        },
        fail: () => {
          this._advancing = false;
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        },
      });
  },

  invokeSettleRent(order, done) {
    if (typeof order === 'function') {
      done = order;
      order = this.data.order;
    }
    if (!order || order.payStatus !== 'paid') {
      if (typeof done === 'function') done();
      return;
    }
    wx.cloud.callFunction({
      name: 'settleRent',
      data: { orderId: this.data.orderId },
      complete: () => {
        if (typeof done === 'function') done();
      },
    });
  },

  acceptBooking() {
    this.respondBooking('accept');
  },

  rejectBooking() {
    this.respondBooking('reject');
  },

  respondBooking(action) {
    if (!this.data.isPublisher) return;
    const title = this.data.order.itemTitle || '该物品';
    const isAccept = action === 'accept';
    wx.showModal({
      title: isAccept ? '接受预约' : '拒绝预约',
      content: isAccept
        ? `确定接受「${title}」的预约？`
        : `确定拒绝「${title}」的预约？`,
      confirmColor: isAccept ? '#00561F' : '#E53E3E',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中' });
        wx.cloud.callFunction({
          name: 'respondBooking',
          data: { orderId: this.data.orderId, action },
          success: (cfRes) => {
            wx.hideLoading();
            const result = cfRes.result || {};
            if (result.success) {
              wx.showToast({
                title: isAccept ? '已接受' : '已拒绝',
                icon: 'success',
              });
              if (isAccept) this.fetchOrder();
              else wx.navigateBack();
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
