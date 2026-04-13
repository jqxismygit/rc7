# 销项发票融合前置接口文档

（V4.1.15）

国信电子票据平台信息服务有限公司


# 一 、概述

本规范主要是企业 ERP 系统与增值税盘开票之间的数据交互接口规范。接口规范包括通用规范和业务规范。通用规范描述所有接口必须遵守的公共部分，业务规范根据具体业务交互内容不同，描述实际业务需要的详细数据内容。

该文档在原税控服务器和盘前置接口的基础上整理，为统一的对外输出文档。

# 二 、通用报文规范

## 2.1. 通用格式

```json
{
  "interface": {
    "globalInfo": {
      "appId": "企业 appId",
      "interfaceId": "接口 ID",
      "interfaceCode": "接口编码",
      "requestCode": "数据交换请求发出方代码",
      "requestTime": "数据交换请求发出时间",
      "responseCode": "数据交换请求接受方代码",
      "dataExchangeId": "数据交换流水号"
    },
    "returnStateInfo": {
      "returnCode": "返回代码(请求不填)",
      "returnMessage": "返回描述(请求不填)"
    },
    "data": {
      "dataDescription": {
        "zipCode": "0"
      },
      "content": "请求数据内容或返回数据内容 – base64 加密",
      "contentKey": "请求数据 content 节点内的内容 SHA-256 再 AES 加密"
    }
  }
}
```

## 2.2. 通用格式样例

```json
{
  "interface": {
    "globalInfo": {
      "appId": "国票信息提供 appId",
      "interfaceId": "",
      "interfaceCode": "GP_SKSBXXCX",
      "requestCode": "DZFPQZ",
      "requestTime": "2020-07-21 09:58:53",
      "responseCode": "DS",
      "dataExchangeId": "DZFPQZDFXJ10012020072198A6123D0"
    },
    "returnStateInfo": {
      "returnCode": "0000(成功) 0001-9999(错误码)",
      "returnMessage": "成功或错误的详细消息"
    },
    "data": {
      "dataDescription": {
        "zipCode": "0"
      },
      "content": "Base64 返回数据内容",
      "contentKey": "请求数据 content 节点内的内容 SHA-256 再 AES 加密"
    }
  }
}
```

## 2.3. 通用接口数据项说明

全局数据项(globalInfo)说明：

<table><tr><td>数据项</td><td>数据项名称</td><td>类型</td><td>长度</td><td>说明</td></tr><tr><td>appId</td><td>授权标识</td><td>String</td><td>不定长</td><td>国票信息提供针对不同税号企业的授权应用标识</td></tr><tr><td>interfaceId</td><td>接口ID</td><td>String</td><td>不定长</td><td>保留为空</td></tr><tr><td>interfacode</td><td>接口编码</td><td>String</td><td>不定长</td><td>具体见各接口定义</td></tr><tr><td>requestCode</td><td>数据交换请求发起方代码</td><td>String</td><td>6</td><td>标识数据交换请求发起方固定值: DZFPQZ</td></tr><tr><td>requestTime</td><td>数据交换请求发出时间</td><td>String</td><td>18</td><td>格式 yyyy-MM-dd HH24:MI:SS</td></tr><tr><td>responseCode</td><td>数据交换请求接受方代码</td><td>String</td><td>2</td><td>标识数据交换请求接受方固定值: DS</td></tr><tr><td>dataExchangeId</td><td>数据交换流水号</td><td>String</td><td>31</td><td>requestCode+interfacode+8位日期+9位序列号</td></tr></table>

数据交换请求返回状态信息 returnStateInfo

<table><tr><td>数据项</td><td>数据项名称</td><td>类型</td><td>长度</td><td>说明</td></tr><tr><td>returnCode</td><td>返回代码</td><td>String</td><td>4</td><td>0000 成功，其他为错误</td></tr><tr><td>returnMessage</td><td>返回描述</td><td>String</td><td>不定长</td><td>0000 返回成功，其他返回错误描述</td></tr></table>


交换数据属性描述（dataDescription）的数据项说明：


<table><tr><td>数据项</td><td>数据项名称</td><td>类型</td><td>长度</td><td>说明</td></tr><tr><td>zipCode</td><td>压缩标识</td><td>String(提供压缩方式)</td><td></td><td>保留字段</td></tr></table>


交换数据内容(content)数据项说明：


<table><tr><td>数据项</td><td>数据项名称</td><td>类型</td><td>长度</td><td>说明</td></tr><tr><td>content</td><td>需要交换的数据内容</td><td>String</td><td>不定长</td><td>整个业务报文使用base64</td></tr><tr><td>contentKey</td><td>加密key</td><td>String</td><td>不定长</td><td>content节点内数据(base64后的数据)SHA-256再用每个企业的密钥AES加密的数据内容。请求时必填，返回时为空。</td></tr></table>

# 三 、接口支持设备类型列表（重要）

名词定义如下：空白代表暂不支持。

服务器：税控服务器。

自持：指用户的税控盘/金税盘/Ukey 设备，使用盘开软件服务。
托管 A：指用户的税控盘/Ukey 设备，进行托管服务。
托管 B：指用户的税控盘/金税盘设备，进行托管服务。
托管 C：指用户的税控盘/金税盘/Ukey 设备，进行托管服务。
数电：数电平台。
乐企：数电平台。

<table><tr><td rowspan="2">序号</td><td rowspan="2">接口</td><td rowspan="2">接口说明</td><td colspan="7">支持类型</td></tr><tr><td>服务器</td><td>自持</td><td>托管A</td><td>托管B</td><td>托管C</td><td>数电</td><td>乐企</td></tr><tr><td>1</td><td>GP_SKBXXCX</td><td>税控设备信息查询</td><td>老税控服务器</td><td></td><td>税控盘/Ukey</td><td></td><td></td><td></td><td></td></tr><tr><td>2</td><td>GP_JKXX</td><td>监控信息查询</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td></td><td></td><td></td></tr><tr><td>3</td><td>GP_RZEWM</td><td>认证二维码查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>4</td><td>GP_EWMRZJG</td><td>二维码认证结果查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>5</td><td>GP_SLZBXXCX</td><td>申领准备信息查询(网上购票)</td><td></td><td></td><td>税控盘/Ukey</td><td></td><td></td><td></td><td></td></tr><tr><td>6</td><td>GP_FPSG</td><td>发票申领(网上购票)</td><td></td><td></td><td>税控盘/Ukey</td><td></td><td></td><td></td><td></td></tr><tr><td>7</td><td>GP_CXSL</td><td>发票申领撤销(网上购票)</td><td></td><td></td><td>税控盘/Ukey</td><td></td><td></td><td></td><td></td></tr><tr><td>8</td><td>GP_SLXXCX</td><td>发票申领结果查询(网上购票)</td><td></td><td></td><td>税控盘/Ukey</td><td></td><td></td><td></td><td></td></tr><tr><td>9</td><td>GP_ZPJSQR</td><td>纸质票接收确认(网上购票)</td><td></td><td></td><td>税控盘/Ukey</td><td></td><td></td><td></td><td></td></tr><tr><td>10</td><td>GP_KCCX</td><td>库存查询</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td>税控盘/金税盘/Ukey</td><td></td><td></td></tr><tr><td>11</td><td>GP_FPDXCX</td><td>网上购票信息查询</td><td></td><td></td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td></td><td></td><td></td></tr><tr><td>12</td><td>GP_FPWSGPLR</td><td>发票网上购票录入</td><td></td><td></td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td></td><td></td><td></td></tr><tr><td>13</td><td>GP_LGXXCX</td><td>发票领购信息查询</td><td>老税控服务器</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>14</td><td>GP_FPFF</td><td>发票票源分发</td><td>老税控服务器</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>15</td><td>GP_FPHS</td><td>发票票源回收</td><td>老税控服务器</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>16</td><td>GP_HZXBSQ</td><td>红字信息表申请</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td></td><td>税控盘/金税盘/Ukey</td><td>数电</td><td>乐企</td></tr><tr><td>17</td><td>GP_HZXXBXZ</td><td>红字信息表下载</td><td></td><td>税控盘/金税盘/Ukey</td><td></td><td></td><td>税控盘/金税盘/Ukey</td><td>数电(列表下载)</td><td>乐企</td></tr><tr><td>18</td><td>GP_HZXXBCX</td><td>红字信息表撤销</td><td>老税控服务器</td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>19</td><td>GP_HZXXBXXC X</td><td>红字信息表查询</td><td>老税控服务器</td><td></td><td>税控盘/Ukey</td><td></td><td>税控盘/金税盘/Ukey</td><td>数电(明细查询)</td><td>乐企</td></tr><tr><td>20</td><td>GP_HZXXBQR</td><td>红字信息表确认</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>21</td><td>GP_DQFPCX</td><td>查询当前未开票号</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td></td><td></td><td></td></tr><tr><td>22</td><td>GP_FPKJ</td><td>发票开具</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td>税控盘/金税盘/Ukey</td><td>数电</td><td>乐企</td></tr><tr><td>23</td><td>GP_FPZF</td><td>发票作废</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td>税控盘/金税盘/Ukey</td><td></td><td></td></tr><tr><td>24</td><td>GP_FPKSHC</td><td>发票快速红冲</td><td>老税控服务器</td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td>税控盘/金税盘/Ukey</td><td>数电</td><td>乐企</td></tr><tr><td>25</td><td>GP_FPXZDZCX</td><td>发票下载地址查询</td><td colspan="7">不针对设备,但需要上传SBLX</td></tr><tr><td>26</td><td>GP_LZFPTJ</td><td>蓝字发票统计信息</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>27</td><td>GP_HZFPTJ</td><td>红字发票统计信息</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>28</td><td>GP_FPTBLB</td><td>发票同步列表</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>29</td><td>GP_FPTBMX</td><td>发票同步明细</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>30</td><td>GP_FPJF</td><td>发票交付</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>31</td><td>GP_HZSJCB</td><td>数据抄报</td><td></td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td></td><td></td><td></td></tr><tr><td>32</td><td>GP_JKHC</td><td>监控回传</td><td></td><td>税控盘/金税盘/Ukey</td><td>税控盘/Ukey</td><td>税控盘/金税盘</td><td></td><td></td><td></td></tr><tr><td>33</td><td>GP_FPCX</td><td>发票查询</td><td colspan="7">不针对设备</td></tr><tr><td>34</td><td>GP_YBJGCX</td><td>异步请求结果查询</td><td colspan="7">不针对设备</td></tr><tr><td>35</td><td>GP_QYOH</td><td>数电企业切换</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>36</td><td>GP_NSRXXCX</td><td>纳税人信息查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>37</td><td>GP_NSRFXXXC X</td><td>纳税人风险信息查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>38</td><td>GP_SSBMCX</td><td>税收分类编码查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>39</td><td>GP_KYSLCX</td><td>可用税率查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>40</td><td>GP SXEDCX</td><td>授信额度查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>41</td><td>GP SXEDXZTH</td><td>授信额度下载/退回</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>42</td><td>GP SXEDSQTZ</td><td>授信额度有效期调整</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>43</td><td>GP_BSWJ</td><td>版式文件查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>44</td><td>GP_FPZTCX</td><td>发票状态查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>45</td><td>GP_SMRZJLCX</td><td>实名认证记录查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>46</td><td>GP_LPKHCCX</td><td>蓝字发票可红冲金额查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>47</td><td>GP_JZFWXXCX</td><td>建筑服务信息查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>48</td><td>GP_FPCT</td><td>发票重推</td><td colspan="7">不针对设备</td></tr><tr><td>49</td><td>GP_BDCFYXXC X</td><td>不动产房源信息查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td></td></tr><tr><td>50</td><td>GP_CJHXXCX</td><td>车架号信息查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>51</td><td>GP_JDCFPSCYCL</td><td>机动车发票上传预处理</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>52</td><td>GP_GFSFWSDD QQYCX</td><td>购方是否为试点地区企业查询</td><td></td><td></td><td></td><td></td><td></td><td>数电</td><td>乐企</td></tr><tr><td>53</td><td>GP_SSZYFWXGXCCX</td><td>涉税专业服务相关信息查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr><tr><td>54</td><td>GP_JYSSJYQYZ GCX</td><td>金银首饰经营企业资格查询</td><td></td><td></td><td></td><td></td><td></td><td></td><td>乐企</td></tr></table>

# 四 、接口定义

为了兼容不同税控的调用方式，同步和异步返回的情况，接口增加回调地址(CALLBACK_URL)和流水号(LSH)，同时返回结果增加字段处理(CODE,MESSAGE)，CODE 方式为0000 的说明有返回结果(实时返回的或通过二次请求原请求已有结果的)，如果为 1000 的则需要通过回调或再次通过原流水号查询才能有结果(如果上次请求还未有处理结果，则返回处理中，除非更换流水号)，如为 2000 则该税控不支持该接口调用，针对实时返回的则回调地址不生效；针对回调地址请提供固定 IP 回写地址，回调报文见返回参数。


主要字段说明：


<table><tr><td>序号</td><td>字段</td><td>中文说明</td><td>描述</td></tr><tr><td>1</td><td>SBBH</td><td>设备编号</td><td>具体指盘号(金税盘、税控盘)、Ukey编号(Ukey)、核心板编号(老税控服务器)等;</td></tr><tr><td>2</td><td>SBLX</td><td>设备类型</td><td>具体指被调用的设备1-税控盘、2-金税盘、3-Ukey、4-老税控服务器、6-数电、7-乐企;1-金税盘/2-税控盘/3-UkeySBBH: Ukey 编号=盘号=KPZDDM4-老税控服务器:SBBH:为空KPZDDM: KPZDDM5-新税控服务器(历史设备已移除)6-数电:</td></tr><tr><td></td><td></td><td></td><td>SBBH:为空KPZDDM:为空7-乐企:SBBH:为空KPZDDM:为空</td></tr><tr><td>3</td><td>FPLXDM</td><td>发票类型代码</td><td>004-增值税专用发票(纸质)005-机动车销售统一发票006-二手车销售统一发票007-增值税普通发票(纸质)025-增值税普通发票(卷式)026-增值税普通发票(电子)028-增值税专用发票(电子)030-数电普票032-数电专票083-数机动车销售电子统一发票084-数电二手车销售电子统一发票085-数电纸质专票086-数电纸质普票087-数电纸质发票(机动车销售统一发票)088-数电纸质发票(二手车销售统一发票)</td></tr></table>

## 4.7. 发票开具与作废

### 4.7.1. 发票开具

接口说明：通过该接口进行纸质发票和电子发票的开具

调用方式：HTTP POST 方式

```txt
InterfaceCode: GP_FPKJ
```

#### 请求参数：

```json
{
  "REQUEST_COMMON_FPKJ": {
    "SBLX": "1-税控盘、2-金税盘、3-UKey、4-老税控服务器、6-数电、7-乐企",
    "SBBH": "设备编号",
    "FPQQLSH": "发票请求流水号",
    "KPZDDM": "开票终端代码",
    "FPLXDM": "发票类型代码",
    "KPLX": "开票类型",
    "BMB_BBH": "编码表版本号",
    "ZSFS": "征税方式",
    "ZSFSXX": {},
    "XSF_NSRSBH": "销售方纳税人识别号",
    "XSF_MC": "销售方名称",
    "XSF_DZDH": "销售方地址、电话（增值税发票）",
    "XSF_DZ": "销售方地址（数电）",
    "XSF_DH": "销售方电话（数电）",
    "XSF_YHZH": "销售方银行账号（增值税发票）",
    "XSF_KHH": "销售方开户行（数电）",
    "XSF_ZH": "销售方开户行账号（数电）",
    "GMF_NSRSBH": "购买方纳税人识别号",
    "GMF_MC": "购买方名称",
    "GMF_DZDH": "购买方地址、电话（增值税发票）",
    "GMF_DZ": "购买方地址（数电）",
    "GMF_DH": "购买方电话（数电）",
    "GMF_YHZH": "购买方银行账号（增值税发票）",
    "GMF_KHH": "购买方开户行（数电）",
    "GMF_ZH": "购买方开户行账号（数电）",
    "GMF_SJH": "购买方手机号",
    "GMF_DZYX": "购买方电子邮箱",
    "FPT_ZH": "发票通账户",
    "WX_OPENID": "微信 openId",
    "KPR": "开票人",
    "KPRZJHM": "开票人证件号码",
    "KPRZJLX": "开票人证件类型",
    "SKR": "收款人",
    "FHR": "复核人",
    "YFP_DM": "原发票代码",
    "YFP_HM": "原发票号码",
    "JSHJ": "价税合计",
    "HJJE": "合计金额",
    "HJSE": "合计税额",
    "KCE": "扣除额",
    "BZ": "备注",
    "YFP_LX": "原发票类型",
    "YFP_RQ": "原发票日期",
    "CHYYDM": "冲红原因代码",
    "SSLKJLY": "3%税率开具发票理由",
    "BY1": "备用字段 1",
    "BY2": "备用字段 2",
    "BY3": "备用字段 3",
    "BY4": "备用字段 4",
    "BY5": "备用字段 5",
    "BY6": "备用字段 6",
    "BY7": "备用字段 7",
    "BY8": "备用字段 8",
    "BY9": "备用字段 9",
    "BY10": "备用字段 10",
    "WX_ORDER_ID": "微信用于预制卡券的唯一识别 ID",
    "WX_APP_ID": "商户所属微信公众号 APPID 或发票通 APPID",
    "ZFB_UID": "支付宝 UID",
    "TSPZ": "特殊票种标识",
    "TSPZXX": {
      "TDYS": []
    },
    "QJ_ORDER_ID": "全局唯一订单 ID",
    "QDBZ": "清单标志",
    "TZDBH": "通知单编号",
    "HZQRDUUID": "红字确认单 UUID",
    "JBRZJHM": "经办人证件号码",
    "JBRZJZLDM": "经办人证件种类代码",
    "JBRGJDM": "经办人国籍代码",
    "JBRZRRNSRSBH": "经办人纳税人识别号",
    "JBRXM": "经办人姓名",
    "JBRLXDH": "经办人联系电话",
    "GMF_ZRRBS": "购买方自然人标识",
    "GMF_ZJLX": "购买方证件类型",
    "GMF_ZJHM": "购买方证件号码",
    "GMF_GJDM": "购买方国籍代码",
    "ZFXXLIST": [
      {
        "JYDH": "交易单号",
        "ZFQDDM": "支付渠道代码"
      }
    ],
    "SFZSGMFYHZH": "是否展示购买方银行账号",
    "SFZSXSFYHZH": "是否展示销售方银行账号",
    "SFZSGMFDZDH": "是否展示购买方地址",
    "SFZSXSFDZDH": "是否展示销售方地址",
    "SSZYFWXYBH": "涉税专业服务协议编号",
    "SFKJSSZYFWFPPM": "是否开具涉税专业服务发票品目",
    "MTPZZB": {
      "MQKMTFRL": "每千克煤炭发热量（千卡）",
      "GJQL": "干基全硫（%）",
      "GZWHJHFF": "干燥无灰基挥发分（%）"
    },
    "COMMON_FPKJ_XMXX": [
      {
        "FPHXZ": "发票行性质",
        "SPBM": "商品编码",
        "ZXBM": "自行编码",
        "YHZCBS": "优惠政策标识",
        "LSLBS": "零税率标识",
        "ZZSTSGL": "增值税特殊管理",
        "XMMC": "项目名称",
        "GGXH": "规格型号",
        "MTZLDM": "煤炭种类代码",
        "DW": "单位",
        "XMSL": "项目数量",
        "XMDJ": "项目单价",
        "XMJE": "项目金额",
        "SL": "税率",
        "SE": "税额",
        "BY1": "备用字段 1",
        "BY2": "备用字段 2",
        "BY3": "备用字段 3",
        "BY4": "备用字段 4",
        "BY5": "备用字段 5"
      }
    ],
    "CALLBACK_URL": "回调地址",
    "LSH": "流水号"
  }
}
```



#### 参数说明：


<table><tr><td>索引</td><td>ID</td><td>名称</td><td>长度</td><td>必须</td><td>说明</td></tr><tr><td>1</td><td>SBBH</td><td>设备编号</td><td>20</td><td>否</td><td></td></tr><tr><td>2</td><td>SBLX</td><td>设备类型</td><td>1</td><td>是</td><td>1-税控盘2-金税盘3-Ukey4-老税控服务器6-数电7-乐企</td></tr><tr><td>3</td><td>FPQQLSH</td><td>发票请求流水号</td><td>20</td><td>是</td><td>企业内部唯一请求开票流水号,每个请求流水号只能开一次,流水号前面以公司名称前缀例如国信电票:GXDP201604201454001</td></tr><tr><td>4</td><td>KPZDDM</td><td>开票终端代码</td><td>30</td><td>否</td><td></td></tr><tr><td>5</td><td>FPLXDM</td><td>发票类型代码</td><td>10</td><td>是</td><td>026增值税普票(电票)004增值税专票(纸票)028增值税专票(电票)007增值税普票(纸票)030 数电普票032 数电专票083 数电机动车销售电子统一发票</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td>084 数电二手车销售电子统一发票</td></tr><tr><td>6</td><td>KPLX</td><td>开票类型</td><td>1</td><td>是</td><td>0-蓝字发票；1-红字发票</td></tr><tr><td>7</td><td>BMB_BBH</td><td>编码表版本号</td><td>20</td><td>否</td><td></td></tr><tr><td>8</td><td>ZSFS</td><td>征税方式</td><td>1</td><td>是</td><td>0：普通征税
1：减按计征
2：差额征税</td></tr><tr><td>9</td><td>ZSFSXX</td><td>征税方式信息</td><td></td><td>否</td><td>数电
需要开具减按计征/差额征税的票此节点必填，否则可省略
报文结构见：八、征税方式报文</td></tr><tr><td>10</td><td>XSF_NSRSBH</td><td>销售方纳税人识别号</td><td>20</td><td>是</td><td></td></tr><tr><td>11</td><td>XSFMC</td><td>销售方名称</td><td>100</td><td>是</td><td></td></tr><tr><td>12</td><td>XSF_DZDH</td><td>销售方地址 电话</td><td>100</td><td>否</td><td>销售方地址 销售方电话（以空格分隔地址电话）增值税发票：必填</td></tr><tr><td>13</td><td>XSF_DZ</td><td>销售方地址</td><td>100</td><td>否</td><td>销售方地址
数电发票：必填</td></tr><tr><td>14</td><td>XSF_DH</td><td>销售方电话</td><td>100</td><td>否</td><td>销售方电话
数电发票：必填</td></tr><tr><td>15</td><td>XSF_YHZH</td><td>销售方银行账号</td><td>100</td><td>是</td><td>销售方开户行 销售方银行账号（以空格分隔开户行账号）
增值税发票：必填</td></tr><tr><td>16</td><td>XSF_KHH</td><td>销售方开户行</td><td>100</td><td>是</td><td>销售方开户行
数电发票：必填</td></tr><tr><td>17</td><td>XSF_ZH</td><td>销售方开户行账号</td><td>100</td><td>是</td><td>销售方开户行账号
数电发票：必填</td></tr><tr><td>18</td><td>GMF_NSRSBH</td><td>购买方纳税人识别号</td><td>20</td><td>否</td><td></td></tr><tr><td>19</td><td>GMFMC</td><td>购买方名称</td><td>100</td><td>是</td><td></td></tr><tr><td>20</td><td>GMF_DZDH</td><td>购买方地址 电话</td><td>100</td><td>否</td><td>购买方地址 购买方电话（以空格分隔地址电话）增值税发票：非必填</td></tr><tr><td>21</td><td>GMF_DZ</td><td>购买方地址</td><td>100</td><td>否</td><td>购买方地址
数电发票：非必填</td></tr><tr><td>22</td><td>GMF_DH</td><td>购买方电话</td><td>100</td><td>否</td><td>购买方电话
数电发票：非必填</td></tr><tr><td>23</td><td>GMF_YHZH</td><td>购买方银行账号</td><td>100</td><td>否</td><td>购买方开户行 购买方银行账号（以空格分隔开户行账</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td>号)增值税发票:非必填</td></tr><tr><td>24</td><td>GMF_KHH</td><td>购买方开户行</td><td>100</td><td>否</td><td>购买方开户行 数电发票:非必填</td></tr><tr><td>25</td><td>GMF_ZH</td><td>购买方开户行账号</td><td>100</td><td>否</td><td>购买方开户行账号 数电发票:非必填</td></tr><tr><td>26</td><td>GMF_SJH</td><td>购买方手机号</td><td>48</td><td>否</td><td>可以多个,用逗号分开,用于接收和归集电子发票 购买方手机号与电子邮箱不能同时为空</td></tr><tr><td>27</td><td>GMF_DZYX</td><td>购买方电子邮箱</td><td>100</td><td>否</td><td>用于接收和归集电子发票 购买方手机号与电子邮箱不能同时为空</td></tr><tr><td>28</td><td>FPT_ZH</td><td>购买方发票通平台账户</td><td>100</td><td>否</td><td>发票通平台(Fapiao.com) 注册账户名,用于接收和归 集电子发票</td></tr><tr><td>29</td><td>WX_OPENID</td><td>微信 openId</td><td>50</td><td>否</td><td>如果使用发票通公众号预 授权需要传用户 openid</td></tr><tr><td>30</td><td>KPR</td><td>开票人</td><td>8</td><td>是</td><td></td></tr><tr><td>31</td><td>KPRZJHM</td><td>开票人证件号码</td><td>30</td><td>否</td><td rowspan="2">目前只有乐企机动车(专票 /销售)必填 限制仅可为以下证件类型: 201、238、237、210、213、 233、227</td></tr><tr><td>32</td><td>KPRZJLX</td><td>开票人证件类型</td><td>3</td><td>否</td></tr><tr><td>33</td><td>SKR</td><td>收款人</td><td>8</td><td>否</td><td></td></tr><tr><td>34</td><td>FHR</td><td>复核人</td><td>8</td><td>否</td><td></td></tr><tr><td>35</td><td>YFP_DM</td><td>原发票代码</td><td></td><td>否</td><td>红字发票时必填(数电不需 要填)</td></tr><tr><td>36</td><td>YFP_HM</td><td>原发票号码</td><td>20</td><td>否</td><td>红字发票时必填</td></tr><tr><td>37</td><td>YFP_LX</td><td>原发票类型</td><td>3</td><td>否</td><td>红字发票时必填(数电不需 要填)</td></tr><tr><td>38</td><td>YFP_RQ</td><td>原发票日期</td><td>8</td><td>否</td><td>若使用金税盘盘柜,则 YFP_RQ格式为YYYYMM; 若SBLX=4,红字发票时必 填,YYYYMMDD 若SBLX=6,数电红字发票 时必填, yyyy-MM-dd HH:mm:ss</td></tr><tr><td>39</td><td>CHYYDM</td><td>冲红原因代码</td><td>1</td><td>否</td><td>SBLX=4(旧税控) SBLX=6(数电) 红字发票时必填 1-销货退回 2-开票有误</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td>3-服务中止
4-销售折让</td></tr><tr><td>40</td><td>SSLKJLY</td><td>3%税率开具发票理由</td><td>1</td><td>否</td><td>1、2020年3月1日前发生纳税义务。
2、前期已开具3%征收率发票，发生销售折让、中止或者退回等情形需要开具红字发票，或者开票有误需要重新开具。
3、因为实际经营业务需要，放弃享受减按1%征收率征收增值税政策。</td></tr><tr><td>41</td><td>JSHJ</td><td>价税合计</td><td></td><td>是</td><td>单位：元（2位小数）</td></tr><tr><td>42</td><td>HJJE</td><td>合计金额</td><td></td><td>是</td><td>不含税，单位：元（2位小数）</td></tr><tr><td>43</td><td>HJSE</td><td>合计税额</td><td></td><td>是</td><td>单位：元（2位小数）</td></tr><tr><td>44</td><td>KCE</td><td>扣除额</td><td>12</td><td>否</td><td>小数点后2位，当ZSFS为2时扣除额为必填项</td></tr><tr><td>45</td><td>BZ</td><td>备注</td><td>240</td><td>否</td><td>电普备注长度应减去”对应正数 发 票 代 码 :XXXXXXXXXX 号码:YYYYYY\n”字样长度，长度剩余160。专票，最大长度为184。若zsfs同时为2,备注长度为160。普票，最大长度138。若zsfs同时为2,备注长度为114。蓝票差额216蓝票无差额240红票差额181红票无差额205</td></tr><tr><td>46</td><td>BY1</td><td>备用字段1</td><td>200</td><td>否</td><td></td></tr><tr><td>47</td><td>BY2</td><td>备用字段2</td><td>200</td><td>否</td><td>订单号</td></tr><tr><td>48</td><td>BY3</td><td>备用字段3</td><td>200</td><td>否</td><td></td></tr><tr><td>49</td><td>BY4</td><td>备用字段4</td><td>200</td><td>否</td><td></td></tr><tr><td>50</td><td>BY5</td><td>备用字段5</td><td>200</td><td>否</td><td></td></tr><tr><td>51</td><td>BY6</td><td>备用字段6</td><td>200</td><td>否</td><td></td></tr><tr><td>52</td><td>BY7</td><td>备用字段7</td><td>200</td><td>否</td><td></td></tr><tr><td>53</td><td>BY8</td><td>备用字段8</td><td>200</td><td>否</td><td></td></tr><tr><td>54</td><td>BY9</td><td>备用字段9</td><td>200</td><td>否</td><td></td></tr></table>


<table><tr><td>55</td><td>BY10</td><td>备用字段10</td><td>200</td><td>否</td><td></td></tr><tr><td>56</td><td>WX-order_ID</td><td>微信用于预制卡券的唯一识别ID</td><td>32</td><td>否</td><td>用于预制卡券的唯一识别ID,例如:通过税号、门店号、小票号等MD5后的值</td></tr><tr><td>57</td><td>WX_APP_ID</td><td>商户所属微信公众号APPID</td><td>50</td><td>否</td><td>如使用商户公众号拉起预制卡券则此内容需要传入,如采用发票通拉起预制卡券则为空。</td></tr><tr><td>58</td><td>ZFB_UID</td><td>支付宝UID</td><td>50</td><td>否</td><td>使用支付宝扫描开票时记录的用户UID</td></tr><tr><td>59</td><td>TSPZ</td><td>特殊票种标识</td><td>2</td><td>否</td><td>见:6.3.特殊票种(特定要素类型)代码</td></tr><tr><td>60</td><td>TSPZXX</td><td>特殊票种信息</td><td></td><td>否</td><td>数电需要开具特定要素类型的票此节点必填,否则可省略报文结构见:七、特定要素报文</td></tr><tr><td>61</td><td>TDYS</td><td>特定要素</td><td></td><td>否</td><td>数电需要开具特定要素类型的票此节点必填,否则可省略报文结构见:七、特定要素报文</td></tr><tr><td>62</td><td>QJ_ORDER_ID</td><td>全局唯一订单ID</td><td>32</td><td>否</td><td>通过税号、内部唯一流水号等做MD5后的值</td></tr><tr><td>63</td><td>QDBZ</td><td>清单标志</td><td>1</td><td>否</td><td>纸票字段0无清单1有清单</td></tr><tr><td>64</td><td>TZDBH</td><td>通知单编号</td><td>20</td><td>否</td><td>非数电专票字段:16位数字,通知单编号数电专票或普票字段:代表信息表编号(XXBBH)数电开具红票,若已申请红字确认单,则必填</td></tr><tr><td>65</td><td>HZQRDUUID</td><td>红字确认单UUID</td><td>32</td><td>否</td><td>数电非必填数电开具红票,若已申请红字确认单,则必填</td></tr><tr><td>66</td><td>JBRZJHM</td><td>经办人证件号码</td><td></td><td>否</td><td>数电</td></tr><tr><td>67</td><td>JBRZJZLDM</td><td>经办人证件种类代码</td><td></td><td>否</td><td>数电见:6.1身份证件种类代码码表</td></tr><tr><td>68</td><td>JBRGJDM</td><td>经办人国籍代码</td><td></td><td>否</td><td>数电见:6.2国籍代码</td></tr><tr><td>69</td><td>JBRZRRNSRSBH</td><td>经办人纳税人识别号</td><td></td><td>否</td><td>数电</td></tr><tr><td>70</td><td>JBRXM</td><td>经办人姓名</td><td></td><td>否</td><td>数电</td></tr><tr><td>71</td><td>JBRLXDH</td><td>经办人联系电话</td><td></td><td>否</td><td></td></tr><tr><td>72</td><td>GMF_ZRRBS</td><td>购买方自然人标识</td><td></td><td>否</td><td>数电默认NY-是N-否SBLX=6时,当GMF_ZRRBS为Y时,可以使用GMF_ZJLX和GMF_ZJHM(非必填,两个字段需要同时为空或者同时不为空)</td></tr><tr><td>73</td><td>GMF_ZJLX</td><td>购买方证件类型</td><td></td><td>否</td><td>见:6.1身份证件种类代码购买方证件类型、购买方证件号码同时为空或同时不为空7.6.农产品收购发票:必填7.7.报废产品收购发票:必填详见具体票种</td></tr><tr><td>74</td><td>GMF_ZJHM</td><td>购买方证件号码</td><td></td><td>否</td><td>购买方证件类型、购买方证件号码同时为空或同时不为空7.6.农产品收购发票:必填7.7.报废产品收购发票:必填详见具体票种</td></tr><tr><td>75</td><td>GMF_GJDM</td><td>购买方国籍代码</td><td></td><td>否</td><td>见:6.2国籍代码</td></tr><tr><td>76</td><td>SFZSGMFYHZH</td><td>是否展示购买方银行账号</td><td></td><td>否</td><td>数电Y-是N-否</td></tr><tr><td>77</td><td>SFZSXSFYHZH</td><td>是否展示销售方银行账号</td><td></td><td>否</td><td>数电Y-是N-否</td></tr><tr><td>78</td><td>SFZSGMFDZDH</td><td>是否展示购买方地址电话</td><td></td><td>否</td><td>数电Y-是N-否</td></tr><tr><td>79</td><td>SFZSXSFZDH</td><td>是否展示销售方地址电话</td><td></td><td>否</td><td>数电Y-是N-否</td></tr><tr><td>80</td><td>SSZYFWXYBH</td><td>涉税专业服务协议编号</td><td>20</td><td>否</td><td></td></tr><tr><td>81</td><td>SFKJSSZYFWFPM</td><td>是否开具涉税专业服务发票品目</td><td>1</td><td>否</td><td>Y:是N:否</td></tr><tr><td>82</td><td>ZFXXLIST</td><td>支付信息数组</td><td></td><td>否</td><td>若没有此业务可以省略</td></tr><tr><td>83</td><td>JYDH</td><td>交易单号</td><td></td><td>否</td><td></td></tr><tr><td>84</td><td>ZFQDDM</td><td>支付渠道代码</td><td></td><td>否</td><td>见:6.5支付渠道代码码表</td></tr><tr><td>85</td><td>MTPZZB</td><td>煤炭品质指标</td><td></td><td>否</td><td rowspan="4">当商品和税收服务分类编码填写102010100000000000（原煤）、1020102000000000000（选煤）、1020199000000000000（煤炭）时，若开票金额超过1000万则必填若没有此业务可省略</td></tr><tr><td>86</td><td>MQKMTFRL</td><td>每千克煤炭发热量（千卡）</td><td></td><td>否</td></tr><tr><td>87</td><td>GJQL</td><td>干基全硫（%）</td><td></td><td>否</td></tr><tr><td>88</td><td>GZWHJHFF</td><td>干燥无灰基挥发分（%）</td><td></td><td>否</td></tr><tr><td>89</td><td colspan="5">项目明细，可多条(最大100条)</td></tr><tr><td>90</td><td>FPHXZ</td><td>发票行性质</td><td>1</td><td>是</td><td>0正常行、1折扣行、2被折扣行</td></tr><tr><td>91</td><td>SPBM</td><td>商品编码</td><td>19</td><td>是</td><td></td></tr><tr><td>92</td><td>ZXBM</td><td>自行编码</td><td>20</td><td>否</td><td></td></tr><tr><td>93</td><td>YHZCBS</td><td>优惠政策标识</td><td>1</td><td>否</td><td>0：不使用，1：使用</td></tr><tr><td>94</td><td>LSLBS</td><td>零税率标识</td><td>1</td><td>否</td><td>空：非零税率，1：免税，2：不征收，3普通零税率</td></tr><tr><td>95</td><td>ZZSTSGL</td><td>增值税特殊管理</td><td>50</td><td>否</td><td>见:6.4.ZZSTSGL-增值税特殊管理支持项</td></tr><tr><td>96</td><td>XMMC</td><td>项目名称</td><td>90</td><td>是</td><td>如果为折扣行，商品名称须与被折扣行的商品名称相同，不能多行折扣。</td></tr><tr><td>97</td><td>DW</td><td>计量单位</td><td>20</td><td>否</td><td>若TSPZ为08，此项必填，必须为“吨”或者“升”当商品和税收服务分类编码填写1020101000000000000（原煤）、1020102000000000000（选煤）、10201990000000000000（煤炭）时，单位必填，且只能是吨或者千克（公斤）</td></tr><tr><td>98</td><td>GGXH</td><td>规格型号</td><td>40</td><td>否</td><td></td></tr><tr><td>99</td><td>MTZLDM</td><td>煤炭种类代码</td><td>4</td><td>否</td><td>当商品和税收服务分类编码填写1020101000000000000（原煤）、1020102000000000000（选煤）、10201990000000000000（煤</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td>炭)时,煤炭种类代码必填,若没有此业务可省略见:6.6.煤炭种类代码</td></tr><tr><td>100</td><td>XMSL</td><td>项目数量</td><td></td><td>否</td><td>总长度包含小数点不能超过15位;若TSPZ为08,此项必填,不能为0。最多保留13位小数。当TSPZ为:06-不动产经营租赁14-不动产销售数量必填</td></tr><tr><td>101</td><td>XMDJ</td><td>项目单价</td><td></td><td>否</td><td>卷票为含税,其他不含税。总长度包含小数点不能超过15位(只有当ZSFS为1时,此处填含税单价)若TSPZ为08,此项必填,不能为0。最多保留13位小数。当TSPZ为:06-不动产经营租赁14-不动产销售单价必填</td></tr><tr><td>102</td><td>XMJE</td><td>项目金额</td><td></td><td>是</td><td>卷票为含税,其他不含税。单位:元(最多保留2位小数)(只有当ZSFS为1时,此处填含税金额)</td></tr><tr><td>103</td><td>SL</td><td>税率</td><td></td><td>是</td><td>2位小数,例1%为0.01</td></tr><tr><td>104</td><td>SE</td><td>税额</td><td></td><td>是</td><td>单位:元(2位小数)</td></tr><tr><td>105</td><td>BY1</td><td>备用字段1</td><td>200</td><td>否</td><td></td></tr><tr><td>106</td><td>BY2</td><td>备用字段2</td><td>200</td><td>否</td><td></td></tr><tr><td>107</td><td>BY3</td><td>备用字段3</td><td>200</td><td>否</td><td></td></tr><tr><td>108</td><td>BY4</td><td>备用字段4</td><td>200</td><td>否</td><td></td></tr><tr><td>109</td><td>BY5</td><td>备用字段5</td><td>200</td><td>否</td><td></td></tr><tr><td>110</td><td>CALLBACK_URL</td><td>回调地址</td><td>500</td><td>否</td><td>仅异步返回时生效</td></tr><tr><td>111</td><td>LSH</td><td>流水号</td><td>36</td><td>否</td><td>供异步返回或异步推送时使用,请求唯一,除非是二次查询结果的重复请求</td></tr></table>

#### 返回参数：

```json
{
  "CODE": "0000-有返回，1000-异步处理中，2000-设备不支持该接口",
  "MESSAGE": "成功或具体信息",
  "DATA": {
    "FPQQLSH": "发票请求流水号",
    "FPLXDM": "发票类型代码",
    "FP_DM": "发票代码",
    "FP_HM": "发票号码",
    "KPRQ": "开票日期",
    "JYM": "校验码",
    "FP_MW": "发票密文/税控码",
    "PDF_URL": "PDF下载地址",
    "OFD_URL": "OFD下载地址",
    "XML_URL": "XML下载地址",
    "SP_URL": "收票地址",
    "SJPdf_URL": "源PDF下载地址",
    "SJ_OFD_URL": "源OFD下载地址",
    "SJ_XML_URL": "源XML下载地址"
  }
}
```


#### 参数说明：


<table><tr><td>索引</td><td>ID</td><td>名称</td><td>长度</td><td>必须</td><td>说明</td></tr><tr><td>1</td><td>CODE</td><td>返回代码</td><td>4</td><td>是</td><td>0000有信息返回,其它异步处理中或设备不支持该接口</td></tr><tr><td>2</td><td>MESSAGE</td><td>返回信息</td><td>160</td><td>是</td><td>变长</td></tr><tr><td>3</td><td>FPQQLSH</td><td>发票请求流水号</td><td>20</td><td>是</td><td></td></tr><tr><td>4</td><td>FPLXDM</td><td>发票类型代码</td><td>10</td><td>是</td><td>026增值税普票(电票)004增值税专票(纸票)028增值税专票(电票)007增值税普票(纸票)025增值税普票(卷票)030数电普票032数电专票</td></tr><tr><td>5</td><td>FP_DM</td><td>发票代码</td><td>12</td><td>否</td><td>成功必填(数电:无)</td></tr><tr><td>6</td><td>FP_HM</td><td>发票号码</td><td>20</td><td>否</td><td>成功必填</td></tr><tr><td>7</td><td>KPRQ</td><td>开票日期</td><td>14</td><td>否</td><td>yyyyMMddHHmmss成功必填</td></tr><tr><td>8</td><td>JYM</td><td>校验码</td><td>20</td><td>否</td><td>部分类型发票返回</td></tr><tr><td>9</td><td>FP_MW</td><td>发票密文/税控码</td><td>112</td><td>否</td><td></td></tr><tr><td>10</td><td>PDF_URL</td><td>PDF 下载地址</td><td>200</td><td>否</td><td></td></tr><tr><td>11</td><td>OFD_URL</td><td>OFD 下载地址</td><td>200</td><td>否</td><td></td></tr><tr><td>12</td><td>XML_URL</td><td>XML 下载地址</td><td>200</td><td>否</td><td></td></tr></table>


销项发票融合前置接口文档 V4.1.15


<table><tr><td>13</td><td>SP(URL</td><td>收票地址</td><td>250</td><td>否</td><td>用该地址生成二维码，供用户扫码获取发票
电票成功必填</td></tr><tr><td>14</td><td>SJ pij_URL</td><td>源PDF 下载地址</td><td>200</td><td>否</td><td>SBLX=6</td></tr><tr><td>15</td><td>SJ_OFD_URL</td><td>源 OFD 下载地址</td><td>200</td><td>否</td><td>SBLX=6</td></tr><tr><td>16</td><td>SJXML_URL</td><td>源XML 下载地址</td><td>200</td><td>否</td><td>SBLX=6</td></tr></table>

### 4.7.2. 发票作废

接口说明：通过该接口对已开发票作废和空白发票作废, 对增值税普通发票（电子）和增值税专用发票（电子）只能作废验签失败的发票。

调用方式：HTTP POST 方式

```typescript
InterfaceCode: GP_FPZF
```

#### 请求参数：

```json
{ "REQUEST_COMMON_FPZF": { "NSRSBH": "纳税人识别号", "SBLX": "1-税控盘、2-金税盘、3-UKKey、4-老税控服务器", "SBBH": "设备编号", "FPLXDM": "发票类型代码", "KPZDDM": "开票终端代码", "ZFLX": "作废类型", "FPDM": "发票代码", "FPHM": "发票号码", "HJJE": "合计金额", "ZFR": "作废人", "CALLBACK_URL": "回调地址", "LSH": "流水号" } }
```

#### 参数说明：

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>长度</td><td>必须</td><td>说明</td></tr><tr><td>1</td><td>NSRSBH</td><td>纳税人识别号</td><td>20</td><td>是</td><td></td></tr><tr><td>2</td><td>SBLX</td><td>设备类型</td><td>1</td><td>是</td><td>1-税控盘
2-金税盘
3-Ukey
4-老税控服务器</td></tr></table>


销项发票融合前置接口文档 V4.1.15


<table><tr><td>3</td><td>SBBH</td><td>设备编号</td><td>20</td><td>否</td><td>对应SBLX设备号</td></tr><tr><td>4</td><td>FPLXDM</td><td>发票类型代码</td><td>3</td><td>是</td><td>004-增值税专用发票（纸质）
005-机动车销售统一发票
006-二手车销售统一发票
007-增值税普通发票（纸质）
025-增值税普通发票（卷式）
026-增值税普通发票（电子）
028-增值税专用发票（电子）</td></tr><tr><td>5</td><td>KPZDDM</td><td>开票终端代码</td><td>30</td><td>否</td><td></td></tr><tr><td>6</td><td>ZFLX</td><td>作废类型</td><td>12</td><td>是</td><td>0-空白作废
1-已开作废</td></tr><tr><td>7</td><td>FPDM</td><td>发票代码</td><td>12</td><td>是</td><td></td></tr><tr><td>8</td><td>FPHM</td><td>发票号码</td><td>8</td><td>是</td><td></td></tr><tr><td>9</td><td>HJJE</td><td>合计金额</td><td>20</td><td>否</td><td>空白作废时为空,小数点后两位</td></tr><tr><td>10</td><td>ZFR</td><td>作废人</td><td>12</td><td>是</td><td></td></tr><tr><td>11</td><td>CALLBACK_URL</td><td>回调地址</td><td>500</td><td>否</td><td>仅异步返回时生效</td></tr><tr><td>12</td><td>LSH</td><td>流水号</td><td>36</td><td>否</td><td>供异步返回或异步推送时使用，请求唯一，除非是二次查询结果的重复请求</td></tr></table>

#### 返回参数：

```json
{ "CODE": "0000-有返回，1000-异步处理中，2000-设备不支持该接口"， "MESSAGE": "成功或具体信息"， "DATA": {} }
```


#### 参数说明：


<table><tr><td>索引</td><td>ID</td><td>名称</td><td>长度</td><td>必须</td><td>说明</td></tr><tr><td>1</td><td>CODE</td><td>返回代码</td><td>4</td><td>是</td><td>0000有信息返回，其它异步处理中或设备不支持该接口</td></tr><tr><td>2</td><td>MESSAGE</td><td>返回信息</td><td>160</td><td>是</td><td>变长</td></tr></table>

### 4.7.3. 发票快速红冲

接口说明：通过该接口做发票快速红冲，仅支持红冲发票通平台存在的蓝票，不支持部分红冲。

调用方式：HTTP POST 方式

```txt
InterfaceCode: GP_FPKSHC
```

#### 请求参数：

{ "REQUEST_COMMON_FPKSHC": { "SBLX": "1-税控盘、2-金税盘、3-UKey、4-老税控服务器、6-数电、7-乐企", "SBBH": "设备编号", "FPQQLSH": "发票请求流水号", "XSF_NSRSBH": "销售方纳税人识别号", "XSF_MC": "销售方名称", "YFP_DM": "原发票代码", "YFP_HM": "原发票号码", "CHYYDM": "冲红原因代码", "SSLKJLY": "小规模、转登记纳税人2021年12月31日前 $3 \%$ 税率开具发票理由", "HZQRDUUID": "红字确认单UUID", "XXBBH": "信息表编号", "KPR": "开票人", "CALLBACK_URL": "回调地址", "LSH": "流水号" } }

#### 参数说明：

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>长度</td><td>必须</td><td>说明</td></tr><tr><td>1</td><td>SBLX</td><td>设备类型</td><td>1</td><td>是</td><td>1-税控盘2-金税盘3-Ukey4-老税控服务器6-数电7-乐企</td></tr><tr><td>2</td><td>SBBH</td><td>设备编号</td><td>20</td><td>否</td><td>对应 SBLX 设备号</td></tr><tr><td>3</td><td>FPQQLSH</td><td>发票请求流水号</td><td>20</td><td>是</td><td></td></tr><tr><td>4</td><td>XSF_NSRSBH</td><td>销售方纳税人识别号</td><td>20</td><td>是</td><td></td></tr><tr><td>5</td><td>XSFMC</td><td>销售方名称</td><td>100</td><td>是</td><td></td></tr></table>


销项发票融合前置接口文档 V4.1.15


<table><tr><td>6</td><td>YFP_DM</td><td>原发票代码</td><td>12</td><td>否</td><td></td></tr><tr><td>7</td><td>YFP_HM</td><td>原发票号码</td><td>20</td><td>是</td><td></td></tr><tr><td>8</td><td>CHYYDM</td><td>冲红原因代码</td><td>1</td><td>否</td><td>SBLX=4(旧税控)
SBLX=6(数电)
红字发票时必填
1-销货退回
2-开票有误
3-服务中止
4-销售折让</td></tr><tr><td>9</td><td>SSLKJLY</td><td>小规模、转登记纳税人2021年12月31日前3%税率开具发票理由</td><td>1</td><td>否</td><td>1、2020年3月1日前发生纳税义务。
2、前期已开具3%征收率发票,发生销售折让、中止或者退回等情形需要开具红字发票,或者开票有误需要重新开具。
3、因为实际经营业务需要,放弃享受减按1%征收率征收增值税政策。</td></tr><tr><td>10</td><td>HZQRDUUID</td><td>红字确认单编号</td><td>32</td><td>否</td><td>数电开具红票,若已申请红字确认单,则必填</td></tr><tr><td>11</td><td>XXBBH</td><td>信息表编号</td><td>20</td><td>否</td><td>数电开具红票,若已申请红字确认单,则必填</td></tr><tr><td>12</td><td>KPR</td><td>开票人</td><td>10</td><td>否</td><td>不传KPR,开具使用的是蓝票的KPR</td></tr><tr><td>13</td><td>CALLBACK_URL</td><td>回调地址</td><td>500</td><td>否</td><td>仅异步返回时生效</td></tr><tr><td>14</td><td>LSH</td><td>流水号</td><td>36</td><td>否</td><td>供异步返回或异步推送时使用,请求唯一,除非是二次查询结果的重复请求</td></tr></table>

#### 返回参数：

```json
{
"CODE": "0000-有返回，1000-异步处理中，2000-设备不支持该接口",
"MESSAGE": "成功或具体信息",
"DATA": {
"FPQQLSH": "发票请求流水号",
"FPLXDM": "发票类型代码",
"FP_DM": "发票代码",
"FP_HM": "发票号码",
"KPRQ": "开票日期",
"JYM": "校验码",
"FP_MW": "发票密文/税控码",
"PDF_URL": "PDF下载地址",
```

```json
"OFD_url": "OFD下载地址",
"XML_url": "XML下载地址",
"SP_url": "收票地址",
"SJ_PDF_url": "源PDF下载地址",
"SJ_OF_DURL": "源OFD下载地址",
"SJ_XLURL": "源XML下载地址"
}
```

#### 参数说明：

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>长度</td><td>必须</td><td>说明</td></tr><tr><td>1</td><td>CODE</td><td>返回代码</td><td>4</td><td>是</td><td>0000有信息返回,其它异步处理中或设备不支持该接口</td></tr><tr><td>2</td><td>MESSAGE</td><td>返回信息</td><td>160</td><td>是</td><td>变长</td></tr><tr><td>3</td><td>FPQQLSH</td><td>发票请求流水号</td><td>20</td><td>是</td><td></td></tr><tr><td>4</td><td>FPLXDM</td><td>发票类型代码</td><td>10</td><td>是</td><td>026增值税普票(电票)004增值税专票(纸票)028增值税专票(电票)007增值税普票(纸票)025增值税普票(卷票)030数电普票032数电专票</td></tr><tr><td>5</td><td>FP_DM</td><td>发票代码</td><td>12</td><td>否</td><td>成功必填(数电:无)</td></tr><tr><td>6</td><td>FP_HM</td><td>发票号码</td><td>20</td><td>否</td><td>成功必填</td></tr><tr><td>7</td><td>KPRQ</td><td>开票日期</td><td>14</td><td>否</td><td>yyyyMMddHHmmss成功必填</td></tr><tr><td>8</td><td>JYM</td><td>校验码</td><td>20</td><td>否</td><td>部分类型发票返回</td></tr><tr><td>9</td><td>FP_MW</td><td>发票密文/税控码</td><td>112</td><td>否</td><td></td></tr><tr><td>10</td><td>PDF_URL</td><td>PDF 下载地址</td><td>200</td><td>否</td><td>电票成功必填</td></tr><tr><td>11</td><td>OFD_URL</td><td>OFD 下载地址</td><td>200</td><td>否</td><td>电票成功必填</td></tr><tr><td>12</td><td>XML_URL</td><td>XML 下载地址</td><td>200</td><td>否</td><td>电票成功必填</td></tr><tr><td>13</td><td>SP_URL</td><td>收票地址</td><td>250</td><td>否</td><td>用该地址生成二维码,供用户扫码获取发票电票成功必填</td></tr><tr><td>14</td><td>SJPdf_url</td><td>源 PDF 下载地址</td><td>200</td><td>否</td><td>SBLX=6</td></tr><tr><td>15</td><td>SJ_OFD_url</td><td>源 OFD 下载地址</td><td>200</td><td>否</td><td>SBLX=6</td></tr><tr><td>16</td><td>SJXML_url</td><td>源 XML 下载地址</td><td>200</td><td>否</td><td>SBLX=6</td></tr></table>

# 五 、返回码对应表

<table><tr><td>代码（returnCode）</td><td>中文描述 returnMessage</td></tr><tr><td>0000</td><td>业务处理成功，返回信息可为空</td></tr><tr><td>0001</td><td>查询接口返回代码，请求正在处理。</td></tr><tr><td>0002</td><td>根据请求报文查询数据为空</td></tr><tr><td>0009</td><td>开具失败</td></tr><tr><td>8001</td><td>此发票从未进行开具</td></tr><tr><td>8009</td><td>发票已开具成功，查询生成PDF失败，请稍等片刻用同一流水号查询结果</td></tr><tr><td>8010</td><td>磁盘错误导致的开具失败</td></tr><tr><td>1002</td><td>当前票号为空，剩余票量为零，请及时去税局购买发票</td></tr><tr><td>1003</td><td>当前票号获取异常</td></tr><tr><td>9001</td><td>查询接口返回代码，此发票不存在。</td></tr><tr><td>9007</td><td>系统运行时异常</td></tr><tr><td>9990</td><td>请求流水号重复</td></tr><tr><td>9991</td><td>推送盘失败</td></tr><tr><td>9996</td><td>报文格式错误</td></tr><tr><td>9997</td><td>数据不符合规范</td></tr><tr><td>9998</td><td>税控返回错误，返回信息为详细错误描述信息</td></tr><tr><td>9999</td><td>业务处理失败，返回信息为详细错误描述信息</td></tr></table>

# 六 、码表


6.1. 身份证件种类代码


<table><tr><td>索引</td><td>名称</td><td>代码</td><td>描述</td><td>备注</td></tr><tr><td rowspan="29">1</td><td rowspan="29">身份证件种类代码</td><td>101</td><td>组织机构代码证</td><td></td></tr><tr><td>102</td><td>营业执照</td><td></td></tr><tr><td>103</td><td>税务登记证</td><td></td></tr><tr><td>199</td><td>其他单位证件</td><td></td></tr><tr><td>201</td><td>居民身份证</td><td></td></tr><tr><td>202</td><td>军官证</td><td></td></tr><tr><td>203</td><td>武警警官证</td><td></td></tr><tr><td>204</td><td>士兵证</td><td></td></tr><tr><td>205</td><td>军队离退休干部证</td><td></td></tr><tr><td>206</td><td>残疾人证</td><td></td></tr><tr><td>207</td><td>残疾军人证(1-8级)</td><td></td></tr><tr><td>208</td><td>外国护照</td><td></td></tr><tr><td>210</td><td>港澳居民来往内地通行证</td><td></td></tr><tr><td>212</td><td>中华人民共和国往来港澳通行证</td><td></td></tr><tr><td>213</td><td>台湾居民往来大陆通行证</td><td></td></tr><tr><td>214</td><td>大陆居民往来台湾通行证</td><td></td></tr><tr><td>215</td><td>外国人居留证</td><td></td></tr><tr><td>216</td><td>外交官证</td><td></td></tr><tr><td>217</td><td>使（领事）馆证</td><td></td></tr><tr><td>218</td><td>海员证</td><td></td></tr><tr><td>219</td><td>香港永久性居民身份证</td><td></td></tr><tr><td>220</td><td>台湾身份证</td><td></td></tr><tr><td>221</td><td>澳门特别行政区永久性居民身份证</td><td></td></tr><tr><td>222</td><td>外国人身份证件</td><td></td></tr><tr><td>224</td><td>就业失业登记证</td><td></td></tr><tr><td>225</td><td>退休证</td><td></td></tr><tr><td>226</td><td>离休证</td><td></td></tr><tr><td>227</td><td>中国护照</td><td></td></tr><tr><td>228</td><td>城镇退役士兵自谋</td><td></td></tr></table>

<table><tr><td rowspan="16"></td><td></td><td>职业证</td><td></td></tr><tr><td>229</td><td>随军家属身份证明</td><td></td></tr><tr><td>230</td><td>中国人民解放军军官转业证书</td><td></td></tr><tr><td>231</td><td>中国人民解放军义务兵退出现役证</td><td></td></tr><tr><td>232</td><td>中国人民解放军士官退出现役证</td><td></td></tr><tr><td>233</td><td>外国人永久居留身份证(外国人永久居留证)</td><td></td></tr><tr><td>234</td><td>就业创业证</td><td></td></tr><tr><td>235</td><td>香港特别行政区护照</td><td></td></tr><tr><td>236</td><td>澳门特别行政区护照</td><td></td></tr><tr><td>237</td><td>中华人民共和国港澳居民居住证</td><td></td></tr><tr><td>238</td><td>中华人民共和国台湾居民居住证</td><td></td></tr><tr><td>239</td><td>《中华人民共和国外国人工作许可证》(A类)</td><td></td></tr><tr><td>240</td><td>《中华人民共和国外国人工作许可证》(B类)</td><td></td></tr><tr><td>241</td><td>《中华人民共和国外国人工作许可证》(C类)</td><td></td></tr><tr><td>291</td><td>医学出生证明</td><td></td></tr><tr><td>299</td><td>其他个人证件</td><td></td></tr></table>

## 6.2. 国籍代码

<table><tr><td>索引</td><td>名称</td><td>代码</td><td>描述</td><td>备注</td></tr><tr><td rowspan="6">1</td><td rowspan="6">经办人国籍代码购买方国籍代码</td><td>156</td><td>中华人民共和国</td><td></td></tr><tr><td>344</td><td>中国香港</td><td></td></tr><tr><td>446</td><td>中国澳门</td><td></td></tr><tr><td>158</td><td>中国台湾</td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td rowspan="3"></td><td rowspan="3"></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table>

## 6.3. 特殊票种（特定要素类型）代码

SBLX：1-税控盘、2-金税盘、3-UKey、4-老税控服务器、6-数电、7-乐企

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>代码</td><td>描述</td><td>SBLX</td><td>备注</td></tr><tr><td rowspan="21">1</td><td rowspan="21">TSPZ</td><td rowspan="21">特殊票种(特定要素类型)</td><td>00</td><td>不是</td><td>1,2,3,4,6,7</td><td></td></tr><tr><td>01</td><td>农产品销售</td><td>1,2,3,4</td><td></td></tr><tr><td>02</td><td>农产品收购</td><td>1,2,3,4,6</td><td></td></tr><tr><td>04</td><td>货物运输服务发票</td><td>6,7</td><td></td></tr><tr><td>06</td><td>不动产经营租赁服务</td><td>6,7</td><td></td></tr><tr><td>08</td><td>成品油销售</td><td>1,2,3,4,6,7</td><td></td></tr><tr><td>09</td><td>旅客运输服务发票</td><td>6,7</td><td></td></tr><tr><td>12</td><td>自产农产品销售发票</td><td>6</td><td></td></tr><tr><td>13</td><td>建筑服务发票</td><td>4,6,7</td><td>建安发票</td></tr><tr><td>14</td><td>不动产销售服务发票</td><td>4,6,7</td><td>房地产销售发票</td></tr><tr><td>15</td><td>二手车</td><td>6</td><td></td></tr><tr><td>16</td><td>矿产品发票</td><td>4</td><td></td></tr><tr><td>20</td><td>机动车</td><td>6,7</td><td>机动车只能开具数电专票</td></tr><tr><td>24</td><td>报废产品收购</td><td>6</td><td></td></tr><tr><td>26</td><td>金银首饰批发</td><td>6,7</td><td></td></tr><tr><td>27</td><td>金银首饰零售</td><td>6,7</td><td></td></tr><tr><td>51</td><td>二手车正常开具</td><td>6</td><td>二手车销售电子统一发票</td></tr><tr><td>52</td><td>二手车反向开具</td><td>6</td><td>二手车销售电子统一发票</td></tr><tr><td>63</td><td>拖拉机和联合收割机服务发票</td><td>6</td><td></td></tr><tr><td>68</td><td>通行费</td><td>7</td><td></td></tr><tr><td>83</td><td>机动车销售电子统一发票</td><td>6,7</td><td></td></tr></table>

## 6.4. ZZSTSGL-增值税特殊管理支持项

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>支持项</td><td>备注</td></tr><tr><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td>简易征收</td><td></td></tr><tr><td>稀土产品</td><td></td></tr><tr><td rowspan="16">1</td><td rowspan="16">ZZSTSGL</td><td rowspan="16">增值税特殊管理</td><td>免税</td><td></td></tr><tr><td>不征税</td><td></td></tr><tr><td>先征后退</td><td></td></tr><tr><td>100%先征后退</td><td></td></tr><tr><td>50%先征后退</td><td></td></tr><tr><td>按3%简易征收</td><td></td></tr><tr><td>按5%简易征收</td><td></td></tr><tr><td>按5%简易征收减按1.5%计征</td><td></td></tr><tr><td>即征即退30%</td><td></td></tr><tr><td>即征即退50%</td><td></td></tr><tr><td>即征即退70%</td><td></td></tr><tr><td>即征即退100%</td><td></td></tr><tr><td>超税负3%即征即退</td><td></td></tr><tr><td>超税负8%即征即退</td><td></td></tr><tr><td>超税负12%即征即退</td><td></td></tr><tr><td>超税负6%即征即退</td><td></td></tr></table>

## 6.5. 支付渠道代码

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>代码</td><td>描述</td><td>备注</td></tr><tr><td rowspan="14">1</td><td rowspan="14">ZFQDDM</td><td rowspan="14">支付渠道代码</td><td>001</td><td>现金</td><td></td></tr><tr><td>002</td><td>银行转账</td><td></td></tr><tr><td>003</td><td>票据</td><td></td></tr><tr><td>004</td><td>借记卡</td><td></td></tr><tr><td>005</td><td>信用卡</td><td></td></tr><tr><td>006</td><td>购物卡/券</td><td></td></tr><tr><td>007</td><td>优惠券</td><td></td></tr><tr><td>008</td><td>商场积分</td><td></td></tr><tr><td>009</td><td>支付宝</td><td></td></tr><tr><td>010</td><td>微信支付</td><td></td></tr><tr><td>011</td><td>云闪付</td><td></td></tr><tr><td>012</td><td>Apple Pay</td><td></td></tr><tr><td>013</td><td>Samsung Pay</td><td></td></tr><tr><td>099</td><td>其他</td><td></td></tr></table>

## 6.6. 煤炭种类代码

<table><tr><td>索引</td><td>ID</td><td>名称</td><td>代码</td><td>描述</td><td>备注</td></tr><tr><td rowspan="6">1</td><td rowspan="6">MTZLDM</td><td rowspan="6">煤炭种类代码</td><td>0100</td><td>政府保供煤</td><td></td></tr><tr><td>0201</td><td>长协煤</td><td>协议期不足半年</td></tr><tr><td>0202</td><td>长协煤</td><td>协议期在半年至一年之间</td></tr><tr><td>0203</td><td>长协煤</td><td>协议期在一年至两年之间</td></tr><tr><td>0204</td><td>长协煤</td><td>协议期在两年以上</td></tr><tr><td>0300</td><td>市场煤</td><td></td></tr></table>
