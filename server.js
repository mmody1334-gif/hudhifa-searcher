app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'الرجاء كتابة سؤال.' });

    if (!apiKey) {
      return res.status(500).json({ error: 'لم يتم العثور على مفتاح GEMINI_API_KEY في متغيرات البيئة.' });
    }

    const prompt = `${SYSTEM_PROMPT}\n\nسؤال المستخدم: ${message}`;

    // مصفوفة بالموديلات البديلة بالترتيب لتجنب ضغط الـ 503
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return res.json({ reply: response.text() });
      } catch (err) {
        lastError = err;
        // إذا كان الخطأ 503 (ضغط سيرفرات)، ينتقل فوراً للموديل التالي
        console.warn(`فشل الموديل ${modelName} بسبب الضغط، جاري تجربة موديل بديل...`);
      }
    }

    throw lastError;
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ 
      error: `السيرفر يواجه ضغطاً لحظياً من جوجل، يرجى إعادة إرسال السؤال بعد ثوانٍ معدودة.` 
    });
  }
});
