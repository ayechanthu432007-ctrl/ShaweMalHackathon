/** FAQ content and question matching for the Shawe Mal Telegram bot. All user-facing text is Myanmar. */

export type FaqId = 'rental' | 'roommate' | 'moving' | 'marketplace' | 'trust' | 'contact';

export interface FaqEntry {
  id: FaqId;
  question: string;
  answer: string;
  /** Existing website page this FAQ links to (frontend route), when one exists. */
  link?: { label: string; path: string };
  /** Lower-cased phrases that map a free-text question to this FAQ. */
  keywords: string[];
}

export const WELCOME_MESSAGE = [
  'မင်္ဂလာပါ 👋',
  'Shawe Mal မှ ကြိုဆိုပါတယ်။',
  '',
  'အောက်မှာ သိလိုတဲ့အကြောင်းအရာကို ရွေးချယ်ပြီး မေးမြန်းနိုင်ပါတယ်။'
].join('\n');

export const MAIN_MENU_LABEL = '⬅️ ပင်မ Menu သို့';

export const GENERIC_ERROR_MESSAGE = 'တောင်းပန်ပါတယ်။ အခုလောလောဆယ် အဆင်မပြေဖြစ်နေပါတယ်။ ခဏနေမှ ပြန်လည်ကြိုးစားကြည့်ပေးပါ။';

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'rental',
    question: '🏠 အိမ်ငှားတွေကို ဘယ်လိုရှာနိုင်မလဲ?',
    answer: [
      '🏠 အိမ်ရှာဖွေခြင်း',
      '',
      'Shawe Mal ရဲ့ Rental Homes မှာ သင်နေချင်တဲ့ နေရာ (Location) နဲ့ သင့် Budget (Price Range) ကို သတ်မှတ်ပြီး အိမ်တွေကို အလွယ်တကူ ရှာဖွေနိုင်ပါတယ်။',
      '',
      'Listing တစ်ခုချင်းစီမှာ ဓာတ်ပုံ၊ ဈေးနှုန်း၊ တည်နေရာနဲ့ အိမ်အချက်အလက်တွေကို ကြည့်ရှုပြီး သင့်လိုအပ်ချက်နဲ့ ကိုက်ညီတဲ့အိမ်ကို ရွေးချယ်နိုင်ပါတယ်။'
    ].join('\n'),
    link: { label: '🔎 အိမ်တွေရှာရန်', path: '/finding-house' },
    keywords: ['အိမ်ငှား', 'အိမ်ရှာ', 'အိမ်ဘယ်မှာ', 'အိမ်ခန်း', 'တိုက်ခန်း', 'ငှားမယ်', 'ငှားချင်', 'rent', 'rental', 'house', 'home', 'apartment', 'condo']
  },
  {
    id: 'roommate',
    question: '👥 အခန်းဖော်ကို ဘယ်လိုရှာနိုင်မလဲ?',
    answer: [
      '👥 အခန်းဖော်ရှာဖွေခြင်း',
      '',
      'Find Roommates မှာ သင့်နဲ့အတူနေမယ့် အခန်းဖော်တွေရဲ့ Gender၊ Personality နဲ့ နေထိုင်မှုပုံစံဆိုင်ရာ Preferences တွေကို ကြည့်ရှုနိုင်ပါတယ်။',
      '',
      'User တစ်ယောက်ချင်းစီရဲ့ Profile မှာ အချက်အလက်တွေကို ပြသထားတဲ့အတွက် ကိုယ်နဲ့ အဆင်ပြေနိုင်မယ့်သူကို ရွေးချယ်နိုင်ပါတယ်။',
      '',
      'သင့်အတွက် သင့်တော်တဲ့သူတွေ့ပြီဆိုရင် Profile ထဲက Request button ကိုနှိပ်ပြီး အခန်းဖော်အဖြစ် request ပို့နိုင်ပါတယ်။'
    ].join('\n'),
    link: { label: '👥 အခန်းဖော်ရှာရန်', path: '/finding-roommates' },
    keywords: ['အခန်းဖော်', 'အတူနေ', 'roommate', 'room mate', 'flatmate']
  },
  {
    id: 'moving',
    question: '🚚 အိမ်ပြောင်းဝန်ဆောင်မှုကို ဘယ်လိုမှာယူနိုင်မလဲ?',
    answer: [
      '🚚 အိမ်ပြောင်းဝန်ဆောင်မှု မှာယူခြင်း',
      '',
      'Shawe Mal ရဲ့ Moving Services မှာ သင့်လိုအပ်ချက်နဲ့ ကိုက်ညီတဲ့ ယာဉ်အမျိုးအစားကို ရွေးချယ်ပြီး Moving Service ကို booking လုပ်နိုင်ပါတယ်။',
      '',
      'Booking ပြုလုပ်ပြီးနောက် အိမ်ပြောင်းခြင်းရဲ့ လုပ်ငန်းစဉ်အဆင့်ဆင့်ကို အချိန်နဲ့တစ်ပြေးညီ (Real-time) ကြည့်ရှုနိုင်ပါတယ်။',
      '',
      'ဥပမာ — Booking Confirmed → Provider Assigned → On the Way → Moving → Completed'
    ].join('\n'),
    link: { label: '🚚 Moving Service ရှာရန်', path: '/hire-moving' },
    keywords: ['အိမ်ပြောင်း', 'ပြောင်းရွှေ့', 'ကားငှား', 'ယာဉ်', 'moving', 'mover', 'truck', 'relocat']
  },
  {
    id: 'marketplace',
    question: '🛍️ Relocation Marketplace မှာ ဘာတွေ ဝယ်/ရောင်းနိုင်မလဲ?',
    answer: [
      '🛍️ Relocation Marketplace',
      '',
      'အိမ်ပြောင်းတဲ့အခါ မလိုတော့တဲ့ ပရိဘောဂနဲ့ အိမ်သုံးပစ္စည်းတွေကို အခြားသူတွေဆီ ရောင်းချနိုင်သလို၊ အိမ်အသစ်မှာ လိုအပ်တဲ့ပစ္စည်းတွေကိုလည်း ရှာဖွေဝယ်ယူနိုင်ပါတယ်။',
      '',
      'Marketplace က ဝယ်သူနဲ့ ရောင်းသူကို ချိတ်ဆက်ပေးတဲ့ platform ဖြစ်ပြီး Shawe Mal ကိုယ်တိုင် ပစ္စည်းတွေကို ရောင်းချတာမဟုတ်ပါဘူး။'
    ].join('\n'),
    link: { label: '🛍️ Marketplace သို့', path: '/marketplace' },
    keywords: ['ပစ္စည်း', 'ရောင်း', 'ဝယ်', 'ပရိဘောဂ', 'ဈေးကွက်', 'marketplace', 'market place', 'sell', 'buy', 'furniture', 'second hand']
  },
  {
    id: 'trust',
    question: '✅ အိမ်နဲ့ Agent တွေကို ဘယ်လိုစစ်ဆေးပြီး ယုံကြည်ရမလဲ?',
    answer: [
      '☑ ယုံကြည်စိတ်ချရမှု စစ်ဆေးခြင်း',
      '',
      'Shawe Mal မှာ Verified Badge ရရှိထားတဲ့ Agent/Partner တွေကို အလွယ်တကူ ခွဲခြားသိနိုင်ပါတယ်။',
      '',
      'Listing တစ်ခုကို မရွေးချယ်ခင် အိမ်အချက်အလက်၊ ဓာတ်ပုံ၊ တည်နေရာ၊ Agent Information နဲ့ Reviews တွေကို စစ်ဆေးနိုင်ပါတယ်။',
      '',
      '⭐ Verified Badge က သက်ဆိုင်ရာ Agent/Partner ဟာ Shawe Mal ရဲ့ သတ်မှတ်ထားတဲ့ verification process ကို ဖြတ်သန်းထားကြောင်း ဖော်ပြပေးပါတယ်။',
      '',
      'ထို့အပြင် မိမိရွေးချယ်မယ့် Listing နဲ့ Agent ရဲ့ အချက်အလက်တွေကို သေချာစစ်ဆေးပြီးမှ ဆုံးဖြတ်နိုင်ပါတယ်။'
    ].join('\n'),
    // The website has no dedicated verification/safety page, so this FAQ has no link button.
    keywords: ['agent', 'အေးဂျင့်', 'ကိုယ်စားလှယ်', 'ပွဲစား', 'စစ်ဆေး', 'စစ်ရ', 'ယုံကြည်', 'ယုံရ', 'verified', 'verify', 'badge', 'trust', 'scam', 'လိမ်']
  },
  {
    id: 'contact',
    question: '❓ တစ်ခြားသိလိုတာ / Feedback',
    answer: 'တစ်ခြားသိလိုတာများ၊ အကြံပြုချက်များ၊ Feedback များရှိရင် အောက်က Telegram Account တွေကို DM ကနေ လာပြောနိုင်ပါတယ်။',
    keywords: ['feedback', 'အကြံပြု', 'တိုင်ကြား', 'ဆက်သွယ်', 'contact', 'support', 'admin', 'help', 'အကူအညီ']
  }
];

export const findFaqById = (id: string): FaqEntry | undefined => FAQ_ENTRIES.find((entry) => entry.id === id);

/** Longest free-text message the matcher looks at; anything beyond is ignored. */
const MAX_QUESTION_LENGTH = 500;

/**
 * Maps a free-text question to the FAQ whose keywords it mentions most. Returns undefined
 * when nothing matches, so the caller can send the "not understood" reply.
 */
export const matchFaq = (text: string): FaqEntry | undefined => {
  const haystack = text.slice(0, MAX_QUESTION_LENGTH).toLowerCase();

  let best: FaqEntry | undefined;
  let bestScore = 0;
  for (const entry of FAQ_ENTRIES) {
    const score = entry.keywords.filter((keyword) => haystack.includes(keyword)).length;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  return best;
};

export const notUnderstoodMessage = (supportUsernames: string[]): string => {
  const handles = supportUsernames.map((username) => `@${username}`).join(' / ');
  const contact = handles ? ` ဒါမှမဟုတ် ${handles} ကို DM ကနေ တိုက်ရိုက်မေးမြန်းနိုင်ပါတယ်။` : '';
  return `မေးခွန်းကို အတိအကျ မနားလည်သေးပါဘူး။ အောက်က Menu ထဲက သက်ဆိုင်ရာအကြောင်းအရာကို ရွေးချယ်ကြည့်နိုင်ပါတယ်။${contact}`;
};
