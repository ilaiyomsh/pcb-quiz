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
- `ant` 2.4.0 הותקן עם `go install 'github.com/anthropics/anthropic-cli/v2/cmd/ant@v2.4.0'` (`GOTOOLCHAIN=auto`, כי נדרש Go 1.25) ל-`/root/go/bin/ant`. ההתקנה לא שורדת סשן חדש. לפריסה לא צריך את `ant`, רק אם משנים את הסוכן או הסביבה.
- הסוכן: `agent_01L4JFT2A3fpNPntvhp9Aidk` (גרסה 2). הסביבה: `env_01838MvQK7ragFhnRhjN39o7`. שניהם ב-`claude-lock.json`.
- `.env` (לא ב-git) כולל את שני המזהים ו-`ANTHROPIC_WORKSPACE=wrkspc_01LB7nNcgsEFSh6bqET6wQ2B`. לא נבדק אם קישורי ה-Console בלוג עובדים עם מזהה ה-workspace.
- `twyst.co.il` נגיש עכשיו. פסקת "על Twyst" עודכנה מהאתר (גרסה 2 של הסוכן), בלי שמות לקוחות, מספרים או משכי זמן של שירותים.
- גרסה 2 גם מורה לסוכן לכתוב טקסט פשוט בלי Markdown: בגרסה 1 הסיכום כלל `**הדגשה**`, והממשק מציג טקסט כמו שהוא (`textContent`), כך שהכוכביות היו נראות.

## פריסה ל-Fly.io (הושלמה בסשן 3)

המשתמש בחר ב-Fly (Railway ו-Render נפסלו). הכול בבראנץ': `Dockerfile`, `.dockerignore`, `fly.toml` (מזהי הסוכן והסביבה ב-`[env]`, אזור `fra`, `auto_stop_machines = "suspend"`, volume בשם `leads` ב-`/app/leads`, מכונה של 256MB), והוראות ב-README.

`TRUST_PROXY` הוחלף ב-`CLIENT_IP_HEADER`: הכותרת היחידה שממנה קוראים את כתובת המבקר להגבלת השיחות לכל IP. ב-Fly זו `fly-client-ip`, ו-`fly.toml` כבר מגדיר אותה. אין נפילה לכותרות אחרות, כי מבקר יכול לשלוח `X-Forwarded-For` או `X-Real-IP` משלו. נבדק בקונטיינר שנבנה: עם אותו `fly-client-ip` וכותרות אחרות מזויפות, השיחה ה-11 בשעה נחסמת.

למה מכונה אחת והשהיה: השרת שומר את השיחות הפתוחות ב-Map בזיכרון. Fly מפעיל מכונה אחת לאפליקציה עם volume, ו-suspend שומר את הזיכרון בזמן שהמכונה ישנה.

**מצב:** פרוס ב-https://twyst-discovery-chat.fly.dev/ בארגון Fly `personal`. מכונה אחת (`80ee12ea654208`, shared-cpu-1x, 256MB, `fra`) עם volume `leads` (`vol_4585omql077xm3j4`, 1GB). ה-image הוא `registry.fly.io/twyst-discovery-chat:f9cfebb` (הקוד של סשן 3, פורס ב-28.10), והסוכן בגרסה 3. נבדקו: 200 בכתובת, שיחה מלאה דרך `/api/chat` עם הזרמה (delta ראשון אחרי 1.5-2.5 שניות), ליד שנשמר ב-volume, מעבר ל-`suspended` כ-6 דקות בלי תנועה, והתעוררות בבקשה הבאה בלי לאבד שיחה פתוחה. בחשבון Fly: חיוב לפי שימוש, כרטיס שמור, `billingStatus: CURRENT`. האפליקציה `monday-pdf-converter` נמחקה לבקשת המשתמש.

הטוקן של Fly לא נשמר בשום מקום ולא נכנס ל-git. לפריסה חוזרת המשתמש מדביק טוקן בפרומפט.

**דברים שנבדקו בסביבה הזו ויחסכו זמן:**

- flyctl: הורדה מ-GitHub עובדת. `https://github.com/superfly/flyctl/releases/download/v0.4.123/flyctl_0.4.123_Linux_x86_64.tar.gz`.
- Docker מותקן אבל ה-daemon לא רץ: מפעילים `dockerd` ברקע.
- Docker Hub מחזיר 429. מושכים `mirror.gcr.io/library/node:22-slim` ומתייגים אותו כ-`node:22-slim`.
- `npm ci` בתוך `docker build` נכשל ב-`SELF_SIGNED_CERT_IN_CHAIN`, כי הפרוקסי של הסשן מיירט TLS. בונים מעותק של ה-`Dockerfile` שבו השורה היא `RUN --mount=type=secret,id=ca,target=/tmp/ca.crt NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm ci --omit=dev`, עם `--secret id=ca,src=/root/.ccr/ca-bundle.crt`. ה-secret לא נשאר ב-image (נבדק). לא לשנות את ה-`Dockerfile` שבריפו.

**הצעדים (לפריסה חוזרת: רק 1, 2, 6, 7, 8):**

1. לוודא גישה: `curl -sS -o /dev/null -w '%{http_code}' https://api.machines.dev` לא אמור להחזיר 403 מהפרוקסי.
2. לשמור את הטוקן בקובץ ב-scratchpad עם `chmod 600`, ולהעביר אותו לכל פקודה כ-`FLY_API_TOKEN="$(cat <file>)"`. לא להדפיס אותו.
3. `flyctl orgs list`, ואז `flyctl apps create twyst-discovery-chat -o <org>`. אם השם תפוס: לבחור שם אחר, לעדכן `app` ב-`fly.toml`, ולבקש מהמשתמש להוסיף את הדומיין החדש של `fly.dev` לרשימה (רק לצורך הבדיקה).
4. secret בלי שהמפתח יופיע בשורת הפקודה: `printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_KEY" | flyctl secrets import --stage -a <app>`.
5. `flyctl volumes create leads --region fra --size 1 -a <app> -y`.
6. לבנות image (ראו למעלה), `flyctl auth docker`, `docker push registry.fly.io/<app>:<git sha>`, ואז `flyctl deploy --image registry.fly.io/<app>:<git sha> --ha=false -a <app>`. אפשרות אחרת: `flyctl deploy --remote-only`, אבל ה-builder של Fly עלול לדרוש דומיינים נוספים.
7. לבדוק:
   - `flyctl machines list -a <app>`: מכונה אחת עם ה-volume.
   - `https://<app>.fly.dev/` מחזיר 200.
   - שיחה אחת קצרה ומלאה דרך `/api/chat` בכתובת הציבורית: הזרמה עובדת, הליד נשמר (`flyctl machine exec <id> "ls /app/leads" -a <app>`).
   - אחרי כמה דקות בלי תנועה המכונה ב-`suspended`, והבקשה הבאה מעירה אותה.
8. לנקות: למחוק את קובץ הטוקן ואת `~/.docker/config.json`, ולהזכיר למשתמש לבטל את הטוקן.
9. לדווח למשתמש את הכתובת, ולשאול אם לפתוח PR ל-`main`.

## סשן 3: כפתורים, הקלטה קולית והנחיות חדשות (פורס)

**כפתורים:** כלי custom חדש `ask_visitor` (1-3 שאלות, 2-6 תשובות לכל אחת, בחירה אחת או מרובה). השרת לא עונה לקריאה: הוא שולח לדפדפן אירוע `question`, מסיים את התור, ושומר את מזהה הקריאה (`TurnState.pendingQuestionId`). ההודעה הבאה של המבקר נשלחת כ-`user.custom_tool_result`, בין שלחץ ובין שכתב בתיבה. התור נגמר רק ב-`requires_action` שה-`event_ids` שלו כוללים את הקריאה הממתינה. `src/questions.ts` בודק את הקלט ומסנן "אחר" (הממשק מוסיף אותו). בממשק: כרטיס עם כפתורים, "אחר" עם שדה טקסט, שליחה מיידית לשאלה אחת עם תשובה אחת, וכרטיס נעול אחרי תשובה.

**הקלטה קולית:** Web Speech API בדפדפן (`he-IL`). הטקסט נכתב לתיבה ולא נשלח לבד. הכפתור מוסתר כשאין זיהוי דיבור (Firefox). ב-Android `continuous` כבוי. ה-API של Claude לא מקבל אודיו, ולכן תמלול בשרת ידרוש ספק נוסף.

**הנחיות הסוכן נכתבו מחדש** אחרי מחקר על זיהוי כאבים (The Mom Test, JTBD, SPIN, מחקר של Google על צ'אטבוט בסקרים). השאלות לפי הסדר: הארגון והתפקיד (בפתיחה), שאלת ההאצלה ("עובד עם שעתיים פנויות ביום") בטקסט, מקרה אמיתי ואיך זה נעשה היום, המחיר בכרטיס, ולמה עכשיו ודחיפות. לסיכום נוסף שדה `trigger`.

**נבדק:** typecheck; ולידציה של `ask_visitor`; Playwright מול `/api/chat` מדומה (כרטיס יחיד, כרטיס עם בחירה מרובה ו"אחר", תשובה חופשית שנועלת כרטיס, מובייל בלי גלילה אופקית, מיקרופון מוסתר בלי זיהוי דיבור, מיקרופון עם recognizer מדומה, ביטול ההקלטה בשליחה). מול ה-API: session עם `agent_with_overrides` (ההנחיות והכלים מהקובץ רק לאותו session, בלי לגעת בסוכן החי), ושתי שיחות מדומות שבהן מודל נוסף שיחק את המבקר: רשות מקומית (4 שאלות, 17 סנט) ובעל משרד שעונה בכלליות ומסרב להשאיר פרטים (5 שאלות, 12 סנט). שני הלידים נשמרו עם `trigger`.

**פריסה (28.10):** קודם השרת (image `f9cfebb`), ואחריו `ant apply`, שיצר את גרסה 3 של הסוכן (ב-`claude-lock.json`). בסדר ההפוך השרת הישן היה מקבל קריאות לכלי שהוא לא מכיר. בדיקה דרך הכתובת הציבורית: משרד עורכי דין, שאלת ההאצלה בטקסט, שלושה כרטיסים שנענו כתוצאת הכלי, סיכום עם המספרים של המבקר, ליד ב-volume עם `trigger`. עלות: 15 סנט. בתור האחרון הסוכן הציג כרטיס בלי משפט שיקוף ובלי לומר שזו השאלה האחרונה, כלומר לא תמיד מקיים את ההוראה הזו.

ב-volume יש גם שני לידים מ-27.10 בשעות 22:16 ו-22:20 שלא באו מהבדיקות של Claude. לא נפתחו.

`TWYST_AGENT_VERSION` (חדש, לא חובה) מקבע גרסה של הסוכן. לא הוגדר ב-`fly.toml`, כך ש-`ant apply` משפיע על האתר מיד. כשמוסיפים לסוכן כלי: קודם פורסים את השרת, ורק אחר כך `ant apply --yes` (בלי `--yes` הוא נכשל כשאין טרמינל).

## להיזהר

- לא ליצור את הסוכן דרך Console, `ant beta:agents create` או `agents.create()` ב-SDK. משאב שנוצר מחוץ ל-`ant apply` לא נכנס ל-lock, וזה יוצר כפילות.
- לא להדפיס, לרשום בלוג או לעשות commit למפתח או לטוקן של Fly.
- כל שיחת ניסיון עולה כסף אמיתי (Opus 5.5). להריץ מעט שיחות ממוקדות.
- לא לבצע archive או delete לסשנים או לסוכנים בלי בקשה מפורשת.

## שאלות פתוחות למשתמש

- לפתוח PR ל-`main`?
- להעביר את הריפו ל-`Twyst-Prime` (ואולי לשנות את השם מ-`pcb-quiz`)? הדרך הנקייה היא Transfer ב-Settings של GitHub; אין ל-Claude כלי להעברה.
- לשלוח את הלידים ללוח ב-monday במקום לקבצי JSON? צריך טוקן ומזהה לוח.
- איך הבוט ישתלב באתר (iframe או widget)? האירוח: Fly.io.
- workspace נפרד עם תקרה לפני העלייה לאוויר.
