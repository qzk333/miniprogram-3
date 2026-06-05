const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { orderId, payMode = 'mock' } = event;
  const { OPENID } = cloud.getWXContext();

  if (!orderId) {
    return { success: false, errMsg: '缺少订单 ID' };
  }

  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;
    if (!order) {
      return { success: false, errMsg: '订单不存在' };
    }
    if (order.borrowerOpenid !== OPENID) {
      return { success: false, errMsg: '仅借方可支付租金' };
    }
    if (!['pending', 'awaiting_confirm'].includes(order.status)) {
      return { success: false, errMsg: '当前状态不可支付' };
    }
    if (order.payStatus === 'paid' || order.payStatus === 'settled') {
      return { success: false, errMsg: '租金已支付' };
    }

    const rentTotal = parseFloat(order.rentTotal);
    if (!rentTotal || rentTotal <= 0) {
      return { success: false, errMsg: '订单租金无效' };
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        payStatus: 'paid',
        payMode,
        paidAt: db.serverDate(),
      },
    });

    return { success: true, rentTotal };
  } catch (err) {
    return { success: false, errMsg: err.message || '支付确认失败' };
  }
};
