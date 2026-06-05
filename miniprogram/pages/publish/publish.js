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
    description: '',
    contactWechat: '',
    contactQQ: '',
  },
  onLoad() {
    if (!getApp().globalData.isLoggedIn) {
      wx.showModal({
        title: '请先登录',
        content: '发布物品需要先登录',
        confirmText: '去登录',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/mine/mine' });
        },
      });
    }
  },

  onShow() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      return;
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
  inputDescription(e) {
    this.setData({ description: e.detail.value });
  },
  inputWechat(e) {
    this.setData({ contactWechat: e.detail.value });
  },
  inputQQ(e) {
    this.setData({ contactQQ: e.detail.value });
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
      if (!this.validateForm()) return;
      const rent = parseFloat(this.data.rentPrice);
      const deposit = this.data.deposit ? parseFloat(this.data.deposit) : 0;
      wx.showModal({
        title: '确认发布',
        content: `物品：${this.data.title}\n分类：${this.data.category}\n日租金：¥${rent}/天\n押金：¥${isNaN(deposit) ? 0 : deposit}`,
        confirmText: '确认发布',
        cancelText: '再想想',
        success: (res) => {
          if (res.confirm) this.doSubmitItem();
        },
      });
    });
  },

  validateForm() {
    if (!this.data.title || !this.data.imageUrl) {
      wx.showToast({ title: '请填写名称并上传主图', icon: 'none' });
      return false;
    }
    const rent = parseFloat(this.data.rentPrice);
    if (
      this.data.rentPrice === '' ||
      this.data.rentPrice === null ||
      isNaN(rent) ||
      rent < 0
    ) {
      wx.showToast({ title: '请填写日租金', icon: 'none' });
      return false;
    }
    return true;
  },

  doSubmitItem() {
    if (!this.validateForm()) return;
    const app = getApp();
    wx.showLoading({ title: '发布中' });
    db.collection('items').add({
      data: {
        title: this.data.title,
        rentPrice: this.data.rentPrice,
        deposit: this.data.deposit,
        category: this.data.category,
        image: this.data.imageUrl,
        description: this.data.description.trim(),
        contactWechat: this.data.contactWechat.trim(),
        contactQQ: this.data.contactQQ.trim(),
        publisherOpenid: app.globalData.openid,
        createTime: db.serverDate(),
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功' });
        this.setData({
          title: '',
          rentPrice: '',
          deposit: '',
          category: '数码电子',
          categoryIndex: 0,
          imageUrl: '',
          description: '',
          contactWechat: '',
          contactQQ: '',
        });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/my-publish/my-publish' });
        }, 1500);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布失败，请重试', icon: 'none' });
      },
    });
  },
});
