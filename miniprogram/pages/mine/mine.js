const db = wx.cloud.database();
Page({
  data: {
    isLoggedIn: false,
    isVerified: false,
    userInfo: { nickName: '微信用户', avatarUrl: '' },
    verifiedEmail: '',
    email: '',
    code: '',
    isSending: false,
    publishedCount: 0,
    activeOrdersCount: 0,
    receivedOrdersCount: 0,
    unreadMessagesCount: 0,
  },

  onShow() {
    const app = getApp();
    const isLoggedIn = app.globalData.isLoggedIn;
    this.setData({ isLoggedIn });
    // 进入「我的」后立即隐藏 Tab 红点（「收到的预约」数字角标仍保留）
    app.hideMineTabRedDot();
    if (isLoggedIn) {
      this.syncUserFromCloud(app.globalData.openid);
    }
  },

  /**
   * 微信一键登录：直接通过云函数获取 openid，不再依赖已废弃的 getUserProfile
   */
  login() {
    wx.showLoading({ title: '登录中' });
    wx.cloud.callFunction({ name: 'login' })
      .then((cfRes) => {
        wx.hideLoading();
        const openid = cfRes.result.openid;
        this.saveLoginState(openid);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      });
  },

  saveLoginState(openid) {
    const app = getApp();
    app.globalData.isLoggedIn = true;
    app.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
    this.setData({ isLoggedIn: true });

    this.syncUserFromCloud(openid);
    getApp().refreshMineTabBadge();
  },

  /**
   * 统一的用户信息同步入口 —— 从云数据库拉取最新状态
   * 无论是登录、切换页面、修改资料后，都通过此方法刷新
   */
  syncUserFromCloud(openid) {
    const app = getApp();
    db.collection('users')
      .doc(openid)
      .get({
        success: (res) => {
          const data = res.data;
          const userInfo = {
            nickName: data.nickname || '微信用户',
            avatarUrl: data.avatarUrl || '',
          };
          // 同步到全局和本地存储
          app.globalData.userInfo = userInfo;
          wx.setStorageSync('userInfo', userInfo);
          this.setData({
            userInfo,
            isVerified: data.isVerified || false,
            verifiedEmail: data.email || '',
            // 恢复邮箱输入框（避免切页后丢失）
            email: data.email || this.data.email,
          });
        },
        fail: () => {
          // 用户记录不存在（首次登录），创建初始文档
          const defaultInfo = { nickName: '微信用户', avatarUrl: '' };
          app.globalData.userInfo = defaultInfo;
          wx.setStorageSync('userInfo', defaultInfo);
          db.collection('users')
            .doc(openid)
            .set({
              data: {
                openid,
                nickname: '微信用户',
                avatarUrl: '',
                isVerified: false,
                createTime: db.serverDate(),
              },
            });
          this.setData({ userInfo: defaultInfo, isVerified: false });
        },
      });
    // 查询统计数据
    this.fetchStats(openid);
  },

  checkAuthStatus() {
    this.syncUserFromCloud(getApp().globalData.openid);
  },

  // 查询"我的发布"和"我的租借"数量
  fetchStats(openid) {
    if (!openid) return;
    const _ = db.command;
    db.collection('items')
      .where({ publisherOpenid: openid })
      .count()
      .then(res => {
        this.setData({ publishedCount: res.total });
      })
      .catch(() => {});
    db.collection('orders')
      .where({
        borrowerOpenid: openid,
        status: _.in(['pending', 'active']),
      })
      .count()
      .then((res) => {
        this.setData({ activeOrdersCount: res.total });
      })
      .catch(() => {});
    db.collection('items')
      .where({ publisherOpenid: openid })
      .field({ _id: true })
      .get()
      .then((itemsRes) => {
        const itemIds = itemsRes.data.map((i) => i._id);
        const cond = itemIds.length
          ? _.or([{ publisherOpenid: openid }, { itemId: _.in(itemIds) }])
          : { publisherOpenid: openid };
        return db
          .collection('orders')
          .where(
            _.and([cond, { status: _.in(['pending', 'active']) }])
          )
          .count();
      })
      .then((res) => {
        const count = res.total;
        this.setData({ receivedOrdersCount: count });
        getApp().markReceivedBadgeSeen(count);
      })
      .catch(() => {});
    getApp()
      .fetchUnreadMessagesCount(openid)
      .then((count) => {
        this.setData({ unreadMessagesCount: count });
        getApp().markMessagesBadgeSeen(count);
      })
      .catch(() => {});
  },

  goToMyReceived() {
    const app = getApp();
    app.requireLogin(() => {
      wx.navigateTo({ url: '/pages/my-received/my-received' });
    });
  },

  goToMyMessages() {
    const app = getApp();
    app.requireLogin(() => {
      wx.navigateTo({ url: '/pages/my-messages/my-messages' });
    });
  },

  // --- 头像和昵称编辑（新版微信 API） ---

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    // 上传头像到云存储
    const openid = getApp().globalData.openid;
    const cloudPath = `avatars/${openid}-${Date.now()}.jpg`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: (res) => {
        const fileID = res.fileID;
        // 更新数据库
        db.collection('users')
          .doc(openid)
          .update({
            data: { avatarUrl: fileID },
          });
        // 更新本地状态
        const app = getApp();
        const newInfo = { ...this.data.userInfo, avatarUrl: fileID };
        app.globalData.userInfo = newInfo;
        wx.setStorageSync('userInfo', newInfo);
        this.setData({ 'userInfo.avatarUrl': fileID });
        wx.showToast({ title: '头像已更新', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
    });
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value.trim();
    if (!nickName || nickName === '微信用户') return;
    const openid = getApp().globalData.openid;
    // 更新数据库
    db.collection('users')
      .doc(openid)
      .update({
        data: { nickname: nickName },
      });
    // 更新本地状态
    const app = getApp();
    const newInfo = { ...this.data.userInfo, nickName };
    app.globalData.userInfo = newInfo;
    wx.setStorageSync('userInfo', newInfo);
    this.setData({ 'userInfo.nickName': nickName });
  },

  // --- 邮箱认证 ---

  inputEmail(e) {
    this.setData({ email: e.detail.value });
  },

  inputCode(e) {
    this.setData({ code: e.detail.value });
  },

  sendCode() {
    if (!this.data.email.includes('.edu.cn'))
      return wx.showToast({ title: '请输入有效的edu邮箱', icon: 'none' });
    this.setData({ isSending: true });
    wx.cloud.callFunction({
      name: 'sendEmail',
      data: { email: this.data.email },
      success: (res) => {
        if (res.result.success) {
          wx.showToast({ title: '验证码已发送至邮箱' });
        } else {
          wx.showToast({ title: '发送失败: ' + (res.result.msg || '请重试'), icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      },
      complete: () => {
        this.setData({ isSending: false });
      },
    });
  },

  isCodeExpired(codeSentAt) {
    if (!codeSentAt) return false;
    let sent = codeSentAt;
    if (sent && typeof sent === 'object' && sent.$date) {
      sent = new Date(sent.$date);
    } else if (!(sent instanceof Date)) {
      sent = new Date(sent);
    }
    const sentMs = sent.getTime();
    if (Number.isNaN(sentMs)) return false;
    return Date.now() - sentMs > 5 * 60 * 1000;
  },

  verifyCode() {
    if (!this.data.code || this.data.code.length !== 6)
      return wx.showToast({ title: '请输入6位验证码', icon: 'none' });

    const openid = getApp().globalData.openid;
    db.collection('users')
      .doc(openid)
      .get({
        success: (userRes) => {
          const storedCode = userRes.data.code;
          const storedEmail = userRes.data.email;

          if (this.isCodeExpired(userRes.data.codeSentAt)) {
            return wx.showToast({ title: '验证码已过期，请重新获取', icon: 'none' });
          }

          if (storedCode === this.data.code) {
            db.collection('users').doc(openid).update({
              data: {
                isVerified: true,
                email: storedEmail,
              },
              success: () => {
                this.setData({
                  isVerified: true,
                  verifiedEmail: storedEmail,
                });
                wx.showToast({ title: '认证成功！' });
              },
              fail: () => {
                wx.showToast({ title: '保存失败，请重试', icon: 'none' });
              },
            });
          } else {
            wx.showToast({ title: '验证码错误', icon: 'error' });
          }
        },
        fail: () => {
          wx.showToast({ title: '请先获取验证码', icon: 'none' });
        },
      });
  },
});
