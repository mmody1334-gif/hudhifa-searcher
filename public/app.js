const chat = document.getElementById("chat");
const input = document.getElementById("q");
const sendBtn = document.getElementById("send");

function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}

// تحويل Markdown بسيط (نقاط، جداول، خط عريض) إلى HTML آمن
function render(md){
  const lines = md.split("\n"); let out = "", list = false, i = 0;
  const closeList = () => { if(list){out += "</ul>"; list = false;} };
  while(i < lines.length){
    const l = lines[i].trim();
    if(l.startsWith("|") && lines[i+1] && /^\|?\s*:?-{2,}/.test(lines[i+1].trim())){
      closeList();
      const cells = r => r.replace(/^\||\|$/g,"").split("|").map(c=>inline(c.trim()));
      out += "<table><thead><tr>" + cells(l).map(c=>`<th>${c}</th>`).join("") + "</tr></thead><tbody>";
      i += 2;
      while(i < lines.length && lines[i].trim().startsWith("|")){
        out += "<tr>" + cells(lines[i].trim()).map(c=>`<td>${c}</td>`).join("") + "</tr>"; i++;
      }
      out += "</tbody></table>"; continue;
    }
    if(/^[-*•]\s+/.test(l)){
      if(!list){out += "<ul>"; list = true;}
      out += "<li>" + inline(l.replace(/^[-*•]\s+/,"")) + "</li>";
    } else if(l){ closeList(); out += "<p>" + inline(l.replace(/^#+\s*/,"")) + "</p>"; }
    else closeList();
    i++;
  }
  closeList(); return out;
}

function add(cls, html){
  const d = document.createElement("div");
  d.className = "msg " + cls; d.innerHTML = html;
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
}

async function ask(text){
  const question = text.trim(); if(!question) return;
  document.getElementById("chips")?.remove();
  add("user", esc(question)); input.value = "";
  sendBtn.disabled = true;
  const wait = add("bot", '<span class="dots"><span></span><span></span><span></span></span>');
  try{
    const r = await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question})});
    const data = await r.json();
    if(!r.ok) throw new Error(data.error);
    wait.innerHTML = render(data.answer);
  }catch(e){
    wait.classList.add("err"); wait.textContent = e.message || "حدث خطأ، حاول مرة أخرى.";
  }
  sendBtn.disabled = false; input.focus(); chat.scrollTop = chat.scrollHeight;
}

sendBtn.onclick = () => ask(input.value);
input.addEventListener("keydown", e => { if(e.key === "Enter") ask(input.value); });
document.querySelectorAll("#chips button").forEach(b => b.onclick = () => ask(b.textContent));
