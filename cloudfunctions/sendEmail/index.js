// cloudfunctions/sendEmail/index.js
const cloud = require('wx-server-sdk')
const nodemailer = require('nodemailer')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { email } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 生成6位随机验证码
  const code = Math.floor(Math.random() * 900000) + 100000;

  // 配置发件邮箱（你需要替换成你自己的QQ邮箱和授权码）
  // QQ邮箱授权码获取方式：QQ邮箱 -> 设置 -> 账号 -> 开启SMTP服务 -> 生成授权码
  let transporter = nodemailer.createTransport({
    host: "smtp.qq.com",
    port: 465,
    secure: true,
    auth: {
      user: "2125325260@qq.com", // 替换
      pass: "omyyktumbasbbeia"  // 替换
    }
  });

  try {
    // 发送邮件
    await transporter.sendMail({
      from: '"校园借借认证中心" <2125325260@qq.com>', // 替换
      to: email,
      subject: "校园借借 - 学生邮箱认证",
      text: `您的认证验证码是: ${code}。该验证码5分钟内有效，请勿泄露给他人。`
    });

    // 将验证码和邮箱存入数据库，仅更新这两个字段，不覆盖其他用户信息
    const userDoc = await db.collection('users').doc(openid).get().catch(() => null);
    if (userDoc && userDoc.data) {
      // 已有用户记录，只更新验证码和邮箱
      await db.collection('users').doc(openid).update({
        data: {
          email: email,
          code: code.toString(),
          codeSentAt: db.serverDate(),
        }
      });
    } else {
      // 新用户，创建记录
      await db.collection('users').doc(openid).set({
        data: {
          openid: openid,
          nickname: '微信用户',
          avatarUrl: '',
          email: email,
          code: code.toString(),
          codeSentAt: db.serverDate(),
          isVerified: false,
          createTime: db.serverDate()
        }
      });
    }
    return { success: true, msg: '发送成功' }
  } catch (err) {
    return { success: false, msg: '发送失败', error: err }
  }
}
