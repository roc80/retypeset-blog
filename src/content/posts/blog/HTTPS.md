---
title: HTTPS
pubDate: 2024-11-30 21:08:50
tags: [Web]
---

## HTTP

### HTTP1.1(1997)

#### 基于TCP

TCP为了拥塞控制，慢启动

#### 浏览器控制一个域的TCP连接数

#### 单个TCP连接只能one by one 地进行请求响应

##### 队头阻塞（HTTP层面）

前面的请求-响应阻塞的话，后面所有的请求-响应都会阻塞

##### 队头阻塞（TCP层面）

发送窗口、接收窗口按序处理数据包

#### 首部重复、未经压缩

请求-响应中的首部往往存在大量重复首部

### HTTP2(2015)

#### 多路复用

同一个TCP连接可以存在多个stream，报文在多个stream内同时传输。任一Stream的 TCPsegment丢失，会导致其他正在进行的Stream阻塞。(原因：TCP队头阻塞)

#### 首部压缩

HPACK算法

#### 报文变成二进制帧

### HTTP3(2019)

#### TCP握手TLS握手整合

![7](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/7.png)

#### QUIC层快不是因为基于UDP

![8](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/8.jpg)

基于UDP是为了能够广泛部署

QUIC大部分内容是整合了TCP和TLS，并且**解决了TCP队头阻塞问题**

QUIC数据包会加密QUIC帧内容

QUIC数据包会添加 ConnectionID 用来表示是否是同一个连接。应用场景：WIFI切换4G，IP地址变了，连接没变，所以不用重新握手。