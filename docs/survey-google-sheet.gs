/**
 * حفظ آراء أولياء الأمور في Google Sheets (حفظ دائم ومجاني)
 *
 * الخطوات:
 * 1) أنشئ Google Sheet جديد ← Extensions (الإضافات) ← Apps Script
 * 2) امسح الكود الموجود والصق هذا الملف كاملاً
 *    ثم Project Settings (⚙️) ← Script Properties ← Add script property
 *      Property: SECRET   |   Value: كلمة سرية من اختيارك
 * 3) Deploy ← New deployment ← النوع: Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4) انسخ رابط الـ Web app (ينتهي بـ /exec)
 * 5) في Render ← Environment أضف:
 *      SURVEY_SHEET_URL    = رابط الـ Web app
 *      SURVEY_SHEET_SECRET = نفس قيمة SECRET
 */
function secretOk_(given) {
  const s = PropertiesService.getScriptProperties().getProperty("SECRET");
  return !!s && given === s;
}
const SHEET_NAME = "الآراء";
// اتركه فارغاً إذا فتحت Apps Script من داخل الشيت، أو ضع رقم الشيت (من رابطه) لسكريبت مستقل
const SHEET_ID = "";

function sheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["id", "التاريخ", "الاسم", "الرأي"]);
    formatSheet_(sh);
  }
  return sh;
}

// تنسيق الصف الواحد: خط Cairo، محاذاة لليمين، التفاف النص
function formatRow_(sh, row) {
  sh.getRange(row, 1, 1, 4)
    .setFontFamily("Cairo").setFontSize(12).setFontColor("#1c2826")
    .setVerticalAlignment("middle").setHorizontalAlignment("right")
    .setWrap(true).setBackground(row % 2 ? "#ffffff" : "#f4f2ea");
  sh.getRange(row, 2).setNumberFormat("yyyy/mm/dd  hh:mm").setHorizontalAlignment("center");
  sh.autoResizeRows(row, 1);
  if (sh.getRowHeight(row) < 44) sh.setRowHeight(row, 44);
}

// تنسيق الورقة كاملة (يمكن تشغيله يدوياً من المحرر: اختر formatSheet ثم تشغيل)
function formatSheet() { formatSheet_(sheet_()); }

function formatSheet_(sh) {
  sh.getParent().setSpreadsheetTimeZone("Asia/Muscat");
  sh.setRightToLeft(true);
  sh.setFrozenRows(1);
  // إخفاء عمود المعرّف والأعمدة الفارغة، وإبقاء: التاريخ، الاسم، الرأي
  sh.hideColumns(1);
  const maxCols = sh.getMaxColumns();
  if (maxCols > 4) sh.hideColumns(5, maxCols - 4);
  sh.setColumnWidth(2, 170);
  sh.setColumnWidth(3, 190);
  sh.setColumnWidth(4, 560);
  // رأس الجدول
  sh.getRange(1, 1, 1, 4)
    .setFontFamily("Cairo").setFontSize(13).setFontWeight("bold")
    .setFontColor("#ffffff").setBackground("#0e6b6b")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.setRowHeight(1, 46);
  // تحويل التواريخ النصية القديمة إلى تواريخ حقيقية ثم تنسيق كل الصفوف
  const last = sh.getLastRow();
  for (let r = 2; r <= last; r++) {
    const c = sh.getRange(r, 2), v = c.getValue();
    if (v && !(v instanceof Date)) { const d = new Date(v); if (!isNaN(d)) c.setValue(d); }
    formatRow_(sh, r);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!secretOk_(body.secret)) return json_({ ok: false, error: "unauthorized" });
    const x = body.entry || {};
    const sh = sheet_();
    const d = new Date(x.date);
    sh.appendRow([x.id, isNaN(d) ? x.date : d, x.name || "", x.comment || ""]);
    formatRow_(sh, sh.getLastRow());
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  if (!secretOk_(e.parameter.secret || "")) return json_({ ok: false, error: "unauthorized" });
  const rows = sheet_().getDataRange().getValues().slice(1);
  const entries = rows.filter(r => r[3]).map(r => ({
    id: String(r[0]),
    date: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
    name: String(r[2] || ""),
    comment: String(r[3] || ""),
  }));
  return json_({ ok: true, entries });
}
