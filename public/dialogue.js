/**
 * Browser copy of the dialogue logic used by the Test Call demo.
 * It mirrors lib/dialogue.js + config.js on the server so the demo behaves
 * like a real phone call. Keep the FAQ list in sync with config.js.
 */
(function (global) {
  'use strict';

  var FAQS = [
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
  ];

  var DONE_PHRASES = [
    'no', 'no thanks', 'no thank you', 'nothing', 'nothing else', 'that is all',
    "that's all", 'no more', 'bas', 'nahi', 'nahin', 'bye', 'goodbye', 'thank you bye',
  ];

  function normalise(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[?!.,;:"'()\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchFaq(text) {
    var t = normalise(text);
    for (var i = 0; i < FAQS.length; i++) {
      for (var j = 0; j < FAQS[i].keywords.length; j++) {
        if (t.indexOf(normalise(FAQS[i].keywords[j])) !== -1) {
          return { id: FAQS[i].id, answer: FAQS[i].answer };
        }
      }
    }
    return null;
  }

  function isDone(text) {
    var t = normalise(text);
    if (!t) return false;
    if (t.indexOf('goodbye') !== -1 || t === 'bye' || / bye$/.test(t)) return true;
    return DONE_PHRASES.some(function (p) { return t === p || t.indexOf(p + ' ') === 0; });
  }

  function extractName(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var patterns = [
      /my name is\s+(.+)/i,
      /(?:i am|i'm|this is|it is|it's)\s+(.+)/i,
      /(?:myself|mera naam)\s+(.+)/i,
      /(.+?)\s+(?:speaking|here|bol raha|bol rahi)/i,
    ];
    var candidate = raw;
    for (var i = 0; i < patterns.length; i++) {
      var m = raw.match(patterns[i]);
      if (m) { candidate = m[1]; break; }
    }
    candidate = candidate
      .replace(/[.!?,]+$/g, '')
      .replace(/\b(sir|madam|ji|please|from|calling)\b.*$/i, '')
      .replace(/\s+(speaking|here)$/i, '')
      .trim();
    var words = candidate.split(/\s+/).filter(Boolean);
    if (words.length > 3) return '';
    return words
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join(' ');
  }

  global.CharcoDialogue = {
    FAQS: FAQS,
    normalise: normalise,
    matchFaq: matchFaq,
    isDone: isDone,
    extractName: extractName,
    LINES: {
      greeting:
        "Hello, and thank you for calling. This is Charco, Miller's assistant. " +
        'Miller is not available to take the call right now, but I can help you, or take a message for him.',
      askName: 'May I please know your name?',
      askPurpose: function (name) {
        return (
          'Thank you' + (name ? ', ' + name : '') +
          '. How may I help you today? You can ask me a question, or simply tell me your message for Miller.'
        );
      },
      askAnythingElse: 'Is there anything else I can help you with?',
      messageTaken: function (name) {
        return (
          'Thank you' + (name ? ', ' + name : '') +
          '. I have noted your message and will pass it to Miller as soon as possible.'
        );
      },
      goodbye: 'Thank you for calling. Have a great day. Goodbye.',
    },
  };
})(window);
