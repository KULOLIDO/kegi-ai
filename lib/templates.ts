export type CorgiTemplate = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  cover_url: string | null;
  cost: number;
  size: string;
  accent: string;
  prompt: string;
  is_active: boolean;
  sort_order: number;
  isCustom?: boolean;
};

export const defaultTemplates: CorgiTemplate[] = [
  {
    id: "2d672f5b-cd1d-4a52-90e0-7cb1227119cc",
    name: "治愈插画",
    tagline: "温暖治愈风格",
    description: "温暖治愈风格",
    cover_url: "/template-covers/healing-cover.png",
    cost: 30,
    size: "1024x1024",
    accent: "from-corgi to-cream",
    prompt:
      "将照片转换成温暖、柔和、治愈系插画风格，保留人物和宠物特征，画面干净友好，色彩柔和。",
    is_active: true,
    sort_order: 10
  },
  {
    id: "8b2c63cc-e51b-4cc5-a479-ecff6a81c5b8",
    name: "Color Walk冰箱贴",
    tagline: "立体冰箱贴风格",
    description: "立体冰箱贴风格",
    cover_url: "/template-covers/color-walk.png",
    cost: 25,
    size: "1024x1024",
    accent: "from-skysoft to-corgi",
    prompt:
      "将图片主体转换为Color Walk风格立体冰箱贴，Q版可爱，柔和光影，立体质感，干净背景。",
    is_active: true,
    sort_order: 20
  },
  {
    id: "90cfc826-8959-46bd-afe7-b42c2fb69aa5",
    name: "手绘Plog",
    tagline: "生活记录插画",
    description: "生活记录插画",
    cover_url: "/template-covers/plog.png",
    cost: 35,
    size: "1024x1024",
    accent: "from-biscuit to-skysoft",
    prompt:
      "将照片转换成温暖治愈的手绘Plog风格插画，柔和色调，生活感，适合小红书分享。",
    is_active: true,
    sort_order: 30
  },
  {
    id: "9df618c4-3977-4967-90e1-c2587ef10f37",
    name: "丑萌涂鸦插画",
    tagline: "爆款手绘风",
    description: "爆款手绘风",
    cover_url: "/template-covers/doodle.png",
    cost: 35,
    size: "1024x1024",
    accent: "from-cream to-skysoft",
    prompt:
      "将照片转换成丑萌涂鸦插画风格，保留人物主体特征，白色背景，线条随意，童趣可爱，适合头像和社交媒体分享。",
    is_active: true,
    sort_order: 40
  },
  {
    id: "c7b28892-74de-49e5-bf31-bd1398c552f8",
    name: "City Pop插画",
    tagline: "日系复古插画",
    description: "日系复古插画",
    cover_url: "/template-covers/city-pop.png",
    cost: 25,
    size: "1024x1024",
    accent: "from-skysoft to-cream",
    prompt:
      "将照片转换为日系City Pop插画风格，鲜艳色彩，复古都市氛围，霓虹灯元素。",
    is_active: true,
    sort_order: 50
  },
  {
    id: "e405d0c7-091d-4516-b821-7567c84029cc",
    name: "波普风格插画",
    tagline: "个性头像",
    description: "个性头像",
    cover_url: "/template-covers/pop-art.png",
    cost: 35,
    size: "1024x1024",
    accent: "from-corgi to-skysoft",
    prompt:
      "将照片转换成波普艺术风格插画，鲜艳配色，大胆图形设计，适合个性头像。",
    is_active: true,
    sort_order: 60
  },
  {
    id: "custom-image",
    name: "自定义生成",
    tagline: "输入自己的风格需求",
    description: "输入自己的风格需求",
    cover_url: "/template-covers/custom.png",
    cost: 30,
    size: "1024x1024",
    accent: "from-ink to-skysoft",
    isCustom: true,
    prompt:
      "根据用户自定义要求生成图片，保留参考图主体的关键特征，画面健康、日常、友好。",
    is_active: true,
    sort_order: 70
  }
];

export function getDefaultTemplate(templateId: string) {
  return defaultTemplates.find((template) => template.id === templateId);
}
