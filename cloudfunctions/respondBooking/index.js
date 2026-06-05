const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function notifyBorrower(order, type) {
  if (!order.borrowerOpenid) return;
  const textMap = {
    order_accepted: `你的预约「${order.itemTitle}」已被出借方接受，请按时面交`,
    order_rejected: `你的预约「${order.itemTitle}」已被出借方拒绝`,
  };
  try {
    await db.collection('notifications').add({
      data: {
        recipientOpenid: order.borrowerOpenid,
        type,
        itemId: order.itemId || '',
        itemTitle: order.itemTitle || '物品',
        orderId: order._id,
        content: textMap[type] || '预约状态已更新',
        fromOpenid: order.publisherOpenid || '',
        fromNickname: '出借方',
        isRead: false,
        createTime: db.serverDate(),
      },
    });
  } catch (e) {
    // 通知失败不阻断主流程
  }
}

exports.main = async (event) => {
  const { orderId, action } = event;
  const { OPENID } = cloud.getWXContext();

  if (!orderId || !['accept', 'reject'].includes(action)) {
    return { success: false, errMsg: '参数无效' };
  }

  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;
    if (!order) {
      return { success: false, errMsg: '订单不存在' };
    }
    if (order.publisherOpenid !== OPENID) {
      return { success: false, errMsg: '仅出借方可处理预约' };
    }
    if (order.status !== 'awaiting_confirm') {
      return { success: false, errMsg: '该预约已处理' };
    }

    if (action === 'accept') {
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'pending',
          acceptedAt: db.serverDate(),
        },
      });
      await notifyBorrower({ ...order, _id: orderId }, 'order_accepted');
      return { success: true, status: 'pending' };
    }

    await db.collection('orders').doc(orderId).remove();
    await notifyBorrower({ ...order, _id: orderId }, 'order_rejected');
    return { success: true, status: 'rejected' };
  } catch (err) {
    return { success: false, errMsg: err.message || '操作失败' };
  }
};
