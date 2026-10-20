/**
 * حفظ آراء أولياء الأمور في Google Sheets (حفظ دائم ومجاني)
 *
 * الخطوات:
 * 1) أنشئ Google Sheet جديد ← Extensions (الإضافات) ← Apps Script
 * 2) امسح الكود الموجود والصق هذا الملف كاملاً، وغيّر قيمة SECRET بكلمة سرية من اختيارك
 * 3) Deploy ← New deployment ← النوع: Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4) انسخ رابط الـ Web app (ينتهي بـ /exec)
 * 5) في Render ← Environment أضف:
 *      SURVEY_SHEET_URL    = رابط الـ Web app
 *      SURVEY_SHEET_SECRET = نفس كلمة SECRET
 */
const SECRET = "غيّر-هذه-الكلمة";
const SHEET_NAME = "الآراء";

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["id", "التاريخ", "الاسم", "الرأي"]);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ ok: false, error: "unauthorized" });
    const x = body.entry || {};
    sheet_().appendRow([x.id, x.date, x.name || "", x.comment || ""]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  if ((e.parameter.secret || "") !== SECRET) return json_({ ok: false, error: "unauthorized" });
  const rows = sheet_().getDataRange().getValues().slice(1);
  const entries = rows.filter(r => r[3]).map(r => ({
    id: String(r[0]),
    date: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
    name: String(r[2] || ""),
    comment: String(r[3] || ""),
  }));
  return json_({ ok: true, entries });
}
