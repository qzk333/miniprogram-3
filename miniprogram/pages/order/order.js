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

Page({
  data: {
    orderId: '',
    order: {},
    statusText: '',
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
    db.collection('orders')
      .doc(this.data.orderId)
      .get({
        success: (res) => {
          const order = res.data;
          const status = order.status || 'pending';
          if (!this.data.showHandoverSuccess && !this.data.showReturnSuccess) {
            wx.setNavigationBarTitle({ title: STATUS_TITLE[status] || '订单详情' });
          }
          this.setData({
            order,
            statusText: STATUS_TEXT[status] || status,
            stepStates: this.computeStepStates(status),
          });
        },
      });
  },

  uploadPhoto(field) {
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

  confirmHandover() {
    getApp().requireLogin(() => {
      if (!this.data.order.handoverImage) {
        return wx.showToast({ title: '请先上传面交照片', icon: 'none' });
      }
      wx.showLoading({ title: '提交中' });
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
    });
  },

  confirmReturn() {
    getApp().requireLogin(() => {
      if (!this.data.order.returnImage) {
        return wx.showToast({ title: '请先上传归还照片', icon: 'none' });
      }
      wx.showLoading({ title: '提交中' });
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
    });
  },

  goToMyOrders() {
    this.setData({ showHandoverSuccess: false, showReturnSuccess: false });
    wx.switchTab({ url: '/pages/my-orders/my-orders' });
  },

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
