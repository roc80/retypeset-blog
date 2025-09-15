---
title: CrashCourseofCS
pubDate: 2024-05-30 21:37:09
tags: [CS]
---

> bump up a new level of abstraction

## CPU执行指令的优化

### 1、单指令流

指令的执行过程：Fetch--Decode--Execute

#### Pipelining流水线parallelize

![1](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/1.png)

##### 存在的问题

1. 如果指令间存在依赖，就不能parallel。——需要判断指令间的依赖关系
2. 当遇到条件判断时，speculative execution 会按照某个选择先执行。——若猜错，pipeline flush

### 2、多指令流

单个CPU内多核

多个CPU

神威﹒太湖之光：40960个CPU、每个CPU256核、FLOPS(Float Point Match Operations Per Second): 9.3亿亿

## 冯﹒诺依曼结构

![2](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/2.png)

## turing

图灵机可以实现任何计算 *（只要有足够的纸带、时间）*

### 停机问题

![3](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/3.png)

停机问题说明了：**不是所有问题都能用计算解决**

## SoftEnginnering

###### Beta版本

软件接近完成，但并未100%测试通过

###### Alpha版本

在Beta版本之前，错误较多，较粗糙，一般用于内部测试

## 光刻

![4](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/4.png)

## 文件系统

每个目录维护一张表，每一条record对应该文件的meta data，记录了该文件存在哪些block中。如果文件size增大到超过当前block空间，则会新增一个block。

删除文件——将该文件对应的record从当前文件夹维护的表格中删除

移动文件——删除srcDir中的record，tarDir中新增record

## 网络

多台电脑共享一个传输媒介，称之为：载波侦听多路访问（Carrier Sense Multiple Access）。

### World Wide Web vs Internet

Internet: 指的是传输电子或光信号，借助OSI Model 实现通信的信息传输网络。

WWW: 指的是以Internet为基础，在其上构建出的以单个网页为单位，网页间互相链接，所有的网页共同组成的网络。

### NetWork Neutrality

## 计算机安全

### authentication

从以下角度进行安全认证：

1. What You Know

   e.g. password, PIN. 通常建议大小写+数字、或是几个英文单词组成密码。防止Brut Force Attck Or Zombie NetWork

2. What You Have

   e.g. SSHKey 

3. What You Are

   e.g. all kinds of biometric identification skills, 这些认证方式不是百分百正确

**安全认证级别高的场景，推荐组合使用上述认证方式，比如：输入密码后还需要进行人脸识别。**

### access control

Bell-LaPadula 模型：不能向上（级访问权限的文件）读，不能向下写（，以防止上级文件信息泄露）。

### attacks

Phishing 钓鱼网站

trojan horses 恶意软件

NAND Mirroring 改写内存值

Exploit 漏洞

BufferOverflow BoundsChecking

Code Injection

Zero Day Vulnerability 零日漏洞

Worms Botnet DDos

### Encryption & Decryption

symmetric encryption & asymmetric encryption

#### DiffieHellman Cipher Exchange

it belongs to symmetric encryption.

单向函数，在DiffieHellman中是指数求模。

> $$
> B^E mod M = R
> $$

Base and Modulus are public, but exponent is secret.

It's difficult to get the value of E arrcoding to B,M and R.

![5](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/5.png)

![6](https://raw.githubusercontent.com/AbyssPraise/DrawingBoard/main/image/6.png)

## MachineLearning

最大化正确分类&&最小化错误分类

