const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { orderId } = event;
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

    const isParty =
      order.borrowerOpenid === OPENID || order.publisherOpenid === OPENID;
    if (!isParty) {
      return { success: false, errMsg: '无权操作此订单' };
    }
    if (order.status !== 'done') {
      return { success: false, errMsg: '订单尚未完成' };
    }
    if (order.payStatus === 'settled') {
      return { success: true, alreadySettled: true };
    }
    if (order.payStatus !== 'paid') {
      return { success: false, errMsg: '租金未处于托管状态' };
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        payStatus: 'settled',
        settledAt: db.serverDate(),
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, errMsg: err.message || '结算失败' };
  }
};
