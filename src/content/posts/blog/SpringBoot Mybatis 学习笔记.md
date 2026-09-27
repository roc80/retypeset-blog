---
title: "SpringBoot Mybatis 学习笔记"
pubDate: 2022-09-27 15:08:48
description: ''
updated: ''
tags:
  - Java
draft: false
pin: 0
toc: true
lang: ''
abbrlink: 'spring-boot-learning-note'
---

**Spring + SpringMVC + Mybatis**

围绕Spring框架构建的一套Java生态下的事实标准的解决方案。

介绍SpringFramework+SpringBoot（提供了SpringFramework的简易使用）

IoC、AOP、SpringMVC、Spring数据库访问

库（对自己写的代码拥有主动权，有选择性地调用别人写好的一些要反复使用的代码）、框架（按照别人列的框架填充自己的代码）

### IoC

**IoC是软件工程的思想，Spring是IoC市场上占据主导地位的一款产品。IoC仅是Spring的能力之一。**

Inversion of Control + Dependencies inject

IoC思想——通过依赖注入的形式实现

正向控制——我知道我要用到什么对象，先new出来这些对象，基于这些对象再new新的对象

反向控制——我不知道当前对象要构建出来需要提前构造什么对象。当构造当前对象的时候，看它的依赖关系，顺着依赖关系一层层去构造所需的对象。

> 依赖注入发生在**既是买方（需要别的bean完成当前对象的构造）又是卖方（提供自己可以生产的对象配方到容器中）**的对象中
>
> 因为：只有你是买方，你才会需要依赖的注入；只有你是卖方（将自己生产对象的控制权交给SpringIoC容器），Spring才能控制你生产对象的过程，完成依赖注入的动作。

#### bean

在Spring中，被Spring容器管理的对象称为bean。

#### 基于XML配置

实践中使用很少了

> 相当于在XML中，维护一个Map<bean的id(做唯一标识用的), 生产bean对应的配方>
>
> 配方中包含：这个bean是哪个类构造出来的，使用哪个构造方法，如果有依赖注入，是使用Setter()还是构造方法传入。简单模拟一下：如果配方中只是包含类的全名称（String类型的类名），通过默认构造方法构造。那么就可以得到这样一个beanDefinition-->Map<String,String>,代表id和类名的映射关系。
>
> 有了beanDefinition，Spring可以通过反射机制，由类名构造对象，得到beanMap: Map<String,Object>,这样在其他bean中使用context.getBean("填的是bean的名字，也就是id"),就会得到beanMap中对应的对象。

#### 基于注解

Spring在启动过程中扫描指定包下的类文件，根据其上是否添加注解，决定是否将其交由Spring管理。

```
1、通过在main函数中设置context，将其与XML文件关联，XML中<beans>内部有:<context:component-scan base-package="你要扫描的包，这个包下的类如果被@Component注解修饰，就会将这个类交给Spring管理">
2、在指定的包下创建要被Spring管理的类，类被@Component修饰
```

###### 如何进行类的注册？

@Component  组件 其他注解无法很好地契合时使用

@Controller 控制器 表示控制作用的时候，用该注解，注册到Spring中

@Service 服务 当一个类提供服务功能

@Repository 仓库 当一个类从类似MySQL这样的存储软件中进行数据读写时

@Configuration 当一个类进行一些额外的配置

1.构造方法注入bean——@AutoWired，通过该注解，可以选择特定的构造方法构造该对象，如果构造方法参数中依赖别的bean，则会先生成该对象。（不添加@Autowired注解的话就会默认执行无参构造）

2.setter()注入

3.属性注入

***注入：将一个bean注入到另一个bean中；属性注入：该属性所在的类只有先注册到 Spring，让Spring 来管理该类的实例化过程，Spring 产生的 bean 才能被注入。自己 new 出来的对象是不能进行属性注入的。***

一般将表过程的对象交给Spring管理，管理的对象默认是单例的。

```xml
// context关联的的xml文件中配置要扫描的所有类的根节点
<context:component-scan base-package=""/>
```

实例工厂方法注册到Spring中

```java
@Configuration
public class AppConfig {
    public AppConfig() {
        System.out.println("com.pl.ioc.AppConfig.AppConfig() called");
    }
    @Bean
    public String welcome() {
        System.out.println("com.pl.ioc.AppConfig.welcome() called");
        return "欢迎";
    }
}
```

当前类要使用Spring Bean注入其他类的单例对象，首先当前类需要被Spring管理（类顶部加 @Component等等之类的注解），其次，其他类也需要被Spring管理（可以被Spring实例化出来一个Bean）

*使用@Bean进行实例工厂方法的注册时，如果参数需要注册Bean，那么建议在形参前加上 @Autowired*

#### bean的其他知识点

> bean的实例化顺序
>
> 根据名字显式地注入bean
>
> bean的作用域、生命周期……
>
> （框架特性）bean的高级用法：@import、条件加载

bean的使用：直接获取bean | 通过依赖注入的方式使用bean

### 配置文件

Java中，默认配置文件是properties的格式。

key=value的格式，key是分段的。

SpringBoot创建的配置文件是resources下的application.properties，通过在里面添加内容来修改SpringBoot运行的默认逻辑。

#### 如何在代码中读取配置文件

1. SpringBoot中注册好了一个Environment对象
2. @Value+spEL，还可以类型转换，还可以设置默认项（当读取不到对应的key时，取默认值）
3. 读取多个key=value项时（具有统一前缀），将多个key封装成一个对象，在对象前加@ConfigurationProperties("统一前缀")，为所有的属性设置setter()

YML格式（中文支持好一些）中写配置信息，注意点：

- =换成：
- ：后面必须有一个空格

- 同名的情况下，yml会被properties覆盖


> 如何读取配置文件？
>
> 1. Environment对象
>

```java

     //Spring 在bean市场中已经注册好了Environment对象，代表着项目的配置环境
    Environment environment = context.getBean(Environment.class);
    String val = environment.getProperty("spring.main.banner-mode");  // application.properties文件就是由许多key=value构成，这里是通过Key 获取 value
    
```

> 
> 2. @Value+SpEL
> 
> 
>3. @ConfigurationProperties，

### 日志

Slf4j

```java
Logger log = LoggerFactory.getLogger(SomeClass.class);
这些类都是org.slf4j包下的
```

log.info("...")

如果输出要有参数，log.debug("{} + {} + {}", 100,200,300)  打印结果是：100+200+300

```java
Exception exc
log.error("...", exc);//打印异常调用栈
```

##### 日志级别

error:

系统当前出问题啦，应该让运营人员介入处理

warn:

系统当前遇到一些风险，希望被排查

info:

系统正常运行时的一些输出，一般不用管

debug:

正常情况下，不希望系统输出，为了排查问题，是需要系统输出更详细的信息的。

> 在yml配置文件中指定特定区域的日志级别
>
> logging：
>
> ​	level:
>
> ​		package_name.class_name: 日志级别

会输出当前级别及更高级别：error > warn > info > debug, 比当前设置的级别更低的日志不会输出。默认日志级别是info

将log输出到文件中：

> logging:
>
> ​	file:
>
> ​	  name: 文件名
>
> 它的日志是追加的

#### lombok库

要使用：1.装lombok插件；2.Maven依赖中添加lombok依赖

在编译期间，给某些注解修饰的类添加与注解对应的方法。

@ToString

@Getter@Setter （作用于所有属性）

@EqualsAndHashCode	

**@Data** 集成了上述的注解

**@Slf4j** 就可以直接使用日志了，不用再使用LoggerFactory了

**@SneakyThrows**  lombok会为我们把受查异常从方法签名抛出去或者在方法中用trycatch转为非受查异常。

------

### 对象代理

Mybatis的原理，SpringAOP的原理

当一个接口引用指向一个实现该接口的对象时：该接口实际上指向一个代理对象，这个代理对象内部维护了指向真正实现接口的对象的指针。

动态代理——接口：InvocationHandler

```java
public interface Flyable {
    void fly();
}
```

```java
public class Bird implements Flyable{

    @Override
    public void fly() {
        System.out.println("Bird.fly() 被调用");
    }
}
```

```java
public class FlyableFactory {
    // 不使用代理，直接在Factory中通过new创建对象
    public static Flyable create() {
        Flyable ins = new Bird();
        return ins;
    }
    // 使用代理
    public static Flyable createWithProxy() {
        BirdProxy proxy = new BirdProxy();
        Object o = Proxy.newProxyInstance(
                Flyable.class.getClassLoader(),
                new Class[]{Flyable.class},
                proxy);
        return (Flyable)o;
    }
}
```

```java
public class BirdProxy implements InvocationHandler {

    private Bird bird = new Bird();
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("开始执行 method.invoke()");
        method.invoke(bird);
        System.out.println("执行 method.invoke() 结束");
        return null;
    }
}
```

```java
public class Main {
    public static void main(String[] args) {
        Flyable ins;
//        ins = FlyableFactory.create();
        ins = FlyableFactory.createWithProxy();
        ins.fly();
    }
}
```

### Mybatis

依赖勾选：MySQL Driver + MyBatis Framework + Spring Data JDBC

Spring Data JDBC只是提供了一个注册好的DataSource对象，默认使用HikariDataSource而不是MysqlDataSource。HikariDataSource自带线程池，性能较好。

MySQL Driver引入mysql-connector-java,提供JDBC访问的底层支持。

配置文件中添加：数据库信息



##### 对数据库读写的解决方案

1、动态拼接SQL；

2、ORM（Object Relation Mapper） 把表映射成类，把表的记录映射成一个个对象，表的结构简单，关系不复杂的时候使用ORM方便。

Mybatis偏向ORM（Mybatis中有@Mapper），对动态SQL支持力度也可以。

Hibernate：更偏向ORM

Spring提供JPA方案，（更极端的ORM，基本看不到SQL，建库建表的过程都用的是对象）

spring jdbctemplate 更偏向动态SQL



*Hikari VS  Druid*

##### 基本原理：对象代理。

1. 给用户提供了接口，接口中有各种方法（接口用@Mapper修饰，为这个接口创建一个代理对象，进行数据映射。）

2. 对于这些方法：

   1. 告诉该方法它执行的是哪条SQL（@Select("要执行的sql")）

   2. 参数化SQL，将方法参数与SQL里的参数匹配起来（@Param("para_name")修饰形参, #{para_name}为sql中的参数）

   3. 将查询出来的表记录，与方法返回值（一般对象）进行映射

      若SQL中的表的字段名和对象中的属性名不一致，则需要进行映射：

      > 注解和XML配置均可，但是注解太麻烦了，这里介绍XML方式。
      >
      > 方式一：
      >
      > 给SQL语句中的字段名起别名使得查找出来的字段名和对象中的属性名一一对应。
      >
      > 方式二：
      >
      > 在对该类的Mapper的XML配置文件中，使用
      >
      > ```xml
      > <resultMap id="xxx" type="要进行映射的表字段名对应的对象的类全名">
      >     <id property="对象的属性（这个属性对应的表字段是主键，所以用id标签）" colum="表中与之相对的主键名称" />
      >     <result property="对象中的属性名" colum="表中的字段名"/>
      >     ...
      > </resultMap>
      > <!-- 在该方法对应的select标签内，将resultType="..."改为resultMap="xxx">
      > ```
      >
      

3. 提供一个代理对象，完成JDBC的整套流程

对于2中的流程：

1. 有使用注解的方法；

2. 也有使用XML的方法

   **用XML之前，得在配置文件（一般是application.xml 或者 application.yml，两者都有的话，xml优先级更高，配置文件会使用application.xml）中表明该类的XML搜索位置：**

   ```yaml
   mybatis:
     mapper-locations:
       - classpath:mapper/**-mapper.xml
   # 上述配置信息表明了：XML配置文件是，resources/mapper目录下的以 -mapper.xml结尾的所有文件
   # 两个**表示当前文件夹下的子孙文件，一个*表示当前目录的子文件
   ```

   **classpath对应的路径就是resources根目录，java目录编译后位于classpath下的一级目录**

*不同的方法之间，用注解和XML格式都行。*

```xml
// 示例，注解方式和XML方式的使用
<mapper namespace = "与此mapper标签对应的类的全名称">
<!-- 在mapper内部，则用select,insert等标签实现增删改查语句>
<select>
id 对应方法名， resultType或resultMap对应结果映射，方法参数对应SQL参数中的#{"给参数命的名"}
<insert>
<update>
<delete>
```



> Java编译后，类的属性名称会保留，方法形参名称是不保留的。

> 实现了CommandLineRunner接口的类，将其注入到Spring中，这样Spring在启动时，就会自动执行这个bean的run()，而不用在main()去使用getBean()来调用run()

##### 增删改查

```java
@Insert("sql")
// 如果希望插入时，自增字段随之改变，也插入到表里面，则这样设置：
// 1.使用注解，在方法上，加上
@options(useGeneratedKeys = true, keyProperty = "对象中的自增属性名", keyColum = "数据表中与之对应的字段名")
// 2.在XML<mapper>中
<select id = "与之对应的方法名" useGeneratedKeys = true, keyProperty = "对象中的自增属性名", keyColum = "数据表中与之对应的字段名">
```



##### [动态SQL](https://mybatis.org/mybatis-3/zh/dynamic-sql.html)

###### 批量插入/删除——用<foreach>

```xml
<insert>
    <foreach collection="参数" item="拿到的集合中的每一项的名字" separator="用什么分隔符分隔多条SQL">
        根据拿到的item的名字得到不同的参数，写SQL
    </foreach>
</insert>
```



### Spring AOP

Aspect Oriented Program 面向切面编程

AOP是一种编程思想，有不同的实现：Java方向，AspectJ 较早；

##### Aspect 切面

逻辑概念，放置公共业务，以及公共业务和具体业务如何产生配置关系的地方。

在SpringAOP中，就是@Aspect修饰的bean对象。



JoinPoint 连接点

切面和业务发生关系的地方，连接点可位于方法的执行、异常的抛出、类被加载时，SpringAOP中仅仅支持方法的执行这一个切入点。



##### Pointcut

哪些方法被切入

> 公共处理 和 哪些具体业务产生关系
>
> 若产生关联，是在什么地方关联
>
> 产生关联后，是在方法执行之前执行公共部分还是方法执行之后，或者其他时机。



##### 如何进行切入？  --> Weaving (编织)

###### 编织的时机

A.java  B.java  C.java

1. 编译期间，通过修改编译器代码

   ABC编译后变为一个字节码文件 T.class

2. 编译后，运行前

   A.class B.class C.class 变为 T.class

3. 运行期间（类被加载时）通过类加载器修改

4. 运行期间去修改，通过对象代理（SpringAOP的做法）



> 更改依赖中的实例，spring-boot-starter,在其后面添加-aop,开启SpringBoot的AOP功能



> AspectJ 使用较早，其使用方案在后来就被当做标准了，AspectJ定义了一组表达式的语法，来描述Pointcut，SpringAOP采用了这种语法，但是SpringAOP和AspectJ没有什么关系。
>
> @Pointcut("这里就用的AspectJ语法")，随用随查。也可以使用注解的方式。

##### AOP的原理

**对象代理**

实现方式：

1. JDK自带的Proxy，通过反射在方法执行前后，加上连接点。代理对象需要实现`InvocationHandler`接口
2. spring框架的CGLib库的Enhancer，为被代理对象生成一个Enhancer(加强) 对象，加强对象需要实现`MethodInterceptor`接口，最终还是使用java.lang.reflect

##### Advice 通知

Advice类型：

- @Before  方法执行前
- @After
- @AfterReturning  只有在 **没有抛出异常，正常return后** 才会进行通知
- @AfterThrowing  只有在抛出异常后，才会进行通知
- @Around  包裹住方法的执行过程，在方法执行前后都可以进行通知



##### 如何使用SpringAop?

1. 定义切面类  @Aspect

2. 在切面类中定义切点  @Pointcut

   定义切点的写法有多种（遵循AspectJ的语法）：

   1. @Pointcut("execution(<方法返回值类型> <包名.类名> <形参列表>)")   示例：

      ```java
      // 执行com.example.aop包下的所有类的所有方法时，被视作一个切点
      @Pointcut("execution(* com.example.aop.*.*(..))")  
      public void aPointCut() {}
      ```

   2. ```java
      @Pointcut("@annotation(com.example.anno.CalcExecTime)")
      public void bPointCut() {}
      ```

      在包 com.example.anno 下 自定义注解  CalcExecTime , 添加了该注解的方法执行时，被视作一个切点

3. 在切面类中定义基于切点的通知  @Before @After @Around  @AfterReturning @AfterThrowing	

   ```java
   @Before("aPointcut()")
   public void execCommonLogic() {
   	// 在aPointcut代表的切点之前，进行公共逻辑的切入
   }
   ```

##### AOP的应用场景

如果一个事务抽象为一个方法，该事务由多条SQL组成，那么在该方法前加上`@Transactional`注解，就可保证事务的acid。

### Web开发的实质

###### 整理各种Web资源

###### 各种资源产生关联的方式

1. HTML和其他资源间的关系：

   ```html
   通过 <img> <link> <srcipt> 或者 <form> <a>
   ```

2. Redirect 引导浏览器请求另一个资源

3. JS发起Ajax请求（浏览器不会处理请求后的响应，响应交给JS处理）

### Spring MVC

代码中的名字是 SpringWebMVC

**Spring MVC 基于Servlet API构建**

#### Servlet

```java
interface Servlet () {
    ...
	void service(ServletRequest req, ServletResponse resp);
    ...
}
// 每个资源都是一个Servlet实现类，req中有资源的路径
// 重写service,根据资源的路径，将req经过service()中的逻辑处理，映射到路径对应的资源对象上
```

```java
abstract class HttpServlet implements Servlet {
    doGet(HttpServletRequest req, HttpServletResponse resp);
    doPost(HttpServletRequest req, HttpServletResponse resp);
    ...
}
```

对于应用HTTP协议的Web资源，继承HttpServlet即可。

##### Servlet定位图

**浏览器发起的每个HTTP请求 --> 执行对应的Web资源对象（Servlet实例）的对应方法**

------

Spring MVC 实现了一个 `DispatcherServlet`类的对象（继承自`HttpServlet`），所有Web资源都交给该对象处理。

#### Thymeleaf

在前后端分离的场景下很少用到了

**注意！！！**

1. resource/templates/下的资源不是web资源（一个Web资源和一个Url一一对应）
2. thymeleaf通过 `spring.thymeleaf.prefix` + `ViewName` + `spring.thymeleaf.suffix` 找到模板

#### 如何获取参数

1. 前端通过queryString携带key=value格式的参数（GET or POST 都行）
2. 前端通过请求体中的form表单携带key=value格式的参数【前提：POST请求，且请求类型是 application/x-www-form-urlencoded】

无论通过queryString还是form表单，在Spring中的接口对应的方法中，可以这样来将前端传递的参数赋值给方法形参

```java
@RequestParam String dd  // 接收form表单中name为dd的参数值，可空

String dd  // 接收form表单中name为dd的参数值，可空
    
@RequestParam("value = ee") String dd  // 接收form表单中name为ee的参数值，不可空，若前端不传，则HTTPCode400

@RequestParam("value = ee", required = false) String dd  // 接收form表单中name为ee的参数值，可空
```
