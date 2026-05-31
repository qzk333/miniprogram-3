const db = wx.cloud.database();
Page({
  data: { orderId: '', order: {} },
  onLoad(options) {
    this.setData({ orderId: options.id });
    this.fetchOrder();
  },
  fetchOrder() {
    db.collection('orders')
      .doc(this.data.orderId)
      .get({
        success: (res) => {
          this.setData({ order: res.data });
        },
      });
  },

  uploadPhoto(field) {
    const app = getApp();
    app.requireLogin(() => {
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
          cloudPath: cloudPath,
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
              });
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
    const app = getApp();
    app.requireLogin(() => {
      db.collection('orders')
        .doc(this.data.orderId)
        .update({
          data: { status: 'active' },
          success: () => {
            wx.showToast({ title: '交接成功' });
            this.fetchOrder();
          },
        });
    });
  },

  confirmReturn() {
    const app = getApp();
    app.requireLogin(() => {
      db.collection('orders')
        .doc(this.data.orderId)
        .update({
          data: { status: 'done' },
          success: () => {
            wx.showToast({ title: '订单已完成' });
            this.fetchOrder();
          },
        });
    });
  },
});
