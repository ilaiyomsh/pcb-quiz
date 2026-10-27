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

## הגבלות מובנות

- תקרת הוצאה של $1 לשיחה (`SESSION_BUDGET_CENTS`).
- עד 12 הודעות בשיחה, ועד 2,000 תווים בהודעה.
- עד 10 שיחות חדשות בשעה מכל כתובת IP. מאחורי reverse proxy מגדירים `TRUST_PROXY=1`.
