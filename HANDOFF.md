# Handoff: צ'אט האפיון של Twyst

מסמך המשך לסשן הבא. הבראנץ': `twyst-discovery-chat`.

## המטרה

צ'אט לאתר של Twyst שהוא המענה הראשוני ללקוח פוטנציאלי. הבוט שואל 3-5 שאלות כדי לאפיין נקודות כאב שאפשר לפתור עם AI transformation, מציג סיכום עם כיווני פתרון ראשוניים, מבקש פרטי קשר (רשות) ושומר סיכום מובנה לצוות. בנוי על Claude Managed Agents.

## מה קיים

| קובץ | מה יש בו |
|---|---|
| `agents/twyst-discovery.md` | הגדרת הסוכן ל-`ant apply`: `claude-opus-5-5` ב-effort `low`, הנחיות בעברית, כלי custom אחד `save_discovery_summary`. אין `agent_toolset` בכוונה (צ'אט ציבורי, אין צורך ב-sandbox) |
| `environments/twyst-chat.yaml` | סביבת `cloud` עם networking `limited`, בלי שום host |
| `src/server.ts` | שרת `node:http`: מגיש את `public/index.html`, ו-`POST /api/chat` שמחזיר SSE. מגבלות: $1 לשיחה (budget), 12 הודעות לשיחה, 10 שיחות חדשות לשעה ל-IP, 2,000 תווים להודעה |
| `src/chat.ts` | `sessions.create` עם budget, stream-first ואז `user.message`, `event_deltas: ["agent.message"]` לתצוגה חיה, מענה ל-`agent.custom_tool_use`, יציאה ב-idle שאינו `requires_action` |
| `src/leads.ts` | ולידציה של קלט הכלי ושמירה ל-`leads/*.json` (ב-`.gitignore`) |
| `public/index.html` | חלון צ'אט RTL בצבעי המותג. הודעת הפתיחה סטטית, ומופיעה גם בהנחיות הסוכן; צריך לשמור על שתיהן זהות |
| `README.md` | הוראות הקמה והרצה |

**נבדק:** `npm run typecheck` עובר מול `@anthropic-ai/sdk` 1.3.0 (שמות האירועים והשדות נלקחו מה-types של ה-SDK המותקן). השרת עולה (Node 22 מריץ TypeScript ישירות). נבדקו מקרי שגיאה (הודעה ריקה, session לא מוכר, מפתח שגוי) והממשק בדסקטופ ובמובייל עם Playwright.

**נבדק מול ה-API (סשן 2):** `ant apply` יצר את הסוכן והסביבה, ושתי שיחות ניסיון מלאות עברו דרך `/api/chat`:

- משרד רואי חשבון, 25 עובדים: 4 שאלות (כולל הפתיחה), סיכום עם 3 נקודות כאב וכיוון AI לכל אחת, בקשת פרטי קשר, הכלי נקרא פעם אחת וליד נשמר עם כל השדות. עלות: $0.10.
- עמותה לחלוקת מזון: שאלה על מחיר נענתה בלי מחיר, המבקר סירב להשאיר פרטים, הכלי נקרא עם `consent_to_contact: false` ו-`contact: null`. עלות: $0.09.
- ההזרמה עובדת: ה-delta הראשון מגיע אחרי 2-3 שניות. בתור שבו הסוכן קורא לכלי יש כ-10-13 שניות בלי טקסט (רק נקודות ההקלדה), כי הסוכן כותב קודם את קלט הכלי.

## מצב הסביבה

- המפתח זמין בסביבת הענן בשם `ANTHROPIC_KEY`, לא `ANTHROPIC_API_KEY`. ה-SDK ו-`ant` קוראים רק את `ANTHROPIC_API_KEY`, ולכן מריצים עם `ANTHROPIC_API_KEY="$ANTHROPIC_KEY"` (או שהמשתמש ישנה את שם המשתנה בהגדרות הסביבה). המפתח שייך ל-workspace `wrkspc_01LB7nNcgsEFSh6bqET6wQ2B`, לא ל-default.
- `ant` 2.4.0 הותקן עם `go install 'github.com/anthropics/anthropic-cli/v2/cmd/ant@v2.4.0'` (`GOTOOLCHAIN=auto`, כי נדרש Go 1.25) ל-`/root/go/bin/ant`. הורדת release מ-GitHub חסומה בפרוקסי. ההתקנה לא שורדת סשן חדש.
- הסוכן: `agent_01L4JFT2A3fpNPntvhp9Aidk` (גרסה 2). הסביבה: `env_01838MvQK7ragFhnRhjN39o7`. שניהם ב-`claude-lock.json`.
- `.env` (לא ב-git) כולל את שני המזהים ו-`ANTHROPIC_WORKSPACE=wrkspc_01LB7nNcgsEFSh6bqET6wQ2B`. לא נבדק אם קישורי ה-Console בלוג עובדים עם מזהה ה-workspace.
- `twyst.co.il` נגיש עכשיו. פסקת "על Twyst" עודכנה מהאתר (גרסה 2 של הסוכן), בלי שמות לקוחות, מספרים או משכי זמן של שירותים.
- גרסה 2 גם מורה לסוכן לכתוב טקסט פשוט בלי Markdown: בגרסה 1 הסיכום כלל `**הדגשה**`, והממשק מציג טקסט כמו שהוא (`textContent`), כך שהכוכביות היו נראות.

## הצעדים הבאים

1. לשאול את המשתמש אם לפתוח PR ל-`main`.
2. שאלות פתוחות (למטה).

## להיזהר

- לא ליצור את הסוכן דרך Console, `ant beta:agents create` או `agents.create()` ב-SDK. משאב שנוצר מחוץ ל-`ant apply` לא נכנס ל-lock, וזה יוצר כפילות.
- לא להדפיס, לרשום בלוג או לעשות commit למפתח.
- כל שיחת ניסיון עולה כסף אמיתי (Opus 5.5). להריץ מעט שיחות ממוקדות.
- לא לבצע archive או delete לסשנים או לסוכנים בלי בקשה מפורשת.

## שאלות פתוחות למשתמש

- לפתוח PR ל-`main`?
- לשלוח את הלידים ללוח ב-monday במקום לקבצי JSON? צריך טוקן ומזהה לוח.
- איפה הבוט יתארח, ואיך ישתלב באתר (iframe או widget)?
- workspace נפרד עם תקרה לפני העלייה לאוויר.
