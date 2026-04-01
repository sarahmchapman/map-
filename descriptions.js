// elsewhere — astrocartography
// Pre-generated reading descriptions
// 40 base descriptions (planet x angle) + 120 sign modifiers (planet x sign)

var SIGN_MODIFIERS={
  Sun:{
    Aries:"With the Sun in Aries, this visibility carries real fire — you're seen as bold, pioneering, and willing to go first. This place rewards your directness.",
    Taurus:"With the Sun in Taurus, your presence here is grounded and magnetic — people sense your steadiness and are drawn to your quiet confidence.",
    Gemini:"With the Sun in Gemini, your identity here is versatile and curious — you're seen as quick, engaging, and full of ideas worth hearing.",
    Cancer:"With the Sun in Cancer, your light here is warm and nurturing — people sense your emotional depth and feel safe in your presence.",
    Leo:"With the Sun in Leo, this line amplifies your natural radiance — here, your warmth and creative confidence tend to shine without effort.",
    Virgo:"With the Sun in Virgo, your visibility here comes through precision and service — people recognise you for your integrity and the quality of your work.",
    Libra:"With the Sun in Libra, your presence here is graceful and relational — you're seen as fair, refined, and someone others want to collaborate with.",
    Scorpio:"With the Sun in Scorpio, your light here runs deep — people sense something powerful and intentional in you, even before you speak.",
    Sagittarius:"With the Sun in Sagittarius, your identity here is expansive and philosophical — you're seen as someone with vision, freedom, and a story worth hearing.",
    Capricorn:"With the Sun in Capricorn, your presence here carries authority — people sense your ambition and respect your capacity to build something real.",
    Aquarius:"With the Sun in Aquarius, your visibility here is distinctive and forward-thinking — you stand out as original, and people are drawn to your perspective.",
    Pisces:"With the Sun in Pisces, your light here is compassionate and dreamy — people sense your depth and spiritual openness, which draws them to you in unexpected ways."
  },
  Moon:{
    Aries:"With the Moon in Aries, your emotional world here is energised and instinctive — you feel more reactive and alive, your gut leading the way.",
    Taurus:"With the Moon in Taurus, this place soothes something deep in you — comfort, beauty, and a sense of physical belonging come more easily here.",
    Gemini:"With the Moon in Gemini, your emotional life here is restless and curious — conversations and connections nourish you in this place.",
    Cancer:"With the Moon in Cancer, this is one of the most powerful homecoming lines possible — your emotional roots feel genuinely held here.",
    Leo:"With the Moon in Leo, you need to be seen and appreciated here to feel at home — when that happens, you flourish in this place.",
    Virgo:"With the Moon in Virgo, your emotional wellbeing here is tied to routine, usefulness, and the small details that make a place feel safe.",
    Libra:"With the Moon in Libra, your inner peace here depends on harmony and connection — beautiful spaces and kind people nourish you deeply.",
    Scorpio:"With the Moon in Scorpio, this place stirs something ancient in you — emotional intensity, transformation, and deep truth-seeking are all amplified.",
    Sagittarius:"With the Moon in Sagittarius, you feel most at home when there's freedom and possibility here — this place can feel like an adventure for the soul.",
    Capricorn:"With the Moon in Capricorn, your emotional security here comes through structure and purpose — having a clear role or goal makes this place feel right.",
    Aquarius:"With the Moon in Aquarius, you feel most yourself here when you're connected to community and ideas that matter beyond the personal.",
    Pisces:"With the Moon in Pisces, this place can feel like a spiritual homecoming — your emotional boundaries soften and you feel more connected to everything."
  },
  Mercury:{
    Aries:"With Mercury in Aries, your voice here is direct and immediate — you say what you mean, and people respect the clarity.",
    Taurus:"With Mercury in Taurus, your communication here is measured and trustworthy — people listen because you speak with conviction and patience.",
    Gemini:"With Mercury in Gemini, this line gives your already quick mind an extra spark — you're at your most articulate and intellectually alive here.",
    Cancer:"With Mercury in Cancer, your communication here is emotionally intuitive — you say what people need to hear, not just what they expect.",
    Leo:"With Mercury in Leo, your voice here carries natural authority and warmth — people are drawn to how you tell a story.",
    Virgo:"With Mercury in Virgo, your thinking here is precise and analytical — this is a powerful place for detailed work, research, or any craft requiring accuracy.",
    Libra:"With Mercury in Libra, your communication here is diplomatic and considered — you have a gift for finding the right words in this place.",
    Scorpio:"With Mercury in Scorpio, your voice here cuts to the core — people are struck by how precisely you name what others leave unspoken.",
    Sagittarius:"With Mercury in Sagittarius, your communication here is expansive and inspiring — you think in big pictures and people are energised by your vision.",
    Capricorn:"With Mercury in Capricorn, your thinking here is structured and strategic — this place sharpens your capacity to communicate with authority.",
    Aquarius:"With Mercury in Aquarius, your mind here is at its most original — unconventional ideas and forward-thinking conversations come naturally.",
    Pisces:"With Mercury in Pisces, your communication here is poetic and impressionistic — you speak to people's imagination and inner world."
  },
  Venus:{
    Aries:"With Venus in Aries, your magnetism here is bold and immediate — you attract through directness and the thrill of the chase.",
    Taurus:"With Venus in Taurus, your appeal here is sensual and steady — people are drawn to your beauty, reliability, and the pleasure you bring to ordinary things.",
    Gemini:"With Venus in Gemini, you attract through wit and variety here — connection feels playful, and you're at your most charming and socially alive.",
    Cancer:"With Venus in Cancer, your appeal here is nurturing and emotionally rich — people feel deeply cared for in your presence.",
    Leo:"With Venus in Leo, your magnetism here is radiant and generous — you love boldly and others feel genuinely celebrated around you.",
    Virgo:"With Venus in Virgo, your appeal here comes through thoughtfulness and refinement — small acts of care and attention make you unforgettable.",
    Libra:"With Venus in Libra, this line is at its most powerful for you — grace, beauty, and genuine connection flow with remarkable ease here.",
    Scorpio:"With Venus in Scorpio, this magnetism runs deep rather than wide — you draw people in through intensity and mystery rather than easy charm.",
    Sagittarius:"With Venus in Sagittarius, your appeal here is adventurous and free-spirited — people are drawn to your openness and love of experience.",
    Capricorn:"With Venus in Capricorn, your magnetism here is understated but lasting — people sense your loyalty and the depth of what you offer.",
    Aquarius:"With Venus in Aquarius, your appeal here is original and refreshingly unconventional — you attract people who value freedom and authenticity.",
    Pisces:"With Venus in Pisces, your magnetism here is ethereal and deeply romantic — people sense something otherworldly and compassionate in you."
  },
  Mars:{
    Aries:"With Mars in Aries, this line puts you at your most powerful and direct — you act without hesitation and others feel your energy immediately.",
    Taurus:"With Mars in Taurus, your drive here is slow-burning and persistent — you accomplish more through steady effort than sudden bursts.",
    Gemini:"With Mars in Gemini, your energy here is scattered but quick — you excel at starting multiple things and keeping the momentum alive through variety.",
    Cancer:"With Mars in Cancer, you fight hardest here for what you love — your drive is protective and emotionally motivated rather than purely competitive.",
    Leo:"With Mars in Leo, your ambition here has genuine flair — you don't just want to succeed, you want to be remembered for it.",
    Virgo:"With Mars in Virgo, your drive here is precise and methodical — you accomplish the most when you focus on craft and execution rather than recognition.",
    Libra:"With Mars in Libra, your energy here is best channelled through collaboration and strategy — you're most effective when working with others toward a shared goal.",
    Scorpio:"With Mars in Scorpio, your power here is intense and focused — you pursue what you want with a quiet determination that rarely fails.",
    Sagittarius:"With Mars in Sagittarius, your energy here is optimistic and expansive — you're driven by belief in a bigger picture and others catch fire from your enthusiasm.",
    Capricorn:"With Mars in Capricorn, this is one of your most powerful career lines — disciplined ambition meets real-world opportunity here.",
    Aquarius:"With Mars in Aquarius, your drive here is original and future-oriented — you're most energised when working toward something that genuinely matters beyond yourself.",
    Pisces:"With Mars in Pisces, your energy here is fluid and intuitive — you're most effective when you trust your instincts rather than forcing a plan."
  },
  Jupiter:{
    Aries:"With Jupiter in Aries, expansion here comes through bold action and initiative — the more you lead, the more this place rewards you.",
    Taurus:"With Jupiter in Taurus, abundance here is sensory and material — comfort, beauty, and financial growth all tend to flow more easily in this place.",
    Gemini:"With Jupiter in Gemini, growth here comes through learning and connection — new ideas, new people, and new conversations open unexpected doors.",
    Cancer:"With Jupiter in Cancer, this place offers a rare combination of expansion and belonging — you can grow here without losing your emotional roots.",
    Leo:"With Jupiter in Leo, this line amplifies your natural generosity and creative confidence — recognition and joy tend to arrive in abundance here.",
    Virgo:"With Jupiter in Virgo, growth here comes through mastery and service — the more carefully and helpfully you work, the more this place opens for you.",
    Libra:"With Jupiter in Libra, relationships and partnerships are the main vehicle for expansion here — the right connection can change everything.",
    Scorpio:"With Jupiter in Scorpio, growth here tends to be deep rather than wide — transformation, inheritance, and hidden resources can all expand here.",
    Sagittarius:"With Jupiter in Sagittarius, this is one of your most expansive lines — freedom, philosophy, and genuine good fortune tend to flow naturally here.",
    Capricorn:"With Jupiter in Capricorn, growth here is earned through discipline — the rewards may come slowly but they tend to be lasting and significant.",
    Aquarius:"With Jupiter in Aquarius, expansion here comes through community and innovation — connecting with like-minded people opens doors that wouldn't open elsewhere.",
    Pisces:"With Jupiter in Pisces, this place offers spiritual abundance and creative inspiration — your imagination and compassion find real-world expression here."
  },
  Saturn:{
    Aries:"With Saturn in Aries, this place asks you to slow down and earn your authority rather than claim it — patience here builds something genuinely yours.",
    Taurus:"With Saturn in Taurus, the work here is material and long-term — building financial security or a lasting physical home is supported by this line.",
    Gemini:"With Saturn in Gemini, this place sharpens your mind through discipline — structured learning, serious writing, or mastering a skill comes with real reward here.",
    Cancer:"With Saturn in Cancer, the inner work here involves confronting old emotional patterns — this place asks you to become your own foundation.",
    Leo:"With Saturn in Leo, this place asks you to earn recognition rather than seek it — the authority you build here through genuine effort tends to last.",
    Virgo:"With Saturn in Virgo, mastery here comes through precision and service — the most demanding work also brings the most lasting satisfaction.",
    Libra:"With Saturn in Libra, this place tests the quality of your commitments — relationships and partnerships here are serious but potentially enduring.",
    Scorpio:"With Saturn in Scorpio, this place asks for deep psychological honesty — confronting what's buried is the price of the power available here.",
    Sagittarius:"With Saturn in Sagittarius, growth here requires real conviction — not borrowed beliefs, but a philosophy you've actually lived and tested.",
    Capricorn:"With Saturn in Capricorn, this is one of your most powerful lines for career and legacy — discipline and ambition are rewarded here more than anywhere.",
    Aquarius:"With Saturn in Aquarius, structure here serves a larger purpose — building systems or communities that outlast you feels both meaningful and possible.",
    Pisces:"With Saturn in Pisces, this place asks you to ground your dreams in reality — the work of making something spiritual or artistic into something tangible."
  },
  Uranus:{
    Aries:"With Uranus in Aries, disruption here is fast and bold — expect sudden shifts in direction that ultimately free you from what was holding you back.",
    Taurus:"With Uranus in Taurus, change here is slow but seismic — deeply held material or physical patterns can transform completely in this place.",
    Gemini:"With Uranus in Gemini, your thinking here is electric and unpredictable — ideas arrive from nowhere, connections form in unexpected ways.",
    Cancer:"With Uranus in Cancer, this place can liberate you from inherited emotional patterns — the freedom here is personal and often surprising.",
    Leo:"With Uranus in Leo, your creative self is awakened here — you express yourself in ways that feel original, even shocking, and fully alive.",
    Virgo:"With Uranus in Virgo, this place disrupts the ordinary rhythms of work and health — inviting more innovative approaches to how you live and serve.",
    Libra:"With Uranus in Libra, relationships here break from convention — you attract unusual connections and are freed from old relational patterns.",
    Scorpio:"With Uranus in Scorpio, transformation here is sudden and complete — power structures and psychological patterns can shift overnight.",
    Sagittarius:"With Uranus in Sagittarius, freedom here is philosophical and adventurous — your beliefs can expand or overturn entirely in this place.",
    Capricorn:"With Uranus in Capricorn, conventional career paths may feel impossible here — and that's the invitation to build something entirely your own.",
    Aquarius:"With Uranus in Aquarius, this line is at its most alive — innovation, community, and radical originality all feel completely natural here.",
    Pisces:"With Uranus in Pisces, liberation here comes through spiritual practice, creative surrender, or dissolving boundaries that no longer serve you."
  },
  Neptune:{
    Aries:"With Neptune in Aries, your idealism here is fired by passion — the dreams that come alive in this place tend to feel like missions.",
    Taurus:"With Neptune in Taurus, beauty and the physical world carry spiritual weight here — art, nature, and the body become pathways to the transcendent.",
    Gemini:"With Neptune in Gemini, ideas and communication take on a dreamlike quality here — inspiration flows, though focus may require effort.",
    Cancer:"With Neptune in Cancer, this place can feel deeply ancestral and emotionally sacred — a homecoming of the soul rather than just the body.",
    Leo:"With Neptune in Leo, creativity and self-expression here carry a transcendent quality — art made in this place tends to touch something universal.",
    Virgo:"With Neptune in Virgo, the spiritual finds expression through service and craft here — devotion to the work itself becomes a form of practice.",
    Libra:"With Neptune in Libra, relationships here carry an idealised, romantic quality — beautiful and potentially transcendent, though requiring grounding.",
    Scorpio:"With Neptune in Scorpio, this place deepens already profound emotional undercurrents — mysticism, shadow work, and deep healing are all amplified.",
    Sagittarius:"With Neptune in Sagittarius, the spiritual here is expansive and philosophical — a sense of larger meaning pervades your experience of this place.",
    Capricorn:"With Neptune in Capricorn, the spiritual finds form through structure here — building something that serves a higher purpose feels both possible and meaningful.",
    Aquarius:"With Neptune in Aquarius, collective idealism and humanitarian vision flow through this place — you sense what's possible for everyone, not just yourself.",
    Pisces:"With Neptune in Pisces, this line is at its most profound — the veil between ordinary and transcendent experience is thinner here than almost anywhere."
  },
  Pluto:{
    Aries:"With Pluto in Aries, transformation here is fierce and immediate — old identities burn away quickly and what emerges is stronger and more authentic.",
    Taurus:"With Pluto in Taurus, transformation here is slow but total — material security, values, and physical reality can all be fundamentally restructured.",
    Gemini:"With Pluto in Gemini, this place transforms how you think and communicate — old mental patterns dissolve and something more powerful takes their place.",
    Cancer:"With Pluto in Cancer, the deepest family wounds and ancestral patterns surface here for healing — this is profound and often cathartic territory.",
    Leo:"With Pluto in Leo, this place confronts you with questions of ego, power, and authentic self-expression — what survives the fire here is genuinely yours.",
    Virgo:"With Pluto in Virgo, transformation here comes through the body, work, and daily life — a complete overhaul of how you live and what you devote yourself to.",
    Libra:"With Pluto in Libra, relationships here carry transformative intensity — old relational patterns die and something more honest and equal can emerge.",
    Scorpio:"With Pluto in Scorpio, this is one of the most intense lines possible — death, rebirth, power, and shadow are all fully activated in this place.",
    Sagittarius:"With Pluto in Sagittarius, beliefs and philosophies are transformed here — what you thought you knew about meaning and truth may be completely remade.",
    Capricorn:"With Pluto in Capricorn, this place dismantles structures that no longer serve — professional ambitions, authority, and legacy are all up for transformation.",
    Aquarius:"With Pluto in Aquarius, collective transformation is possible here — you sense the need for radical change and may become part of bringing it about.",
    Pisces:"With Pluto in Pisces, the deepest layers of the unconscious are stirred here — spiritual dissolution and regeneration at the soul level are both possible."
  }
};
var LINE_ACTIVATED={
  Sun:{
    MC:"In this place, the Sun crowns your public life — your sense of purpose and identity shines most visibly here. Career opportunities tend to find you, and you're more likely to be seen, recognised, and respected for who you truly are. This is one of the strongest lines for stepping into a leadership role or building a legacy.",
    IC:"The Sun roots itself deep in your private world here — this place can feel like home in a profound way, as if something essential about you is mirrored back by the land and its people. Family life, self-understanding, and your relationship with your own history tend to deepen here.",
    ASC:"You arrive as yourself here. The Sun on your Ascendant means your vitality, confidence, and core identity are right on the surface — people see you clearly, and you feel more alive and present than usual. This is a powerful line for self-expression, visibility, and stepping into your own light.",
    DSC:"The Sun illuminates your relationships here — you're drawn to partners who embody warmth, confidence, or creative fire. This place tends to attract significant people into your life, and one-on-one connections carry more weight and meaning here than elsewhere."
  },
  Moon:{
    MC:"The Moon on your Midheaven here brings your emotional world into public view — your career may involve nurturing, caretaking, or working with the public in an intimate way. You may feel more emotionally visible here, which can be both vulnerable and deeply rewarding.",
    IC:"Few lines feel as homelike as the Moon IC. This place tends to feel deeply familiar, almost ancestral — as if your emotional roots belong here. Family life, private retreat, and inner healing are all supported. Many people feel more themselves here than anywhere else.",
    ASC:"You come across as warm, intuitive, and deeply human here. The Moon on your Ascendant means others sense your emotional openness immediately — this can draw people to you or make you feel more emotionally exposed than usual. A powerful place for empathy, creativity, and connection.",
    DSC:"Relationships here tend to be emotionally rich and nurturing. You may attract partners who are caring and intuitive, or find that existing relationships deepen into something more tender and vulnerable. This place softens the edges between you and those you love."
  },
  Mercury:{
    MC:"Mercury on the Midheaven sharpens your professional voice here — writing, speaking, teaching, media, or any work that requires clear communication tends to flourish. You're more articulate and quick-thinking in public here, and your ideas are more likely to be heard and valued.",
    IC:"Your mind becomes reflective and inward here. Mercury IC is a good line for journaling, study, processing old memories, or having important conversations with family. You may find yourself thinking more deeply about your roots and the stories you carry.",
    ASC:"You come across as sharp, curious, and communicative here — people want to talk to you. Mercury on the Ascendant gives your presence an animated, mentally engaged quality. This is a great line for networking, learning, meeting new people, and environments that reward quick thinking.",
    DSC:"Conversations matter more here. Mercury on the Descendant draws you toward mentally stimulating partners and collaborators — people who challenge your thinking and keep you engaged. Contracts, negotiations, and intellectual partnerships tend to go well in this place."
  },
  Venus:{
    MC:"In this place, Venus crowns your public life — you may find yourself drawn to creative work, beauty, or people-focused roles that feel genuinely fulfilling. Others tend to perceive you as charming and magnetic here. A strong placement for visibility in the arts, design, fashion, or anything that requires grace under a public eye.",
    IC:"Venus at the base of your chart here softens your private world — home feels beautiful, family relationships carry more ease and affection, and you may find a deep aesthetic pleasure in the land itself. This is a cherished line for creating a sanctuary and feeling genuinely at peace.",
    ASC:"You arrive differently here — more magnetic, more at ease in your skin. Venus on your Ascendant means others are drawn to you, and you to them. Beauty seems to find you here. Romance, creativity, and social ease all flow more naturally in this place.",
    DSC:"Relationships bloom here — Venus on the Descendant is one of the most celebrated lines for love and meaningful partnership. You may meet someone significant, feel a deepened attraction to a current partner, or simply find that people here appreciate and reflect your value back to you."
  },
  Mars:{
    MC:"Mars drives your ambitions to the surface here — this is a powerful line for career momentum, taking bold professional risks, and being seen as someone who gets things done. Competition tends to sharpen you rather than drain you. Strong for entrepreneurship, athletics, or any field that rewards initiative.",
    IC:"Mars at the root of the chart here can stir things up at home — this place may bring up old family tensions, a drive to renovate or rebuild, or a fierce protectiveness of your private space. It's a line that demands honesty about where you come from and what you're building.",
    ASC:"You arrive differently here. Mars on the Ascendant charges your physical presence — people notice you, you feel more driven and direct, and life tends to move faster. This place wakes something up in you. Great for starting things, taking bold action, or physical pursuits — though conflict can come more easily too.",
    DSC:"Relationships here carry more intensity — passion, friction, and chemistry all run hotter. Mars on the Descendant can attract bold, driven partners, but it can also bring power struggles. This is a place where relationships push you to grow through honest confrontation and genuine desire."
  },
  Jupiter:{
    MC:"Jupiter expands everything it touches here, and on the Midheaven that means your career and public reputation. Opportunities tend to arrive more easily, doors open that stay closed elsewhere, and others perceive you as someone worth investing in. One of the most celebrated lines for professional growth and recognition.",
    IC:"In this place, Jupiter expands your sense of home and belonging. You may find it easier to put down roots here, feel a deep sense of abundance in your private life, or experience a profound connection to the land and its people. Family life tends to flourish, and there's often a feeling of being held by something larger than yourself.",
    ASC:"Jupiter on your Ascendant here is one of the most expansive lines there is — you feel more optimistic, more open, more like your best self. Others perceive you as generous and full of life. Travel, learning, and new possibilities tend to come easily. This place simply feels good.",
    DSC:"Relationships expand in this place. You may meet people who feel larger than life, find yourself drawn into partnerships that open new worlds, or attract a partner who embodies abundance and optimism. This is one of the most celebrated lines for love and meaningful connection."
  },
  Saturn:{
    MC:"Saturn on the Midheaven here asks something of you — this place tends to bring serious professional ambition, a desire to build something lasting, or a confrontation with authority and structure. Recognition comes slowly but it sticks. This isn't an easy line, but it's one of the most powerful for long-term career building.",
    IC:"Saturn at the root of the chart here calls you to do serious inner work — confronting family patterns, building genuine emotional foundations, or sitting with parts of your history that need to be acknowledged. This place asks for depth and honesty. What you build here tends to last.",
    ASC:"Saturn on your Ascendant here gives you a certain gravity — people perceive you as serious, reliable, and grounded. You may feel more self-disciplined and focused here, but also more aware of your limitations. This place tends to reward commitment and patience over spontaneity.",
    DSC:"Relationships here tend to be serious and long-lasting — Saturn on the Descendant draws you toward partners who are dependable and mature, or brings a sobering quality to existing partnerships. This is a place where commitment is tested and, if it holds, becomes something truly solid."
  },
  Uranus:{
    MC:"Uranus on the Midheaven here can completely reshape your sense of career and calling — expect the unexpected professionally, a sudden change of direction, or a pull toward unconventional work. This is a powerful line for innovation, disruption, and breaking free from a path that no longer fits.",
    IC:"Uranus at the base of the chart here can feel unsettling at first — home life may be unpredictable, or you may find it hard to stay put. But for the right person, this line brings liberation from old family patterns and a radical sense of inner freedom. It shakes things loose.",
    ASC:"You come across as electric here — original, unpredictable, and alive with ideas. Uranus on the Ascendant means you don't quite fit the expected mould in this place, and that can be exhilarating. People find you fascinating. This is a strong line for reinvention and living outside convention.",
    DSC:"Relationships here are anything but predictable — Uranus on the Descendant attracts unconventional partners, open arrangements, or sudden and electric connections. This place challenges your assumptions about what love and partnership should look like. Freeing, if sometimes unstable."
  },
  Neptune:{
    MC:"Neptune on the Midheaven here dissolves the edges of your public identity — your calling here tends to be spiritual, artistic, or service-oriented. You may feel drawn toward healing, music, film, or any work that requires surrender to something beyond the self. Inspiration flows, but so does confusion about direction.",
    IC:"Neptune at the root of your chart here gives home a dreamy, almost otherworldly quality. This place can feel deeply healing and spiritually resonant — as if you've arrived somewhere your soul recognises. A beautiful line for retreat, creative solitude, and connecting to what's sacred in your private life.",
    ASC:"You arrive softly here — Neptune on the Ascendant gives you a certain ethereal quality that others find both magnetic and mysterious. You may feel more open, more permeable, more attuned to the invisible currents of a place. Beautiful for spiritual practice, creativity, and compassion, though boundaries can thin.",
    DSC:"Relationships here carry a spiritual or romantic depth that can feel transcendent — Neptune on the Descendant dissolves the usual distance between you and others, creating a sense of deep soul connection. But it can also blur what's real. Idealism in love runs high here; so does the capacity for genuine compassion."
  },
  Pluto:{
    MC:"Pluto on the Midheaven here is one of the most transformative career lines there is — this place tends to bring a complete reinvention of your public identity, a confrontation with power, or a calling toward work that involves depth, shadow, or radical change. Not easy, but unforgettable.",
    IC:"Pluto at the root of the chart here reaches into the deepest layers of who you are — old wounds, ancestral patterns, and buried truths tend to surface in this place. This is powerful territory for shadow work and genuine psychological transformation. What you heal here goes all the way down.",
    ASC:"Your presence carries real intensity here — Pluto on the Ascendant means people feel your depth before you say a word. This place tends to bring profound personal transformation, a shedding of old identities, and an encounter with your own power. Not always comfortable, but deeply revelatory.",
    DSC:"Relationships in this place tend to be transformative and intense — Pluto on the Descendant draws you toward partners who challenge you at the deepest level, or brings existing relationships into a crucible of change. Power dynamics, obsession, and profound soul-level bonding are all possible here."
  }
};


// Best for: 40 planet x angle descriptions
var BEST_FOR={
  "Sun":{
    "MC":"Places where your identity and career can fully align \u2014 cities that reward leadership, visibility, and genuine authority. This line supports being recognised not just for what you do but for who you are. Strong for building a public reputation that actually reflects your values.",
    "IC":"Putting down deep roots in a place that feels ancestrally right \u2014 somewhere your private self can fully exhale. This line supports healing your relationship with your origins, creating a home that genuinely reflects who you are, and doing the inner work that makes everything else possible.",
    "ASC":"Anywhere you want to arrive as yourself \u2014 fully seen, fully present, fully alive. This line puts your core identity right on the surface, making it ideal for new beginnings, bold self-expression, and environments where your confidence can set the tone.",
    "DSC":"Significant one-on-one relationships \u2014 romantic, professional, or creative \u2014 where both people show up as equals. This line draws people toward you who can genuinely see and reflect your light. Strong for partnerships built on mutual recognition."
  },
  "Moon":{
    "MC":"Careers that involve genuine human connection \u2014 counselling, teaching, caretaking, the arts, or any public role where emotional intelligence is the real skill. This line supports being known for your empathy and depth, not just your output.",
    "IC":"The deepest kind of homecoming \u2014 a place where your emotional body finally relaxes. This line is ideal for healing, retreat, family reconnection, and building a private life that genuinely nourishes you. Many people feel more themselves here than anywhere else.",
    "ASC":"Environments where emotional openness is an asset \u2014 creative communities, healing spaces, intimate gatherings. This line makes you deeply approachable and draws people who want real connection rather than surface engagement.",
    "DSC":"Emotionally rich partnerships where both people feel genuinely held. This line draws nurturing, intuitive people toward you and supports relationships built on real care. Strong for deepening existing bonds or finding someone who truly gets you."
  },
  "Mercury":{
    "MC":"Cities with strong intellectual, media, or communications cultures \u2014 places where ideas and words carry real weight. This line supports writing, speaking, teaching, journalism, or any career that requires you to be heard. Your professional voice finds its fullest expression here.",
    "IC":"Deep study, journaling, processing old stories, and conversations with family that actually go somewhere. This line supports the kind of reflective thinking that changes how you understand your own history. A quiet line \u2014 powerful for inner work.",
    "ASC":"Fast-moving, socially rich environments where curiosity and quick thinking are rewarded. This line makes you more articulate, more socially alive, and more able to connect across different worlds. Great for networking, learning, or anywhere you need to make a strong first impression.",
    "DSC":"Intellectual partnerships and collaborations where ideas are genuinely exchanged. This line draws articulate, mentally stimulating people toward you \u2014 and supports contracts, negotiations, and any professional relationship built on clear communication."
  },
  "Venus":{
    "MC":"Places where your public life and creative identity can fully merge \u2014 cities with strong arts, fashion, design, or beauty industries. This line supports being recognised for your taste and warmth, not just your output. Strong for any career that requires charm, aesthetics, or genuine people skills.",
    "IC":"Creating a home that feels genuinely beautiful and nourishing \u2014 this line supports putting down roots somewhere that feeds your soul privately. Healing family relationships, finding deep domestic contentment, and building a sanctuary that truly reflects your values.",
    "ASC":"Anywhere you want to be seen, loved, and received warmly. Romance, creative confidence, and social magnetism all flow naturally here. Great for new beginnings where first impressions matter, or anywhere you want to show up as your most magnetic self.",
    "DSC":"Significant romantic partnerships, creative collaborations, and business relationships that feel genuinely harmonious. The Descendant is the relationship axis \u2014 Venus here draws meaningful people toward you and supports connections built on genuine mutual appreciation."
  },
  "Mars":{
    "MC":"Cities that reward ambition, initiative, and the willingness to compete \u2014 entrepreneurial hubs, athletic environments, or any field where drive is the differentiator. This line supports bold career moves, leadership, and being known as someone who makes things happen.",
    "IC":"Channelling your drive into building something private and lasting \u2014 renovating a home, establishing strong family foundations, or doing the physical and emotional work of creating real security. This line rewards effort directed inward.",
    "ASC":"Environments that reward directness, physical presence, and the willingness to go first. Sports, startups, activism, physical training \u2014 anywhere that energy and initiative are the currency. This line makes you feel fully alive and ready to act.",
    "DSC":"Relationships that carry genuine passion and honest challenge \u2014 partners who push you to be better rather than just comfortable. This line supports dynamics where both people show up fully and aren't afraid of productive conflict."
  },
  "Jupiter":{
    "MC":"Cities where opportunity flows freely and your reputation can grow without friction \u2014 places with strong networks, optimistic cultures, and room for expansion. This line supports career leaps, public recognition, and being in the right place at the right time.",
    "IC":"Building a home life that feels genuinely abundant \u2014 not just materially but spiritually and emotionally. This line supports finding a place that feels bigger than you expected, where family life flourishes and private joy comes easily.",
    "ASC":"Anywhere you want to feel like your best self \u2014 open, generous, full of possibility. This line makes life feel easier and more expansive. Great for travel, study, spiritual exploration, or simply being in a place that reminds you how much is possible.",
    "DSC":"Partnerships that genuinely expand your world \u2014 romantic connections that introduce you to new philosophies, business partners who open unexpected doors, or collaborators who make you feel like anything is possible. This line draws big-hearted, generous people toward you."
  },
  "Saturn":{
    "MC":"Cities that reward long-term thinking, discipline, and the willingness to earn your place \u2014 established institutions, traditional industries, or any environment where credibility is built over time. This line supports career legacies that actually last.",
    "IC":"Doing the serious inner work of building real emotional foundations \u2014 confronting family patterns, creating genuine security, and becoming someone you can rely on. This line rewards honesty about where you come from and what you're actually building.",
    "ASC":"Environments that value gravitas, reliability, and substance over flash \u2014 law, academia, architecture, or any field where being taken seriously matters. This line gives you a quiet authority that earns genuine respect over time.",
    "DSC":"Committed, long-term relationships built on mutual respect and genuine reliability. This line draws mature, dependable people toward you and supports partnerships that are tested by time and emerge stronger for it."
  },
  "Uranus":{
    "MC":"Cities on the cutting edge \u2014 tech hubs, creative capitals, activist communities, or anywhere that rewards original thinking and the willingness to disrupt. This line supports reinventing your career, breaking from convention, and being known for doing something genuinely new.",
    "IC":"Breaking free from inherited family patterns and creating a home life that looks nothing like what you grew up with \u2014 and feels completely right. This line supports radical private reinvention and the liberation that comes from finally living on your own terms.",
    "ASC":"Environments that celebrate originality, eccentricity, and the courage to be different. This line makes you electric and unforgettable \u2014 ideal for creative communities, tech cultures, or anywhere that rewards thinking outside every available box.",
    "DSC":"Unconventional relationships and partnerships that break the expected mould \u2014 open arrangements, unexpected connections, or collaborators who challenge every assumption you have about what relationship can look like."
  },
  "Neptune":{
    "MC":"Cities with strong creative, spiritual, or healing cultures \u2014 places where art, music, film, or service to others is taken seriously as a calling. This line supports careers built on imagination, compassion, and the willingness to work with the invisible.",
    "IC":"Retreat, creative solitude, and deep spiritual nourishment in private. This line makes home feel sacred \u2014 a place for meditation, creative practice, or simply the kind of quiet that allows you to hear yourself think. Profound for healing.",
    "ASC":"Environments that value sensitivity, creativity, and spiritual depth \u2014 artistic communities, healing spaces, or anywhere that welcomes the full range of human feeling. This line makes you deeply magnetic in a subtle, ethereal way.",
    "DSC":"Soul-level partnerships built on genuine spiritual or creative resonance \u2014 connections that feel fated, transcendent, or simply unlike anything you've experienced before. This line draws deeply sensitive and imaginative people toward you."
  },
  "Pluto":{
    "MC":"Cities where power, transformation, and depth are taken seriously \u2014 finance, psychology, politics, research, or any field that deals with what's beneath the surface. This line supports careers that involve real stakes and the courage to go where others won't.",
    "IC":"The deepest possible inner work \u2014 confronting ancestral wounds, buried family truths, and the psychological foundations that everything else rests on. This line is demanding but offers the kind of transformation that reaches all the way down.",
    "ASC":"Environments that welcome intensity, depth, and the willingness to be radically honest. This line makes you unforgettable \u2014 ideal for situations where you need to show your full power or effect genuine change in the people around you.",
    "DSC":"Transformative relationships that change you at the core \u2014 connections that strip away pretence and demand total honesty. This line draws intense, perceptive people toward you and supports partnerships that are genuinely alchemical."
  }
};

// Watch for: 40 planet x angle descriptions
var WATCH_FOR={
  "Sun":{
    "MC":"This line can make public approval feel like oxygen \u2014 watch for shaping your career around what looks impressive rather than what genuinely fulfils you. The Midheaven asks for authenticity; the Sun here can sometimes seduce you into performance over presence.",
    "IC":"The IC is the most private point in the chart \u2014 the Sun here can make it tempting to stay inward, avoiding the visibility your full self requires. Watch for using home and family as a retreat from the world rather than a foundation for engaging with it.",
    "ASC":"The Sun on the Ascendant can make you overly self-referential \u2014 the most vibrant version of this line is generous, not consuming. Watch for needing to be the centre, or for letting ego get in the way of genuine connection.",
    "DSC":"The Descendant represents what we project onto others \u2014 the Sun here can mean you see your own light in partners rather than developing it fully in yourself. Watch for relationships that feel empowering but subtly keep you small."
  },
  "Moon":{
    "MC":"The Moon on the Midheaven brings your emotional world into public \u2014 which can leave you feeling overexposed or reactive to criticism in ways that feel disproportionate. Watch for letting your mood dictate your professional presence, or needing external validation to feel competent.",
    "IC":"This line can make the private world feel so nourishing that leaving it becomes genuinely hard. Watch for emotional over-attachment to home or family, or for using the comfort of this place to avoid the growth that requires friction.",
    "ASC":"The Moon on the Ascendant can make you emotionally porous \u2014 absorbing the moods of everyone around you. Watch for losing your own emotional ground in the presence of others, or for being so open that you attract people who consume rather than reciprocate.",
    "DSC":"Emotional dependency can run high here \u2014 watch for attracting partners you need to mother or be mothered by, or for relationships where emotional need is mistaken for depth. The healthiest version of this line is mutual care, not merged identity."
  },
  "Mercury":{
    "MC":"Mercury on the Midheaven can make you overly focused on how your ideas are received \u2014 watch for editing yourself into acceptability, or for prioritising cleverness over genuine insight. The best work here comes from thinking freely, not strategically.",
    "IC":"This line can send the mind into anxious loops \u2014 too much introspection without action. Watch for overthinking old stories, getting lost in analysis, or having conversations with family that go in circles without resolution.",
    "ASC":"Mercury on the Ascendant can make you scattered \u2014 too many ideas, too many directions, not enough follow-through. Watch for using wit and charm to keep people at a surface level, or for being so mentally busy that you miss what's actually happening in the room.",
    "DSC":"Watch for attracting partners who stimulate your mind but don't meet you emotionally \u2014 or for relationships that are all conversation and no depth. Mercury on the Descendant can also bring contractual complications; read everything carefully here."
  },
  "Venus":{
    "MC":"This line can make public approval feel like a need rather than a bonus \u2014 watch for shaping your career around what looks good rather than what genuinely fulfils you. The Midheaven asks for authenticity; Venus here can sometimes seduce you into performance.",
    "IC":"Venus on the IC can make it tempting to retreat entirely into comfort and beauty, avoiding the friction that growth requires. Watch for idealising home or family in ways that close you off from the world, or for spending on aesthetics to fill an emotional gap.",
    "ASC":"Venus on the Ascendant can make approval feel essential to your sense of self. Watch for people-pleasing, or for attracting admirers without the discernment to know who actually deserves your time and energy. Charm is a gift \u2014 use it consciously.",
    "DSC":"The Descendant represents what we project onto others \u2014 Venus here can mean you see beauty and harmony in partners that isn't fully there yet. Watch for staying in relationships past their natural end for the sake of keeping the peace."
  },
  "Mars":{
    "MC":"Mars on the Midheaven can make you come across as aggressive or impatient in professional settings \u2014 watch for burning bridges in the pursuit of speed, or for letting competitive energy turn into unnecessary conflict with colleagues or authority figures.",
    "IC":"Mars at the root of the chart can stir up old family anger or make home feel like a battlefield. Watch for bringing work stress home, for power struggles in domestic life, or for channelling drive into restlessness rather than genuine building.",
    "ASC":"Mars on the Ascendant can make you come on too strong \u2014 watch for leading with aggression rather than confidence, or for attracting conflict simply because your energy is so charged. The most effective version of this line is directed, not reactive.",
    "DSC":"Relationships here can tip into power struggles \u2014 watch for attracting partners who fight you rather than stand beside you, or for mistaking intensity for chemistry. Passion is present on this line; make sure it's mutual and chosen, not compulsive."
  },
  "Jupiter":{
    "MC":"Jupiter on the Midheaven can encourage overreach \u2014 promising more than you can deliver, expanding too fast, or mistaking opportunity for inevitability. Watch for bypassing the discipline that real recognition requires, or for letting optimism substitute for preparation.",
    "IC":"Jupiter on the IC can make home life feel so abundant that genuine contentment becomes complacency. Watch for excess in private life \u2014 overindulgence, over-spending on the home, or using comfort to avoid the challenges that would actually grow you.",
    "ASC":"Jupiter on the Ascendant can tip into excess \u2014 too much of everything, too many directions, too much promise without follow-through. Watch for overconfidence, or for attracting people who want to ride your expansive energy rather than contribute their own.",
    "DSC":"Jupiter on the Descendant can lead to idealising partners or expanding into relationships that aren't as golden as they appear. Watch for over-giving in partnerships, or for attracting people who take more than they offer under the cover of big personalities."
  },
  "Saturn":{
    "MC":"Saturn on the Midheaven can make the climb feel relentlessly hard \u2014 watch for letting perfectionism or fear of failure keep you from acting at all. This line rewards consistent effort, not waiting until everything is perfect before you begin.",
    "IC":"Saturn on the IC can bring up deep feelings of not being enough, or of home never feeling quite safe enough. Watch for being overly critical of yourself in private, or for replicating cold or distant family dynamics rather than consciously building something warmer.",
    "ASC":"Saturn on the Ascendant can make you come across as guarded or overly serious \u2014 watch for keeping people at a distance through formality, or for being so focused on being taken seriously that you forget to let people actually know you.",
    "DSC":"Saturn on the Descendant can attract relationships that feel more like duty than desire, or partners who are withholding rather than warm. Watch for staying in commitments out of obligation, or for choosing reliability over genuine connection."
  },
  "Uranus":{
    "MC":"Uranus on the Midheaven can make stability feel impossible \u2014 careers here may start and stop suddenly, or professional reinventions can happen before the last one has had time to land. Watch for disrupting things before they've had a chance to grow.",
    "IC":"Uranus on the IC can make it genuinely hard to settle \u2014 home may change frequently, relationships with family may be unpredictable, or the need for freedom can make putting down roots feel like a trap. Watch for mistaking restlessness for liberation.",
    "ASC":"Uranus on the Ascendant can make you come across as erratic or hard to pin down \u2014 watch for being so committed to originality that you alienate people who might genuinely support you, or for using unconventionality as a shield against intimacy.",
    "DSC":"Uranus on the Descendant can attract unstable or unavailable partners, or create a pattern of relationships that are electric at the start and chaotic shortly after. Watch for mistaking unpredictability for excitement, or freedom for avoidance of real commitment."
  },
  "Neptune":{
    "MC":"Neptune on the Midheaven can make your career direction genuinely hard to pin down \u2014 watch for drifting between callings without committing to any of them, or for building a public image that's more about impression than substance. Clarity of purpose requires real effort here.",
    "IC":"Neptune on the IC can blur the line between sanctuary and escapism \u2014 watch for using home as a place to disappear rather than restore, or for idealising family members in ways that prevent honest relationship. This line asks for gentle but clear-eyed honesty in private.",
    "ASC":"Neptune on the Ascendant can make your boundaries genuinely porous \u2014 watch for absorbing other people's energy to the point of losing your own, or for being seen as something you're not because you unconsciously mirror what others want to see.",
    "DSC":"Neptune on the Descendant is one of the most romantically idealising placements \u2014 watch for falling for who someone could be rather than who they are, or for attracting people who are unavailable, addicted, or in need of saving. Compassion is beautiful here; discernment is essential."
  },
  "Pluto":{
    "MC":"Pluto on the Midheaven can attract power struggles with authority figures, or bring professional crises that feel like destruction but are actually clearing the ground for something real. Watch for becoming obsessive about control in your career, or for letting ambition override integrity.",
    "IC":"Pluto on the IC stirs what's deepest and most buried \u2014 watch for this process becoming overwhelming without adequate support. Shadow work is powerful here, but it's not something to do alone. Make sure you have people or practices that can hold you through what comes up.",
    "ASC":"Pluto on the Ascendant can make your intensity feel threatening to people who aren't ready for it \u2014 watch for unconsciously using your power to control rather than connect, or for attracting people who are drawn to your depth but can't actually meet it.",
    "DSC":"Pluto on the Descendant can attract obsessive or controlling relationship dynamics \u2014 watch for intensity that crosses into possession, or for staying in relationships past the point of health because the bond feels impossible to break. Transformation is available here; so is entanglement."
  }
};
