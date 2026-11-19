/**
 * The study information and consent text, in English and Filipino (D5).
 *
 * Written 2026-11-19 from the earlier draft, to cover what the Philippine
 * National Ethical Guidelines for Research Involving Human Participants
 * (PHREB, 2022) ask a consent form to state: the purpose, what taking part
 * involves, risks and benefits, privacy, that taking part is voluntary and can
 * stop at any time, and whom to ask. The data section follows RA 10173, the
 * Data Privacy Act of 2012. The adviser and any ethics review may still ask
 * for changes. The withdrawal rule (what was already given is kept) is the
 * developers' decision of 2026-11-04.
 *
 * Change `CONSENT_VERSION` with any change here, so each record names the
 * text its participant agreed to.
 */

export interface ConsentSection {
  title: { en: string; fil: string };
  body: { en: string; fil: string };
}

export const CONSENT_TITLE = { en: 'Study Information and Consent', fil: 'Impormasyon ng Pag-aaral at Pahintulot' };

export const CONSENT_INTRO = {
  en: 'Please read this before you start. It explains what the study is, what you will do, and what happens to your data. Take part only if you agree.',
  fil: 'Pakibasa ito bago magsimula. Ipinapaliwanag nito kung ano ang pag-aaral, ang gagawin mo, at ang mangyayari sa iyong datos. Sumali lamang kung sumasang-ayon ka.',
};

export const CONSENT_SECTIONS: readonly ConsentSection[] = [
  {
    title: { en: 'About the study', fil: 'Tungkol sa pag-aaral' },
    body: {
      en: 'Arangkada is a driving game that helps you review for the LTO driver’s license exam. It was made for an undergraduate thesis. The study looks at how well the game chooses what you practise next. Arangkada is a learning tool: it is not an official product of the Land Transportation Office (LTO).',
      fil: 'Ang Arangkada ay isang laro sa pagmamaneho na tumutulong sa iyong mag-review para sa LTO driver’s license exam. Ginawa ito para sa isang undergraduate thesis. Sinusuri ng pag-aaral kung gaano kahusay pumili ang laro ng susunod mong pagsasanay. Ang Arangkada ay kasangkapan sa pag-aaral: hindi ito opisyal na produkto ng Land Transportation Office (LTO).',
    },
  },
  {
    title: { en: 'What you will do', fil: 'Ang gagawin mo' },
    body: {
      en: 'On your own device, at your own pace: a short form about you, a quick device check, a 60-question pre-test, the game from the tutorial to the Final Mission, a post-test, and a short survey. You do not have to finish in one sitting: your progress is saved.',
      fil: 'Sa sarili mong device, sa sarili mong bilis: maikling form tungkol sa iyo, mabilis na pagsuri ng device, 60-tanong na pre-test, ang laro mula tutorial hanggang Huling Misyon, isang post-test, at maikling survey. Hindi mo kailangang tapusin sa isang upuan: naka-save ang iyong progreso.',
    },
  },
  {
    title: { en: 'How the game learns', fil: 'Paano natututo ang laro' },
    body: {
      en: 'Between levels, the game chooses what to add for you, and it learns from every participant as the study goes on. So early participants may get more varied choices than later ones.',
      fil: 'Sa pagitan ng mga level, pumipili ang laro kung ano ang idadagdag para sa iyo, at natututo ito sa bawat kalahok habang tumatakbo ang pag-aaral. Kaya maaaring mas iba-iba ang pinipili para sa mga naunang kalahok.',
    },
  },
  {
    title: { en: 'Your data and privacy', fil: 'Ang iyong datos at privacy' },
    body: {
      en: 'The only personal information we ask for is your name and age, on this page. They are kept apart from your game data, and only the researchers can read them, so they can help you if you lose your password. Everything you do in the study (answers, scores, time and choices in the game) is stored under your participant code. Your name is never in any data we analyse or publish, and results are reported for groups only. The data is stored on secured cloud servers (Google Firebase), read only by the research team, and never sold or shared for advertising. Under the Data Privacy Act of 2012 (RA 10173), you may ask to see or correct your data.',
      fil: 'Ang tanging personal na impormasyong hinihingi namin ay ang iyong pangalan at edad, sa pahinang ito. Hiwalay itong itinatabi sa datos ng laro, at mga mananaliksik lamang ang makakabasa, para matulungan ka kung makalimutan mo ang password. Lahat ng gagawin mo sa pag-aaral (mga sagot, iskor, oras at mga pinili sa laro) ay itinatabi sa ilalim ng iyong participant code. Hindi kailanman isasama ang iyong pangalan sa datos na susuriin o ilalathala, at iniuulat ang resulta nang pangkalahatan lamang. Nakatabi ang datos sa ligtas na cloud server (Google Firebase), binabasa lamang ng research team, at hindi ibinebenta o ibinabahagi para sa advertising. Sa ilalim ng Data Privacy Act of 2012 (RA 10173), maaari mong hilinging makita o itama ang iyong datos.',
    },
  },
  {
    title: { en: 'Taking part is your choice', fil: 'Ikaw ang magpapasya kung sasali' },
    body: {
      en: 'You may stop at any time, for any reason, without saying why and with no penalty. Press "Withdraw from the study" on your study home screen, or message the team. After that, the app records nothing more from you. What you have already given is kept, under your participant code only, and used in the study: please agree only if you accept that.',
      fil: 'Maaari kang tumigil anumang oras, sa anumang dahilan, nang hindi nagsasabi kung bakit at walang parusa. Pindutin ang "Umatras sa pag-aaral" sa iyong study home screen, o mag-message sa team. Pagkatapos noon, wala nang itatala ang app mula sa iyo. Ang naibigay mo na ay itatabi, sa ilalim lamang ng iyong participant code, at gagamitin sa pag-aaral: pumayag lamang kung tinatanggap mo ito.',
    },
  },
  {
    title: { en: 'Risks and benefits', fil: 'Panganib at pakinabang' },
    body: {
      en: 'The risks are small: the screen time of playing a game, and perhaps some pressure during the timed tests. Take breaks whenever you need to. Your scores are not grades and have no effect on any license application. You get free practice for the license exam, and you help improve how driving is taught. The game is practice only: it does not replace a driving school or the LTO’s requirements.',
      fil: 'Maliit ang panganib: ang oras sa screen sa paglalaro, at marahil kaunting pressure sa mga test na may oras. Magpahinga kung kailangan. Hindi grado ang iyong mga iskor at walang epekto sa anumang aplikasyon ng lisensya. Makakakuha ka ng libreng pagsasanay para sa exam, at makakatulong ka sa pagpapabuti ng pagtuturo ng pagmamaneho. Pagsasanay lamang ang laro: hindi nito pinapalitan ang driving school o ang mga kailangan ng LTO.',
    },
  },
  {
    title: { en: 'Questions', fil: 'Mga tanong' },
    body: {
      en: 'If you have a question or a concern, before, during or after the study, reply to the message your invite came in, and the research team will answer.',
      fil: 'Kung may tanong o alalahanin ka, bago, habang o pagkatapos ng pag-aaral, sumagot sa mensaheng pinagdalhan ng iyong imbitasyon, at sasagot ang research team.',
    },
  },
];

export const CONSENT_AGREEMENT = {
  en: 'I have read the Study Information and Consent, I am 18 or older, and I agree to take part.',
  fil: 'Nabasa ko ang Impormasyon ng Pag-aaral at Pahintulot, ako ay 18 taong gulang pataas, at pumapayag akong sumali.',
};
