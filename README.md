# 奶油指尖 · 美甲预约网站

手机端优先的奶油 ins 风美甲店预约系统。

## 功能

- 首页价目表与店铺须知
- 在线预约（选项目 → 选日期时间 → 填微信号/备注/参考图）
- 参考图上传 1–3 张（自动压缩，保存至 `data/uploads/`）
- 店主后台查看、筛选、删除预约记录，点击参考图放大查看

## 启动

```bash
npm install
npm start
```

浏览器打开：http://localhost:3000

- 顾客预约：首页 →「在线预约」
- 店主后台：http://localhost:3000/admin.html（默认密码 `meijia2025`）

## 自定义

| 项目 | 位置 |
|------|------|
| 店名 | `public/index.html`、`booking.html` 中的「奶油指尖」 |
| 服务项目与价格 | `public/js/data.js` |
| 管理密码 | 环境变量 `ADMIN_PASSWORD` 或默认 `meijia2025` |
| 可预约时段 | `public/js/data.js` 中的 `TIME_SLOTS` |

## 技术栈

Node.js + Express + SQLite（数据保存在 `data/bookings.db`）
