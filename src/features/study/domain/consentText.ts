/**
 * The study information and consent text, in English
 * and Filipino (D5).
 *
 * DRAFT: the team and the adviser write the final text, and an ethics review
 * may change it. Every section here is a placeholder that says what the final
 * one must cover: the Philippine National Ethical Guidelines for Research
 * Involving Human Participants (PHREB, 2022; **verify** the sections) and
 * RA 10173 for the data. The withdrawal section is the developers' decision
 * of 2026-11-04: a participant may stop at any time, and what they already
 * gave is kept, so no one finds out after the study that a record is gone.
 * Whether that is acceptable is for the adviser and any ethics review to
 * confirm (**verify** RA 10173 §4 on research, and PHREB 2022 on withdrawal).
 * The Filipino is a draft for the team to check. Change `CONSENT_VERSION` with any change here, so each
 * record names the text its participant agreed to.
 */

export interface ConsentSection {
  title: { en: string; fil: string };
  body: { en: string; fil: string };
}

export const CONSENT_SECTIONS: readonly ConsentSection[] = [
  {
    title: { en: 'What this study is', fil: 'Ano ang pag-aaral na ito' },
    body: {
      en: '[DRAFT] Arangkada is a driving game for the LTO licence exam, made for an undergraduate thesis. The study checks how well the game chooses what you practise next, from how you and the other participants play.',
      fil: '[DRAFT] Ang Arangkada ay isang laro sa pagmamaneho para sa LTO licence exam, ginawa para sa isang undergraduate thesis. Sinusuri ng pag-aaral kung gaano kahusay pumili ang laro ng susunod mong pagsasanay, mula sa paglalaro mo at ng iba pang kalahok.',
    },
  },
  {
    title: { en: 'What you will do', fil: 'Ang gagawin mo' },
    body: {
      en: '[DRAFT] At home, on your own device: a short form about you, a device check, a 60-question pre-test, the game from the tutorial to the Final Mission, a 30-question post-test, and a survey. The team will say how long this takes.',
      fil: '[DRAFT] Sa bahay, sa sarili mong device: maikling form tungkol sa iyo, pagsuri ng device, 60-tanong na pre-test, ang laro mula tutorial hanggang Huling misyon, 30-tanong na post-test, at isang survey. Sasabihin ng team kung gaano ito katagal.',
    },
  },
  {
    title: { en: 'How the game learns', fil: 'Paano natututo ang laro' },
    body: {
      en: '[DRAFT] Between levels the game chooses what to add, and it learns from every participant as the study goes. Early participants may get more varied choices than later ones.',
      fil: '[DRAFT] Sa pagitan ng mga level, pumipili ang laro kung ano ang idadagdag, at natututo ito sa bawat kalahok habang tumatakbo ang pag-aaral. Maaaring mas iba-iba ang pinipili para sa mga naunang kalahok.',
    },
  },
  {
    title: { en: 'Your data', fil: 'Ang iyong datos' },
    body: {
      en: '[DRAFT] The only personal information we ask for is your name and age, on this page. The researchers can see who you are, so they can help you if you lose your password. Everything you do in the study is stored under your participant code, and your name is never in any data we analyse or publish (RA 10173, the Data Privacy Act of 2012).',
      fil: '[DRAFT] Ang tanging personal na impormasyong hinihingi namin ay ang iyong pangalan at edad, sa pahinang ito. Nakikita ng mga mananaliksik kung sino ka, para matulungan ka kung makalimutan mo ang password. Lahat ng gagawin mo sa pag-aaral ay itatabi sa ilalim ng iyong participant code, at hindi kailanman isasama ang iyong pangalan sa datos na susuriin o ilalathala (RA 10173, Data Privacy Act of 2012).',
    },
  },
  {
    title: { en: 'Stopping', fil: 'Pagtigil' },
    body: {
      en: 'You may stop taking part at any time, for any reason, without telling us why and with no penalty. Press "Withdraw from the study" on your home screen, or message the team. After that, the app records nothing more from you. What you have already given is kept, under your participant code only, and used in the study: please agree only if you accept that.',
      fil: '[DRAFT] Maaari kang tumigil anumang oras, sa anumang dahilan, nang hindi nagsasabi kung bakit at walang parusa. Pindutin ang "Umatras sa pag-aaral" sa iyong home screen, o mag-message sa team. Pagkatapos noon, wala nang itatala ang app mula sa iyo. Ang naibigay mo na ay itatabi, sa ilalim lamang ng iyong participant code, at gagamitin sa pag-aaral: pumayag lamang kung tinatanggap mo ito.',
    },
  },
  {
    title: { en: 'Risks and benefits', fil: 'Panganib at pakinabang' },
    body: {
      en: '[DRAFT] The team writes this section: what the risks are (for example screen time), and that the game is practice for the exam, not a replacement for a driving school or the LTO.',
      fil: '[DRAFT] Isusulat ng team ang bahaging ito: ang mga panganib (halimbawa ang oras sa screen), at na ang laro ay pagsasanay para sa exam, hindi kapalit ng driving school o ng LTO.',
    },
  },
];

export const CONSENT_AGREEMENT = {
  en: 'I have read the information above, I am 18 or older, and I agree to take part.',
  fil: 'Nabasa ko ang impormasyon sa itaas, ako ay 18 taong gulang pataas, at pumapayag akong sumali.',
};
