const db = wx.cloud.database();
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
  },
  onLoad(options) {
    this.itemId = options.id;
    this.checkUserVerify();
    this.fetchItemAndOrders();
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
    db.collection('items')
      .doc(this.itemId)
      .get({
        success: (res) => {
          this.setData({ item: res.data });
        },
      });
    db.collection('orders')
      .where({ itemId: this.itemId })
      .get({
        success: (res) => {
          this.generateCalendar(res.data);
        },
      });
  },

  /**
   * 生成带星期对齐的真实日历
   * JS getDay(): 0=周日, 1=周一 … 6=周六
   * 调整为：0=周一 … 6=周日（中文习惯）
   */
  generateCalendar(orders) {
    const today = new Date();
    const now = new Date(); // 保留此刻时间，不作为禁用日期的基准（today 包含今天）

    // 今天在一周中的位置（调整后：周一=0，周日=6）
    const jsDay = today.getDay(); // 0=Sun, 1=Mon...6=Sat
    const startCol = jsDay === 0 ? 6 : jsDay - 1;

    // 显示月份范围
    const endDate = new Date(today.getTime() + 29 * 24 * 60 * 60 * 1000);
    const monthLabel = (today.getMonth() === endDate.getMonth())
      ? `${today.getMonth() + 1}月`
      : `${today.getMonth() + 1}月 — ${endDate.getMonth() + 1}月`;

    const cal = [];

    // 前面填充空占位格
    for (let i = 0; i < startCol; i++) {
      cal.push({ empty: true });
    }

    // 生成 30 天
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      // 判断是否已被借出
      let isDisabled = false;
      orders.forEach((order) => {
        if (dateStr >= order.startDate && dateStr <= order.endDate && order.status !== 'done') {
          isDisabled = true;
        }
      });

      cal.push({
        date: dateStr,
        year: year,
        month: month,
        day: day,
        disabled: isDisabled,
        selected: false,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }

    this.setData({ calendar: cal, currentMonth: monthLabel });
  },

  selectDate(e) {
    const idx = e.currentTarget.dataset.index;
    const day = this.data.calendar[idx];
    if (!day || day.empty || day.disabled) return;

    const cal = this.data.calendar;

    if (this.data.selectStep === 0) {
      // 第一步：选开始日期
      cal.forEach((c) => { if (!c.empty) c.selected = false; });
      cal[idx].selected = true;
      this.setData({ calendar: cal, startDate: day.date, endDate: '', selectStep: 1 });
    } else {
      // 第二步：选结束日期
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
      this.setData({ calendar: cal, endDate: day.date, selectStep: 0 });
    }
  },

  resetDates() {
    const cal = this.data.calendar;
    cal.forEach((c) => { if (!c.empty) c.selected = false; });
    this.setData({ calendar: cal, startDate: '', endDate: '', selectStep: 0 });
  },

  bookItem() {
    const app = getApp();
    app.requireLogin(() => {
      this.doBookItem();
    });
  },

  doBookItem() {
    if (!this.data.startDate || !this.data.endDate)
      return wx.showToast({ title: '请选择借用时间段', icon: 'none' });
    wx.showLoading({ title: '生成凭证中' });
    db.collection('orders').add({
      data: {
        itemId: this.data.item._id,
        itemTitle: this.data.item.title,
        startDate: this.data.startDate,
        endDate: this.data.endDate,
        finalDeposit: this.data.isVerified ? 0 : this.data.item.deposit,
        borrowerOpenid: getApp().globalData.openid,
        status: 'pending',
        createTime: db.serverDate(),
      },
      success: (res) => {
        wx.hideLoading();
        const app = getApp();
        app.globalData.pendingOrderTip = {
          orderId: res._id,
          itemTitle: this.data.item.title,
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
