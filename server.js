const express = require("express");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
app.set("trust proxy", 1); // Render يعمل خلف بروكسي
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const REPORT_PATH = path.join(__dirname, "report.txt");

// تعليمات النظام (مفصولة عن التقرير لتوجيه الذكاء الاصطناعي بذكاء)
const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لمدرسة حذيفة بن محصن (5-12).
مهمتك الأساسية هي الإجابة عن أسئلة الزائرين بناءً على "تقرير التقويم الذاتي" الذي سيقدمه لك المستخدم.

قواعد هامة جداً للبحث والاستنتاج:
1. التقرير مليء بالجداول والبيانات المتداخلة، ابحث بدقة واربط بين الصفوف والأعمدة (مثال: اربط اسم المعلم بمادته، أو اربط الصف بنسب النجاح الخاصة به).
2. افهم مرادفات الكلمات (إذا سأل عن "عدد الطلاب" ابحث عن "إجمالي الطلبة"، وهكذا).
3. أجب حصراً من المعلومات المرفقة في التقرير، ولا تستخدم معلومات من خارجه.
4. إذا سأل الزائر عن معلومة غير موجودة تماماً في التقرير حتى بعد البحث العميق، قل بلطف: "عذراً، هذه المعلومة غير متوفرة في تقرير التقويم الذاتي الحالي للمدرسة."
5. أجب بالعربية الفصحى المبسطة، واستخدم النقاط والجداول لتنسيق إجابتك بشكل مريح للعين.`;

// قراءة التقرير
function loadReport() {
  try {
    return fs.readFileSync(REPORT_PATH, "utf8");
  } catch (err) {
    console.error("خطأ في قراءة ملف التقرير:", err);
    return "لا يوجد تقرير مرفق.";
  }
}
// نقطة اتصال جديدة لقراءة التقرير مجاناً بدون الذكاء الاصطناعي
app.get("/api/report", (req, res) => {
  res.send(loadReport());
});
app.post("/api/ask", async (req, res) => {
  const question = (req.body && req.body.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "اكتب سؤالك أولاً." });
  if (question.length > 1000) return res.status(400).json({ error: "السؤال طويل جداً." });

  // سحب محتوى التقرير الحي
  const reportContent = loadReport();

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3, // 0.3 ممتازة لتعطيه مرونة في فهم السؤال دون التأليف من خارج التقرير
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // وضع التقرير كجزء من سياق المحادثة يجعله يركز في البيانات بشكل أفضل بكثير
        { role: "user", content: `إليك نص "تقرير التقويم الذاتي" الخاص بالمدرسة:\n\n${reportContent}\n\n================\nبناءً على التقرير السابق فقط، أجب عن هذا السؤال:\n${question}` }
      ],
    });
    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error("OpenAI Error:", err);
    res.status(500).json({ error: "تعذّر الحصول على إجابة الآن. حاول مرة أخرى بعد قليل." });
  }
});

// ================= استطلاع آراء أولياء الأمور =================
// التخزين: إذا وُضع SURVEY_SHEET_URL (رابط Google Apps Script) تُحفظ الآراء في Google Sheets بشكل دائم.
// وإلا تُحفظ في ملف JSON محلي (تنبيه: على خطة Render المجانية يُمسح الملف عند إعادة التشغيل).
const SURVEY_SHEET_URL = process.env.SURVEY_SHEET_URL || "";
const SURVEY_SHEET_SECRET = process.env.SURVEY_SHEET_SECRET || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SURVEY_FILE = path.join(DATA_DIR, "survey.json");

function readLocal() {
  try { return JSON.parse(fs.readFileSync(SURVEY_FILE, "utf8")); } catch { return []; }
}
function writeLocal(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SURVEY_FILE, JSON.stringify(list, null, 2));
}

async function saveComment(entry) {
  if (SURVEY_SHEET_URL) {
    const r = await fetch(SURVEY_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: SURVEY_SHEET_SECRET, action: "add", entry }),
      redirect: "follow",
    });
    const data = await r.json().catch(() => ({}));
    if (!data.ok) throw new Error("Sheet save failed: " + (data.error || r.status));
    return;
  }
  const list = readLocal();
  list.push(entry);
  writeLocal(list);
}

async function listComments() {
  if (SURVEY_SHEET_URL) {
    const url = SURVEY_SHEET_URL + (SURVEY_SHEET_URL.includes("?") ? "&" : "?") +
      "action=list&secret=" + encodeURIComponent(SURVEY_SHEET_SECRET);
    const r = await fetch(url, { redirect: "follow" });
    const data = await r.json();
    if (!data.ok) throw new Error("Sheet read failed: " + (data.error || r.status));
    return data.entries || [];
  }
  return readLocal();
}

// حدّ بسيط لمنع الإغراق: 5 رسائل لكل جهاز كل 10 دقائق
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= 5) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

function checkAdmin(req, res) {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "لم يتم ضبط كلمة مرور الإدارة (ADMIN_PASSWORD) على الخادم." });
    return false;
  }
  if ((req.get("x-admin-password") || "") !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "كلمة المرور غير صحيحة." });
    return false;
  }
  return true;
}

// صفحة ولي الأمر وصفحة الإدارة
app.get(["/survey", "/survey/"], (req, res) => res.sendFile(path.join(__dirname, "public", "survey.html")));
app.get(["/survey/admin", "/survey/admin/"], (req, res) => res.sendFile(path.join(__dirname, "public", "survey-admin.html")));

app.post("/api/survey", async (req, res) => {
  const comment = ((req.body && req.body.comment) || "").toString().trim();
  const name = ((req.body && req.body.name) || "").toString().trim().slice(0, 80);
  if (req.body && req.body.website) return res.json({ ok: true }); // فخ للروبوتات
  if (comment.length < 3) return res.status(400).json({ error: "فضلاً اكتب رأيك أولاً." });
  if (comment.length > 2000) return res.status(400).json({ error: "الرسالة طويلة جداً (الحد 2000 حرف)." });
  if (tooMany(req.ip)) return res.status(429).json({ error: "أرسلت عدة رسائل مؤخراً، حاول بعد قليل." });

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    date: new Date().toISOString(),
    name,
    comment,
  };
  try {
    await saveComment(entry);
    res.json({ ok: true });
  } catch (err) {
    console.error("Survey save error:", err);
    res.status(500).json({ error: "تعذّر إرسال رأيك الآن، حاول مرة أخرى." });
  }
});

app.get("/api/survey/comments", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const list = await listComments();
    list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    res.json({ ok: true, entries: list, storage: SURVEY_SHEET_URL ? "sheet" : "file" });
  } catch (err) {
    console.error("Survey list error:", err);
    res.status(500).json({ error: "تعذّر تحميل الآراء." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
