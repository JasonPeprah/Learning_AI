// Learning_AI_Functions.js

// 1. Page Navigation
function navigateTo(page) {
  window.location.href = page;
}

// 2. Handle Drag & Drop
function handleDragOver(event) {
  event.preventDefault();
}

function handleDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) {
    readFileContent(file);
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    readFileContent(file);
  }
}

// 3. Read File Content
function readFileContent(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === "pdf") {
    const reader = new FileReader();
    reader.onload = function () {
      const typedArray = new Uint8Array(reader.result);
      pdfjsLib.getDocument({ data: typedArray }).promise.then(function (pdf) {
        let textPromises = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          textPromises.push(pdf.getPage(i).then(page => page.getTextContent()));
        }
        Promise.all(textPromises).then(contents => {
          const text = contents.map(content => content.items.map(i => i.str).join(" ")).join("\n");
          fillInputBox(text);
        });
      });
    };
    reader.readAsArrayBuffer(file);

  } else if (ext === "docx") {
    const reader = new FileReader();
    reader.onload = function (event) {
      mammoth.extractRawText({ arrayBuffer: event.target.result })
        .then(result => fillInputBox(result.value));
    };
    reader.readAsArrayBuffer(file);

  } else if (ext === "pptx") {
    const reader = new FileReader();
    reader.onload = function (event) {
      JSZip.loadAsync(event.target.result).then(zip => {
        let slideTexts = [];
        const slideRegex = /ppt\/slides\/slide\d+\.xml/;

        const slides = Object.keys(zip.files).filter(name => slideRegex.test(name));
        const promises = slides.map(slide => zip.files[slide].async("string"));

        Promise.all(promises).then(contents => {
          contents.forEach(content => {
            const matches = content.match(/<a:t>(.*?)<\/a:t>/g);
            if (matches) {
              slideTexts.push(matches.map(t => t.replace(/<\/?a:t>/g, '')).join(' '));
            }
          });
          fillInputBox(slideTexts.join("\n"));
        });
      });
    };
    reader.readAsArrayBuffer(file);

  } else if (ext === "txt" || ext === "md") {
    const reader = new FileReader();
    reader.onload = function (e) {
      fillInputBox(e.target.result);
    };
    reader.readAsText(file);
  }
}

// 4. Handle Image OCR
function handleImageInput(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;

  Tesseract.recognize(file, 'eng').then(result => {
    fillInputBox(result.data.text);
  });
}

function fillInputBox(content) {
  const noteInput = document.getElementById("noteInput") || document.getElementById("questionNoteInput");
  if (noteInput) noteInput.value = content;
}

// 5. Simplify Notes (AI)
async function simplifyNotes() {
  const input = document.getElementById("noteInput").value.trim();
  if (!input) return alert("Please provide some notes.");

  const prompt = `Simplify the following study notes:\n${input}`;
  const response = await callCohereAPI(prompt);
  if (response) {
    document.getElementById("simplifiedNotes").innerText = response;
    document.getElementById("simplifiedNotesContainer").style.display = "block";
    localStorage.setItem("lastSimplifiedNotes", response);
  }
}

// 6. Generate Questions
async function generateQuestions() {
  const input = document.getElementById("questionNoteInput").value.trim();
  if (!input) return alert("Please enter some text.");

  const prompt = `Generate 5 study questions from this content:\n${input}`;
  const response = await callCohereAPI(prompt);

  if (response) {
    const questions = response.split("\n").filter(q => q.trim());
    const questionsList = document.getElementById("questionsList");
    questionsList.innerHTML = "";
    questions.forEach(q => {
      const li = document.createElement("li");
      li.innerText = q;
      questionsList.appendChild(li);
    });

    document.getElementById("questionsContainer").style.display = "block";
    document.getElementById("generateAnswersBtn").disabled = false;

    localStorage.setItem("latestQuestions", JSON.stringify(questions));
  }
}

// 7. Generate Answers
async function generateAnswers() {
  const questionsList = document.getElementById("questionsList");
  const questions = Array.from(questionsList.children).map(li => li.innerText).join("\n");
  if (!questions) return alert("No questions found.");

  const prompt = `Provide brief answers to the following questions:\n${questions}`;
  const response = await callCohereAPI(prompt);

  if (response) {
    document.getElementById("answersList").innerText = response;
    document.getElementById("answersContainer").style.display = "block";
    localStorage.setItem("latestAnswers", response);
  }
}

// 8. Call Cohere API
async function callCohereAPI(prompt) {
  try {
    const res = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer dSKwSBDxZy0gQsB6pdK09IBHPqmr8j0pg2v38r3t",
        "Content-Type": "application/json",
        "Cohere-Version": "2022-12-06"
      },
      body: JSON.stringify({
        message: prompt,
        chat_history: []
      })
    });

    const data = await res.json();
    if (res.ok && data.text) return data.text.trim();
    else {
      alert("Failed to get a response from Cohere.");
      console.error(data);
      return null;
    }
  } catch (err) {
    alert("Error contacting Cohere API.");
    console.error(err);
    return null;
  }
}

// 9. Update Theme Colors
function updatePrimaryColor(color) {
  document.documentElement.style.setProperty('--primary-color', color);
  localStorage.setItem('primaryColor', color);
}

function updateSecondaryColor(color) {
  document.documentElement.style.setProperty('--secondary-color', color);
  localStorage.setItem('secondaryColor', color);
}

// 10. Load Theme on Page Load
window.addEventListener("DOMContentLoaded", () => {
  const p = localStorage.getItem('primaryColor');
  const s = localStorage.getItem('secondaryColor');
  if (p) document.documentElement.style.setProperty('--primary-color', p);
  if (s) document.documentElement.style.setProperty('--secondary-color', s);

  const historyContainer = document.getElementById("historyContainer");
  if (historyContainer) {
    const qHistory = JSON.parse(localStorage.getItem("latestQuestions") || "[]");
    const aHistory = localStorage.getItem("latestAnswers");
    const simplified = localStorage.getItem("lastSimplifiedNotes");

    let html = "";
    if (qHistory.length > 0) {
      html += `<h4>Last Generated Questions:</h4><ul>${qHistory.map(q => `<li>${q}</li>`).join("")}</ul>`;
    }
    if (aHistory) {
      html += `<h4>Last Generated Answers:</h4><p>${aHistory.replace(/\n/g, "<br>")}</p>`;
    }
    if (simplified) {
      html += `<h4>Last Simplified Notes:</h4><p>${simplified.replace(/\n/g, "<br>")}</p>`;
    }

    historyContainer.innerHTML = html || "<p>No history found yet.</p>";
    historyContainer.style.display = "block";
  }
});

// 11. Show History on Settings Page
function showHistory() {
  const container = document.getElementById("historyContainer");
  if (container) {
    container.style.display = container.style.display === "none" ? "block" : "none";
  }
}
