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

**לא נבדק:** שיחה אמיתית. בסשן הקודם לא היו מפתח API ו-`ant`. גם ה-YAML של הסוכן לא עבר עדיין ולידציה מול ה-API.

## מצב הסביבה

- המשתמש הוסיף `ANTHROPIC_API_KEY` כמשתנה סביבה. המפתח נוצר ב-workspace הקיים של הארגון ב-Console; לא נוצר workspace נפרד לבוט, כי זה לא אפשרי מהטלפון. לארגון יש תקרה חודשית של $500. ייתכן שלמשתמש אין הרשאת Admin בארגון ב-Console.
- `ant` לא מותקן. המשתמש ביקש להתקין אותו בסשן הזה.
- `twyst.co.il` היה חסום ברשת (403 מהפרוקסי). המשתמש התבקש להוסיף את `twyst.co.il` ו-`www.twyst.co.il` לרשימת האתרים המותרים. לבדוק אם זה נכנס לתוקף.
- המידע על Twyst בהנחיות נלקח ממסמכים ב-Google Drive של המשתמש: ייעול תהליכי עבודה בארגונים עם monday.com, אפליקציות ייעודיות, אוטומציות ואינטגרציות ופתרונות AI, ללקוחות עסקיים ולגופים ציבוריים. Tagline: "Systems that drive decisions."

## הצעדים הבאים

1. `git checkout twyst-discovery-chat`, ולוודא שהמפתח זמין בלי להדפיס אותו: `echo ${ANTHROPIC_API_KEY:+set}`.
2. להתקין `ant` בגרסה 1.30.0 ומעלה (release ללינוקס מ-`github.com/anthropics/anthropic-cli/releases`), ולהריץ `ant auth status`.
3. `ant apply --dry-run -v agents/twyst-discovery.md environments/twyst-chat.yaml`, ולהציג למשתמש את התוכנית. רק אחרי שהוא מאשר: `ant apply --yes agents/twyst-discovery.md environments/twyst-chat.yaml`. לא להוסיף `--force` או `--prune`.
4. לעשות commit ל-`claude-lock.json`, וליצור `.env` (לא נכנס ל-git) עם `TWYST_AGENT_ID` ו-`TWYST_ENVIRONMENT_ID` מתוך ה-lock. אם המפתח לא ב-workspace בשם default, להגדיר גם `ANTHROPIC_WORKSPACE` כדי שקישורי ה-Console בלוג יעבדו.
5. `npm install && npm start`, ולהריץ שיחת ניסיון מלאה. למשל לקוח מדומה שהוא משרד רואי חשבון עם 25 עובדים, דרך `curl` ל-`/api/chat` או Playwright, עד שהכלי נקרא. לבדוק:
   - שאלה אחת בכל הודעה, ולא יותר מחמש שאלות.
   - הסיכום מציג 2-3 נקודות כאב עם כיוון AI לכל אחת.
   - הבוט מבקש פרטי קשר.
   - נוצר קובץ ב-`leads/` עם שדות סבירים.
   - התשובות מגיעות בהזרמה (`delta`) ולא רק בסוף.
   - העלות של שיחה ב-Console.
6. אם `twyst.co.il` נגיש: לקרוא את האתר ולעדכן את פסקת "על Twyst" בהנחיות, בלי שמות של לקוחות. אחרי כל שינוי בהנחיות מריצים `ant apply` שוב (גרסה חדשה של אותו סוכן).
7. לדווח למשתמש מה עבד ומה כדאי לשפר, ולשאול אם לפתוח PR ל-`main`.

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
