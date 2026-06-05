function parseDateStr(str) {
  if (!str) return null;
  const d = new Date(str.replace(/-/g, '/'));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 从进行中订单里找出最近待办（待面交看 startDate，借用中看 endDate）
 */
function computeNextReminder(orders) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let best = null;

  (orders || [])
    .filter((o) => o.status === 'pending' || o.status === 'active')
    .forEach((order) => {
      const isPending = order.status === 'pending';
      const deadline = parseDateStr(isPending ? order.startDate : order.endDate);
      if (!deadline) return;
      const daysLeft = Math.round((deadline - today) / (24 * 60 * 60 * 1000));
      if (!best || deadline < best.deadline) {
        best = {
          order,
          deadline,
          daysLeft,
          action: isPending ? '面交' : '归还',
          dateLabel: formatMonthDay(deadline),
        };
      }
    });

  if (!best) return null;

  let reminderText = '';
  if (best.daysLeft < 0) {
    reminderText = `「${best.order.itemTitle}」已逾期，请尽快${best.action}`;
  } else if (best.daysLeft === 0) {
    reminderText = `「${best.order.itemTitle}」今天之前需${best.action}`;
  } else {
    reminderText = `「${best.order.itemTitle}」${best.dateLabel}之前需${best.action}`;
  }

  return {
    ...best,
    reminderText,
    itemTitle: best.order.itemTitle,
    orderId: best.order._id,
  };
}

module.exports = {
  computeNextReminder,
};
