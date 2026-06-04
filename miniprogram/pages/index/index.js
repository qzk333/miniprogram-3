const db = wx.cloud.database()
Page({
  data: {
    itemList: [],
    allItems: [],
    categories: ['全部', '数码电子', '学习资料', '正装礼服', '运动器材', '乐器', '日常工具', '出行装备', '其他'],
    activeCategory: '全部',
    searchText: ''
  },
  onShow() {
    this.fetchItems();
    this.showPendingOrderTip();
  },

  /** 预约成功后从详情返回首页时弹出一次性引导 */
  showPendingOrderTip() {
    const app = getApp();
    const tip = app.globalData.pendingOrderTip;
    if (!tip) return;
    app.globalData.pendingOrderTip = null;

    const dateRange = `${tip.startDate} 至 ${tip.endDate}`;
    wx.showModal({
      title: '预约成功',
      content: `「${tip.itemTitle}」\n${dateRange}\n\n面交时请打开「我的 → 我的租借」上传凭证并确认交接。`,
      confirmText: '我的租借',
      cancelText: '继续逛逛',
      success: (res) => {
        if (res.confirm) {
          const q = tip.orderId ? `?highlight=${tip.orderId}` : '';
          wx.navigateTo({ url: `/pages/my-orders/my-orders${q}` });
        }
      },
    });
  },
  fetchItems() {
    // 从云数据库拉取物品数据
    db.collection('items').orderBy('createTime', 'desc').get({
      success: res => {
        this.setData({ allItems: res.data }, () => {
          this.applyFilter();
        });
      },
      fail: err => {
        console.error('Fetch items failed', err);
      }
    })
  },
  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: category }, () => {
      this.applyFilter();
    });
  },
  onSearchInput(e) {
    const text = e.detail.value;
    this.setData({ searchText: text }, () => {
      this.applyFilter();
    });
  },
  applyFilter() {
    const { allItems, activeCategory, searchText } = this.data;
    let filtered = allItems;

    if (activeCategory !== '全部') {
      filtered = filtered.filter(item => item.category === activeCategory);
    }

    if (searchText && searchText.trim() !== '') {
      const keyword = searchText.trim().toLowerCase();
      filtered = filtered.filter(item => item.title && item.title.toLowerCase().includes(keyword));
    }

    this.setData({ itemList: filtered });
  },
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})