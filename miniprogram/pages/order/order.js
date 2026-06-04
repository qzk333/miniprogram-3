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
          wx.setNavigationBarTitle({ title: STATUS_TITLE[status] || '订单详情' });
          this.setData({
            order,
            statusText: STATUS_TEXT[status] || status,
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

  confirmHandover() {
    getApp().requireLogin(() => {
      db.collection('orders')
        .doc(this.data.orderId)
        .update({
          data: { status: 'active' },
          success: () => {
            wx.showToast({ title: '交接成功', icon: 'success' });
            this.fetchOrder();
          },
          fail: () => {
            wx.showToast({ title: '操作失败', icon: 'none' });
          },
        });
    });
  },

  confirmReturn() {
    getApp().requireLogin(() => {
      db.collection('orders')
        .doc(this.data.orderId)
        .update({
          data: { status: 'done' },
          success: () => {
            wx.showToast({ title: '订单已完成', icon: 'success' });
            this.fetchOrder();
          },
          fail: () => {
            wx.showToast({ title: '操作失败', icon: 'none' });
          },
        });
    });
  },

  goToMyOrders() {
    wx.navigateBack({
      fail: () => {
        wx.navigateTo({ url: '/pages/my-orders/my-orders' });
      },
    });
  },

  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
