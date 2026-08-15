/**
 * 实用网站数据源。
 * 后续增删网站或分类只需修改本文件，页面结构与渲染逻辑无需调整。
 */
const WMU_USEFUL_SITES = [
  {
    id: "campus",
    title: "全校通用",
    description: "校园服务、教务办公与学校门户",
    icon: "campus",
    tone: "blue",
    sites: [
      { name: "温州医科大学 WebVPN", url: "https://webvpn.wmu.edu.cn/", description: "校外访问校内资源" },
      { name: "教务综合信息服务平台", url: "https://jwxt.wmu.edu.cn/", description: "选课、成绩与培养信息" },
      { name: "中国科学技术大学网络测速", url: "https://test.ustc.edu.cn/", description: "网络连接与带宽测试" },
      { name: "温州医科大学网上办事大厅", url: "https://ehall.wmu.edu.cn/", description: "校内事项在线办理" },
      { name: "温州医科大学信息技术中心", url: "https://itc.wmu.edu.cn/", description: "校园网络与信息服务" },
      { name: "温州医科大学主页", url: "https://www.wmu.edu.cn/", description: "学校门户与新闻资讯" },
      { name: "研究生院主页", url: "https://yjsy.wmu.edu.cn/", description: "研究生培养与管理" },
      { name: "仁济学院主页", url: "https://rjxy.wmu.edu.cn/", description: "仁济学院门户" },
      { name: "继续教育学院主页", url: "https://jjxy.wmu.edu.cn/", description: "继续教育信息服务" },
      { name: "国际教育学院主页", url: "https://sis.wmu.edu.cn/", description: "国际学生教育与服务" },
      { name: "温州医科大学校内邮箱系统", url: "https://mail.wmu.edu.cn/", description: "学校电子邮箱" },
      { name: "国际交流合作处", url: "https://global.wmu.edu.cn/", description: "国际交流项目与事务" },
      { name: "国资处", url: "https://gzc.wmu.edu.cn/", description: "国有资产管理服务" }
    ]
  },
  {
    id: "colleges",
    title: "各二级学院",
    description: "学院、附属医院与专业教学单位",
    icon: "college",
    tone: "green",
    sites: [
      { name: "口腔医学院（口腔附院）", url: "https://www.dentist.ac.cn/", description: "口腔医学院与附属口腔医院" },
      { name: "眼视光生工院（眼视光附院）", url: "https://www.wzeye.cn/", description: "眼视光学院与附属眼视光医院" },
      { name: "第二临床（附二院｜育英）", url: "https://www.wzhealth.com/", description: "第二临床医学院与附属第二医院" },
      { name: "临一信工", url: "https://ygb.wzhospital.cn:10443/", description: "第一临床医学院（信息与工程学院）" },
      { name: "文管学院", url: "https://yxrwgl.wmu.edu.cn/", description: "医学人文与管理学院" },
      { name: "中医药学院", url: "https://zhyyxy.wmu.edu.cn/", description: "中医药学院门户" },
      { name: "药学院", url: "https://yxy.wmu.edu.cn/", description: "药学院门户" },
      { name: "康复医学院", url: "https://kfyxy.wmu.edu.cn/", description: "康复医学院门户" },
      { name: "阿尔伯塔学院", url: "https://ai.wmu.edu.cn/", description: "阿尔伯塔学院门户" },
      { name: "精神医学学院", url: "https://jsyx.wmu.edu.cn/", description: "精神医学学院门户" },
      { name: "基础医学院", url: "https://jcyxy.wmu.edu.cn/", description: "基础医学院门户" },
      { name: "检生学院", url: "https://jsxy.wmu.edu.cn/", description: "检验医学院（生命科学学院）" },
      { name: "公卫学院", url: "https://sph.wmu.edu.cn/", description: "公共卫生与管理学院" },
      { name: "护理学院", url: "https://hlxy.wmu.edu.cn/", description: "护理学院门户" }
    ]
  },
  {
    id: "teaching",
    title: "教学学院",
    description: "公共课程与创新创业教学平台",
    icon: "book",
    tone: "gold",
    sites: [
      { name: "马克思主义学院", url: "https://skb.wmu.edu.cn/", description: "思想政治理论课教学" },
      { name: "体育科学部", url: "https://tky.wmu.edu.cn/", description: "体育课程与校园体育" },
      { name: "外国语学院", url: "https://wgy.wmu.edu.cn/", description: "外语课程与语言教学" },
      { name: "创新创业教育学院", url: "https://cxcy.wmu.edu.cn/", description: "创新创业教育与实践" }
    ]
  },
  {
    id: "learning",
    title: "常用网站",
    description: "在线课程与实践教学平台",
    icon: "globe",
    tone: "red",
    sites: [
      { name: "超星学习通", url: "https://passport2.chaoxing.com/login?fid=12&refer=http%3A%2F%2Fi.chaoxing.com%2Fbase%3Ft%3D1758955616847&space=2", description: "课程学习与教学互动" },
      { name: "智慧树", url: "https://www.zhihuishu.com/", description: "在线课程学习平台" },
      { name: "浙江省高校在线开放平台", url: "https://www.zjooc.cn/", description: "省级高校开放课程" },
      { name: "数字马院实践平台", url: "https://wmu.ulearning.cn/sjjx2/", description: "思政课实践教学" }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = WMU_USEFUL_SITES;
}

if (typeof window !== "undefined") {
  window.WMU_USEFUL_SITES = WMU_USEFUL_SITES;
}
