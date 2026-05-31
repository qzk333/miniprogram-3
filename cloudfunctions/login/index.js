// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 获取用户 OpenID 的核心逻辑
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  return {
    openid: wxContext.OPENID
  }
}