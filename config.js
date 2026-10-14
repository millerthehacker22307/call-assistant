'use strict';
/**
 * Charco Call Assistant — editable settings.
 *
 * Everything the assistant SAYS is configured here, so Miller can change the
 * wording without touching any logic. All spoken lines are polished English
 * by default (owner preference for products). A couple of natural Hinglish
 * greeting variants are kept as comments at the bottom of this file — swap
 * the `greeting` string with one of them if a warmer desi tone is ever wanted.
 */

module.exports = {
  assistantName: 'Charco Call Assistant',
  assistantShortName: 'Charco',
  ownerName: 'Miller',

  // Twilio/Polly voices. Hindi text (Devanagari) automatically uses the
  // Hindi voice; everything else uses the Indian-English voice. See
  // `say()` in server.js — that is the en-IN fallback handling.
  voice: {
    hindi: { voice: 'Polly.Aditi', language: 'hi-IN' },
    english: { voice: 'Polly.Kajal', language: 'en-IN' },
  },
  // Language hint given to Twilio's speech recogniser (<Gather>).
  gatherLanguage: 'hi-IN',

  businessHours: '9 AM to 9 PM, Monday to Saturday',

  greeting:
    "Hello, and thank you for calling. This is Charco, Miller's assistant. " +
    'Miller is not available to take the call right now, but I can help you, or take a message for him.',

  askName: 'May I please know your name?',
  askPurpose: (name) =>
    `Thank you${name ? ', ' + name : ''}. How may I help you today? You can ask me a question, or simply tell me your message for Miller.`,
  askAnythingElse: 'Is there anything else I can help you with?',
  messageTaken: (name) =>
    `Thank you${name ? ', ' + name : ''}. I have noted your message and will pass it to Miller as soon as possible.`,
  goodbye: 'Thank you for calling. Have a great day. Goodbye.',
  noInput:
    "I'm sorry, I could not hear you. Please call again, or leave your message when you call back. Goodbye.",
  fallback:
    "I may not have the answer to that one, but I am happy to take a message and pass it to Miller.",

  outboundIntro:
    "Hello, this is Charco, calling on behalf of Miller. I have a quick enquiry, please.",
  outboundThanks:
    'Thank you for the information. I will pass this to Miller. Have a great day. Goodbye.',

  /**
   * FAQ intents. The dialogue manager (lib/dialogue.js) matches the caller's
   * speech against `keywords` (simple substring/word matching — no external
   * AI key needed). Add new entries here and both the phone flow and the
   * browser Test Call demo pick them up (demo data lives in
   * public/dialogue.js and mirrors this list).
   */
  faqs: [
    {
      id: 'who-is-this',
      keywords: ['who is this', 'who are you', 'your name', 'kaun bol raha', 'who is speaking'],
      answer:
        "I am Charco, Miller's virtual assistant. I answer calls on his behalf, help with basic questions, and take messages for him.",
    },
    {
      id: 'where-is-miller',
      keywords: ['where is miller', 'is miller there', 'talk to miller', 'speak to miller', 'miller available', 'miller hai'],
      answer:
        'Miller is not available on a call right now. If you tell me your message, I will make sure he receives it right after this call.',
    },
    {
      id: 'what-do-you-do',
      keywords: ['what do you do', 'what does miller do', 'services', 'your work', 'what is this about', 'offer'],
      answer:
        'Miller works on websites and digital projects for local businesses, and this assistant helps him stay reachable. For anything specific, please leave a message and he will get back to you.',
    },
    {
      id: 'timings',
      keywords: ['timing', 'timings', 'what time', 'when are you open', 'open', 'hours', 'kab khulta', 'working hours'],
      answer: 'Our usual hours are 9 AM to 9 PM, Monday to Saturday.',
    },
    {
      id: 'price',
      keywords: ['price', 'cost', 'charge', 'rate', 'how much', 'fees', 'quote', 'quotation'],
      answer:
        'Pricing depends on the exact requirement. If you leave your name, number, and what you need, Miller will share a proper quote with you personally.',
    },
    {
      id: 'location',
      keywords: ['location', 'address', 'where are you', 'where is the office', 'kahan', 'situated'],
      answer:
        'We are based in Lucknow. For the exact address or a meeting, please leave a message and Miller will confirm it with you directly.',
    },
    {
      id: 'callback',
      keywords: ['call back', 'callback', 'call me', 'ring me', 'get back'],
      answer:
        'Of course. I will note that you would like a call back. Please also tell me the best time, and Miller will call you.',
    },
  ],
};

/* Hinglish greeting variants (optional — not used by default):
 * 1) "Namaste! Main Charco bol raha hoon, Miller ka assistant. Miller abhi call pe available nahi hain, lekin aap apna message bata sakte hain, main unhe de dunga."
 * 2) "Hello ji, Charco this side — Miller ke assistant. Aap apna naam aur kaam bata dijiye, baaki main sambhal lunga."
 */
