/**
 * MOODMON 情绪潮玩 IP 设计 — 前期调研问卷 v2
 * 研究对象：21—25岁、初入职场的青年（独居/合租/与家人同住/公司宿舍均可）
 * 共 29 题：筛选题 5、情绪体验 6、情绪表达 4、潮玩态度 4、角色偏好 8、开放题 2。
 */

const AGREEMENT5 = [
  { v: 'a', t: '非常不同意', score: 1 },
  { v: 'b', t: '比较不同意', score: 2 },
  { v: 'c', t: '一般', score: 3 },
  { v: 'd', t: '比较同意', score: 4 },
  { v: 'e', t: '非常同意', score: 5 },
];

const FREQ = [
  { v: 'a', t: '从不', score: 1 },
  { v: 'b', t: '偶尔', score: 2 },
  { v: 'c', t: '有时', score: 3 },
  { v: 'd', t: '经常', score: 4 },
  { v: 'e', t: '几乎每天', score: 5 },
];

const IMPACT5 = [
  { v: 'a', t: '几乎不影响', score: 1 },
  { v: 'b', t: '影响较小', score: 2 },
  { v: 'c', t: '一般', score: 3 },
  { v: 'd', t: '影响较大', score: 4 },
  { v: 'e', t: '影响很大', score: 5 },
];

const NEED5 = [
  { v: 'a', t: '完全不需要', score: 1 },
  { v: 'b', t: '不太需要', score: 2 },
  { v: 'c', t: '一般', score: 3 },
  { v: 'd', t: '比较需要', score: 4 },
  { v: 'e', t: '非常需要', score: 5 },
];

const EMOTIONS = [
  { v: 'a', t: '快乐' }, { v: 'b', t: '悲伤' }, { v: 'c', t: '愤怒' },
  { v: 'd', t: '焦虑' }, { v: 'e', t: '好奇' }, { v: 'f', t: '孤独' }, { v: 'g', t: '平静' },
];

export const QUESTIONS = {
  /* ---------- 筛选题 ---------- */
  s_age: {
    type: 'single', short: '年龄', required: true,
    title: '你的年龄是？',
    options: [
      { v: 'a', t: '18岁以下' }, { v: 'b', t: '18—20岁' },
      { v: 'c', t: '21—25岁' }, { v: 'd', t: '26—30岁' }, { v: 'e', t: '31岁以上' },
    ],
  },
  s_grad: {
    type: 'single', short: '毕业状态', required: true,
    title: '你是否已经毕业（含应届）？',
    options: [{ v: 'a', t: '已毕业 / 应届' }, { v: 'b', t: '仍在读' }, { v: 'c', t: '其他' }],
  },
  s_work: {
    type: 'single', short: '工作年限', required: true,
    title: '你累计全职工作（含实习 / 试用期）多久了？',
    options: [
      { v: 'a', t: '3个月内' }, { v: 'b', t: '3—12个月' },
      { v: 'c', t: '1—3年' }, { v: 'd', t: '3年以上' },
      { v: 'e', t: '暂未工作 / 待业' },
    ],
  },
  s_duration: {
    type: 'single', short: '居住时长', required: true,
    title: '你在现在住的地方住了多久？',
    options: [
      { v: 'a', t: '3个月内' }, { v: 'b', t: '3—6个月' },
      { v: 'c', t: '6—12个月' }, { v: 'd', t: '1年以上' },
    ],
  },
  s_live: {
    type: 'single', short: '居住情况', required: true,
    title: '你目前的居住情况是？',
    options: [
      { v: 'a', t: '独居（自己住）' }, { v: 'b', t: '与人合租' },
      { v: 'c', t: '与父母 / 家人同住' }, { v: 'd', t: '公司宿舍 / 公司安排住宿' },
      { v: 'e', t: '其他' },
    ],
  },

  /* ---------- 情绪体验 ---------- */
  f1: {
    type: 'frequency', short: '孤独频率', required: true,
    title: '最近一个月，你感到孤独、缺少陪伴的频率是？', options: FREQ,
  },
  f2: {
    type: 'frequency', short: '焦虑频率', required: true,
    title: '最近一个月，你感到焦虑、紧绷的频率是？', options: FREQ,
  },
  f3: {
    type: 'frequency', short: '平静频率', required: true,
    title: '最近一个月，你感到平静、放松的频率是？', options: FREQ,
  },
  emo_multi: {
    type: 'multi', short: '最常出现的情绪', required: true, maxSelect: 3,
    title: '最近一个月，你最常感到哪些情绪？',
    options: EMOTIONS,
  },
  emo_impact: {
    type: 'likert', short: '情绪影响决定', required: true,
    title: '情绪会在多大程度上影响你的日常小决定（吃什么、买什么、联系谁）？',
    options: IMPACT5,
  },
  emo_accept: {
    type: 'likert', short: '负面情绪需要表达', required: true,
    title: '你认为焦虑、孤独、愤怒这类负面情绪需要被表达出来吗？',
    options: NEED5,
  },

  /* ---------- 情绪表达与调节 ---------- */
  expr_who: {
    type: 'single', short: '情绪倾诉对象', required: true,
    title: '情绪不好时，你通常更倾向于？',
    options: [
      { v: 'a', t: '自己消化' }, { v: 'b', t: '找亲近的人说' },
      { v: 'c', t: '发社交媒体或写下来' }, { v: 'd', t: '用活动转移注意力' }, { v: 'e', t: '其他' },
    ],
  },
  expr_way: {
    type: 'multi', short: '情绪表达方式', required: true, maxSelect: 3,
    title: '你通常用哪些方式表达或缓解情绪？',
    options: [
      { v: 'a', t: '听音乐 / 看剧 / 游戏' }, { v: 'b', t: '运动 / 散步' },
      { v: 'c', t: '写日记或文字' }, { v: 'd', t: '画画 / 做手工' },
      { v: 'e', t: '买东西' }, { v: 'f', t: '找人聊天' },
      { v: 'g', t: '一个人待着' }, { v: 'h', t: '其他' },
    ],
  },
  expr_self: {
    type: 'likert', short: '让身边人知道情绪', required: true,
    title: '我愿意让身边的人知道我的真实情绪', options: AGREEMENT5,
  },
  expr_hide: {
    type: 'likert', short: '习惯藏起负面情绪', required: true,
    title: '我习惯把负面情绪藏起来，不让人看出', options: AGREEMENT5,
  },

  /* ---------- 潮玩态度 ---------- */
  toy_exp: {
    type: 'single', short: '潮玩接触', required: true,
    title: '你是否有潮玩 / 摆件 / 盲盒类小物件的购买或关注经历？',
    options: [
      { v: 'a', t: '买过' }, { v: 'b', t: '没买过但关注过' },
      { v: 'c', t: '没关注过' }, { v: 'd', t: '说不清' },
    ],
  },
  toy_motive: {
    type: 'multi', short: '潮玩购买动机', required: true, maxSelect: 3,
    title: '你购买或想购买潮玩的主要原因是？',
    options: [
      { v: 'a', t: '造型好看' }, { v: 'b', t: '情绪治愈与陪伴' },
      { v: 'c', t: '收藏' }, { v: 'd', t: '送礼' },
      { v: 'e', t: '社交分享' }, { v: 'f', t: 'IP故事与世界观' },
      { v: 'g', t: '盲盒惊喜' }, { v: 'h', t: '其他' },
    ],
  },
  toy_price: {
    type: 'single', short: '可接受价格', required: true,
    title: '你能接受的单个潮玩 / 摆件价格区间是？',
    options: [
      { v: 'a', t: '39元以下' }, { v: 'b', t: '39—69元' },
      { v: 'c', t: '69—129元' }, { v: 'd', t: '129—299元' },
      { v: 'e', t: '299元以上' }, { v: 'f', t: '不购买' },
    ],
  },
  toy_gap: {
    type: 'multi', short: '潮玩改进方向', required: true, maxSelect: 3,
    title: '你觉得现有情绪类潮玩最需要改进的是？',
    options: [
      { v: 'a', t: '情绪表达不够准确' }, { v: 'b', t: '风格太单一（只有可爱治愈）' },
      { v: 'c', t: '缺乏故事与世界观' }, { v: 'd', t: '价格偏高' },
      { v: 'e', t: '尺寸不合适' }, { v: 'f', t: '材质做工' },
      { v: 'g', t: '不知道去哪买' }, { v: 'h', t: '其他' },
    ],
  },

  /* ---------- 角色设计偏好 ---------- */
  role_need: {
    type: 'multi', short: '希望角色表达的情绪', required: true, maxSelect: 3,
    title: '如果有一组情绪角色，你最希望它们表达哪些情绪？',
    options: EMOTIONS,
  },
  role_animal: {
    type: 'single', short: '动物原型', required: true,
    title: '你更喜欢什么动物原型？',
    options: [
      { v: 'a', t: '猫' }, { v: 'b', t: '狗' }, { v: 'c', t: '熊' },
      { v: 'd', t: '兔' }, { v: 'e', t: '鸟类' }, { v: 'f', t: '幻想生物' },
      { v: 'g', t: '无所谓' }, { v: 'h', t: '其他' },
    ],
  },
  role_color: {
    type: 'single', short: '色彩倾向', required: true,
    title: '你更喜欢什么色彩倾向？',
    options: [
      { v: 'a', t: '低饱和柔和' }, { v: 'b', t: '明快高饱和' },
      { v: 'c', t: '黑白灰' }, { v: 'd', t: '冷暖对比' },
      { v: 'e', t: '自然大地色' }, { v: 'f', t: '无所谓' },
    ],
  },
  role_shape: {
    type: 'multi', short: '识别情绪的特征', required: true, maxSelect: 3,
    title: '哪些特征最能让你一眼识别角色的情绪？',
    options: [
      { v: 'a', t: '表情' }, { v: 'b', t: '姿态' }, { v: 'c', t: '颜色' },
      { v: 'd', t: '轮廓形状' }, { v: 'e', t: '材质' }, { v: 'f', t: '配饰或道具' },
      { v: 'g', t: '故事文字' },
    ],
  },
  role_story: {
    type: 'single', short: '故事风格', required: true,
    title: '你更喜欢哪种角色故事风格？',
    options: [
      { v: 'a', t: '轻松幽默' }, { v: 'b', t: '真实克制' },
      { v: 'c', t: '温暖治愈' }, { v: 'd', t: '奇幻冒险' }, { v: 'e', t: '不需要故事' },
    ],
  },
  role_size: {
    type: 'single', short: '角色尺寸', required: true,
    title: '你更喜欢的角色尺寸是？',
    options: [
      { v: 'a', t: '5—8cm 桌面小摆件' }, { v: 'b', t: '10—15cm 可把玩' },
      { v: 'c', t: '20cm 以上收藏' }, { v: 'd', t: '无所谓' },
    ],
  },
  role_buy: {
    type: 'likert', short: '角色购买意愿', required: true,
    title: '如果角色情绪表达准确、造型也喜欢，我愿意购买', options: AGREEMENT5,
  },
  attn: {
    type: 'single', short: '注意力检测', required: true,
    title: '注意力检测：本题请选择“比较同意”',
    options: AGREEMENT5,
  },

  /* ---------- 开放题 ---------- */
  o1: {
    type: 'open', short: '情绪场景', required: false, maxLength: 300,
    title: '最近一次让你印象较深的情绪场景，是怎样的？',
    hint: '可以写当时的时间、地点、发生了什么（选填）',
  },
  o2: {
    type: 'open', short: '对角色形象的期待', required: false, maxLength: 300,
    title: '如果 MONLINGS 情绪角色来到你身边，你希望它是什么动物、什么风格或颜色？',
    hint: '例如：圆润的小熊、雾蓝色、看起来有点困（选填）',
  },
};

export const SECTIONS = [
  { id: 'intro', type: 'intro' },
  {
    id: 'screen', title: '先认识一下你', desc: '以下信息仅用于描述样本构成，全部匿名统计',
    qids: ['s_age', 's_grad', 's_work', 's_duration', 's_live'],
  },
  {
    id: 'emotion', title: '情绪体验', desc: '回想最近一个月的感受，没有对错之分',
    qids: ['f1', 'f2', 'f3', 'emo_multi', 'emo_impact', 'emo_accept'],
  },
  {
    id: 'express', title: '情绪表达与调节', desc: '你通常怎样表达或消化情绪',
    qids: ['expr_who', 'expr_way', 'expr_self', 'expr_hide'],
  },
  {
    id: 'toy', title: '潮玩态度', desc: '关于潮玩、摆件和盲盒的接触与偏好',
    qids: ['toy_exp', 'toy_motive', 'toy_price', 'toy_gap'],
  },
  {
    id: 'role', title: '角色设计偏好', desc: '如果要做一组情绪角色，你更喜欢哪种',
    qids: ['role_need', 'role_animal', 'role_color', 'role_shape', 'role_story', 'role_size', 'role_buy', 'attn'],
  },
  {
    id: 'open', title: '还想听听你的话', desc: '选填，但你的描述会很有帮助',
    qids: ['o1', 'o2'],
  },
];

export const SCREEN_RULES = [
  { id: 's_age', pass: ['c'], reason: '年龄不在21—25岁' },
  { id: 's_grad', pass: ['a'], reason: '尚未毕业' },
  { id: 's_work', pass: ['a', 'b', 'c'], reason: '全职工作已超过3年或暂未工作' },
];

export const CONSENT = {
  brand: 'MOODMON',
  title: '情绪与潮玩偏好调研',
  subtitle: 'MOODMON 情绪潮玩IP设计 · 前期用户调研',
  intro:
    '你好，感谢参与本次匿名调研。本调研关注初入职场青年的情绪体验与潮玩偏好——无论你现在是独居、合租、与家人同住，还是住公司宿舍，只要你最近感到过孤独、疲惫或情绪需要被表达，都欢迎填写。所有回答仅用于汇总分析。',
  points: [
    { icon: '匿名', text: '匿名填写，不收集姓名、手机号等身份信息' },
    { icon: '约2分钟', text: '共 29 题，大约需要 2—3 分钟' },
    { icon: '无门槛', text: '不设硬性门槛，条件不符也可提交，会作为参考样本' },
  ],
  privacy:
    '数据仅用于毕业设计研究，以汇总形式呈现，不会公开单份问卷内容；引用开放题时会去除可识别信息。点击“开始填写”即表示你已了解上述说明并同意参与。',
};

function publicQuestion(id) {
  const q = QUESTIONS[id];
  if (!q) return null;
  return {
    id, type: q.type, short: q.short, title: q.title, hint: q.hint || '',
    required: !!q.required, maxLength: q.maxLength || 0,
    maxSelect: q.maxSelect || 0,
    options: q.options ? q.options.map(o => ({ v: o.v, t: o.t, other: !!o.other, score: o.score || 0 })) : [],
  };
}

function publicMeta() {
  return {
    consent: CONSENT,
    sections: SECTIONS.filter(s => s.type !== 'intro').map((s, i) => ({
      id: s.id, index: i + 1, title: s.title, desc: s.desc || '',
      questions: s.qids.map(publicQuestion),
    })),
    screenRules: SCREEN_RULES,
    totalSteps: SECTIONS.filter(s => s.type !== 'intro').length,
  };
}

export { publicMeta };
