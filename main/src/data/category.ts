const category = [
  {
    key: 0,
    name: "饮食",
    questions: [
      {
        content: "我(ngo5)唔(m4)食(sik6)辣(laat6)嘢(ye5)",
        originalText: "我不吃辣的东西",
        yueText: "我唔食辣嘢",
        audioUrl: "/audio/yue1.m4a",
      },
      {
        content: "我(ngo5)中(zung1)意(ji3)食(sik6)嘢(je5)",
        originalText: "我喜欢吃东西",
        yueText: "我中意食嘢",
        audioUrl: "/audio/yue2.m4a",
      },
    ],
  },
  {
    key: 1,
    name: "问路",
    questions: [
      {
        content: "依(ji1)个(go3)地(zi2)址(dim2)点(haang4)",
        originalText: "这个地址怎么走？",
        yueText: "依个地址点行",
        audioUrl: "/audio/yue15.m4a",
      },
    ],
  },
  {
    key: 2,
    name: "景点",
    questions: [
      {
        content:
          "广(gwon2)州(zau1)灯(dang1)光(gwong1)秀(sau3)型(jing4)到(dou3)爆(baau3)",
        originalText: "广州灯光秀很酷炫",
        yueText: "广州灯光秀型到爆",
        audioUrl: "/audio/yue21.m4a",
      },
    ],
  },
  {
    key: 3,
    name: "住宿",
    questions: [
      {
        content: "寻(cam4)日(jat6)预(jyu6)约(joek3)咗(zo2)",
        originalText: "昨天预约了",
        yueText: "寻日预约咗",
        audioUrl: "/audio/yue27.m4a",
      },
    ],
  },
  {
    key: 4,
    name: "交通",
    questions: [
      {
        content:
          "去(heoi3)广(gwong2)州(zau1)塔(taap3)大(daai6)概(koi3)要(jiu3)几(gei2)耐(noi6)啊(aa)",
        originalText: "去广州塔大概要多久啊？",
        yueText: "去广州塔大概要几耐啊",
        audioUrl: "/audio/yue30.m4a",
      },
    ],
  },
  {
    key: 5,
    name: "询问",
    questions: [
      {
        content: "点(im2)解(gaai2)嘅(ge2)",
        originalText: "为什么呢？",
        yueText: "点解嘅",
        audioUrl: "/audio/yue35.m4a",
      },
    ],
  },
  {
    key: 6,
    name: "回答",
    questions: [
      {
        content: "冇(u5)问(man6)题(tai4)",
        originalText: "没问题",
        yueText: "冇问题",
        audioUrl: "/audio/yue42.m4a",
      },
    ],
  },
];
export type Category = (typeof category)[number];
export default category;
