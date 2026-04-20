## 大麦-标准接入文档-V2.2.0

##### 总述：

##### 版本记录

## 一、正向链路接口：

part 1-大麦提供给供应商的接

总体说明：

1.1 业务说明：
1.2 业务流程说明
推送方式建议
1.3 系统接口协议
1.4 表格中参数约束符号含义
1.5 消息请求报文体结构
1.6 消息应答报文说明
接口详情
2.1 项目推送接口
2.1.1 业务说明：
2.1.2 请求条件
2.1.3 参数列表
2.1.4 输入示例
2.2 场次推送接口
2.2.1 业务说明：
2.2.2 请求条件
2.2.3 参数列表
2.2.4 输入示例
2.3 票品推送接口
2.3.1 业务说明：
2.3.2 请求条件
2.3.3 参数列表
2.3.4 输入示例
2.4 新优惠推送接口
2.4.1 业务说明：
2.4.2 请求条件
2.4.3 参数列表
2.4.4 输入示例
2.5 座位推送接口
2.5.1 业务说明：
2.5.2 请求条件
2.5.3 参数列表
2.5.4 输入示例
2.6 座位状态同步接口
2.6.1 业务说明：
2.6.2 请求条件
2.6.3 参数列表
2.6.4 输入示例

Part 2-供应商需提供的接口：
1. 总体说明：
1.1 业务说明：
1.2 系统接口协议
1.3 表格中参数约束符号含义
1.4 消息请求头结构
消息签名规则
1.5 消息响应头结构
1.6 用户下单流程图
2. 接口详情
2.1 锁座接口
2.1.1 业务说明：
2.1.2 请求条件
2.1.3 参数列表
入参列表
响应列表
2.1.4 输入示例
请求报文
响应报文
2.2 支付回调接口
2.2.1 业务说明：
2.2.2 请求条件
2.2.3 参数列表
响应列表
2.2.4 输入示例
2.3 获取电子票接口
2.3.1 业务说明：
2.3.2 请求条件
2.3.3 参数列表
2.3.4 输入示例
2.4 订单取消接口
2.4.1 业务说明：
2.4.2 请求条件
2.4.3 参数列表
2.4.4 输入示例

3. 接口服务响应代码

二、逆向链路接口：

1. 总体说明：
1.1 业务说明：
1.1.1 退票规则推送：
退款规则同步数据结构（修改原项目同步入参即可，如下）
退票规则补充说明：
条件退规则推送代码示例如下：

1.2 系统接口协议
1.3 表格中参数约束符号含义
1.4 消息请求报文体结构
1.5 消息应答报文说明
2.1 核验状态同步接口
2.1.1 业务说明：
2.1.2 请求条件
2.1.3 参数列表
2.1.4 输入示例
2.2 退票申请接口
2.2.1 业务说明：
2.2.2 请求条件
2.3.3 参数列表
2.2.4 输入示例
2.3 退票结果通知接口
2.3.1 业务说明：
2.3.2 请求条件
2.3.3 参数列表
2.3.4 输入示例
3. 接口服务响应代码
档总附录

## 总述：

• 本文档用于大麦票务系统与合作方票务系统的对接，统一规范双方的票务产品形态，使得合作方的项目可在大麦网实现同步展示、销售等功能。
● 本文档主要分为两大部分：正向链路接口和逆向链路接口。

正向链路接口再分为：大麦提供给供应商的接口、供应商需提供的接口。大麦提供给供应商的接口用于供应商将项目信息等数据推送至大麦；供应商需提供的接口用于大麦在用户下单购买等环节调用。
☐ 逆向链路接口主要用于换票&验票状态的回传、退票（开发中）等

· 前置接入条件：开始接入前，贵方需：
完成在大麦商家中心的注册

申请apiKey与apiPw，并将请求API服务的IP告知大麦
☐ 向大麦索要接口签名
• 上述环节如有疑问，请与对应商务同学联系

### 版本记录


<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>日期</td><td style='text-align: center; word-wrap: break-word;'>版本</td><td style='text-align: center; word-wrap: break-word;'>说明</td><td style='text-align: center; word-wrap: break-word;'>修改人</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>2023/4/1</td><td style='text-align: center; word-wrap: break-word;'>V2.0.0</td><td style='text-align: center; word-wrap: break-word;'>文档创建</td><td style='text-align: center; word-wrap: break-word;'>十海、临尧</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>2023/9/18</td><td style='text-align: center; word-wrap: break-word;'>V2.0.1</td><td style='text-align: center; word-wrap: break-word;'>优惠能力新增：（1）移除原有的优惠接口（2）新增能力更加丰富的优惠接口</td><td style='text-align: center; word-wrap: break-word;'>临尧</td></tr><tr><td rowspan="2">2024/3/12</td><td rowspan="2">V2.0.2</td><td style='text-align: center; word-wrap: break-word;'>锁座接口增加字段（锁座接口蓝色字体部分）：（1） 票品信息新增票品类型字段、及命中优惠字段（2） 商品信息新增单票品对应的套票id字段</td><td rowspan="2">渐境</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>套票能力新增：有座项目新增自由组合套票能力</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>2024/6/18</td><td style='text-align: center; word-wrap: break-word;'>V2.0.3</td><td style='text-align: center; word-wrap: break-word;'>项目推送接口增加字段，支持海报和详情同步</td><td style='text-align: center; word-wrap: break-word;'>兆舟</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>2024/8/5</td><td style='text-align: center; word-wrap: break-word;'>V2.1.0</td><td style='text-align: center; word-wrap: break-word;'>支持票单核验状态回传大麦</td><td style='text-align: center; word-wrap: break-word;'>十海、临尧</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>2025/6/623</td><td style='text-align: center; word-wrap: break-word;'>V2.2.0</td><td style='text-align: center; word-wrap: break-word;'>支持退票</td><td style='text-align: center; word-wrap: break-word;'>十海、兆舟</td></tr></table>

## 一、正向链路接口：

### Part 1—大麦提供给供应商的接口：

### 1. 总体说明：

#### 1.1 业务说明：

i. 大麦提供给供应商的接口主要用于供应商将商品/项目/演出信息、库存/座位状态等数据传输给大麦，大麦根据这些数据信息将项目上架至大麦网或将已有的项目信息更新。

ii. 大麦的商品数据主要包括三个维度：项目、场次、票品。票品对场次、场次对项目都为可对应的从属关系，即某一票品需对应且属于某一场次、某一场次需对应且属于某一项目。

iii. 项目、场次、票品各维度上都有标签，且都向下生效。如：项目维度分为有座项目与无座项目，若某一项目为有座项目，则该项目下所有场次都为有座场次。

iv. 以当前时间为准，已过期的项目、场次、票品请勿推送。

v. 项目维度下有效场次的票品总数不能超过1000个，超出后会导致部分场次不显示。

#### 1.2 业务流程说明

<div style="text-align: center;"><img src="https://pplines-online.bj.bcebos.com/deploy/official/paddleocr/pp-ocr-vl-15//c09e3a67-5ea9-4990-832b-4c9a72498417/markdown_1/imgs/img_in_image_box_108_115_1078_1492.jpg?authorization=bce-auth-v1%2FALTAKzReLNvew3ySINYJ0fuAMN%2F2026-04-07T03%3A19%3A05Z%2F-1%2F%2F2009f1f2dd55d5c36c61ea93dd09c05e501085cb6105e03b4be7ba276bf0181e" alt="Image" width="79%" /></div>


上架项目到

大麦官网

推送方式建议

方式一：项目数据信息改变时触发+失败重试（建议方式）
方式二：定时任务推送（需要推送限制频率）

建议10～20分钟一次

#### 1.3 系统接口协议

接口使用JSON方式进行交互，采用UTF-8编码

#### 1.4 表格中参数约束符号含义

<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>约束符号</td><td style='text-align: center; word-wrap: break-word;'>含义</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>非必填</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>必填</td></tr></table>

#### 1.5 消息请求报文体结构

Java

1 {
2 "signed " : {
3 "signInfo" : "消息签名",
4 "timeStamp" : "时间戳"
5 }
6 }



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>长度</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signInfo</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>消息签名</td><td style='text-align: center; word-wrap: break-word;'>对接时请通过邮件申请</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>timeStam</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>当前毫秒时间</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>p</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>戳</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

#### 1.6 消息应答报文说明

Java

1 = {
    2     "code": "0",
    3     "desc": "成功"
}



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>长度</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>code</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应码</td><td style='text-align: center; word-wrap: break-word;'>具体见响应码列表</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>desc</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应描述</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

### 2. 接口详情

#### 2.1 项目推送接口

##### 2.1.1 业务说明：

1、本接口用于供应商推送项目相关数据，每次推送需包含项目纬度的全部信息

2、海报和详情首次推送有效，海报和详情不允许更新，如果需要更新请线下联系BD更新

3、当前版本已经更新了退票能力，如果接入退票能力，请在本接口中同步推送项目退票规则，退票规则同步详情可见第二章【逆向链路接口】中1.1.1

##### 2.1.2 请求条件

• 请求URL：/b2b2c/2.0/sync/project

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.1.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>projectInfo</td><td style='text-align: center; word-wrap: break-word;'>ProjectInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目信息对象</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>venuelInfo</td><td style='text-align: center; word-wrap: break-word;'>VenuelInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆信息对象</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过100</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>chooseSeatFla</td><td style='text-align: center; word-wrap: break-word;'>boolean</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>是否选座项目</td><td style='text-align: center; word-wrap: break-word;'>true: 选座, false: 无座</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>g</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>posters</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>海报</td><td style='text-align: center; word-wrap: break-word;'>海报图片地址, 大小不超过3MB, 互联网可访问, 图片格式: png, jpeg, jpg, bmp, webp</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>introduce</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>详情</td><td style='text-align: center; word-wrap: break-word;'>大小不超过25000字节 (GBK编码格式下)</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过100</td></tr></table>





##### 2.1.4 输入示例

{
    "projectInfo": {
        "chooseSeatFlag": true,
        "name": "you座测试项目请不要拍",
        "id": "2549337712832",
        "posters": "http://xxxx.jpg",
        "introduce": "详情"
    },
    "venueInfo": {
        "name": "测试场馆",
        "id": "2549337712832"
    },
    "signed": {
        "timeStamp": "1631757264606",
        "signInfo": "请使用申请的签名"
    }
}

#### 2.2 场次推送接口

##### 2.2.1 业务说明：

1、目前不支持纸质票项目

2、单看台jpg底图场次，强制使用大麦默认的场馆底图，该情况venueJpgImg可以不传具体图片，可传XXX

3、如果舞台不在场馆最前方，需要传SVG底图

4、多看台项目，需使用SVG底图

##### 2.2.2 请求条件

• 请求URL：/b2b2c/2.0/sync/perform

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.2.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>projectId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>performs</td><td style='text-align: center; word-wrap: break-word;'>List&lt;PerformInputDT&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次信息集合</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>performNa</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次名称</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>me</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>status</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次状态</td><td style='text-align: center; word-wrap: break-word;'>0:禁用或1:启用</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>saleStartTi</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>销售开始时间</td><td style='text-align: center; word-wrap: break-word;'>格式为:yyyy-MM-dd</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>me</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>HH:mm:ss</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>saleEndTim</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>销售结束时间</td><td style='text-align: center; word-wrap: break-word;'>格式为:yyyy-MM-dd</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>e</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>HH:mm:ss</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>showTime</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>演出开始时间</td><td style='text-align: center; word-wrap: break-word;'>格式为:yyyy-MM-dd</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>HH:mm:ss</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>endTime</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>演出结束时间</td><td style='text-align: center; word-wrap: break-word;'>格式为:yyyy-MM-dd</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>HH:mm:ss</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>tTypeAndD</td><td style='text-align: center; word-wrap: break-word;'>Map&lt;Integer,</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>取票方式And电子票</td><td style='text-align: center; word-wrap: break-word;'>key=1（纸质票）,value:</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>Method</td><td style='text-align: center; word-wrap: break-word;'>Integer[]&gt;</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>3=快递;4=上门自取;----</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>转字符串</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>暂不支持，请不要使用</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>key=2（电子票）value:</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>电子票类型:1=身份证电子票;2=二维码电子票;3=串码</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>即目前只支持电子票</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>ruleType</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>实名制规则不能为空</td><td style='text-align: center; word-wrap: break-word;'>0=非实名</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>1=一单一证2=一票一证</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>certTypes</td><td style='text-align: center; word-wrap: break-word;'>List&lt;Integer&gt;</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>证件类型，实名制情况必填</td><td style='text-align: center; word-wrap: break-word;'>1=身份证，2=护照，3=港澳通行证，4=台胞证，7=港澳台居民居住证 8=外国人永久居留身份证</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>venueJpgl</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>jpg格式场馆底图</td><td style='text-align: center; word-wrap: break-word;'>格式为去头的base64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>mg</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>jpg和svg格式场馆底图必须传一个</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>venueSvgl</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>svg格式场馆底图</td><td style='text-align: center; word-wrap: break-word;'>格式为svg文件中的文本内容</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>mg</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>jpg和svg格式场馆底图必须传一个</td></tr></table>





##### 2.2.4 输入示例

{
    "salesTime": "2023-05-16 08:00:00",
    "salesTime": "2023-01-01 08:00:00",
    "typeAndMethod": "2: [1]",
    "performName": "5月16号 8:00",
    "ruleType": 1,
    "showTime": "2023-05-16 08:00:00",
    "certTypes": [
        1,
        1,
        "endTime": "2023-05-20 18:00:00",
        "id": "3",
        "status": 1,
        "venueJpgImg": "xx"
    ]
},
"signed": {
    "timeStamp": "1631757264606",
    "signInfo": "请使用申请的签名"
},
"projectId": "349337712877"
}

#### 2.3 票品推送接口

##### 2.3.1 业务说明：

### 1、不支持票价修改

##### 2.3.2 请求条件

• 请求URL：/b2b2c/2.0/sync/price

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.3.3 参数列表



<table border="1" style="margin: auto; word-wrap: break-word;"><tr><td style="text-align: center; word-wrap: break-word;">元素名称</td><td style="text-align: center; word-wrap: break-word;">类型</td><td style="text-align: center; word-wrap: break-word;">是否必填</td><td style="text-align: center; word-wrap: break-word;">描述</td><td style="text-align: center; word-wrap: break-word;">说明</td></tr><tr><td style="text-align: center; word-wrap: break-word;">projectId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">项目ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">performId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">场次ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">priceList</td><td style="text-align: center; word-wrap: break-word;">List&lt;Pricelnfo&gt;</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票品集合</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">packages</td><td style="text-align: center; word-wrap: break-word;">List&lt;TicketPackageInfo&gt;</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">套票集合</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">signed</td><td style="text-align: center; word-wrap: break-word;">Signed</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">签名信息</td><td style="text-align: center; word-wrap: break-word;">见1.4请求报文结构</td></tr><tr><td style="text-align: center; word-wrap: break-word;">id</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票价ID</td><td style="text-align: center; word-wrap: break-word;">长度不能超过64</td></tr><tr><td style="text-align: center; word-wrap: break-word;">name</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票品名称</td><td style="text-align: center; word-wrap: break-word;">长度不能超过64</td></tr><tr><td style="text-align: center; word-wrap: break-word;">desc</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">票品描述</td><td style="text-align: center; word-wrap: break-word;">长度不能超过100</td></tr><tr><td style="text-align: center; word-wrap: break-word;">price</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票价</td><td style="text-align: center; word-wrap: break-word;">单位分</td></tr><tr><td style="text-align: center; word-wrap: break-word;">saleState</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票品状态</td><td style="text-align: center; word-wrap: break-word;">1可售，2不可售</td></tr><tr><td style="text-align: center; word-wrap: break-word;">color</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">票品颜色</td><td style="text-align: center; word-wrap: break-word;">hex格式如：#FFFFFF</td></tr><tr><td style="text-align: center; word-wrap: break-word;">stockNumb</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">总库存</td><td style="text-align: center; word-wrap: break-word;">无座时使用，默认9999</td></tr><tr><td style="text-align: center; word-wrap: break-word;">er</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">无座项目总库存不可以修改为小于已售库存数量</td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">TicketPackageInfo</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">id</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">套票ID</td><td style="text-align: center; word-wrap: break-word;">长度不能超过64</td></tr><tr><td style="text-align: center; word-wrap: break-word;">name</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">套票名称</td><td style="text-align: center; word-wrap: break-word;">长度不能超过64</td></tr><tr><td style="text-align: center; word-wrap: break-word;">desc</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">票品描述</td><td style="text-align: center; word-wrap: break-word;">长度不能超过100</td></tr><tr><td style="text-align: center; word-wrap: break-word;">price</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">套票价格</td><td style="text-align: center; word-wrap: break-word;">单位分</td></tr><tr><td style="text-align: center; word-wrap: break-word;">packageTy</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">套票类型</td><td style="text-align: center; word-wrap: break-word;">固定套票=1、自由组合套票=2（固定套票仅支持有座项目）</td></tr><tr><td style="text-align: center; word-wrap: break-word;">pe</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">saleState</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">套票状态</td><td style="text-align: center; word-wrap: break-word;">1可售，2不可售</td></tr><tr><td style="text-align: center; word-wrap: break-word;">packagelnf</td><td style="text-align: center; word-wrap: break-word;">List&lt;PackageInfo&gt;</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">套票子票品信息集合</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td colspan="5">PackageInfo</td></tr><tr><td style="text-align: center; word-wrap: break-word;">priceld</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">子票ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">ticketNum</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">子票数量</td><td style="text-align: center; word-wrap: break-word;">必须大于0</td></tr></table>




##### 2.3.4 输入示例

{
    "performId": "3",
    "signed": {
        "timeStamp": "1631757264606",
        "signInfo": "请使用申请的签名"
    },
    "packages": [
        {
            "price": 2000,
            "name": "3张2块",
            "saleState": 1,
            "id": "11",
            "packageInfo": [
                {
                    "ticketNum": 3,
                    "priceId": "1093377350045097344"
                }
            ],
            "packageType": 1,
            "desc": "1"
        }
    ],
    "projectId": "349337712877",
    "priceList": [
        {
            "price": 1000,
            "name": "AAA1",
            "saleState": 1,
            "id": "1093377350045097344",
            "desc": "AAA"
        },
        {
            "price": 1,
            "name": "AAAA2",
            "saleState": 1,
            "id": "1093377350045097345",
            "desc": "AAA2"
        }
    ],
    "price": 2,
    "name": "AAA3",
    "saleState": 1,
    "id": "1093377350045097346",
    "desc": "AAA3",
    "color": "#040A78"
}

46

47

48

}

]

#### 2.4 新优惠推送接口

##### 2.4.1 业务说明：

1、支持优惠修改

2、该接口为场次维度的优惠接口，在同一次请求中必须把该场次下的所有优惠传送过来，如果没传就表示下架优惠。

3、原有接口目前还可以正常使用，请尽快替换为该接口

替换接口原则：已经使用过老优惠接口的项目继续使用老优惠接口，新增的项目使用当前优惠接口

##### 2.4.2 请求条件

• 请求URL：/b2b2c/2.0/sync/perform/activity

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.4.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>projectId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>performanceId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>activityList</td><td style='text-align: center; word-wrap: break-word;'>List&lt;ActivityParDTO&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠活动集合</td><td style='text-align: center; word-wrap: break-word;'>如果需要全部下架，请有空集合</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td colspan="5">ActivityParDTO</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>activityId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>startTime</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠生效时间</td><td style='text-align: center; word-wrap: break-word;'>1695125231000</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>endTime</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠结束时间</td><td style='text-align: center; word-wrap: break-word;'>1696125232000</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>activityRule</td><td style='text-align: center; word-wrap: break-word;'>ActivityRuleParDT</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠规则</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>activityItemI</td><td style='text-align: center; word-wrap: break-word;'>List&lt;String&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>优惠票品范围</td><td style='text-align: center; word-wrap: break-word;'>为使用该优惠的票价ID集合</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>dList</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>注意目前仅支持传一个票品</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>





##### 2.4.4 输入示例

{
    "performanceId": "1",
    "activityList": [
        {
            "activityRule": {
                "actionPrice": "6",
                "conditionNum": 2,
                "conditionType": "4",
                "actionPriceType": "2"
            },
            "startTime": "1690855200000",
            "activityId": "7111111111",
            "name": "每满2件打6折",
            "endTime": "1700297347000",
            "activityItemIdList": [
                "1093377350045097344"
            ]
        }
    ],
    "projectId": "88232",
    "signed": {
        "timeStamp": "173175726460336",
        "signInfo": "Zxx="
    }
}

#### 2.5 座位推送接口

##### 2.5.1 业务说明：

1、座位信息不能变更，如票品、看台、坐标等

##### 2.5.2 请求条件

• 请求URL：b2b2c/2.0/sync/seat

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.5.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>project</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>ld</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>perfor</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>mld</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>stands</td><td style='text-align: center; word-wrap: break-word;'>List&lt;StandInfo&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>看台信息集合</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>floors</td><td style='text-align: center; word-wrap: break-word;'>List&lt;FloorInfo&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>楼层信息集合</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>seats</td><td style='text-align: center; word-wrap: break-word;'>List&lt;SeatInfo&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位信息集合</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>StandInfo</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>看台ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>看台名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>standR</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>看台坐标</td><td style='text-align: center; word-wrap: break-word;'>多看台底图或者svg底图</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>c</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>的时候必填</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>看台坐标,需顺时针传</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>格式如下：76,371|168,392|162,437|113,437|88,431|54,410</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>FloorInfo</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>楼层ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>楼层名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>seats</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>desc</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>座位描述</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>standId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>看台ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>floorId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>楼层ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>rowName</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>行名称</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>xCoord</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位X坐标</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>yCoord</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位Y坐标</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>





##### 2.5.4 输入示例

{
    "stands": [
        {
            "name": "看台1",
            "id": "688122776762060800",
            "standRc": "0.0, 0.0 | 0.0, 0.0 | 0.0, 0.0 | 0.0, 0.0"
        }
    ],
    "performId": "3",
    "floors": [
        {
            "name": "1层",
            "id": "3b9bfce5f51ae639829405979c6b3122"
        }
    ],
    "venueId": "349337712877",
    "signed": {
        "timeStamp": "1631757264606",
        "signInfo": "请使用申请的签名"
    },
    "projectId": "349337712877",
    "seats": [
        {
            "floorId": "3b9bfce5f51ae639829405979c6b3122",
            "xCoord": "1",
            "rowName": "1排",
            "name": "15座",
            "standId": "688122776762060800",
            "id": "1093385763697286528",
            "yCoord": "15"
        },
        {
            "floorId": "3b9bfce5f51ae639829405979c6b3122",
            "xCoord": "7",
            "rowName": "7排",
            "name": "16座",
            "standId": "688122776762060800",
            "id": "1093385763718258065",
            "yCoord": "16"
        },
        {
            "floorId": "3b9bfce5f51ae639829405979c6b3122",
            "xCoord": "7",
            "rowName": "7排",
            "name": "18座"
        }
    ]
}

{
    "standId": "688122776762060800",
    "id": "1093385763718258066",
    "yCoord": "18"
},
{
    "floorId": "3b9bfce5f51ae639829405979c6b3122",
    "xCoord": "7",
    "rowName": "7排",
    "name": "20座",
    "standId": "688122776762060800",
    "id": "1093385763718258067",
    "yCoord": "20"
}

#### 2.6 座位状态同步接口

##### 2.6.1 业务说明：

1、整体推送，频率最快1分钟一次，建议5分钟一次

2、或状态改变后，只推状态改变的座位

##### 2.6.2 请求条件

• 请求URL：/b2b2c/2.0/sync/commodity

• 请求方式：POST

- 表头：Content-Type: application/json;

##### 2.6.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>projectId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>performId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场次ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>seatList</td><td style='text-align: center; word-wrap: break-word;'>List&lt;CommodityInfo&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位状态信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td colspan="5">CommodityInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>seatId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>itemId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>票品ID</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>status</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>座位状态</td><td style='text-align: center; word-wrap: break-word;'>1: 可售,2:锁定,3:已售</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>packageInfo</td><td style='text-align: center; word-wrap: break-word;'>CommodityPackageInfo</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>座位对应的套票信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">CommodityPackageInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>groupId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>套票分组ID</td><td style='text-align: center; word-wrap: break-word;'>一个套票下分组相同的座位绑定到一起卖</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>itemPackageId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>套票ID</td><td style='text-align: center; word-wrap: break-word;'>对应票品接口里的套票ID</td></tr></table>





##### 2.6.4 输入示例

{
    "performId": "3",
    "signed": {
        "timeStamp": "1631757264606",
        "signInfo": "请使用申请的签名"
    },
    "projectId": "349337712877",
    "seatList": {
        "seatId": "1093385763697286528",
        "itemId": "1093377350045097344",
        "status": 1
    },
    "seatId": "1093385763718258065",
    "itemId": "1093377350045097344",
    "status": 1
},
"seatId": "1093385763718258066",
"itemId": "1093377350045097344",
"status": 1
},
"packageInfo": {
    "groupId": 1,
    "itemPackageId": "11"
}
},
"seatId": "1093385763718258067",
"itemId": "1093377350045097344",
"status": 1
},
"packageInfo": {
    "groupId": 1,
    "itemPackageId": "11"
}
}

### Part 2—供应商需提供的接口：

### 1. 总体说明：

#### 1.1 业务说明：

1. 供应商需提供的接口用于大麦在用户下单购买等环节调用，以实现座位锁定、支付回调、获取电子票、订单取消等功能。

2. 开始接入前，贵方需申请apiKey与apiPw，并将请求API服务的IP告知大麦

3. 交易接口需要在2s内返回，超时会导致接口调用失败，且锁座接口不会重试，建议不要超过300ms

#### 1.2 系统接口协议

待补充

#### 1.3 表格中参数约束符号含义



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>约束符号</td><td style='text-align: center; word-wrap: break-word;'>含义</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>非必填</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>必填</td></tr></table>

#### 1.4 消息请求头结构

{
    "head": {
        "version": "版本号",
        "msgId": "消息ID",
        "apiKey": "API钥匙",
        "apiSecret": "API密钥",
        "timeStamp": "消息发送时间戳",
        "signed": "消息签名"
    }
}



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>apiKey</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>Api钥匙</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>apiSecret</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>请求体</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>timeStamp</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>时间戳</td><td style='text-align: center; word-wrap: break-word;'>毫秒</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>msgId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>消息Id</td><td style='text-align: center; word-wrap: break-word;'>请求消息唯一ID</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>version</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>版本号</td><td style='text-align: center; word-wrap: break-word;'>如：1.0</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>消息签名</td><td style='text-align: center; word-wrap: break-word;'>见消息签名规则</td></tr></table>





##### 消息签名规则

signed=MD5(version=version值+&+msgID=msgID值+&+apiKey=apiKey值+&+apiSecret=API密钥值+&+timeStamp=时间戳值).toupperCase()
API密钥(apiSecret)=MD5(apiKey+apiPw)

签名生成demo见附录

#### 1.5 消息响应头结构



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>returnCode</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>返回响应码code</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>returnDesc</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>返回响应信息描述</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

#### 1.6 用户下单流程图

<div style="text-align: center;"><img src="https://pplines-online.bj.bcebos.com/deploy/official/paddleocr/pp-ocr-vl-15//6796aff9-bba2-411f-834a-1bfeb5ce3bc2/markdown_3/imgs/img_in_image_box_183_90_1056_953.jpg?authorization=bce-auth-v1%2FALTAKzReLNvew3ySINYJ0fuAMN%2F2026-04-07T03%3A19%3A09Z%2F-1%2F%2F7793f4bcd1337ed1cb21f0e17c9433bd5d85e39b568b8eafcfd72baaa432d3b4" alt="Image" width="71%" /></div>


### 2. 接口详情

#### 2.1 锁座接口

##### 2.1.1 业务说明：

1、三方需要根据大麦给的总金额和实际支付金额进行校验

##### 2.1.2 请求条件

• 请求URL：三方自定义，对接时提供给大麦

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.1.3 参数列表

##### 入参列表



<table border="1" style="margin: auto; word-wrap: break-word;"><tr><td style="text-align: center; word-wrap: break-word;">元素名称</td><td style="text-align: center; word-wrap: break-word;">类型</td><td style="text-align: center; word-wrap: break-word;">是否</td><td style="text-align: center; word-wrap: break-word;">描述</td><td style="text-align: center; word-wrap: break-word;">说明</td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">必填</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">head</td><td style="text-align: center; word-wrap: break-word;">RequestHead</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">请求头</td><td style="text-align: center; word-wrap: break-word;">1.4 消息请求头结构</td></tr><tr><td style="text-align: center; word-wrap: break-word;">bodySubmitOrder</td><td style="text-align: center; word-wrap: break-word;">BodySubmitOrder</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">请求体</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">r</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">BodySubmitOrder</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">orderInfo</td><td style="text-align: center; word-wrap: break-word;">SubmitOrderInfo</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">订单详情</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">SubmitOrderInfo</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">daMaiOrderId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">大麦订单号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">projectId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">项目ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">performId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">场次ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">hasSeat</td><td style="text-align: center; word-wrap: break-word;">Boolean</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">是否是选座项目</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">commodityInfoLi</td><td style="text-align: center; word-wrap: break-word;">List&lt;CommodityInfo&gt;</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">下单商品信息</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">st</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">集合</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">pricelnfo</td><td style="text-align: center; word-wrap: break-word;">List&lt;SubmitOrderPriceInfo&gt;</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">下单票价信息</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">userInfo</td><td style="text-align: center; word-wrap: break-word;">UserInfo</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">购买者信息</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">certifications</td><td style="text-align: center; word-wrap: break-word;">List&lt;TicketOwnerInfo&gt;</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">持票人信息</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">deliveryMethod</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">配送方式</td><td style="text-align: center; word-wrap: break-word;">3=二维码电子票;4=身份证电子票</td></tr><tr><td style="text-align: center; word-wrap: break-word;">remark</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">备注</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">totalAmountFen</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">订单总金额（订单票品总金额）</td><td style="text-align: center; word-wrap: break-word;">单位分</td></tr><tr><td style="text-align: center; word-wrap: break-word;">realAmountOfFe</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">实际支付金额</td><td style="text-align: center; word-wrap: break-word;">单位分</td></tr><tr><td style="text-align: center; word-wrap: break-word;">n</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">expressFee</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">额外金额</td><td style="text-align: center; word-wrap: break-word;">如：运费等。目前情况只会为0</td></tr><tr><td style="text-align: center; word-wrap: break-word;">expand1</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">扩展自段1</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">expand2</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">扩展自段2</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">expand3</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">扩展自段3</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">CommodityInfo</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">priceld</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票品ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">seatld</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">座位ID</td><td style="text-align: center; word-wrap: break-word;">仅有座时传</td></tr><tr><td style="text-align: center; word-wrap: break-word;">subOrderId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">大麦子订单号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">packageld</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">套票id</td><td style="text-align: center; word-wrap: break-word;">单票所属的套票id（如果当前票品属于套票才会传）</td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">需要使用该字段需提前联系大麦技术处理，且仅针对新增项目，历史项目不作处理</td></tr><tr><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">SubmitOrderPricelnfo</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">priceld</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票品ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">num</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">该票品购买数量</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">price</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">票价金额</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">type</td><td style="text-align: center; word-wrap: break-word;">Byte</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">票品类型</td><td style="text-align: center; word-wrap: break-word;">0=单票, 1=固定套票, 2=自由组合套票</td></tr><tr><td rowspan="4">activityInfoList</td><td rowspan="4">List&lt;ActivityInfo&gt;</td><td rowspan="3">N</td><td rowspan="3">票品命中的优惠集合</td><td style="text-align: center; word-wrap: break-word;">需要使用该字段需提前联系大麦技术处理, 且仅针对新增项目, 历史项目不作处理</td></tr><tr><td style="text-align: center; word-wrap: break-word;">命中优惠时携带未命中优惠为空</td></tr><tr><td style="text-align: center; word-wrap: break-word;">需要使用该字段需提前联系大麦技术处理, 且仅针对新增项目, 历史项目不作处理</td></tr><tr><td rowspan="2">ActivityInfo</td><td rowspan="2">Y</td><td rowspan="2">优惠id</td></tr><tr><td style="text-align: center; word-wrap: break-word;">activityId</td><td style="text-align: center; word-wrap: break-word;">String</td></tr><tr><td style="text-align: center; word-wrap: break-word;">activityName</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">优惠名称</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td colspan="5">UserInfo</td></tr><tr><td style="text-align: center; word-wrap: break-word;">userId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">用户ID</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">name</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">用户信息姓名</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">mobile</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">客户手机号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">idCard</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">身份证号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">provinceName</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">省名称</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">cityName</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">市名称</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">areaName</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">区名称</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">address</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">详细地址</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">zipCode</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">邮政编码</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">invoiceType</td><td style="text-align: center; word-wrap: break-word;">Integer</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">发票类型</td><td style="text-align: center; word-wrap: break-word;">0:个人 1:单位（暂不支持）</td></tr><tr><td style="text-align: center; word-wrap: break-word;">invoiceUnitName</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">发票抬头</td><td style="text-align: center; word-wrap: break-word;">暂不支持</td></tr><tr><td style="text-align: center; word-wrap: break-word;">tatNo</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">税号</td><td style="text-align: center; word-wrap: break-word;">暂不支持</td></tr><tr><td style="text-align: center; word-wrap: break-word;">email</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">电子邮件</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td colspan="5">TicketOwnerInfo</td></tr><tr><td style="text-align: center; word-wrap: break-word;">certType</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">证件类型</td><td style="text-align: center; word-wrap: break-word;">1=身份证，2=护照，3=港澳通行证，4=台胞证，7=港澳台居民居住证，8=外国人永久居留身份证</td></tr><tr><td style="text-align: center; word-wrap: break-word;">certNo</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">证件号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">ownerName</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">持票人姓名</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">ownerMobile</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">持票人手机号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">seatId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">N</td><td style="text-align: center; word-wrap: break-word;">座位ID</td><td style="text-align: center; word-wrap: break-word;">无座时为空,用于seat和持票人的映射</td></tr></table>


##### 响应列表


<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>ResponseHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应头信息</td><td style='text-align: center; word-wrap: break-word;'>1.5 消息响应头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>body</td><td style='text-align: center; word-wrap: break-word;'>BodySubmitOrder</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应体信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">BodySubmitOrder</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderInfo</td><td style='text-align: center; word-wrap: break-word;'>OrderInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">OrderInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>三方订单号（非大麦）</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>totalAmount</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单总金额</td><td style='text-align: center; word-wrap: break-word;'>单位分</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>realAmount</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单需实付金额</td><td style='text-align: center; word-wrap: break-word;'>单位分</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>expressFee</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>额外费用</td><td style='text-align: center; word-wrap: break-word;'>传0</td></tr></table>


##### 2.1.4 输入示例

请求报文

```json
{
    "bodySubmitOrder": {
        "orderInfo": {
            "certifications": [
                {
                    "certNo": "23272419950628072X",
                    "certType": 1,
                    "seatId": "259484"
                }
            ],
            "commodityInfoList": [
                {
                    "priceId": "128553",
                    "seatId": "259484",
                    "subOrderId": "3221038191278529541"
                }
            ],
            "daMaiOrderId": "3221038191278529541",
            "deliveryMethod": 3,
            "expand2": "{\"realAmount\":\"30\",\"privilegeType\":\"使用优惠\",\"privilegeName\":\"大麦优惠\"}",
            "expressFee": 0,
            "hasSeat": true,
            "performId": "340868",
            "priceInfo": [
                {
                    "num": 1,
                    "price": 30,
                    "priceId": "128553",
                    "type": 0,
                    "activityInfoList": [
                        {
                            "activityId": "7111111111",
                            "activityName": "每满2件打6折"
                        }
                    ]
                }
            ],
            "projectId": "22456884",
            "realAmountOfFen": 30,
            "totalAmountFen": 30,
            "userInfo": {
                "address": "无详细地址",
                "deliverType": 1,
                "idCard": "23272419950628072X",
                "invoiceUnitName": "",
                "mobile": "18392621878",
                "name": "刘玉凤",
                "userId": "3862524195"
            }
        }
    },
    "head": {
        "apiKey": "qmyihai60s",
        "apiSecret": "9333C6B484EE98AF23500D9620A9FE1D",
        "msgId": "1677647220299",
        "signed": "818515D53D4A8163025156EC8605AB56",
        "timeStamp": "1677647220299",
        "version": "1.0.0"
    }
}
```

##### 响应报文

{
    "body": {
        "orderInfo": {
            "expressFee": 0,
            "orderId": "1031851",
            "realAmount": 30,
            "totalAmount": 300
        }
    },
    "head": {
        "returnCode": "0",
        "returnDesc": "成功"
    }
}

#### 2.2 支付回调接口

##### 2.2.1 业务说明：

大麦支付成功后回调该接口

##### 2.2.2 请求条件

• 请求URL：三方自定义，对接时提供给大麦

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.2.3 参数列表

##### 入参列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>RequestHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>请求头</td><td style='text-align: center; word-wrap: break-word;'>1.4 消息请求头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>bodyPayCallBac</td><td style='text-align: center; word-wrap: break-word;'>PayCallBackBody</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息体</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>k</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">PayCallBackBody</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderInfo</td><td style='text-align: center; word-wrap: break-word;'>OrderInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">OrderInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>daMaiOrderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>大麦订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>商家订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>totalAmount</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单总金额（优惠后的）</td><td style='text-align: center; word-wrap: break-word;'>单位分</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>realAmount</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单需实付金额</td><td style='text-align: center; word-wrap: break-word;'>单位分</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>expressFee</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>额外费用</td><td style='text-align: center; word-wrap: break-word;'>传0</td></tr></table>

##### 响应列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>ResponseHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应头信息</td><td style='text-align: center; word-wrap: break-word;'>1.5 消息响应头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>body</td><td style='text-align: center; word-wrap: break-word;'>BodySubmitOrder</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应体信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">BodySubmitOrder</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderInfo</td><td style='text-align: center; word-wrap: break-word;'>OrderInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">OrderInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>三方订单号（非大麦）</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>daMaiOrderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>大麦订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>payStatus</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>支付状态：0:失败,1:成功</td></tr></table>

##### 2.2.4 输入示例

大麦请求示例

{
    "bodyPayCallBack": {
        "orderInfo": {
            "daMaiOrderId": "1369849301333814812",
            "expressFee": 0,
            "orderId": "1663441557761691648",
            "realAmount": 1,
            "totalAmount": 1
        }
    },
    "head": {
        "apiKey": "xxx",
        "apiSecret": "xxxx",
        "msgId": "1685430689762",
        "signed": "xxx",
        "timeStamp": "1685430689762",
        "version": "1.0.0"
    }
}

##### 返回示例

{
    "body": {
        "orderInfo": {
            "daMaiOrderId": "345646112233435345",
            "orderId": "232432354654757645",
            "payStatus": 1
        }
    },
    "head": {
        "returnCode": "0",
        "returnDesc": ""
    }
}

#### 2.3 获取电子票接口

##### 2.3.1 业务说明：

支付成功后获取电子票

##### 2.3.2 请求条件

• 请求URL：三方自定义，对接时提供给大麦

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.3.3 参数列表

入参列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>RequestHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>请求头</td><td style='text-align: center; word-wrap: break-word;'>1.4 消息请求头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>bodyGetESeatInfo</td><td style='text-align: center; word-wrap: break-word;'>BodyGetESeatInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">BodyGetESeatInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>daMaiUserId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>大麦用户id</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>商家订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>


<div style="text-align: center;"><div style="text-align: center;">响应列表</div> </div>


<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>必填</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>ResponseHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应头信息</td><td style='text-align: center; word-wrap: break-word;'>1.5 消息响应头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>body</td><td style='text-align: center; word-wrap: break-word;'>BodySubmitOrder</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应体信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td colspan="4">BodySubmitOrder</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>bodyGetESeatInf</td><td style='text-align: center; word-wrap: break-word;'>GetESeatInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>o</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td colspan="4">GetESeatInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>eticketInfos</td><td style='text-align: center; word-wrap: break-word;'>List&lt;EticketInfo&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>电子票列表</td><td style='text-align: center; word-wrap: break-word;'>多张票需要回传多个</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>EticketInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>projectName</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目名称</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>showTime</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>演出时间戳</td><td style='text-align: center; word-wrap: break-word;'>毫秒时间戳</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>venueName</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆名称</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td colspan="3">EticketInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>aoDetailId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>票单号</td><td style='text-align: center; word-wrap: break-word;'>每个座位的票单号均唯一</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>certType</td><td style='text-align: center; word-wrap: break-word;'>Byte</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>证件类型</td><td style='text-align: center; word-wrap: break-word;'>0-非实名,</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>1-“身份证”,</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>2-“学生证”,</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>4-“护照”,</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>5-“港澳通行证”,</td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>6-“台胞证”</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>certNo</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>证件号</td><td style='text-align: center; word-wrap: break-word;'>实名制必填</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>eticketImage</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>电子票图片</td><td style='text-align: center; word-wrap: break-word;'>Base64字符串</td></tr></table>



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>hasSeat</td><td style='text-align: center; word-wrap: break-word;'>Boolean</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>是否有座</td><td style='text-align: center; word-wrap: break-word;'>true有座,false无座</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>price</td><td style='text-align: center; word-wrap: break-word;'>Long</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>票价</td><td style='text-align: center; word-wrap: break-word;'>单位分</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>priceld</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>票价ID</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>qrcodeType</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>取票类型</td><td style='text-align: center; word-wrap: break-word;'>1 静态二维码电子票,对应场次中的二维码电子票2 动态二维码电子票,对应场次中的二维码电子票3 身份证电子票,对应场次中的身份证电子票4 换票码,对应场次中的串码5 静态码+换票码对应场次中的二维码电子票+串码qrCode</td><td style='text-align: center; word-wrap: break-word;'>StringStringStringStringStringString</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>exchangeCode</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>二维码code</td><td style='text-align: center; word-wrap: break-word;'>动静态二维码原始值qrcodeType=1||2||5时必填</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>seatByNumber</td><td style='text-align: center; word-wrap: break-word;'>Boolean</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>换票码</td><td style='text-align: center; word-wrap: break-word;'>qrcodeType=4||5时必填长度不超过32位</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>seatId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>座位ID</td><td style='text-align: center; word-wrap: break-word;'>有座项目座位ID不能为空</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>rowNo</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>座位排号</td><td style='text-align: center; word-wrap: break-word;'>有座不能为空</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>seatNo</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>列号</td><td style='text-align: center; word-wrap: break-word;'>有座不能为空</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

##### 2.3.4 输入示例

请求示例

{
    "bodyGetESeatInfo": {
        "daMaiUserId": "12343243543535464",
        "orderId": "12345545464364326"
    },
    "head": {
        "apiKey": "appkey",
        "apiSecret": "secretkey",
        "msgId": "msgId",
        "signed": "signXXXXXXXXXXXX",
        "timeStamp": "1682058632087",
        "version": "1.0"
    }
}

##### 返回示例

{
    "body": {
        "bodyGetESeatInfo": {
            "eticketInfos": [
                "aoDetailId": "no231434565654754",
                "certNo": "110102199910112231",
                "certType": 1,
                "eticketImage": "NDMyNDUzNTQzNjUONDUONg==",
                "exchangeCode": "dd132434546546",
                "hasSeat": true,
                "price": 100,
                "priceId": "123243214",
                "qrCode": "THQCHK57xJdyY387",
                "qrcodeType": 4,
                "rowNo": "12",
                "seatByNumber": true,
                "seatId": "23243243543543",
                "seatNo": "10"
            }],
            "projectName": "项目名称",
            "showTime": 1682060886858,
            "venueName": "场馆名称"
        },
        "head": {
            "returnCode": "0",
            "returnDesc": ""
        }
    }
}

#### 2.4 订单取消接口

##### 2.4.1 业务说明：

取消订单

##### 2.4.2 请求条件

• 请求URL：三方自定义，对接时提供给大麦

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.4.3 参数列表

入参列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>RequestHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>请求头</td><td style='text-align: center; word-wrap: break-word;'>1.4 消息请求头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>cancelOrderInfo</td><td style='text-align: center; word-wrap: break-word;'>CancelOrderInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>订单信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">CancelOrderInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>商家订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

##### 响应列表

<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>ResponseHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应头信息</td><td style='text-align: center; word-wrap: break-word;'>1.5 消息响应头结构</td></tr></table>

##### 2.4.4 输入示例

请求示例

{
    "cancelOrderInfo": {
        "orderId": "23214235353454"
    },
    "head": {
        "apiKey": "appkey",
        "apiSecret": "secretkey",
        "msgId": "msgId",
        "signed": "signXXXXXXXXXXXX",
        "timeStamp": "1682061180867",
        "version": "1.0"
    }
}

JSON

1 {
2 "head": {
3 "returnCode": "0",
4 "returnDesc": "取消订单成功"
5 }
6 }

### 3. 接口服务响应代码

##### 建议下面场景按照对应的错误码和描述返回



<table border="1" style="margin: auto; word-wrap: break-word;"><tr><td style="text-align: center; word-wrap: break-word;">code</td><td style="text-align: center; word-wrap: break-word;">描述</td><td style="text-align: center; word-wrap: break-word;">说明</td></tr><tr><td style="text-align: center; word-wrap: break-word;">0</td><td style="text-align: center; word-wrap: break-word;">请求成功</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20000</td><td style="text-align: center; word-wrap: break-word;">验签失败</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20001</td><td style="text-align: center; word-wrap: break-word;">参数校验失败</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20002</td><td style="text-align: center; word-wrap: break-word;">网络连接异常</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20003</td><td style="text-align: center; word-wrap: break-word;">业务限流降级</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20010</td><td style="text-align: center; word-wrap: break-word;">锁座失败--座位已售/锁定/库存不足</td><td style="text-align: center; word-wrap: break-word;">该场景必须按照这个格式回传，可以降低座位状态不一致的概率</td></tr><tr><td style="text-align: center; word-wrap: break-word;">20011</td><td style="text-align: center; word-wrap: break-word;">锁座失败--下单数超过限购</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20012</td><td style="text-align: center; word-wrap: break-word;">锁座失败--不在开售时间内</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20013</td><td style="text-align: center; word-wrap: break-word;">锁座失败--场次未授权</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20014</td><td style="text-align: center; word-wrap: break-word;">锁座失败--金额校验不通过</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20015</td><td style="text-align: center; word-wrap: break-word;">锁座失败--除上述场景外通用</td><td style="text-align: center; word-wrap: break-word;">错误信息描述清晰</td></tr><tr><td style="text-align: center; word-wrap: break-word;">20020</td><td style="text-align: center; word-wrap: break-word;">支付回调失败--订单不存在</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20021</td><td style="text-align: center; word-wrap: break-word;">支付回调失败--订单已失效</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20022</td><td style="text-align: center; word-wrap: break-word;">支付回调失败-- 金额校验不通过</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20023</td><td style="text-align: center; word-wrap: break-word;">支付回调失败--第三方支付回调处理中中</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20024</td><td style="text-align: center; word-wrap: break-word;">支付回调失败-- 内部异常，可重试成功的</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20025</td><td style="text-align: center; word-wrap: break-word;">支付回调失败-- 除上述场景外通用</td><td style="text-align: center; word-wrap: break-word;">错误信息描述清晰</td></tr><tr><td style="text-align: center; word-wrap: break-word;">20030</td><td style="text-align: center; word-wrap: break-word;">获取电子票失败 -- 失败原因</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">20040</td><td style="text-align: center; word-wrap: break-word;">取消订单失败 -- 失败原因</td><td style="text-align: center; word-wrap: break-word;"></td></tr></table>




## 二、逆向链路接口：

### 1. 总体说明：

#### 1.1 业务说明：

i. 大麦对外提供逆向链路接口，用于三方商家同步项目下订单、票单的换票以及验票状态，以及实现线上退票能力

ii. 大麦获取到三方商家票单的换/验票状态后，会根据商家情况来处理后续票夹展示、订单退票等逻辑，核验部分接口详见2.1

iii. 退票能力主要分为两大部分：退票规则同步和退票能力接通

1. 想使用大麦退票能力，需要按照大麦模式在项目同步时，同步推送项目的退票规则（退票规则部分推送方式详情见下方1.1.1）

2. 在同步退票规则后，可以调用退票能力接口，退票能详情力见下方2.2和2.3

a. 在大麦场景中，由于存在预存款、月结等多模式，并且大麦对大麦用户退票和退款的行为逻辑一致，所以对大麦和贵方来说，退票即退款，完成退票后无需额外调用退款接口

##### 1.1.1 退票规则推送：

<div style="text-align: center;"><div style="text-align: center;">退款规则同步数据结构（修改原项目同步入参即可，如下）</div> </div>




<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>projectInfo</td><td style='text-align: center; word-wrap: break-word;'>ProjectInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目信息对象</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundRuleInfo</td><td style='text-align: center; word-wrap: break-word;'>RefundRuleIn</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>退款规则对象</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">f0</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>venuelInfo</td><td style='text-align: center; word-wrap: break-word;'>VenuelInfo</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆信息对象</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td colspan="5">ProjectInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>项目名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过100</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>chooseSeatFla</td><td style='text-align: center; word-wrap: break-word;'>boolean</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>是否选座项目</td><td style='text-align: center; word-wrap: break-word;'>true: 选座, false: 无座</td></tr><tr><td colspan="5">g</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>posters</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>海报</td><td style='text-align: center; word-wrap: break-word;'>海报图片地址, 大小不超过3MB, 互联网可访问, 图片格式支持: png, jpeg, jpg, bmp, webp</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>introduce</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>详情</td><td style='text-align: center; word-wrap: break-word;'>大小不超过25000字节 (GBK编码格式下)</td></tr><tr><td colspan="5">VenuelInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>id</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆ID</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过64</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>name</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>场馆名称</td><td style='text-align: center; word-wrap: break-word;'>长度不能超过100</td></tr><tr><td colspan="5">RefundRuleInfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundType</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>退票类型</td><td style='text-align: center; word-wrap: break-word;'>1-不可退（默认）5-条件退6-随时退</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>performEndAut</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>场次结束自动退</td><td style='text-align: center; word-wrap: break-word;'>随时退必传，其他退票类型不可传</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>oRefundType</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>1-自动退0-不自动退</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundProcedu</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>条件退退票手续费规则</td><td style='text-align: center; word-wrap: break-word;'>条件退必传，其他退票类型不可传</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>reFeeRule</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>当前只支持2-据场次演出开始时间倒计时规则</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>cEndEntrance</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>大麦用户侧退票入口是否开启，条件退必传，开启-1，不开启-0</td><td style='text-align: center; word-wrap: break-word;'>条件退必传，其他退票类型不可传</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundDetailLis</td><td style='text-align: center; word-wrap: break-word;'>List&lt;RefundD</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>条件退退款手续费规则</td><td style='text-align: center; word-wrap: break-word;'>条件退必传，其他退票类型不可传</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>t</td><td style='text-align: center; word-wrap: break-word;'>ateRuleInput</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>DTO&gt;</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>RefundDateRuleInputDTO</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>startDay</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-天</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-时</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>startHour</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-分</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-天</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>startMinutes</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-时</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-天</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>endDay</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-分</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-天</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>endHour</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-时</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-天</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>endMinutes</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-分</td><td style='text-align: center; word-wrap: break-word;'>距离场次开始时间-天</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundRule</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>退票类型</td><td style='text-align: center; word-wrap: break-word;'>1-手续费 2-免费退票 3-不支持退4-停止退票</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundRuleFee</td><td style='text-align: center; word-wrap: break-word;'>BigDecimal</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>退票手续费</td><td style='text-align: center; word-wrap: break-word;'>支持小数点后2位，如1.11表示手续费是1.11%</td></tr></table>





##### 退票规则补充说明：

从退票类型来看，可以总体分为：不可退、随时退和条件退三种，其中

- 不可退：如果退票类型设置为不可退，则意味着除异常情况外，此项目不会退款；如果发生异常情

况有退票行为，则需联系业务并双方系统协商后统一退票

• 随时退：

☐ 随时退代表在场次结束之前任意时间段内，只要票没有被核验，即申请一定可以退票成功

而且随时退还可以补充选择场次结束时是否自动退，如果选择自动退后，在场次结束时，大麦会批量调用退票接口完成未核验票的退票行为

• 条件退：

条件退相对比较复杂，可以理解为类似于12306的阶梯退票模式，即以场次/演出开始时间（火车发车时间）为锚点，向前倒数不同的时间，收取不同的费用

- 大麦模式的每一个退票阶梯都由开始时间、结束时间、费用三个核心字段组成，退票阶梯数不可超过8个，具体示例如下

条件退规则推送代码示例如下：

```json
{
  "projectInfo": {
    "chooseSeatFlag": true,
    "name": "you座测试项目请不要拍",
    "id": "2549337712832",
    "posters": "http://xxxx.jpg",
    "introduce": "详情"
  },
  "venueInfo": {
    "name": "测试场馆",
    "id": "2549337712832"
  },
  "refundRuleInfo": {
    "refundType": 5,
    "performEndAutoRefundType": null,
    "refundProcedureFeeRule": 2,
    "refundDetailList": [
      {
        "endDay": 20,
        "endHour": 10,
        "endMinutes": 0,
        "refundRule": 2,
        "startDay": 30,
        "startHour": 10,
        "startMinutes": 0
      },
      {
        "endDay": 10,
        "endHour": 10,
        "endMinutes": 0,
        "refundRule": 1,
        "refundRuleFee": 15.88,
        "startDay": 20,
        "startHour": 10,
        "startMinutes": 0
      },
      {
        "endDay": 5,
        "endHour": 10,
        "endMinutes": 0,
        "refundRule": 1,
        "refundRuleFee": 30,
        "startDay": 10,
        "startHour": 10,
        "startMinutes": 0
      },
      {
        "refundRule": 4,
        "startDay": 5,
        "startHour": 10,
        "startMinutes": 0
      }
    ]
  },
  "signed": {
    "timeStamp": "1631757264606",
    "signInfo": "请使用申请的签名"
  }
}
```

退款规则第1条：场次开始前30天10小时0分～场次开始前20天10时0分免手续费

退款规则第2条：场次开始前20天10小时0分～场次开始前10天10时0分收取15.88%的手续费

退款规则第3条：场次开始前10天10小时0分～场次开始前5天10时0分收取30%的手续费

退款规则第4条：场次开始前5天10小时0分～场次开始前不允许退款

#### 1.2 系统接口协议

接口使用JSON方式进行交互，采用UTF-8编码

#### 1.3 表格中参数约束符号含义



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>约束符号</td><td style='text-align: center; word-wrap: break-word;'>含义</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>非必填</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>必填</td></tr></table>

#### 1.4 消息请求报文体结构

Java

1  {
2  "signed": {
3    "signInfo": "消息签名",
4    "timeStamp": "时间戳"
5  }
6  }



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>长度</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signInfo</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>消息签名</td><td style='text-align: center; word-wrap: break-word;'>对接时请通过邮件申请</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>timeStam</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>当前毫秒时间</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>p</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>戳</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

#### 1.5 消息应答报文说明

Java

1  $ \rightarrow $ {
2     "code": "0",
3     "desc": "成功"
4 }



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>长度</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>code</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应码</td><td style='text-align: center; word-wrap: break-word;'>具体见响应码列表</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>desc</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应描述</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

### 2. 接口详情

#### 2.1 核验状态同步接口

##### 2.1.1 业务说明：

1、订单维度，只推送已核验/打印的票单即可，不推送默认为未核验

2、推送频率：核验/打印后推送即可

##### 2.1.2 请求条件

• 请求URL：/b2b2c/2.0/sync/validate

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.1.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>cOrderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>大麦订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>vendorOrderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>三方订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>validateVouche</td><td style='text-align: center; word-wrap: break-word;'>List&lt;Validatelnfo&gt;</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>核验票单集合</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>rRequestList</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>signed</td><td style='text-align: center; word-wrap: break-word;'>Signed</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>签名信息</td><td style='text-align: center; word-wrap: break-word;'>见1.4请求报文结构</td></tr><tr><td colspan="5">Validatelnfo</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>aoDetailId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>三方票单号</td><td style='text-align: center; word-wrap: break-word;'>同获取电子票时返回票单号，必须唯一</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>printStatus</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>打印状态1未打印，2已打印</td><td style='text-align: center; word-wrap: break-word;'>打印状态如果不为空，则这三个字段都不能为空</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>printCount</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>打印次数</td><td style='text-align: center; word-wrap: break-word;'>打印和核验必须二选一</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>printTime</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>打印时间，格式：yyyy-MM-ddHH:mm:ss</td><td style='text-align: center; word-wrap: break-word;'>核验状态如果不为空，则这三个字段都不能为空</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>validateStatus</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>N</td><td style='text-align: center; word-wrap: break-word;'>验票状态1未验，2已验</td><td style='text-align: center; word-wrap: break-word;'>核验状态如果不为空，则这三个字段都不能为空</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>validateCount</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>验票次数</td><td style='text-align: center; word-wrap: break-word;'>打印和核验必须二选一</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>validateTime</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'></td><td style='text-align: center; word-wrap: break-word;'>验票时间，格式：yyyy-MM-ddHH:mm:ss</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

##### 2.1.4 输入示例

{
    "signed": {
        "timeStamp": "1631757264606",
        "signInfo": "请使用申请的签名"
    },
    "cOrderId": "大麦订单号",
    "vendorOrderId": "三方订单号",
    "validateVoucherRequestList": [
        {
            "aoDetailId": "三方票单号，对应获取电子票的票单号，必须唯一"，
            "printStatus": "打印状态1未打印，2已打印"，
            "printCount": "打印次数"，
            "printTime": "打印时间"，
            "validateStatus": "验票状态1未验，2已验"，
            "validateCount": "验票次数"，
            "validateTime": "验票时间"
        }
    ]
}

#### 2.2 退票申请接口

##### 2.2.1 业务说明：

1、订单维度，用于大麦侧发起退款申请

2、如果接口响应失败，会一直重试，具体退款结果以消息通知为准

3、退票整体流程可见（需完成2.2和2.3的整体接入）：

<div style="text-align: center;"><img src="https://pplines-online.bj.bcebos.com/deploy/official/paddleocr/pp-ocr-vl-15//fe8a2eb4-0658-458d-ba5a-3e2d2455d06c/markdown_4/imgs/img_in_image_box_102_105_1117_637.jpg?authorization=bce-auth-v1%2FALTAKzReLNvew3ySINYJ0fuAMN%2F2026-04-07T03%3A19%3A11Z%2F-1%2F%2F3404e1cdfb0dfbae32b685f173cb777f6ce118b89e6f5da9c00544b5784023e4" alt="Image" width="82%" /></div>


##### 2.2.2 请求条件

• 请求URL：三方自定义，对接时提供给大麦

• 请求方式：POST

- 表头：Content-Type: application/json;

##### 2.3.3 参数列表

入参列表



<table border="1" style="margin: auto; word-wrap: break-word;"><tr><td style="text-align: center; word-wrap: break-word;">元素名称</td><td style="text-align: center; word-wrap: break-word;">类型</td><td style="text-align: center; word-wrap: break-word;">是否必填</td><td style="text-align: center; word-wrap: break-word;">描述</td><td style="text-align: center; word-wrap: break-word;">说明</td></tr><tr><td style="text-align: center; word-wrap: break-word;">head</td><td style="text-align: center; word-wrap: break-word;">RequestHead</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">请求头</td><td style="text-align: center; word-wrap: break-word;">1.4 消息请求头结构</td></tr><tr><td style="text-align: center; word-wrap: break-word;">bodyRefund</td><td style="text-align: center; word-wrap: break-word;">RefundRequestBody</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">订单信息体</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td colspan="5">RefundRequestBody</td></tr><tr><td style="text-align: center; word-wrap: break-word;">daMaiOrderId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">大麦订单号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">orderId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">商家订单号</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">daMaiRefundId</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">大麦退款单号</td><td style="text-align: center; word-wrap: break-word;">多次重试，退款单号一样</td></tr><tr><td style="text-align: center; word-wrap: break-word;">refundReason</td><td style="text-align: center; word-wrap: break-word;">String</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">退款原因</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">orderAmount</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;">Y</td><td style="text-align: center; word-wrap: break-word;">订单总金额（分）</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">realOrderAmount</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">订单实际金额（分）</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">refundFee</td><td style="text-align: center; word-wrap: break-word;">BigDecimal</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">退款手续费比例</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">refundFeeAmount</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">退款手续费（分）</td><td style="text-align: center; word-wrap: break-word;"></td></tr><tr><td style="text-align: center; word-wrap: break-word;">realRefundFeeAmount</td><td style="text-align: center; word-wrap: break-word;">Long</td><td style="text-align: center; word-wrap: break-word;"></td><td style="text-align: center; word-wrap: break-word;">实际退款手续费（分）</td><td style="text-align: center; word-wrap: break-word;">实际以该费用结算</td></tr></table>




##### 响应列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>head</td><td style='text-align: center; word-wrap: break-word;'>ResponseHead</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应头信息</td><td style='text-align: center; word-wrap: break-word;'>1.5 消息响应头结构</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>body</td><td style='text-align: center; word-wrap: break-word;'>RefundResponseBody</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>响应体信息</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td colspan="5">RefundResponseBody</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>商家退款单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

##### 2.2.4 输入示例

请求示例

{
    "bodyRefund": {
        "daMaiOrderId": "12343243543535464",
        "orderId": "12345545464364326",
        "daMaiRefundId": "133131",
        "refundReason": "退款原因",
        "orderAmount": 100000,
        "realOrderAmount": 80000,
        "refundFee": 20,
        "refundFeeAmount": 16000,
        "realRefundFeeAmount": 10000
    },
    "head": {
        "apiKey": "appkey",
        "apiSecret": "secretkey",
        "msgId": "msgId",
        "signed": "signXXXXXXXXXXXX",
        "timeStamp": "1682058632087",
        "version": "1.0"
    }
}

##### 返回示例

JSON

1 = {
    2 = "body": {
        "refundId": "111111"
    },
    5 = "head": {
        "returnCode": "0",
        "returnDesc": ""
    }
}

#### 2.3 退票结果通知接口

##### 2.3.1 业务说明：

### 1、订单维度

### 2、推送频率：退款完成后即可推送

##### 2.3.2 请求条件

• 请求URL：/b2b2c/2.0/refund/callback/notify

• 请求方式：POST

• 表头：Content-Type: application/json;

##### 2.3.3 参数列表



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>元素名称</td><td style='text-align: center; word-wrap: break-word;'>类型</td><td style='text-align: center; word-wrap: break-word;'>是否必填</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>daMaiOrderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>大麦订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>daMaiRefundId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>大麦退款单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>orderId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>商家订单号</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>refundId</td><td style='text-align: center; word-wrap: break-word;'>String</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>商家退款单号</td><td style='text-align: center; word-wrap: break-word;'>退款申请返回退款单号</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>status</td><td style='text-align: center; word-wrap: break-word;'>Integer</td><td style='text-align: center; word-wrap: break-word;'>Y</td><td style='text-align: center; word-wrap: break-word;'>退款状态0成功1失败</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

##### 2.3.4 输入示例

{
    "signed": {
        "timeStamp": "1631757264606",
        "signInfo": "请使用申请的签名"
    },
    "daMaiOrderId": "大麦订单号",
    "daMaiRefundId": "大麦退款单号",
    "orderId": "商家订单号",
    "refundId": "商家退款单号",
    "status": 0
}

### 3. 接口服务响应代码



<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>code</td><td style='text-align: center; word-wrap: break-word;'>描述</td><td style='text-align: center; word-wrap: break-word;'>说明</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>0</td><td style='text-align: center; word-wrap: break-word;'>请求成功</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10001</td><td style='text-align: center; word-wrap: break-word;'>不支持此业务</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10002/10003/10009</td><td style='text-align: center; word-wrap: break-word;'>内部网络异常</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10004</td><td style='text-align: center; word-wrap: break-word;'>业务降级</td><td style='text-align: center; word-wrap: break-word;'>接口限流</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10005</td><td style='text-align: center; word-wrap: break-word;'>参数有值不正确</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10008</td><td style='text-align: center; word-wrap: break-word;'>商家参数配置异常</td><td style='text-align: center; word-wrap: break-word;'>一般只有对接时，商家信息配置错误。请联系大麦开发人员</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10011</td><td style='text-align: center; word-wrap: break-word;'>签名信息有误</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10016</td><td style='text-align: center; word-wrap: break-word;'>商家被禁用</td><td style='text-align: center; word-wrap: break-word;'></td></tr><tr><td style='text-align: center; word-wrap: break-word;'>10018</td><td style='text-align: center; word-wrap: break-word;'>数据同步失败</td><td style='text-align: center; word-wrap: break-word;'></td></tr></table>

## 文档总附录

### 1、交易签名demo

```java
private static String version = "version=";
private static String msgID = "msgID=";
private static String apiKey = "apiKey=";
private static String apiSecret = "apiSecret=";
private static String timeStamp = "timeStamp=";
private static String DEFAULT_OPT = "&";

private String getSinged(
    String apiKey,String version, Long timeSmp, String secret
) {
    StringBuffer sb = new StringBuffer();
    sb.append(version).append(version).append(DEFAULT_OPT);
    sb.append(msgID).append(timeSmp).append(DEFAULT_OPT);
    sb.append(apiKey).append(apiKey).append(DEFAULT_OPT);
    sb.append(apiSecret).append(secret).append(DEFAULT_OPT);
    sb.append(timeStamp).append(timeSmp);
    return MD5.crypt(sb.toString()).toUpperCase();
}

private String getSecret(String apiKey, String apiSn) {
    return MD5.crypt(apiKey + apiSn).toUpperCase();
}
```

