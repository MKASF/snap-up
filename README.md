# 介绍

可以用来抢茅台

## 安装

1. .npmrc文件添加以下2个镜像

    `registry=https://registry.npm.taobao.org/`

    `PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors`

2. 当前文件目录执行`npm i`

## 使用

1. 第一次使用先要执行`npm run init`获取收获地址和eid、fp。执行时机要在抢购时间内才行，因为在抢购时间才能获取到抢购地址进入订单页面。

2. 执行`npm run start`。默认配置会在开始抢购1分钟前进入页面，建议不要修改这个。如果要修改，需要同步修改index.ts里的`addTime`这个常量。

## 注意事项

1. 打开浏览器后先进行手动登录

2. 抢购成功后需要手动进行支付
