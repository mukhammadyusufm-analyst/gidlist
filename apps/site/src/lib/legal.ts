import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * The privacy policy and terms, in every locale the site serves.
 *
 * DELIBERATELY NOT IN THE CMS. Every other string on this site can be edited
 * from the product's admin screen without a deploy, which is right for marketing
 * copy and wrong for this. A legal document's value is that you can say what it
 * said on a particular date: git gives that for free, and a database row that
 * anyone with admin access can rewrite silently does not. Changing these means a
 * commit and a deploy, which is the correct amount of friction.
 *
 * Written from what the code actually does — the retention windows are
 * `plans.evidence_retention_days`, the processors are the services the app
 * genuinely calls. If either changes, this file is part of that change.
 */

export const COMPANY_NAME = 'UNUMIS LTD';

/**
 * The company's own site.
 *
 * Rendered as a real link wherever the company is named, and published in the
 * JSON-LD organisation as `sameAs`. That is the property search engines read as
 * "these two addresses are the same entity" — a plain mention establishes
 * nothing, whereas a link plus `sameAs` connects Gidlist's reputation to the
 * company's and back again.
 */
export const COMPANY_URL = 'https://unumis.com';
export const COMPANY_COUNTRY_EN = 'the Republic of Uzbekistan';
export const LEGAL_CONTACT_EMAIL = 'gidlist.operations@gmail.com';

/**
 * The registered address, kept here but DELIBERATELY NOT RENDERED.
 *
 * Nothing requires it. Google asks for a privacy policy and terms at reachable
 * URLs, not for a postal address inside them, and a policy identifies its
 * controller adequately with a legal name and a contact address. The company and
 * its address are already in the state register, so omitting them here lowers
 * prominence rather than concealing anything — but there is no reason to put a
 * private residence in front of every visitor to satisfy a requirement that does
 * not exist.
 *
 * Expect this to change: acquiring merchant status with Click or Payme normally
 * means publishing company particulars — legal name, address, INN, contacts — on
 * the site. When that day comes, render this rather than re-deriving it.
 */
export const COMPANY_ADDRESS_UNPUBLISHED =
  'Andijon viloyati, Jalaquduq tumani, Soʻfiqishloq MFY, Oʻzbekiston koʻchasi, 56-uy, Oʻzbekiston';

/** ISO date of the last substantive change. Update it whenever the text changes. */
export const LEGAL_UPDATED = '2026-08-29';

export type LegalSection = { heading: string; body: string[] };

export type LegalDoc = {
  title: string;
  /** Rendered above the text, e.g. "Last updated: 29 August 2026". */
  updated: string;
  intro: string[];
  sections: LegalSection[];
};

export type LegalDocs = { privacy: LegalDoc; terms: LegalDoc };

const en: LegalDocs = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: 29 August 2026',
    intro: [
      `${COMPANY_NAME}, a company registered in ${COMPANY_COUNTRY_EN}, operates Gidlist. This policy explains what we collect, why, how long we keep it, and what you can ask us to do about it.`,
      `For anything in this policy, write to ${LEGAL_CONTACT_EMAIL}. Our registered address is available on request to that address.`,
    ],
    sections: [
      {
        heading: 'Two different relationships',
        body: [
          'Gidlist is used by organisations, and that changes who decides what happens to your data.',
          'For your account — your email address and name — we decide, and this policy applies directly.',
          'For the work recorded inside a space — checklists, submissions, photographs, locations — the organisation that owns the space decides, and we act on its instructions. If you fill in checklists for your employer and want that content changed or removed, ask your employer first. We will pass such requests on to them rather than acting alone, because the record belongs to them.',
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'Account details: your email address and name, and your profile picture if you choose to sign in with Google.',
          'Membership: which spaces and boards you belong to, and your role in each.',
          'Checklist content: the templates and schedules your organisation creates.',
          'Submissions: which items were ticked, the time each one was ticked, who submitted the result, and any notes added.',
          'Attachments: photographs and files, but only for items where your organisation has asked for them.',
          'Location: GPS coordinates, only for items where your organisation has turned location on, and only at the moment you tick that item. We do not track your location in the background, and the app cannot read your position when it is closed.',
          'Technical records: server logs, including IP address and browser, kept so we can secure the service and investigate faults.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To provide the service: to show your organisation what was done, by whom, and when.',
          'To keep the record trustworthy, which is the point of the product.',
          'To send necessary email, such as invitations and alerts about your account.',
          'To keep the service secure and to investigate misuse.',
          'We do not sell your data, and we do not use it for advertising or profiling.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'The record of a submission is kept for as long as the organisation’s account exists. An operational record that quietly disappeared after a year would be worth nothing, so we do not delete it on a timer.',
          'Attachments are treated differently, because they are large and their usefulness fades. Photographs and files are removed automatically once the organisation’s plan retention window passes: 90 days on the free plan, 365 days on Starter, 730 days on Team, and indefinitely on Business.',
          'When an attachment expires, the record still shows that one was provided and the date it was removed. Nothing about the submission itself is erased.',
          'If you close your account we delete your account details. Content belonging to an organisation’s space remains that organisation’s record.',
        ],
      },
      {
        heading: 'Who else handles your data',
        body: [
          'We use a small number of providers to run the service, and they process data only on our instructions:',
          'Supabase — database, file storage, and sign-in.',
          'Vercel — hosting for the website and application.',
          'Resend — sending transactional email such as invitations.',
          'Google — only if you choose to sign in with a Google account.',
          'These providers operate infrastructure outside Uzbekistan, which means your data may be stored and processed abroad. If your organisation has obligations about where data is held, contact us before storing regulated records in Gidlist.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can ask us for a copy of your data, ask us to correct it, ask us to delete it, or object to how we use it.',
          `Write to ${LEGAL_CONTACT_EMAIL} and we will answer within 30 days.`,
          'Where the data forms part of an organisation’s operational record, we will forward your request to that organisation, as explained above.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'Access to data is enforced by the database itself rather than only by the application, so a fault in one screen cannot expose another organisation’s records. Traffic is encrypted in transit, and attachments are held in private storage reachable only through short-lived links.',
          'No service can promise perfect security. If we ever discover a breach affecting your data, we will tell you.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'Gidlist is a workplace tool and is not intended for anyone under 16. We do not knowingly collect data from children.',
        ],
      },
      {
        heading: 'Changes to this policy',
        body: [
          'When this policy changes we update the date at the top. If a change materially affects your rights, we will email account holders rather than relying on you to notice.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: 'Last updated: 29 August 2026',
    intro: [
      `These terms govern your use of Gidlist, operated by ${COMPANY_NAME}, a company registered in ${COMPANY_COUNTRY_EN}. Our registered address is available on request to ${LEGAL_CONTACT_EMAIL}.`,
      'By creating an account or using the service you accept these terms. If you are accepting on behalf of an organisation, you confirm you are authorised to do so.',
    ],
    sections: [
      {
        heading: 'The service',
        body: [
          'Gidlist provides scheduled operational checklists: templates, assignment, completion records, and reporting on what was done and when.',
          'We improve and change the service over time. We will not remove a feature your plan depends on without telling you first.',
        ],
      },
      {
        heading: 'Accounts',
        body: [
          'You are responsible for your account and for keeping your sign-in details safe.',
          'If you invite people into your space, you are responsible for who you invite and for what they can see. Tell us promptly if you believe an account has been misused.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Do not use Gidlist to break the law, to store unlawful content, or to harm others.',
          'Do not attempt to access data belonging to another organisation, probe or circumvent our security, or disrupt the service for other users.',
          'Do not resell or provide the service to third parties without a written agreement with us.',
        ],
      },
      {
        heading: 'Your content',
        body: [
          'The checklists, submissions, photographs and files you put into Gidlist remain yours. We claim no ownership of them.',
          'You grant us only the permission needed to run the service: to store your content, and to show it to the people in your space who are entitled to see it.',
          'You are responsible for having the right to upload what you upload. That includes photographs showing people, and any location data your staff record — tell your staff what is being collected before you switch those requirements on.',
        ],
      },
      {
        heading: 'Plans and payment',
        body: [
          'A free plan is available. Paid plans are billed in advance for the period shown at the time of purchase, and prices are shown before you commit.',
          'Applicable taxes are added where required by law.',
          'If you downgrade or stop paying, your records are not deleted immediately, but features tied to a higher plan — including longer attachment retention — stop applying.',
        ],
      },
      {
        heading: 'Availability',
        body: [
          'We aim to keep Gidlist available continuously, but we do not guarantee uninterrupted service. Maintenance, provider outages and faults happen.',
          'The application is designed so that a checklist can be filled in on a phone with a poor connection, but it is not a substitute for your own operational backup where the work is critical.',
        ],
      },
      {
        heading: 'No warranty for compliance',
        body: [
          'Gidlist records what your staff did and when. It does not certify that the work was done correctly, and it is not legal, safety, or regulatory advice.',
          'Deciding whether Gidlist satisfies an obligation you are under — an inspection regime, a food safety standard, an audit requirement — is your responsibility, not ours. The service is provided "as is".',
        ],
      },
      {
        heading: 'Liability',
        body: [
          'To the extent permitted by law, our total liability to you for any claim relating to the service is limited to the amount you paid us in the twelve months before the claim arose.',
          'We are not liable for indirect or consequential loss, including lost profits or lost business.',
          'Nothing in these terms limits liability that cannot lawfully be limited.',
        ],
      },
      {
        heading: 'Suspension and ending the agreement',
        body: [
          'You may stop using Gidlist at any time. Export anything you need before you do.',
          'We may suspend or close an account that breaches these terms, or that puts the service or other customers at risk. Where the circumstances allow it, we will warn you first.',
        ],
      },
      {
        heading: 'Governing law',
        body: [
          'These terms are governed by the law of the Republic of Uzbekistan, and disputes are subject to the courts of the Republic of Uzbekistan.',
        ],
      },
      {
        heading: 'Changes to these terms',
        body: [
          'When we change these terms we update the date at the top, and we email account holders about material changes. Continuing to use the service after a change means you accept it.',
        ],
      },
      {
        heading: 'Contact',
        body: [`Questions about these terms: ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
};

const uz: LegalDocs = {
  privacy: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish: 2026-yil 29-avgust',
    intro: [
      `Gidlist xizmatini Oʻzbekiston Respublikasida roʻyxatdan oʻtgan ${COMPANY_NAME} yuritadi. Ushbu siyosat biz qanday maʼlumot toʻplashimizni, nima uchun toʻplashimizni, uni qancha saqlashimizni va siz nimani talab qilishingiz mumkinligini tushuntiradi.`,
      `Ushbu siyosatga oid har qanday savol boʻyicha ${LEGAL_CONTACT_EMAIL} manziliga yozing. Roʻyxatdan oʻtgan manzilimizni shu elektron pochta orqali soʻrab olishingiz mumkin.`,
    ],
    sections: [
      {
        heading: 'Ikki xil munosabat',
        body: [
          'Gidlistdan tashkilotlar foydalanadi va bu maʼlumotingiz taqdirini kim hal qilishini oʻzgartiradi.',
          'Hisobingiz maʼlumotlari — elektron pochtangiz va ismingiz — boʻyicha qarorni biz qabul qilamiz va ushbu siyosat bevosita qoʻllanadi.',
          'Ish maydonida qayd etilgan ish — nazorat roʻyxatlari, topshiriqlar, suratlar, joylashuv — boʻyicha qarorni maydon egasi boʻlgan tashkilot qabul qiladi, biz esa uning koʻrsatmasi asosida ish koʻramiz. Agar siz ish beruvchingiz uchun nazorat roʻyxatlarini toʻldirsangiz va bu maʼlumotni oʻzgartirish yoki oʻchirishni istasangiz, avval ish beruvchingizga murojaat qiling. Biz bunday soʻrovlarni mustaqil bajarmasdan, unga yoʻllaymiz, chunki bu yozuv unga tegishli.',
        ],
      },
      {
        heading: 'Biz nimalarni toʻplaymiz',
        body: [
          'Hisob maʼlumotlari: elektron pochta manzilingiz va ismingiz, Google orqali kirsangiz — profil rasmingiz.',
          'Aʼzolik: qaysi maydon va doskalarga tegishli ekanligingiz va ulardagi rolingiz.',
          'Nazorat roʻyxati mazmuni: tashkilotingiz yaratgan shablonlar va jadvallar.',
          'Topshiriqlar: qaysi bandlar belgilangani, har biri qachon belgilangani, natijani kim yuborgani va qoʻshilgan izohlar.',
          'Ilovalar: suratlar va fayllar — faqat tashkilotingiz ularni talab qilgan bandlar uchun.',
          'Joylashuv: GPS koordinatalari — faqat tashkilotingiz joylashuvni yoqqan bandlar uchun va faqat siz oʻsha bandni belgilagan paytda. Biz sizning joylashuvingizni fonda kuzatmaymiz va ilova yopiq boʻlganda oʻrningizni bila olmaydi.',
          'Texnik yozuvlar: server jurnallari, jumladan IP manzil va brauzer — xizmat xavfsizligini taʼminlash va nosozliklarni tekshirish uchun saqlanadi.',
        ],
      },
      {
        heading: 'Nima uchun foydalanamiz',
        body: [
          'Xizmatni koʻrsatish uchun: tashkilotingizga nima, kim tomonidan va qachon bajarilganini koʻrsatish.',
          'Yozuvning ishonchliligini saqlash uchun — mahsulotning asosiy maqsadi shu.',
          'Zarur xatlarni yuborish uchun: taklifnomalar va hisobingizga oid ogohlantirishlar.',
          'Xizmat xavfsizligini taʼminlash va suiisteʼmolni tekshirish uchun.',
          'Biz maʼlumotlaringizni sotmaymiz hamda reklama yoki profillash uchun ishlatmaymiz.',
        ],
      },
      {
        heading: 'Qancha vaqt saqlaymiz',
        body: [
          'Topshiriq yozuvi tashkilot hisobi mavjud boʻlgan davr mobaynida saqlanadi. Bir yildan keyin sekin yoʻqoladigan operatsion yozuvning qiymati boʻlmaydi, shuning uchun biz uni taymer boʻyicha oʻchirmaymiz.',
          'Ilovalar boshqacha koʻrib chiqiladi, chunki ular katta hajmli va vaqt oʻtishi bilan ahamiyatini yoʻqotadi. Suratlar va fayllar tashkilot tarifidagi saqlash muddati tugagach avtomatik oʻchiriladi: bepul tarifda 90 kun, Starter tarifida 365 kun, Team tarifida 730 kun, Business tarifida muddatsiz.',
          'Ilova muddati tugaganda ham yozuvda ilova taqdim etilgani va u qaysi sanada oʻchirilgani koʻrinib turadi. Topshiriqning oʻzidan hech narsa oʻchirilmaydi.',
          'Hisobingizni yopsangiz, hisob maʼlumotlaringizni oʻchiramiz. Tashkilot maydoniga tegishli mazmun oʻsha tashkilotning yozuvi boʻlib qoladi.',
        ],
      },
      {
        heading: 'Maʼlumotlaringiz bilan yana kim ishlaydi',
        body: [
          'Xizmatni yuritish uchun bir necha provayderdan foydalanamiz va ular maʼlumotni faqat bizning koʻrsatmamiz asosida qayta ishlaydi:',
          'Supabase — maʼlumotlar bazasi, fayl saqlash va tizimga kirish.',
          'Vercel — vebsayt va ilova uchun hosting.',
          'Resend — taklifnoma kabi tranzaksion xatlarni yuborish.',
          'Google — faqat siz Google hisobi orqali kirishni tanlasangiz.',
          'Bu provayderlar infratuzilmasi Oʻzbekistondan tashqarida ishlaydi, yaʼni maʼlumotlaringiz chet elda saqlanishi va qayta ishlanishi mumkin. Agar tashkilotingizda maʼlumot qayerda saqlanishiga oid talablar boʻlsa, tartibga solinadigan yozuvlarni Gidlistda saqlashdan oldin biz bilan bogʻlaning.',
        ],
      },
      {
        heading: 'Sizning huquqlaringiz',
        body: [
          'Maʼlumotlaringiz nusxasini soʻrashingiz, ularni tuzatishni yoki oʻchirishni talab qilishingiz, foydalanish usulimizga eʼtiroz bildirishingiz mumkin.',
          `${LEGAL_CONTACT_EMAIL} manziliga yozing — 30 kun ichida javob beramiz.`,
          'Agar maʼlumot tashkilotning operatsion yozuvi tarkibiga kirsa, yuqorida tushuntirilganidek, soʻrovingizni oʻsha tashkilotga yoʻllaymiz.',
        ],
      },
      {
        heading: 'Xavfsizlik',
        body: [
          'Maʼlumotga kirish faqat ilova darajasida emas, maʼlumotlar bazasining oʻzida cheklanadi — shuning uchun bitta ekrandagi xato boshqa tashkilot yozuvlarini ocha olmaydi. Trafik uzatishda shifrlanadi, ilovalar esa faqat qisqa muddatli havolalar orqali ochiladigan yopiq xotirada saqlanadi.',
          'Hech bir xizmat mutlaq xavfsizlikni vaʼda qila olmaydi. Maʼlumotlaringizga taʼsir qiluvchi buzilishni aniqlasak, sizni xabardor qilamiz.',
        ],
      },
      {
        heading: 'Bolalar',
        body: [
          'Gidlist ish joyi uchun moʻljallangan vosita boʻlib, 16 yoshgacha boʻlganlar uchun emas. Biz bolalardan bila turib maʼlumot toʻplamaymiz.',
        ],
      },
      {
        heading: 'Siyosatdagi oʻzgarishlar',
        body: [
          'Siyosat oʻzgarganda yuqoridagi sanani yangilaymiz. Agar oʻzgarish huquqlaringizga jiddiy taʼsir qilsa, sizning eʼtiboringizga tashlab qoʻymasdan, hisob egalariga xat yuboramiz.',
        ],
      },
    ],
  },
  terms: {
    title: 'Foydalanish shartlari',
    updated: 'Oxirgi yangilanish: 2026-yil 29-avgust',
    intro: [
      `Ushbu shartlar Oʻzbekiston Respublikasida roʻyxatdan oʻtgan ${COMPANY_NAME} tomonidan yuritiladigan Gidlist xizmatidan foydalanishingizni tartibga soladi. Roʻyxatdan oʻtgan manzilimizni ${LEGAL_CONTACT_EMAIL} orqali soʻrab olishingiz mumkin.`,
      'Hisob yaratish yoki xizmatdan foydalanish orqali siz ushbu shartlarni qabul qilasiz. Agar tashkilot nomidan qabul qilayotgan boʻlsangiz, bunga vakolatingiz borligini tasdiqlaysiz.',
    ],
    sections: [
      {
        heading: 'Xizmat',
        body: [
          'Gidlist rejalashtirilgan operatsion nazorat roʻyxatlarini taqdim etadi: shablonlar, biriktirish, bajarilish yozuvlari hamda nima va qachon bajarilgani boʻyicha hisobotlar.',
          'Biz xizmatni vaqt oʻtishi bilan takomillashtiramiz va oʻzgartiramiz. Tarifingiz bogʻliq boʻlgan imkoniyatni sizga oldindan xabar bermasdan olib tashlamaymiz.',
        ],
      },
      {
        heading: 'Hisoblar',
        body: [
          'Hisobingiz va kirish maʼlumotlaringiz xavfsizligi uchun siz javobgarsiz.',
          'Maydoningizga odamlarni taklif qilsangiz, kimni taklif qilganingiz va ular nimani koʻra olishi uchun javobgarsiz. Hisob suiisteʼmol qilingan deb hisoblasangiz, bizni tezda xabardor qiling.',
        ],
      },
      {
        heading: 'Maqbul foydalanish',
        body: [
          'Gidlistdan qonunbuzarlik uchun, noqonuniy mazmun saqlash uchun yoki boshqalarga zarar yetkazish uchun foydalanmang.',
          'Boshqa tashkilotning maʼlumotiga kirishga urinmang, xavfsizligimizni sinab koʻrmang yoki chetlab oʻtmang, boshqa foydalanuvchilar uchun xizmatni buzmang.',
          'Biz bilan yozma kelishuvsiz xizmatni uchinchi shaxslarga qayta sotmang yoki taqdim etmang.',
        ],
      },
      {
        heading: 'Sizning mazmuningiz',
        body: [
          'Gidlistga joylagan nazorat roʻyxatlari, topshiriqlar, suratlar va fayllar sizniki boʻlib qoladi. Biz ularga egalik daʼvo qilmaymiz.',
          'Siz bizga faqat xizmatni yuritish uchun zarur ruxsatni berasiz: mazmuningizni saqlash va uni maydoningizdagi koʻrish huquqiga ega shaxslarga koʻrsatish.',
          'Yuklagan narsangizga huquqingiz borligi uchun siz javobgarsiz. Bunga odamlar tasvirlangan suratlar va xodimlaringiz qayd etadigan joylashuv maʼlumotlari ham kiradi — bu talablarni yoqishdan oldin xodimlaringizga nima toʻplanayotganini ayting.',
        ],
      },
      {
        heading: 'Tariflar va toʻlov',
        body: [
          'Bepul tarif mavjud. Pullik tariflar xarid vaqtida koʻrsatilgan davr uchun oldindan hisoblanadi va narxlar siz rozilik bildirishdan oldin koʻrsatiladi.',
          'Qonun talab qilgan hollarda tegishli soliqlar qoʻshiladi.',
          'Tarifni pasaytirsangiz yoki toʻlovni toʻxtatsangiz, yozuvlaringiz darhol oʻchirilmaydi, biroq yuqori tarifga bogʻliq imkoniyatlar — jumladan ilovalarning uzoqroq saqlanishi — qoʻllanishdan toʻxtaydi.',
        ],
      },
      {
        heading: 'Xizmatning mavjudligi',
        body: [
          'Gidlistni uzluksiz ishlashini taʼminlashga intilamiz, biroq uzilishsiz xizmatni kafolatlamaymiz. Texnik xizmat, provayder uzilishlari va nosozliklar boʻlishi mumkin.',
          'Ilova nazorat roʻyxatini aloqa sust boʻlgan telefonda ham toʻldirish mumkin boʻlishi uchun ishlab chiqilgan, ammo ish hal qiluvchi ahamiyatga ega boʻlganda u sizning oʻz zaxira tartibingiz oʻrnini bosmaydi.',
        ],
      },
      {
        heading: 'Muvofiqlik boʻyicha kafolat yoʻq',
        body: [
          'Gidlist xodimlaringiz nima qilgani va qachon qilganini qayd etadi. U ishning toʻgʻri bajarilganini tasdiqlamaydi hamda huquqiy, xavfsizlik yoki tartibga solish boʻyicha maslahat emas.',
          'Gidlist sizning zimmangizdagi majburiyatni — tekshiruv tartibi, oziq-ovqat xavfsizligi standarti, audit talabi — qondirishini baholash sizning javobgarligingiz, bizniki emas. Xizmat "borligicha" taqdim etiladi.',
        ],
      },
      {
        heading: 'Javobgarlik',
        body: [
          'Qonun ruxsat bergan darajada, xizmatga oid har qanday daʼvo boʻyicha sizning oldingizdagi umumiy javobgarligimiz daʼvo yuzaga kelishidan oldingi oʻn ikki oyda bizga toʻlagan summangiz bilan cheklanadi.',
          'Biz bilvosita yoki ergashuvchi zarar, jumladan boy berilgan foyda yoki yoʻqotilgan biznes uchun javobgar emasmiz.',
          'Ushbu shartlardagi hech narsa qonun boʻyicha cheklab boʻlmaydigan javobgarlikni cheklamaydi.',
        ],
      },
      {
        heading: 'Toʻxtatib turish va shartnomani tugatish',
        body: [
          'Gidlistdan foydalanishni istalgan vaqtda toʻxtatishingiz mumkin. Bunga qadar kerakli maʼlumotlarni eksport qiling.',
          'Ushbu shartlarni buzadigan yoki xizmatga hamda boshqa mijozlarga xavf soladigan hisobni toʻxtatib turishimiz yoki yopishimiz mumkin. Vaziyat imkon bergan hollarda avval ogohlantiramiz.',
        ],
      },
      {
        heading: 'Amaldagi qonun',
        body: [
          'Ushbu shartlar Oʻzbekiston Respublikasi qonunchiligi bilan tartibga solinadi va nizolar Oʻzbekiston Respublikasi sudlariga tegishli.',
        ],
      },
      {
        heading: 'Shartlardagi oʻzgarishlar',
        body: [
          'Shartlarni oʻzgartirganda yuqoridagi sanani yangilaymiz va jiddiy oʻzgarishlar haqida hisob egalariga xat yuboramiz. Oʻzgarishdan keyin xizmatdan foydalanishda davom etish uni qabul qilganingizni bildiradi.',
        ],
      },
      {
        heading: 'Bogʻlanish',
        body: [`Ushbu shartlar boʻyicha savollar: ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
};

const ru: LegalDocs = {
  privacy: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление: 29 августа 2026 г.',
    intro: [
      `Сервис Gidlist предоставляет ${COMPANY_NAME} — компания, зарегистрированная в Республике Узбекистан. Эта политика объясняет, какие данные мы собираем, зачем, как долго храним и о чём вы можете нас попросить.`,
      `По любым вопросам, связанным с этой политикой, пишите на ${LEGAL_CONTACT_EMAIL}. Адрес регистрации предоставляется по запросу на этот же адрес.`,
    ],
    sections: [
      {
        heading: 'Два разных отношения',
        body: [
          'Gidlist используют организации, и от этого зависит, кто решает судьбу ваших данных.',
          'В отношении учётной записи — вашего адреса электронной почты и имени — решение принимаем мы, и эта политика применяется напрямую.',
          'В отношении работы, зафиксированной в пространстве, — чек-листов, отправленных отчётов, фотографий, местоположения — решение принимает организация, которой принадлежит пространство, а мы действуем по её указанию. Если вы заполняете чек-листы для работодателя и хотите изменить или удалить эти данные, обратитесь сначала к нему. Такие запросы мы передаём организации, а не выполняем самостоятельно, потому что запись принадлежит ей.',
        ],
      },
      {
        heading: 'Что мы собираем',
        body: [
          'Данные учётной записи: адрес электронной почты и имя, а также фотография профиля, если вы входите через Google.',
          'Участие: к каким пространствам и доскам вы относитесь и какая у вас роль.',
          'Содержание чек-листов: шаблоны и расписания, созданные вашей организацией.',
          'Отправленные отчёты: какие пункты отмечены, время отметки каждого, кто отправил результат и добавленные примечания.',
          'Вложения: фотографии и файлы — только для пунктов, где организация их запросила.',
          'Местоположение: координаты GPS — только для пунктов, где организация включила определение местоположения, и только в момент отметки. Мы не отслеживаем ваше местоположение в фоновом режиме, и приложение не может определить его, когда закрыто.',
          'Технические записи: журналы сервера, включая IP-адрес и браузер, — для обеспечения безопасности и разбора сбоев.',
        ],
      },
      {
        heading: 'Зачем мы это используем',
        body: [
          'Для работы сервиса: чтобы показать организации, что, кем и когда было сделано.',
          'Чтобы запись оставалась достоверной — в этом смысл продукта.',
          'Для отправки необходимых писем: приглашений и уведомлений об учётной записи.',
          'Для обеспечения безопасности сервиса и расследования злоупотреблений.',
          'Мы не продаём ваши данные и не используем их для рекламы или профилирования.',
        ],
      },
      {
        heading: 'Сколько мы храним',
        body: [
          'Запись об отправленном отчёте хранится всё время существования учётной записи организации. Операционная запись, которая тихо исчезает через год, не имеет ценности, поэтому мы не удаляем её по таймеру.',
          'С вложениями иначе: они объёмные, и их полезность со временем падает. Фотографии и файлы удаляются автоматически по истечении срока хранения тарифа организации: 90 дней на бесплатном тарифе, 365 дней на Starter, 730 дней на Team и бессрочно на Business.',
          'После удаления вложения запись по-прежнему показывает, что вложение было предоставлено, и дату его удаления. Из самого отчёта ничего не стирается.',
          'При закрытии учётной записи мы удаляем ваши данные учётной записи. Содержимое, принадлежащее пространству организации, остаётся её записью.',
        ],
      },
      {
        heading: 'Кто ещё обрабатывает данные',
        body: [
          'Для работы сервиса мы используем несколько поставщиков, которые обрабатывают данные только по нашим указаниям:',
          'Supabase — база данных, хранение файлов и вход в систему.',
          'Vercel — хостинг сайта и приложения.',
          'Resend — отправка транзакционных писем, например приглашений.',
          'Google — только если вы выбираете вход через аккаунт Google.',
          'Инфраструктура этих поставщиков расположена за пределами Узбекистана, то есть ваши данные могут храниться и обрабатываться за рубежом. Если у вашей организации есть требования к месту хранения данных, свяжитесь с нами до того, как размещать в Gidlist регулируемые записи.',
        ],
      },
      {
        heading: 'Ваши права',
        body: [
          'Вы можете запросить копию своих данных, попросить исправить или удалить их либо возразить против способа их использования.',
          `Напишите на ${LEGAL_CONTACT_EMAIL} — мы ответим в течение 30 дней.`,
          'Если данные входят в операционную запись организации, мы передадим ваш запрос этой организации, как описано выше.',
        ],
      },
      {
        heading: 'Безопасность',
        body: [
          'Доступ к данным ограничивается самой базой данных, а не только приложением, поэтому ошибка на одном экране не может открыть записи другой организации. Трафик шифруется при передаче, а вложения хранятся в закрытом хранилище, доступном только по кратковременным ссылкам.',
          'Ни один сервис не может обещать абсолютной безопасности. Если мы обнаружим утечку, затрагивающую ваши данные, мы сообщим вам.',
        ],
      },
      {
        heading: 'Дети',
        body: [
          'Gidlist — рабочий инструмент, он не предназначен для лиц младше 16 лет. Мы сознательно не собираем данные детей.',
        ],
      },
      {
        heading: 'Изменения политики',
        body: [
          'При изменении политики мы обновляем дату вверху. Если изменение существенно затрагивает ваши права, мы напишем владельцам учётных записей, а не будем рассчитывать на то, что вы заметите сами.',
        ],
      },
    ],
  },
  terms: {
    title: 'Условия использования',
    updated: 'Последнее обновление: 29 августа 2026 г.',
    intro: [
      `Эти условия регулируют использование Gidlist — сервиса, который предоставляет ${COMPANY_NAME}, компания, зарегистрированная в Республике Узбекистан. Адрес регистрации предоставляется по запросу на ${LEGAL_CONTACT_EMAIL}.`,
      'Создавая учётную запись или используя сервис, вы принимаете эти условия. Если вы принимаете их от имени организации, вы подтверждаете, что уполномочены на это.',
    ],
    sections: [
      {
        heading: 'Сервис',
        body: [
          'Gidlist предоставляет операционные чек-листы по расписанию: шаблоны, назначение исполнителей, записи о выполнении и отчётность о том, что и когда было сделано.',
          'Мы развиваем и меняем сервис со временем. Мы не удалим функцию, от которой зависит ваш тариф, не предупредив вас заранее.',
        ],
      },
      {
        heading: 'Учётные записи',
        body: [
          'Вы отвечаете за свою учётную запись и за сохранность данных для входа.',
          'Приглашая людей в своё пространство, вы отвечаете за то, кого приглашаете и что им доступно. Сообщите нам без промедления, если считаете, что учётной записью воспользовались без разрешения.',
        ],
      },
      {
        heading: 'Допустимое использование',
        body: [
          'Не используйте Gidlist для нарушения закона, хранения противоправного содержания или причинения вреда другим.',
          'Не пытайтесь получить доступ к данным другой организации, проверять или обходить нашу защиту, нарушать работу сервиса для других пользователей.',
          'Не перепродавайте и не предоставляйте сервис третьим лицам без письменного соглашения с нами.',
        ],
      },
      {
        heading: 'Ваше содержание',
        body: [
          'Чек-листы, отчёты, фотографии и файлы, которые вы размещаете в Gidlist, остаются вашими. Мы не претендуем на права собственности на них.',
          'Вы предоставляете нам только те разрешения, которые нужны для работы сервиса: хранить ваше содержание и показывать его тем участникам вашего пространства, кто вправе его видеть.',
          'Вы отвечаете за наличие прав на то, что загружаете. Это касается и фотографий, на которых изображены люди, и данных о местоположении, которые фиксируют ваши сотрудники, — предупредите сотрудников о том, что собирается, прежде чем включать эти требования.',
        ],
      },
      {
        heading: 'Тарифы и оплата',
        body: [
          'Доступен бесплатный тариф. Платные тарифы оплачиваются авансом за период, указанный при покупке, и цены показываются до подтверждения.',
          'Применимые налоги добавляются в случаях, предусмотренных законом.',
          'При переходе на более низкий тариф или прекращении оплаты ваши записи не удаляются немедленно, но возможности, привязанные к более высокому тарифу, — включая более длительный срок хранения вложений — перестают действовать.',
        ],
      },
      {
        heading: 'Доступность',
        body: [
          'Мы стремимся обеспечивать непрерывную работу Gidlist, но не гарантируем её. Техническое обслуживание, сбои поставщиков и неисправности случаются.',
          'Приложение рассчитано на заполнение чек-листа с телефона при плохой связи, но оно не заменяет ваш собственный резервный порядок там, где работа критична.',
        ],
      },
      {
        heading: 'Без гарантии соответствия требованиям',
        body: [
          'Gidlist фиксирует, что и когда сделали ваши сотрудники. Он не удостоверяет правильность выполнения работы и не является юридической консультацией или консультацией по безопасности и нормативным требованиям.',
          'Оценка того, удовлетворяет ли Gidlist вашим обязательствам — режиму проверок, стандарту пищевой безопасности, требованию аудита, — ваша ответственность, а не наша. Сервис предоставляется «как есть».',
        ],
      },
      {
        heading: 'Ответственность',
        body: [
          'В пределах, допускаемых законом, наша общая ответственность перед вами по любому требованию, связанному с сервисом, ограничена суммой, уплаченной вами нам за двенадцать месяцев до возникновения требования.',
          'Мы не отвечаем за косвенные или последующие убытки, включая упущенную выгоду и утрату деловых возможностей.',
          'Ничто в этих условиях не ограничивает ответственность, которую нельзя ограничить по закону.',
        ],
      },
      {
        heading: 'Приостановление и прекращение',
        body: [
          'Вы можете прекратить пользоваться Gidlist в любой момент. Выгрузите нужные данные заранее.',
          'Мы можем приостановить или закрыть учётную запись, которая нарушает эти условия либо создаёт риск для сервиса или других клиентов. Если обстоятельства позволяют, мы предупредим заранее.',
        ],
      },
      {
        heading: 'Применимое право',
        body: [
          'Эти условия регулируются законодательством Республики Узбекистан, споры подлежат рассмотрению в судах Республики Узбекистан.',
        ],
      },
      {
        heading: 'Изменения условий',
        body: [
          'При изменении условий мы обновляем дату вверху и пишем владельцам учётных записей о существенных изменениях. Продолжение использования сервиса после изменения означает согласие с ним.',
        ],
      },
      {
        heading: 'Контакты',
        body: [`Вопросы по этим условиям: ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
};

export const LEGAL: Record<BuiltinLocale, LegalDocs> = { en, uz, ru };
