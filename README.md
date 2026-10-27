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

## העלאה ל-Railway

1. New Project ← Deploy from GitHub repo ← `ilaiyomsh/pcb-quiz`. Railway מזהה Node ומריץ `npm start`.
2. ב-Settings ← Source, לבחור את הבראנץ' שבו נמצא הצ'אט (כל עוד הוא לא מוזג, `twyst-discovery-chat`).
3. ב-Variables להגדיר:
   - `ANTHROPIC_API_KEY`: מפתח מאותו workspace שבו נוצר הסוכן (ה-`workspace_id` ב-`claude-lock.json`). עדיף מפתח נפרד לשרת, שאפשר לבטל בלי לפגוע בדברים אחרים.
   - `TWYST_AGENT_ID` ו-`TWYST_ENVIRONMENT_ID` מתוך `claude-lock.json`.
   - `TRUST_PROXY=1`, כדי שהגבלת השיחות לכל IP תעבוד מאחורי ה-proxy של Railway.
   - רשות: `ANTHROPIC_WORKSPACE`, `SESSION_BUDGET_CENTS`.
4. ב-Settings ← Networking ← Generate Domain, כדי לקבל כתובת ציבורית.
5. כדי שהלידים לא יימחקו בכל deploy, לחבר Volume בנתיב `/app/leads`.

השרת שומר את השיחות הפתוחות בזיכרון, ולכן צריך להריץ אותו ב-replica אחד. deploy חדש מנתק שיחות שבאמצע, והמבקר יתבקש לרענן את הדף.

## הגבלות מובנות

- תקרת הוצאה של $1 לשיחה (`SESSION_BUDGET_CENTS`).
- עד 12 הודעות בשיחה, ועד 2,000 תווים בהודעה.
- עד 10 שיחות חדשות בשעה מכל כתובת IP. מאחורי reverse proxy מגדירים `TRUST_PROXY=1`.
