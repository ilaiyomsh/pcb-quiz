# צ'אט אפיון ראשוני של Twyst

צ'אט לאתר שמשמש מענה ראשוני ללקוח. הבוט שואל 3-5 שאלות כדי לאפיין נקודות כאב שאפשר לפתור עם AI, מציג ללקוח סיכום עם כיווני פתרון ראשוניים, מבקש פרטי קשר ושומר סיכום מובנה לצוות.

הבוט רץ על Claude Managed Agents: Anthropic מריצה את הסוכן, והשרת כאן רק פותח session לכל שיחה ומעביר הודעות.

## מבנה

| קובץ | תפקיד |
|---|---|
| `agents/twyst-discovery.md` | הגדרת הסוכן: מודל, הנחיות השיחה, והכלי `save_discovery_summary`. כדי לשנות התנהגות, עורכים את הקובץ ומריצים `ant apply` שוב |
| `environments/twyst-chat.yaml` | סביבת הריצה. לסוכן אין כלי sandbox, ולכן אין לה גישה לרשת |
| `src/server.ts` | שרת HTTP: מגיש את דף הצ'אט ו-`POST /api/chat` |
| `src/chat.ts` | יצירת session, הזרמת התשובה לדפדפן, מענה לקריאה לכלי |
| `src/leads.ts` | שמירת סיכומי האפיון ל-`leads/*.json` |
| `public/index.html` | חלון הצ'אט (RTL, צבעי המותג) |
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

## העלאה ל-Fly.io

`fly.toml` ו-`Dockerfile` כבר מוגדרים: מזהי הסוכן והסביבה, אזור פרנקפורט, מכונה של 256MB שנכנסת להשהיה (suspend) כשאין תנועה, ו-volume ללידים ב-`/app/leads`.

1. בדשבורד של Fly: Launch an app ← GitHub ← `ilaiyomsh/pcb-quiz`, בבראנץ' שבו נמצא הצ'אט (כל עוד הוא לא מוזג, `twyst-discovery-chat`). אם השם `twyst-discovery-chat` תפוס, בוחרים שם אחר.
2. להגדיר secret בשם `ANTHROPIC_API_KEY`: מפתח מאותו workspace שבו נוצר הסוכן (ה-`workspace_id` ב-`claude-lock.json`). עדיף מפתח נפרד לשרת, שאפשר לבטל בלי לפגוע בדברים אחרים.
3. אם מתבקשים ליצור volume, השם הוא `leads`, ו-1GB מספיק.
4. הכתובת: `https://<שם האפליקציה>.fly.dev`.

מה-CLI: `fly launch` בתיקייה הזו (משתמש ב-`fly.toml` הקיים), ואז `fly secrets set ANTHROPIC_API_KEY=...`.

השרת שומר את השיחות הפתוחות בזיכרון, ולכן צריך לרוץ על מכונה אחת. ה-volume דואג לזה: Fly מפעיל מכונה אחת לאפליקציה עם volume. אם בכל זאת נוצרה מכונה שנייה, מורידים אותה (`fly scale count 1`). ההשהיה שומרת את הזיכרון, כך ששיחה שמחכה למבקר לא נקטעת. deploy חדש כן מנתק שיחות שבאמצע, והמבקר יתבקש לרענן את הדף.

## הגבלות מובנות

- תקרת הוצאה של $1 לשיחה (`SESSION_BUDGET_CENTS`).
- עד 12 הודעות בשיחה, ועד 2,000 תווים בהודעה.
- עד 10 שיחות חדשות בשעה מכל כתובת IP. מאחורי reverse proxy, `CLIENT_IP_HEADER` קובע מאיזו כותרת לקרוא את הכתובת (ב-Fly: `fly-client-ip`, כבר ב-`fly.toml`).
