const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: false, errMsg: '未登录' };
  }

  try {
    const res = await db
      .collection('notifications')
      .where({
        recipientOpenid: OPENID,
        isRead: _.neq(true),
      })
      .update({
        data: { isRead: true },
      });
    return { success: true, updated: res.stats.updated || 0 };
  } catch (err) {
    return { success: false, errMsg: err.message || '标记已读失败' };
  }
};
