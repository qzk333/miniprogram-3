const db = wx.cloud.database();

function buildPreview(content) {
  const text = (content || '').trim();
  return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}

/**
 * 评论/回复成功后创建通知：
 * - 在发布者物品下留言 → 通知发布者
 * - 回复某人的评论 → 通知被回复者
 * - 在发布者物品下回复他人 → 同时通知发布者（若发布者不是被回复者本人）
 */
function pushCommentNotifications({
  item,
  authorOpenid,
  authorNickname,
  commentId,
  content,
  replyTarget,
}) {
  const publisherOpenid = item.publisherOpenid || '';
  const preview = buildPreview(content);
  const tasks = [];
  const notified = new Set();

  const addNotify = (recipientOpenid, type) => {
    if (!recipientOpenid || recipientOpenid === authorOpenid || notified.has(recipientOpenid)) {
      return;
    }
    notified.add(recipientOpenid);
    tasks.push(
      db.collection('notifications').add({
        data: {
          recipientOpenid,
          type,
          itemId: item._id,
          itemTitle: item.title || '物品',
          commentId,
          content: preview,
          fromOpenid: authorOpenid,
          fromNickname: authorNickname || '微信用户',
          isRead: false,
          createTime: db.serverDate(),
        },
      })
    );
  };

  if (replyTarget && replyTarget.openid) {
    addNotify(replyTarget.openid, 'reply');
  }

  if (
    publisherOpenid &&
    publisherOpenid !== authorOpenid &&
    publisherOpenid !== (replyTarget && replyTarget.openid)
  ) {
    addNotify(publisherOpenid, replyTarget ? 'item_reply' : 'item_comment');
  }

  if (tasks.length === 0) return Promise.resolve();
  return Promise.all(tasks).catch(() => {});
}

module.exports = {
  pushCommentNotifications,
};
