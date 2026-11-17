import type { AnalyzeRequest, AskRequest, Timeline } from "./schema.js";

/**
 * Offline demo data (MOCK=1): the poker Short walkthrough, spread over whatever
 * video length is sent. Lets you try the UI without an API key.
 */
type MockTimelineParams = { request: AnalyzeRequest };

export function mockTimeline({ request }: MockTimelineParams): Timeline {
  const d = request.durationSec;
  function at(fraction: number): number {
    return Math.round(d * fraction * 10) / 10;
  }
  return {
    topic: "Live Texas Hold'em hand",
    overview:
      "A player in a brown jacket raises before the flop, keeps betting on a very connected board, then stays calm while his opponent thinks for about six minutes on the river.",
    confidenceNote: "Hole cards, who bet first on the turn, and the final result are not visible in these frames.",
    moments: [
      {
        t: at(0.02),
        title: "Pre-flop raise to $200",
        whatsHappening: "The player in the brown jacket raises to $200 before any shared cards are dealt.",
        whyItMatters: "Raising pre-flop takes the initiative: it says 'my two cards are good' and makes others pay to continue.",
        risk: "",
        improve: "",
        keyMoment: false,
        highlight: { x: 0.3, y: 0.38, w: 0.3, h: 0.16, label: "Raise $200" },
        speak: "He opens with a raise to two hundred. That's him taking control of the hand early.",
      },
      {
        t: at(0.35),
        title: "Scary board: 3♣ 2♣ 2♦ A♣",
        whatsHappening: "The turn brings the A♣. The board now shows three clubs, A-2-3, and a pair of twos. Pot is $1,210.",
        whyItMatters:
          "Three clubs means any two clubs is a flush. A-2-3 means 4-5 is a straight. The paired 2 makes full houses possible. 4♣5♣ is a straight flush — the best possible hand.",
        risk: "One pair or two pair is weak here; many hands beat it.",
        improve: "Before betting, count which hands beat you on this board.",
        keyMoment: true,
        highlight: { x: 0.13, y: 0.62, w: 0.6, h: 0.11, label: "Flush + straight + full house possible" },
        speak: "Look at the board. Three clubs, ace two three, and a pair. Lots of strong hands are possible here.",
      },
      {
        t: at(0.45),
        title: "Raise $400 on the turn",
        whatsHappening: "He puts in $400 on this board (the overlay calls it a raise).",
        whyItMatters: "Betting big on a board like this tells the opponent 'I have a flush or better' — true or as a bluff.",
        risk: "If he has a small flush, a bigger flush or a full house still beats him.",
        improve: "Size the bet based on which worse hands can call, not just how strong you feel.",
        keyMoment: false,
        highlight: { x: 0.3, y: 0.39, w: 0.26, h: 0.13, label: "Raise $400" },
        speak: "He raises four hundred. On this board that represents a flush or better.",
      },
      {
        t: at(0.7),
        title: "River 9♦ — a blank",
        whatsHappening: "The river is the 9♦. The pot has grown to $3,325, so more money went in after the turn.",
        whyItMatters: "A 'blank' card changes nothing: no new flush, straight or pair. The decision is all about reading the opponent.",
        risk: "",
        improve: "",
        keyMoment: false,
        highlight: { x: 0.33, y: 0.6, w: 0.34, h: 0.13, label: "9♦ changes nothing" },
        speak: "Nine of diamonds on the river. A blank. Nothing changed.",
      },
      {
        t: at(0.78),
        title: "Six-minute tank",
        whatsHappening: "The editor adds a sunset clip with '6 minutes pass…': the opponent thinks for about six minutes. Our player sits relaxed, chin on hand.",
        whyItMatters: "This is the point of the video: a good player stays calm and looks the same whether strong or bluffing, so he gives no tells.",
        risk: "Six minutes is very long; in a live room anyone can 'call the clock' to put a time limit on the decision.",
        improve: "Keep your posture and routine identical every hand so nothing gives you away.",
        keyMoment: true,
        highlight: { x: 0.36, y: 0.12, w: 0.3, h: 0.3, label: "Calm = no tells" },
        speak: "Six minutes go by. Watch him. Totally relaxed. That's the sign of a good player — no tells.",
      },
    ],
    summary: {
      whatHappened:
        "He raised pre-flop, kept betting on a board where flushes, straights and full houses were possible, and stayed composed while his opponent took a very long time on the river.",
      risks: [
        "Connected, paired, three-flush boards make medium-strength hands weak.",
        "Big bets on scary boards cost a lot when you are behind.",
        "Real money: a $3,000+ pot — set a strict bankroll limit if you play.",
      ],
      improvements: [
        "Count the hands that beat you before betting.",
        "Keep a consistent routine so your body language gives nothing away.",
        "Know table etiquette like calling the clock on very long decisions.",
      ],
    },
    quiz: [
      {
        question: "On a board of 3♣ 2♣ 2♦ A♣, which hand is the best possible?",
        options: ["K♣ Q♣ (king-high flush)", "4♣ 5♣ (straight flush)", "A♦ A♥ (aces full)", "2♥ 2♠ (four twos)"],
        answerIndex: 1,
        explanation: "4♣5♣ makes A-2-3-4-5 all in clubs: a straight flush, which beats four of a kind.",
      },
      {
        question: "What is a 'blank' river card?",
        options: ["A card that completes a flush", "A card that changes nothing important", "A card that pairs the board", "A face-down card"],
        answerIndex: 1,
        explanation: "A blank doesn't create new flushes, straights or pairs, so hand strengths stay the same.",
      },
      {
        question: "Why does the video call the relaxed player 'a good poker player'?",
        options: ["He bet the most money", "He stayed composed and gave away no tells", "He thought for six minutes", "He won every hand"],
        answerIndex: 1,
        explanation: "Staying calm and consistent while the opponent thinks means he gives no physical clues about his hand.",
      },
    ],
  };
}

type MockAnswerParams = { request: AskRequest };

export function mockAnswer({ request }: MockAnswerParams): string {
  return `(demo mode) Good question — "${request.question}". At ${request.t.toFixed(0)}s the key idea is: count which hands beat you on this board before putting more money in. Run the server without MOCK=1 and with an API key to get real answers.`;
}
