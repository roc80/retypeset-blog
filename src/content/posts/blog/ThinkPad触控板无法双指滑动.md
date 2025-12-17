---
title: ThinkPad触控板无法双指滑动
pubDate: 2025-12-17 14:21:40
description: ''
updated: ''
tags:
  - 解决问题
draft: false
pin: 0
toc: true
lang: ''
abbrlink: 'think-pad-touch-pad'
---

### 问题
ThinkPad触控板无法双指滑动，很难受，根本用不了。
于是去搜解决办法，搜出来的教程说是要下载驱动。
找到SN以后，查对应的驱动一直搜索不到，问京东客服也无果。

*不应该浪费时间去问售前*

### 解决方案

1. 在[这里](https://pcsupport.lenovo.com/us/en)输入MachineTypeModule(可以在BIOS看到)
2. 出现对应机型，输入序列码SerialNumber(BIOS中可以看到)
3. ![think-pad-touch-pad-1](/images/think-pad-touch-pad-1.png)
4. 安装必要的 LenovoBridgeService后就可以开始在线更新了。

驱动更新完成后，重启PC，就可以双指滑动了。

感觉，手又回来了。ThinkPad没有外接键鼠的时候，触控板还得好用才行啊。
