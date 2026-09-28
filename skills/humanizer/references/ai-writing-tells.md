# AI Writing Tells: Top Patterns and Replacement Rules

Condensed reference from blader/humanizer (github.com/blader/humanizer), based on
Wikipedia's "Signs of AI writing". Patterns are numbered strongest first:
§1-5 justify an edit on one sighting; patterns marked *weak alone* need company
from other tells in the same passage.

## How to work

1. Mark the tells (strongest first, paragraph-level as well as sentence-level).
2. Draft the rewrite. Keep every supported claim; add nothing not in the source or from the user. Fiction is exempt.
3. Check the draft aloud. Unsupported additions and lost claims are both errors. Re-scan for tells that survive most rewrites: contrasts (1), closers (2), triads (6), dashes (8), bold labels (19).
4. Write the final version naturally; vary sentence length.

Voice: match the user's sample if given (it overrides the rules, including the dash rule). Otherwise take voice from text kind — blog/essay keeps opinions and asides; reference/technical/legal stays neutral.

## A. Staging instead of stating (act on one sighting)

### 1. Not X but Y (strongest tell)
- Watch: not just/only/merely X, but Y; it's not X, it's Y; X rather than Y; split across sentences ("This does not mean X. It means Y."); clipped negative tail.
- Fix: state the point directly. Keep a contrast only when the negative half corrects a belief the reader holds or both halves carry information.
- "It's not just a song, it's a statement." → "The heavy beat adds to the aggressive tone."

### 2. One-line closers and dramatic fragments
- Watch: "That is the real win."; "Let that sink in."; "Read that again."; same closer after every section; sentence that names what an example showed; rows of fragments; ALL-CAPS or every. single. word.
- Fix: cut closers that repeat or explain what the reader just saw; keep one that adds a fact or consequence. Merge fragment rows into a claim.

### 3. Sayings that sound deep
- Watch: the real question is, at its core, what really matters, fundamentally, the deeper issue, the heart of the matter, X is the Y of Z, X becomes a trap, the language/currency/architecture of.
- Fix: replace the aphorism with the specific claim.

### 4. Staged run-up before the point
- Watch: Let's dive in, let's explore, here's what you need to know, now let's look at, without further ado, Honestly?, Here's the thing, Real talk.
- Fix: remove the run-up; just make the point.

### 5. Arguing with no one
- Watch: This isn't about, I'm not saying, To be clear, Don't get me wrong, Some might say... but, A tempting approach would be, You might think... but.
- Fix: remove the defense of an objection no one made; state the real claim. Keep objections the text actually attributes or answers in full.

## B. Rhythm by rule

### 6. Forced triads
- Watch: three ideas in one sentence ("innovation, inspiration, and insights"), three parallel examples, three short facts plus a lesson.
- Fix: check each item adds a distinct idea; merge examples or develop the strongest one. Keep three real items when meaning needs three.

### 7. Repeated sentence openings
- Watch: several sentences starting with the same subject (often he/she).
- Fix: merge sentences, swap the subject, or begin with the action. Do not ban the word outright.

### 8. Dashes as the universal connector
- Rule: final rewrite contains zero em dashes (—) or en dashes (–) unless the writer's sample uses them. Replace with period, comma, colon, or parentheses. Also fix spaced dashes / double hyphens used as dashes. Leave code, inline code, commands, paths, URLs alone. *Weak alone* (one dash); a text full of them is not.

### 9. Stacked qualifiers
- Watch: to be fair, it's also possible, could potentially, might arguably, in some cases it may.
- Fix: keep only qualifiers the source supports. Ordinary hedges (perhaps, tends to) are human and fine. *Weak alone.*

### 10. Hyphenated pairs everywhere
- Watch: high-quality, well-known, long-term, real-time after the noun.
- Fix: keep hyphen before a noun ("a high-quality report"), drop after ("the report is high quality"). Dictionary-hyphenated words (third-party) keep it. *Weak alone.*

### 11. Passive voice and missing subjects
- Watch: hidden actors, dropped subjects ("No configuration file needed.").
- Fix: active voice when it makes actor and action clearer. *Weak alone.*

## C. Inflation and borrowed authority

### 12. Overused AI words (tells wherever they appear)
- List: Actually, additionally, align with, bolstered, crucial, deep dive, delve, enduring, enhance, garner, gate(d) (figurative), highlight (verb), interplay, intricate, key (adjective), landscape (abstract), meticulous(ly), pivotal, quietly, robust (figurative), showcase, tapestry, testament, underscore (verb), valuable, vibrant.
- Fix: replace with a plainer word or restate the fact. Most common in groups.

### 13. Inflated significance
- Watch: stands as a testament, a pivotal/crucial moment, plays a key role, marking/shaping the, underscores its importance, setting the stage for, evolving landscape; stock "Despite these challenges... continues to thrive" sections; "the future looks bright", "exciting times ahead" send-offs.
- Fix: keep the fact, drop the significance. End on the last concrete fact.

### 14. Vague connection or association
- Watch: associated with, in connection with, linked to, tied to.
- Fix: name the actual relationship the source gives; if not given, keep the vague wording rather than invent a role.

### 15. Shallow -ing riders
- Watch: highlighting, underscoring, emphasizing, reflecting, symbolizing, showcasing, fostering.
- Fix: keep the fact; drop the -ing rider unless the source supports what it claims.

### 16. Sales language
- Watch: rich (figurative), profound, exemplifies, commitment to, natural beauty, nestled, in the heart of, breathtaking, must-visit, stunning.
- Fix: state what the thing actually is.

### 17. Borrowed authority
- Watch: experts argue, observers have cited, industry reports; prestige outlet lists ("cited in The New York Times, BBC..."); "active social media presence, over N followers."
- Fix: name the real source and what it said, or cut the unsupported claim/list.

### 18. Avoiding is, are, and has
- Watch: serves as, stands as, functions as, operates as, marks, represents; boasts, features, offers.
- Fix: use is, are, has.

## D. Formatting by rule

### 19. Bold as decoration
- Watch: bolded words without a reason; labeled lists with bold label + colon.
- Fix: remove the bold; turn a labeled list into prose when labels carry no information.

### 20. Decorative headings
- Watch: title case on every heading, emojis/arrows in headings or list items, horizontal rules between every section, a top heading that repeats the title.
- Fix: sentence case, no decoration, no rules; heading names the section's content.

### 21. Curly quotation marks
- Watch: curly quotes “...” where the format uses straight quotes. *Weak alone.*

## E. Leftovers from the chat and the draft (remove outright)

### 22. Chatbot residue (most certain tell)
- Watch: I hope this helps, Of course!, Certainly!, Great question!, You're absolutely right, Would you like..., Want me to...?, Should I continue?, let me know.
- Fix: remove the wrapper, keep the content.

### 23. Knowledge-limit disclaimers and guesses
- Watch: as of [date], up to my last training update, not publicly available, not widely documented, maintains a low profile, likely [grew up/studied], it is believed that.
- Fix: state what the source does not show, or remove the sentence. Do not fill gaps with plausible guesses.

### 24. A heading repeated in the first sentence
- Watch: one-line paragraph right after a heading that restates it.
- Fix: remove the repeated sentence.

### 25. Writing about the document instead of its subject
- Watch: "was added to replace", "generated from", "compiled from", "the table below compares", "this section is organized by".
- Fix: describe the subject, not the document/process. Keep source credits and caveats that change reader action.

## F. Writing for the wrong reader

### 26. Re-explaining what the reader knows (in replies)
- Watch: a reply that restates the problem, walks through diagnosis and evidence, then gives the decision last; numbers/commands included to prove a plan.
- Fix: lead with the decision; keep only the reasoning that changes whether the reader agrees (one fact they lack, any link to act).

## Quick replacement rules (at a glance)

| AI tell | Replacement |
|---|---|
| not just X, but Y | the plain claim |
| That is the real win. / Let that sink in. | cut, or keep only if it adds a fact |
| Let's dive in / here's what you need to know | cut the run-up |
| at its core / fundamentally / the real question is | the specific claim |
| em dashes everywhere | periods, commas, colons, parentheses |
| forced triplets (x, y, and z) | two items or one developed idea |
| serves as / stands as / boasts | is / has |
| ambiguous "associated with" | the named role |
| experts argue / industry reports | the named source or nothing |
| I hope this helps / Great question! | cut entirely |
| bold lists (label: colon) | plain prose |
| "Despite challenges... continues to thrive" | the concrete facts only |
| preamble before the point in a reply | decision first |

## Source

Wikipedia: ["Signs of AI writing"](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing),
maintained by WikiProject AI Cleanup; packaged by blader/humanizer (MIT).