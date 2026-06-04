const db = wx.cloud.database();
const MAX_COMMENT_LEN = 200;

Page({
  data: {
    item: {},
    isVerified: false,
    calendar: [],
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    currentMonth: '',
    startDate: '',
    endDate: '',
    selectStep: 0,
    rentDays: 0,
    rentTotal: '',
    comments: [],
    commentInput: '',
    loadingItem: true,
  },

  onLoad(options) {
    this.itemId = options.id;
    this.checkUserVerify();
    this.fetchItemAndOrders();
  },

  onShow() {
    if (this.itemId) {
      this.fetchComments();
    }
  },

  checkUserVerify() {
    const app = getApp();
    if (!app.globalData.isLoggedIn || !app.globalData.openid) {
      this.setData({ isVerified: false });
      return;
    }
    db.collection('users')
      .doc(app.globalData.openid)
      .get({
        success: (userRes) => {
          this.setData({ isVerified: userRes.data.isVerified || false });
        },
        fail: () => {
          this.setData({ isVerified: false });
        },
      });
  },

  fetchItemAndOrders() {
    this.setData({ loadingItem: true });
    wx.showLoading({ title: '加载中' });
    db.collection('items')
      .doc(this.itemId)
      .get({
        success: (res) => {
          this.setData({ item: res.data, loadingItem: false });
        },
        fail: () => {
          this.setData({ loadingItem: false });
          wx.showToast({ title: '物品加载失败', icon: 'none' });
        },
      });
    db.collection('orders')
      .where({ itemId: this.itemId })
      .get({
        success: (res) => {
          this.generateCalendar(res.data);
        },
        fail: () => {
          wx.showToast({ title: '日历加载失败', icon: 'none' });
        },
        complete: () => {
          wx.hideLoading();
        },
      });
  },

  fetchComments() {
    db.collection('comments')
      .where({ itemId: this.itemId })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
      .then((res) => {
        this.setData({ comments: res.data });
      })
      .catch(() => {
        wx.showToast({ title: '评论加载失败', icon: 'none' });
      });
  },

  generateCalendar(orders) {
    const today = new Date();
    const jsDay = today.getDay();
    const startCol = jsDay === 0 ? 6 : jsDay - 1;
    const endDate = new Date(today.getTime() + 29 * 24 * 60 * 60 * 1000);
    const monthLabel =
      today.getMonth() === endDate.getMonth()
        ? `${today.getMonth() + 1}月`
        : `${today.getMonth() + 1}月 — ${endDate.getMonth() + 1}月`;

    const cal = [];
    for (let i = 0; i < startCol; i++) {
      cal.push({ empty: true });
    }

    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      let isDisabled = false;
      orders.forEach((order) => {
        if (dateStr >= order.startDate && dateStr <= order.endDate && order.status !== 'done') {
          isDisabled = true;
        }
      });

      cal.push({
        date: dateStr,
        year,
        month,
        day,
        disabled: isDisabled,
        selected: false,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }

    this.setData({ calendar: cal, currentMonth: monthLabel });
  },

  calcRentEstimate() {
    const { startDate, endDate, item } = this.data;
    if (!startDate || !endDate || !item.rentPrice) {
      this.setData({ rentDays: 0, rentTotal: '' });
      return;
    }
    const days = this.countRentDays(startDate, endDate);
    const daily = parseFloat(item.rentPrice) || 0;
    const total = (days * daily).toFixed(2);
    this.setData({ rentDays: days, rentTotal: total });
  },

  countRentDays(start, end) {
    const s = new Date(start.replace(/-/g, '/'));
    const e = new Date(end.replace(/-/g, '/'));
    const diff = Math.round((e - s) / (24 * 60 * 60 * 1000));
    return diff + 1;
  },

  selectDate(e) {
    const idx = e.currentTarget.dataset.index;
    const day = this.data.calendar[idx];
    if (!day || day.empty || day.disabled) return;

    const cal = this.data.calendar;

    if (this.data.selectStep === 0) {
      cal.forEach((c) => {
        if (!c.empty) c.selected = false;
      });
      cal[idx].selected = true;
      this.setData(
        { calendar: cal, startDate: day.date, endDate: '', selectStep: 1 },
        () => this.calcRentEstimate()
      );
    } else {
      if (day.date < this.data.startDate) {
        return wx.showToast({ title: '结束日期不能早于开始', icon: 'none' });
      }

      const startIdx = cal.findIndex((c) => c.date === this.data.startDate);
      for (let i = startIdx; i <= idx; i++) {
        if (!cal[i].empty && cal[i].disabled) {
          return wx.showToast({ title: '包含不可借用的日期', icon: 'none' });
        }
        if (!cal[i].empty) {
          cal[i].selected = true;
        }
      }
      this.setData(
        { calendar: cal, endDate: day.date, selectStep: 0 },
        () => this.calcRentEstimate()
      );
    }
  },

  resetDates() {
    const cal = this.data.calendar;
    cal.forEach((c) => {
      if (!c.empty) c.selected = false;
    });
    this.setData(
      { calendar: cal, startDate: '', endDate: '', selectStep: 0, rentDays: 0, rentTotal: '' }
    );
  },

  copyContact(e) {
    const { type } = e.currentTarget.dataset;
    const item = this.data.item;
    const value = type === 'wechat' ? item.contactWechat : item.contactQQ;
    if (!value) {
      return wx.showToast({ title: '未填写联系方式', icon: 'none' });
    }
    wx.setClipboardData({
      data: value,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      },
    });
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value });
  },

  submitComment() {
    const app = getApp();
    app.requireLogin(() => {
      this.doSubmitComment();
    });
  },

  doSubmitComment() {
    const content = (this.data.commentInput || '').trim();
    if (!content) {
      return wx.showToast({ title: '请输入评论内容', icon: 'none' });
    }
    if (content.length > MAX_COMMENT_LEN) {
      return wx.showToast({ title: `最多${MAX_COMMENT_LEN}字`, icon: 'none' });
    }
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    wx.showLoading({ title: '发送中' });
    db.collection('comments')
      .add({
        data: {
          itemId: this.itemId,
          content,
          authorOpenid: app.globalData.openid,
          authorNickname: userInfo.nickName || '微信用户',
          createTime: db.serverDate(),
        },
        success: () => {
          wx.hideLoading();
          this.setData({ commentInput: '' });
          wx.showToast({ title: '已发送', icon: 'success' });
          this.fetchComments();
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '发送失败', icon: 'none' });
        },
      });
  },

  bookItem() {
    const app = getApp();
    app.requireLogin(() => {
      this.doBookItem();
    });
  },

  doBookItem() {
    if (!this.data.startDate || !this.data.endDate) {
      return wx.showToast({ title: '请选择借用时间段', icon: 'none' });
    }
    const item = this.data.item;
    wx.showLoading({ title: '生成凭证中' });
    db.collection('orders')
      .add({
        data: {
          itemId: item._id,
          itemTitle: item.title,
          startDate: this.data.startDate,
          endDate: this.data.endDate,
          rentDays: this.data.rentDays,
          finalDeposit: this.data.isVerified ? 0 : item.deposit,
          borrowerOpenid: getApp().globalData.openid,
          publisherOpenid: item.publisherOpenid || '',
          status: 'pending',
          createTime: db.serverDate(),
        },
        success: (res) => {
          wx.hideLoading();
          const app = getApp();
          app.globalData.pendingOrderTip = {
            orderId: res._id,
            itemTitle: item.title,
            startDate: this.data.startDate,
            endDate: this.data.endDate,
          };
          wx.switchTab({ url: '/pages/index/index' });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '预约失败，请重试', icon: 'none' });
        },
      });
  },
});
