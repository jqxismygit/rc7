// 假数据模块

// 用户信息
export const mockUser = {
  id: "10001",
  openId: "mock_openid_12345",
  phone: "138****8888",
  nickname: "CR7粉丝",
  avatar: "/static/images/avatar-default.png",
  email: "user@example.com",
  isEmployee: false, // 是否为员工
};

// 员工用户
export const mockEmployee = {
  ...mockUser,
  id: "20001",
  phone: "139****9999",
  nickname: "工作人员",
  isEmployee: true,
};

// 首页信息流卡片
export const mockHomeCards = [
  {
    id: 1,
    type: "event", // event-展会赛事, activity-线下活动, video-视频, article-图文
    title: "C罗见面会 - 上海站",
    cover: "https://via.placeholder.com/750x400",
    date: "2026-03-15",
    location: "上海梅赛德斯奔驰文化中心",
    description: "与传奇球星C罗面对面交流的难得机会",
    tags: ["热门", "限量"],
    price: 599,
  },
  {
    id: 2,
    type: "video",
    title: "C罗精彩进球集锦",
    cover: "https://via.placeholder.com/750x400",
    duration: "05:32",
    views: 128000,
    videoUrl: "",
  },
  {
    id: 3,
    type: "activity",
    title: "球迷线下见面会",
    cover: "https://via.placeholder.com/750x400",
    date: "2026-03-20",
    location: "北京工人体育场",
    countdown: 864000, // 倒计时秒数
    status: "upcoming", // upcoming-即将开始, ongoing-进行中, ended-已结束
  },
  {
    id: 4,
    type: "article",
    title: "世界杯赛程表 | 小组赛阶段",
    cover: "https://via.placeholder.com/750x400",
    publishTime: "2026-02-10 10:00",
    readCount: 5600,
  },
];

// 赛事信息
export const mockMatches = [
  {
    id: 1,
    homeTeam: "葡萄牙",
    awayTeam: "西班牙",
    homeScore: 3,
    awayScore: 3,
    date: "2026-02-15 20:00",
    status: "finished", // upcoming, live, finished
    venue: "卢赛尔体育场",
  },
  {
    id: 2,
    homeTeam: "葡萄牙",
    awayTeam: "摩洛哥",
    homeScore: null,
    awayScore: null,
    date: "2026-03-01 22:00",
    status: "upcoming",
    venue: "教育城体育场",
  },
];

// 积分榜
export const mockStandings = [
  { rank: 1, team: "葡萄牙", played: 3, won: 2, drawn: 1, lost: 0, points: 7 },
  { rank: 2, team: "西班牙", played: 3, won: 2, drawn: 0, lost: 1, points: 6 },
  { rank: 3, team: "摩洛哥", played: 3, won: 1, drawn: 0, lost: 2, points: 3 },
];

// C罗行程
export const mockSchedule = [
  {
    id: 1,
    date: "2026-03-15",
    time: "14:00",
    event: "上海球迷见面会",
    location: "上海梅赛德斯奔驰文化中心",
    status: "confirmed",
  },
  {
    id: 2,
    date: "2026-03-20",
    time: "19:00",
    event: "北京慈善晚宴",
    location: "北京国家会议中心",
    status: "confirmed",
  },
];

// C罗职业生涯
export const mockCareer = [
  {
    year: 2003,
    event: "加盟曼联",
    description: "从里斯本竞技转会至曼联，开启传奇生涯",
    image: "https://via.placeholder.com/200x150",
  },
  {
    year: 2008,
    event: "首次金球奖",
    description: "获得个人首座金球奖",
    image: "https://via.placeholder.com/200x150",
  },
  {
    year: 2016,
    event: "欧洲杯冠军",
    description: "率领葡萄牙夺得欧洲杯冠军",
    image: "https://via.placeholder.com/200x150",
  },
];

// 联名品牌（logo 使用 static/images 下的 PNG/JPG）
export const mockBrands = [
  {
    id: 1,
    name: "Air.inc",
    logo: "/static/images/brand-air.png",
    description: "官方空间合作品牌",
    products: ["空间设计", "联名场馆"],
    miniAppId: "",
  },
  {
    id: 2,
    name: "vsble",
    logo: "/static/images/brand-vsble.png",
    description: "官方饮品合作品牌",
    products: ["联名饮品", "限定礼盒"],
    miniAppId: "",
  },
  {
    id: 3,
    name: "Parafin",
    logo: "/static/images/brand-parafin.png",
    description: "官方数字合作品牌",
    products: ["数字藏品", "NFT"],
    miniAppId: "",
  },
  {
    id: 4,
    name: "SevenOne",
    logo: "/static/images/brand-sevenone.png",
    description: "官方云服务合作品牌",
    products: ["云服务", "数据平台"],
    miniAppId: "",
  },
];

// 首页 Hero Banner（封面使用 static/images 下的 PNG/JPG）
export const mockHeroBanners = [
  {
    tag: "限时展出",
    title: "CR7® LIFE 中国北京馆",
    subtitle: "亚洲首个 CR7® LIFE 沉浸式博物馆",
    location: "北京市 · 国贸商圈",
    date: "2026.03.16 - 06.01",
    cover: "/static/images/event-card.jpg",
  },
  {
    tag: "全球巡展",
    title: "CR7 世界杯荣耀特展",
    subtitle: "重温世界杯高光瞬间",
    location: "中国上海 · 外滩",
    date: "2026.07 起",
    cover: "/static/images/event-card.jpg",
  },
];

// 首页热门活动 - 购票
export const mockHotTickets = [
  {
    id: 1,
    museum: "C罗博物馆 · 中国上海馆",
    title: "C罗博物馆 · 中国上海馆",
    time: "03/16·10:00-22:00·上海黄浦区外滩1号",
    location: "上海黄浦区外滩1号",
    cover: "/static/images/event-card.jpg",
    price: 99,
    status: "active",
    statusText: "售票中",
    cta: "立即购票",
  },
  {
    id: 2,
    museum: "C罗博物馆 · 中国北京馆",
    title: "家庭套票 · 4 人同游",
    time: "2026-04-01 起 · 10:00-22:00",
    location: "北京市朝阳区 国贸商圈",
    cover: "/static/images/event-card.jpg",
    price: 366,
    status: "countdown",
    statusText: "倒计时 10 天",
    cta: "查看详情",
  },
];

// 首页热门活动 - 线下活动
export const mockHotEvents = [
  {
    id: 3,
    museum: "签名会 · 北京站",
    title: "CR7 见面会 · 限定名额",
    time: "2026-03-20 19:00",
    location: "北京 CR7® LIFE 馆内互动区",
    status: "active",
    statusText: "报名中",
    cta: "立即报名",
  },
  {
    id: 4,
    museum: "线下观赛夜",
    title: "欧冠观赛派对",
    time: "2026-04-10 02:30",
    location: "上海 CR7® LIFE 球迷专区",
    status: "countdown",
    statusText: "倒计时 5 天",
    cta: "预约席位",
  },
];

// 首页热门活动 - 世界杯
export const mockHotWorldcup = [
  {
    id: 5,
    museum: "世界杯特别活动",
    title: "C罗世界杯经典进球重现",
    time: "2026 世界杯期间",
    location: "多城市 CR7® LIFE 馆",
    status: "active",
    statusText: "规划中",
    cta: "敬请期待",
  },
];

// 首页 C罗专区入口
export const mockCr7ZoneEntries = [
  {
    key: "calendar",
    title: "行程日历",
    desc: "跟随 C罗 全球足迹",
    icon: "📅",
    route: "/pages/schedule/schedule",
  },
  {
    key: "highlights",
    title: "视频集锦",
    desc: "高光时刻一键回放",
    icon: "🎥",
    route: "/pages/schedule/schedule",
  },
  {
    key: "career",
    title: "职业生涯",
    desc: "纵览传奇数据年表",
    icon: "📊",
    route: "/pages/schedule/schedule",
  },
];

// 首页马上购票 - 主推活动
export const mockTicketEvent = {
  id: 1,
  title: "C罗博物馆 · 中国上海馆",
  time: "03/16·10:00-22:00·上海黄浦区外滩1号",
  cover: "/static/images/event-card.jpg",
};

// 首页 CR7 News 列表
export const mockCr7News = [
  {
    id: 1,
    type: "video",
    title: "视频集锦",
    desc: "高光时刻一键回放",
    cover: "/static/images/event-card.jpg",
    route: "/pages/schedule/schedule",
  },
  {
    id: 2,
    type: "career",
    title: "职业生涯",
    desc: "纵览传奇数据年表",
    cover: "/static/images/event-card.jpg",
    route: "/pages/schedule/schedule",
  },
  {
    id: 3,
    type: "article",
    title: "C罗再次上演帽子戏法",
    desc: "场面极度震撼",
    cover: "/static/images/event-card.jpg",
  },
];

// 票种信息
export const mockTicketTypes = [
  {
    id: 1,
    name: "早鸟票",
    price: 399,
    originalPrice: 599,
    description: "不可退款，当天可用",
    stock: 50,
    canRefund: false,
    tag: "限量",
  },
  {
    id: 2,
    name: "单人票",
    price: 299,
    originalPrice: 299,
    description: "标准入场票",
    stock: 200,
    canRefund: true,
    tag: "",
  },
  {
    id: 3,
    name: "双人套票",
    price: 499,
    originalPrice: 499,
    description: "两人同行更优惠",
    stock: 100,
    canRefund: true,
    tag: "",
  },
];

// 用户已购票券
export const mockMyTickets = [
  {
    id: "T20260215001",
    eventId: 1,
    eventName: "C罗见面会 - 上海站",
    // eventCover: 'https://via.placeholder.com/750x400',
    eventDate: "2026-03-15 14:00",
    eventLocation: "上海梅赛德斯奔驰文化中心",
    ticketType: "单人票",
    quantity: 1,
    price: 599,
    status: "unused",
    qrCode: "https://via.placeholder.com/300",
    purchaseTime: "2026-02-10 15:30",
    canRefund: true,
    orderNo: "O202602100001",
    paidAmount: 599,
    refundAmount: 599,
  },
  {
    id: "T20260215002",
    eventId: 3,
    eventName: "球迷线下见面会",
    eventCover: "https://via.placeholder.com/750x400",
    eventDate: "2026-03-20 19:00",
    eventLocation: "北京工人体育场",
    ticketType: "双人套票",
    quantity: 2,
    price: 999,
    status: "unused",
    qrCode: "https://via.placeholder.com/300",
    purchaseTime: "2026-02-11 10:20",
    canRefund: true,
    orderNo: "O202602110002",
    paidAmount: 999,
    refundAmount: 999,
  },
];

// 消息列表
export const mockMessages = [
  {
    id: 1,
    type: "ticket", // ticket-购票, system-系统, activity-活动
    title: "购票成功",
    content: '您已成功购买"C罗见面会-上海站"门票',
    time: "2026-02-10 15:30",
    isRead: false,
  },
  {
    id: 2,
    type: "activity",
    title: "活动提醒",
    content: "您预约的活动将在3天后开始，请提前做好准备",
    time: "2026-02-12 09:00",
    isRead: true,
  },
  {
    id: 3,
    type: "system",
    title: "系统通知",
    content: "小程序已更新至最新版本",
    time: "2026-02-11 18:00",
    isRead: true,
  },
];

// 投票选项
export const mockVoteOptions = [
  {
    matchId: 2,
    homeTeam: "葡萄牙",
    awayTeam: "摩洛哥",
    homeVotes: 15680,
    awayVotes: 8920,
    drawVotes: 3200,
    userVote: null, // null-未投票, 'home'-主队, 'away'-客队, 'draw'-平局
  },
];

// 游戏排行榜
export const mockGameRanking = [
  {
    rank: 1,
    nickname: "CR7真爱粉",
    score: 9850,
    avatar: "https://via.placeholder.com/50",
  },
  {
    rank: 2,
    nickname: "足球小子",
    score: 9720,
    avatar: "https://via.placeholder.com/50",
  },
  {
    rank: 3,
    nickname: "葡萄牙加油",
    score: 9650,
    avatar: "https://via.placeholder.com/50",
  },
  {
    rank: 10,
    nickname: "CR7粉丝",
    score: 8900,
    avatar: "https://via.placeholder.com/50",
    isMe: true,
  },
];

// 协议与隐私政策 HTML 内容（模拟 CMS 下发）
export const mockLegalContent = {
  terms: `
    <h1>CR7® LIFE 用户协议</h1>
    <p>为保障您的合法权益，请在使用本小程序前，仔细阅读并充分理解本用户协议的全部内容。</p>
    <p>当您点击「一键登录 / 注册」并完成登录，即视为您已阅读并同意本协议全部条款。</p>
    <h2>一、服务内容</h2>
    <p>本小程序向您提供包括但不限于：展览及活动信息浏览、在线购票、票券管理、线下活动报名、
    互动游戏、联名品牌展示等功能，具体以实际上线功能为准。</p>
    <h2>二、用户行为规范</h2>
    <p>您在使用本小程序过程中应遵守相关法律法规，不得利用本服务从事任何违法违规或侵害他人合法权益的行为。</p>
  `,
  privacy: `
    <h1>CR7® LIFE 隐私政策</h1>
    <p>在您使用本小程序的过程中，我们将依据最小必要原则收集与提供服务相关的个人信息，
    例如微信头像昵称、设备信息、订单信息等，用于身份识别、购票下单、订单查询及安全风控。</p>
    <h2>一、信息使用</h2>
    <p>我们仅会在实现本政策所述目的所必需的范围内使用您的个人信息，包括但不限于完成购票、
    核销、订单售后、活动通知、风险控制与防止欺诈等。</p>
    <h2>二、您的权利</h2>
    <p>您有权访问、更正、删除您的部分个人信息，并可撤回授权同意或注销账号。</p>
  `,
};
