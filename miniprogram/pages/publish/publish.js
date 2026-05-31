const db = wx.cloud.database();
Page({
  data: {
    title: '',
    rentPrice: '',
    deposit: '',
    category: '数码电子',
    categoryIndex: 0,
    categories: [
      '数码电子',
      '学习资料',
      '正装礼服',
      '运动器材',
      '乐器',
      '日常工具',
      '出行装备',
      '其他',
    ],
    imageUrl: '',
  },
  onShow() {
    // 每次进入发布页时检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '请先登录',
        content: '发布物品需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/mine/mine' });
          }
        },
      });
    }
  },
  inputTitle(e) {
    this.setData({ title: e.detail.value });
  },
  inputRent(e) {
    this.setData({ rentPrice: e.detail.value });
  },
  inputDeposit(e) {
    this.setData({ deposit: e.detail.value });
  },
  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({
      categoryIndex: index,
      category: this.data.categories[index],
    });
  },

  uploadImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中' });
        const cloudPath = `items/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            this.setData({ imageUrl: uploadRes.fileID });
            wx.hideLoading();
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          },
        });
      },
    });
  },

  submitItem() {
    const app = getApp();
    app.requireLogin(() => {
      this.doSubmitItem();
    });
  },

  doSubmitItem() {
    if (!this.data.title || !this.data.imageUrl) {
      return wx.showToast({ title: '请完善信息', icon: 'none' });
    }
    const app = getApp();
    wx.showLoading({ title: '发布中' });
    db.collection('items').add({
      data: {
        title: this.data.title,
        rentPrice: this.data.rentPrice,
        deposit: this.data.deposit,
        category: this.data.category,
        image: this.data.imageUrl,
        publisherOpenid: app.globalData.openid,
        createTime: db.serverDate(),
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功' });
        this.setData({ title: '', rentPrice: '', deposit: '', category: '', imageUrl: '' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布失败，请重试', icon: 'none' });
      },
    });
  },
});
