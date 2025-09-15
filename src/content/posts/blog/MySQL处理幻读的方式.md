---
title: MySQL处理幻读的方式
pubDate: 2025-05-27 10:14:18
tags: [SQL]
---

## REPEATABLE隔离级别

### SQL标准

REPEATABLE 级别的定义是：保证前面查询出来的结果集不被修改。

### 幻读(Phantom Read)

具体来讲，事务A查询年龄小于50的用户，第一次查询是张三、李四。事务B插入王五，45岁，提交事务。事务A再次查询，依旧是张三、李四（并且张三和李四的属性不变）就行。

如果事务A此时统计 年龄 < 50的数量，应该是3。并且，当事务A试图插入一条id和王五一样的数据师，会因为id重复插入失败。

### MySQL的实现

REPEATABLE 级别下，使用 MVCC + NEXT-KEY-LOCK( RECORD LOCK + GAP LOCK ) 尽量避免幻读。
1. select ... from ..., 这是快照读，事务中第一次快照读会创建快照(ReadView)
2. select ... from ... for update, 这是当前读，执行后
- 如果查询的column有索引，索引命中的记录会加RECORD LOCK, RECORD LOCK之间会加GAP LOCK，其他事务想修改加锁数据时会被阻塞。
```sql
// mysql -V 8.0
// age有索引, 在事务A中执行
select * from user where age between 5 and 10 for update;

// 在事务B中执行
insert into user(age) values(5); //阻塞
insert into user(age) values(9); //阻塞
insert into user(age) values(10); //阻塞
insert into user(age) values(12); //阻塞

// 阻塞，直到超时后，主键会自增，但不会有记录被插入

insert into user(age) values(4); //成功插入
```

```sql
select * from user where age = 5 for update;

// age = 5 的记录被加上Record锁，并且保证左右两边都要有一个Gap锁
// 如果 age = 5 两边有间隙，那么GapLock 范围是 (lastVal, curVal) && (curVal, nextVal)
// 如果 age 的分布是 4 5 7，那么GapLock范围是 [4, 5) && (5, 7)
```


阻塞时间：
```sql
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout'; // 50s
// 临时设置
SET SESSION innodb_lock_wait_timeout = 3;
```
- 如果查询的column没有索引，使用表锁，也就是锁住所有的Record，以及它们之间的间隙。


