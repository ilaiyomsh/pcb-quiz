# צ'אט אפיון ראשוני של Twyst

צ'אט לאתר שמשמש מענה ראשוני ללקוח. הבוט שואל 3-5 שאלות כדי לאפיין נקודות כאב שאפשר לפתור עם AI, מציג ללקוח סיכום עם כיווני פתרון ראשוניים, מבקש פרטי קשר ושומר סיכום מובנה לצוות. חלק מהשאלות מוצגות ככרטיס עם כפתורי תשובה, ואפשר גם לענות בהקלטה קולית.

הבוט רץ על Claude Managed Agents: Anthropic מריצה את הסוכן, והשרת כאן רק פותח session לכל שיחה ומעביר הודעות.

## מבנה

| קובץ | תפקיד |
|---|---|
| `agents/twyst-discovery.md` | הגדרת הסוכן: מודל, הנחיות השיחה, והכלים `ask_visitor` ו-`save_discovery_summary`. כדי לשנות התנהגות, עורכים את הקובץ ומריצים `ant apply` שוב |
| `environments/twyst-chat.yaml` | סביבת הריצה. לסוכן אין כלי sandbox, ולכן אין לה גישה לרשת |
| `src/server.ts` | שרת HTTP: מגיש את דף הצ'אט ו-`POST /api/chat` |
| `src/chat.ts` | יצירת session, הזרמת התשובה לדפדפן, מענה לקריאות לכלים |
| `src/questions.ts` | בדיקת השאלות שהסוכן שולח ל-`ask_visitor` לפני שהן מוצגות |
| `src/leads.ts` | שמירת סיכומי האפיון ל-`leads/*.json` |
| `public/index.html` | חלון הצ'אט (RTL, צבעי המותג), כרטיסי השאלות וכפתור ההקלטה |
| `Dockerfile`, `fly.toml` | העלאה ל-Fly.io |

הודעת הפתיחה מופיעה גם ב-`public/index.html` וגם בהנחיות הסוכן. אם משנים אותה, צריך לשנות בשני המקומות.

## הקמה (פעם אחת)

צריך את ה-CLI `ant` בגרסה 1.30.0 ומעלה, ומפתח API עם גישה ל-Managed Agents (`ANTHROPIC_API_KEY`, או `ant auth login`).

```sh
ant apply --dry-run -v agents/twyst-discovery.md environments/twyst-chat.yaml   # מציג מה ייווצר, בלי לשנות
ant apply agents/twyst-discovery.md environments/twyst-chat.yaml                # יוצר את הסוכן והסביבה
```

`ant apply` כותב את המזהים ל-`claude-lock.json`. צריך לעשות לקובץ commit, אחרת ההרצה הבאה תיצור סוכן כפול. אחר כך מעתיקים את המזהים ל-`.env`:

```sh
cp .env.example .env
jq -r '.resources["./agents/twyst-discovery.md"].id' claude-lock.json     # -> TWYST_AGENT_ID
jq -r '.resources["./environments/twyst-chat.yaml"].id' claude-lock.json  # -> TWYST_ENVIRONMENT_ID
```

## הרצה

```sh
npm install
npm start          # http://localhost:3000
npm run typecheck
```

נדרש Node 22.18 ומעלה. Node מריץ את קבצי ה-TypeScript ישירות, בלי שלב build.

כל שיחה מקבלת קישור לצפייה ב-Console, שמודפס ללוג של השרת. כל סיכום שנשמר מופיע ב-`leads/`.

## שאלות עם כפתורים

כשהתשובות צפויות (גודל ארגון, כלים בשימוש, כמה שעות בשבוע, מה הכי דחוף), הסוכן קורא לכלי `ask_visitor` עם 1-3 שאלות, ולכל שאלה 2-6 תשובות ובחירה אחת או מרובה. השרת לא עונה לקריאה מיד: הוא שולח לדפדפן את הכרטיס ומסיים את התור, וה-session מחכה (`requires_action`). ההודעה הבאה של המבקר נשלחת כתוצאת הכלי, בין אם לחץ על כפתורים ובין אם כתב טקסט חופשי בתיבה. כל שאלה מקבלת בממשק גם כפתור "אחר" עם שדה טקסט. שאלה אחת עם תשובה אחת נשלחת בלחיצה הראשונה, ובכל מקרה אחר יש בכרטיס כפתור שליחה.

## הקלטה קולית

כפתור המיקרופון משתמש בזיהוי הדיבור של הדפדפן (Web Speech API, בעברית). הטקסט נכתב לתיבה, והמבקר בודק אותו לפני השליחה. הכפתור מופיע ב-Chrome, ב-Edge וב-Safari, ומוסתר בדפדפן שאין בו זיהוי דיבור (Firefox). באייפון ובאייפד רק Safari מורשה להשתמש בזיהוי הדיבור: Chrome, Firefox, Edge והדפדפנים שבתוך אפליקציות נכשלים עוד לפני בקשת הרשאה, ולכן שם הכפתור מוסתר. דפדפן שבכל זאת נכשל (למשל דפדפן בתוך אפליקציה שנראה כמו Safari) מסתיר את הכפתור אחרי הניסיון הראשון, ומציג הודעה שבאייפון ההקלטה עובדת בספארי. ב-Chrome הקול עובר לזיהוי בשירות של Google, וב-Safari בשירות של Apple. ה-API של Claude לא מקבל קלט קולי, ולכן תמלול בשרת ידרוש שירות תמלול נוסף.

## העלאה ל-Fly.io

`fly.toml` ו-`Dockerfile` כבר מוגדרים: מזהי הסוכן והסביבה, אזור פרנקפורט, מכונה של 256MB שנכנסת להשהיה (suspend) כשאין תנועה, ו-volume ללידים ב-`/app/leads`.

1. בדשבורד של Fly: Launch an app ← GitHub ← `ilaiyomsh/pcb-quiz`, בבראנץ' שבו נמצא הצ'אט (כל עוד הוא לא מוזג, `twyst-discovery-chat`). אם השם `twyst-discovery-chat` תפוס, בוחרים שם אחר.
2. להגדיר secret בשם `ANTHROPIC_API_KEY`: מפתח מאותו workspace שבו נוצר הסוכן (ה-`workspace_id` ב-`claude-lock.json`). עדיף מפתח נפרד לשרת, שאפשר לבטל בלי לפגוע בדברים אחרים.
3. אם מתבקשים ליצור volume, השם הוא `leads`, ו-1GB מספיק.
4. הכתובת: `https://<שם האפליקציה>.fly.dev`.

מה-CLI: `fly launch` בתיקייה הזו (משתמש ב-`fly.toml` הקיים), ואז `fly secrets set ANTHROPIC_API_KEY=...`.

### פריסה אוטומטית

`.github/workflows/fly-deploy.yml` פורס מחדש בכל push ל-`main`, אחרי typecheck. אפשר גם להריץ אותו ידנית מלשונית Actions. צריך פעם אחת:

1. ליצור deploy token לאפליקציה: בדשבורד של Fly, באפליקציה `twyst-discovery-chat` ← Tokens, או `fly tokens create deploy -a twyst-discovery-chat`. הטוקן הזה מוגבל לאפליקציה אחת.
2. ב-GitHub, בריפו: Settings ← Secrets and variables ← Actions ← New repository secret, בשם `FLY_API_TOKEN`.

שינויים בסוכן (`agents/twyst-discovery.md`) לא נפרסים כך, אלא עם `ant apply`.

שינוי בסוכן (`ant apply`) משפיע על השרת הפרוס מיד, כי שיחה חדשה מקבלת את הגרסה האחרונה של הסוכן. כשמוסיפים לסוכן כלי, קודם פורסים את השרת שמטפל בו, ורק אחר כך מריצים `ant apply`. כדי שגרסה חדשה של הסוכן לא תגיע לאתר לפני שבודקים אותה, אפשר לקבע גרסה עם `TWYST_AGENT_VERSION` ב-`fly.toml`, ואז לעדכן את המספר כשמוכנים.

השרת שומר את השיחות הפתוחות בזיכרון, ולכן צריך לרוץ על מכונה אחת. ה-volume דואג לזה: Fly מפעיל מכונה אחת לאפליקציה עם volume. אם בכל זאת נוצרה מכונה שנייה, מורידים אותה (`fly scale count 1`). ההשהיה שומרת את הזיכרון, כך ששיחה שמחכה למבקר לא נקטעת. deploy חדש כן מנתק שיחות שבאמצע, והמבקר יתבקש לרענן את הדף.

## הגבלות מובנות

- תקרת הוצאה של $1 לשיחה (`SESSION_BUDGET_CENTS`).
- עד 12 הודעות בשיחה, ועד 2,000 תווים בהודעה.
- עד 10 שיחות חדשות בשעה מכל כתובת IP. מאחורי reverse proxy, `CLIENT_IP_HEADER` קובע מאיזו כותרת לקרוא את הכתובת (ב-Fly: `fly-client-ip`, כבר ב-`fly.toml`).
