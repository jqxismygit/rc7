// 假数据模块

// 用户信息
export const mockUser = {
  id: '10001',
  openId: 'mock_openid_12345',
  phone: '138****8888',
  nickname: 'CR7粉丝',
  avatar: 'https://via.placeholder.com/100',
  email: 'user@example.com',
  isEmployee: false // 是否为员工
}

// 员工用户
export const mockEmployee = {
  ...mockUser,
  id: '20001',
  phone: '139****9999',
  nickname: '工作人员',
  isEmployee: true
}

// 首页信息流卡片
export const mockHomeCards = [
  {
    id: 1,
    type: 'event', // event-展会赛事, activity-线下活动, video-视频, article-图文
    title: 'C罗见面会 - 上海站',
    cover: 'https://via.placeholder.com/750x400',
    date: '2026-03-15',
    location: '上海梅赛德斯奔驰文化中心',
    description: '与传奇球星C罗面对面交流的难得机会',
    tags: ['热门', '限量'],
    price: 599
  },
  {
    id: 2,
    type: 'video',
    title: 'C罗精彩进球集锦',
    cover: 'https://via.placeholder.com/750x400',
    duration: '05:32',
    views: 128000,
    videoUrl: ''
  },
  {
    id: 3,
    type: 'activity',
    title: '球迷线下见面会',
    cover: 'https://via.placeholder.com/750x400',
    date: '2026-03-20',
    location: '北京工人体育场',
    countdown: 864000, // 倒计时秒数
    status: 'upcoming' // upcoming-即将开始, ongoing-进行中, ended-已结束
  },
  {
    id: 4,
    type: 'article',
    title: '世界杯赛程表 | 小组赛阶段',
    cover: 'https://via.placeholder.com/750x400',
    publishTime: '2026-02-10 10:00',
    readCount: 5600
  }
]

// 赛事信息
export const mockMatches = [
  {
    id: 1,
    homeTeam: '葡萄牙',
    awayTeam: '西班牙',
    homeScore: 3,
    awayScore: 3,
    date: '2026-02-15 20:00',
    status: 'finished', // upcoming, live, finished
    venue: '卢赛尔体育场'
  },
  {
    id: 2,
    homeTeam: '葡萄牙',
    awayTeam: '摩洛哥',
    homeScore: null,
    awayScore: null,
    date: '2026-03-01 22:00',
    status: 'upcoming',
    venue: '教育城体育场'
  }
]

// 积分榜
export const mockStandings = [
  { rank: 1, team: '葡萄牙', played: 3, won: 2, drawn: 1, lost: 0, points: 7 },
  { rank: 2, team: '西班牙', played: 3, won: 2, drawn: 0, lost: 1, points: 6 },
  { rank: 3, team: '摩洛哥', played: 3, won: 1, drawn: 0, lost: 2, points: 3 }
]

// C罗行程
export const mockSchedule = [
  {
    id: 1,
    date: '2026-03-15',
    time: '14:00',
    event: '上海球迷见面会',
    location: '上海梅赛德斯奔驰文化中心',
    status: 'confirmed'
  },
  {
    id: 2,
    date: '2026-03-20',
    time: '19:00',
    event: '北京慈善晚宴',
    location: '北京国家会议中心',
    status: 'confirmed'
  }
]

// C罗职业生涯
export const mockCareer = [
  {
    year: 2003,
    event: '加盟曼联',
    description: '从里斯本竞技转会至曼联，开启传奇生涯',
    image: 'https://via.placeholder.com/200x150'
  },
  {
    year: 2008,
    event: '首次金球奖',
    description: '获得个人首座金球奖',
    image: 'https://via.placeholder.com/200x150'
  },
  {
    year: 2016,
    event: '欧洲杯冠军',
    description: '率领葡萄牙夺得欧洲杯冠军',
    image: 'https://via.placeholder.com/200x150'
  }
]

// 联名品牌
export const mockBrands = [
  {
    id: 1,
    name: 'Nike',
    logo: 'https://via.placeholder.com/150',
    description: 'C罗与Nike的长期合作伙伴关系',
    products: ['CR7足球鞋', '训练装备'],
    miniAppId: '' // 小程序appId
  },
  {
    id: 2,
    name: 'Herbalife',
    logo: 'https://via.placeholder.com/150',
    description: '营养补充品牌合作',
    products: ['蛋白粉', '能量饮料'],
    miniAppId: ''
  }
]

// 票种信息
export const mockTicketTypes = [
  {
    id: 1,
    name: '早鸟票',
    price: 399,
    originalPrice: 599,
    description: '限时优惠，不可退票',
    stock: 50,
    canRefund: false,
    tag: '限量'
  },
  {
    id: 2,
    name: '单人票',
    price: 599,
    originalPrice: 599,
    description: '标准入场票',
    stock: 200,
    canRefund: true,
    tag: ''
  },
  {
    id: 3,
    name: '双人套票',
    price: 999,
    originalPrice: 1198,
    description: '两人同行更优惠',
    stock: 100,
    canRefund: true,
    tag: '推荐'
  }
]

// 用户已购票券
export const mockMyTickets = [
  {
    id: 'T20260215001',
    eventId: 1,
    eventName: 'C罗见面会 - 上海站',
    eventDate: '2026-03-15 14:00',
    ticketType: '单人票',
    quantity: 1,
    price: 599,
    status: 'unused', // unused-未使用, used-已使用, refunded-已退票
    qrCode: 'https://via.placeholder.com/300',
    purchaseTime: '2026-02-10 15:30',
    canRefund: true
  },
  {
    id: 'T20260215002',
    eventId: 3,
    eventName: '球迷线下见面会',
    eventDate: '2026-03-20 19:00',
    ticketType: '双人套票',
    quantity: 2,
    price: 999,
    status: 'unused',
    qrCode: 'https://via.placeholder.com/300',
    purchaseTime: '2026-02-11 10:20',
    canRefund: true
  }
]

// 消息列表
export const mockMessages = [
  {
    id: 1,
    type: 'ticket', // ticket-购票, system-系统, activity-活动
    title: '购票成功',
    content: '您已成功购买"C罗见面会-上海站"门票',
    time: '2026-02-10 15:30',
    isRead: false
  },
  {
    id: 2,
    type: 'activity',
    title: '活动提醒',
    content: '您预约的活动将在3天后开始，请提前做好准备',
    time: '2026-02-12 09:00',
    isRead: true
  },
  {
    id: 3,
    type: 'system',
    title: '系统通知',
    content: '小程序已更新至最新版本',
    time: '2026-02-11 18:00',
    isRead: true
  }
]

// 投票选项
export const mockVoteOptions = [
  {
    matchId: 2,
    homeTeam: '葡萄牙',
    awayTeam: '摩洛哥',
    homeVotes: 15680,
    awayVotes: 8920,
    drawVotes: 3200,
    userVote: null // null-未投票, 'home'-主队, 'away'-客队, 'draw'-平局
  }
]

// 游戏排行榜
export const mockGameRanking = [
  { rank: 1, nickname: 'CR7真爱粉', score: 9850, avatar: 'https://via.placeholder.com/50' },
  { rank: 2, nickname: '足球小子', score: 9720, avatar: 'https://via.placeholder.com/50' },
  { rank: 3, nickname: '葡萄牙加油', score: 9650, avatar: 'https://via.placeholder.com/50' },
  { rank: 10, nickname: 'CR7粉丝', score: 8900, avatar: 'https://via.placeholder.com/50', isMe: true }
]
