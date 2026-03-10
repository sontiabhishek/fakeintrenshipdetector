document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation ---
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- Tabs ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked & corresponding content
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    // --- Drag and Drop File Upload ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // Make whole dropzone clickable
    dropZone.addEventListener('click', () => fileInput.click());

    // Highlight dropzone on drag over
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // --- Actions ---
    const analyzeTextBtn = document.getElementById('analyze-text-btn');
    const textInput = document.querySelector('.text-input');

    analyzeTextBtn.addEventListener('click', () => {
        if (textInput.value.trim().length > 10) {
            startAnalysis('text');
        } else {
            alert('Please enter a longer description to analyze.');
        }
    });

    function handleFileUpload(file) {
        // Basic validation for image
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (JPG, PNG).');
            return;
        }

        // In a real app, we might show a preview here
        // For the mock, we just proceed to analysis
        startAnalysis('image');
    }

    // --- AI Analysis via Local Ollama ---
    const inputArea = document.getElementById('input-area');
    const scanningState = document.getElementById('scanning-state');
    const resultsArea = document.getElementById('results-area');
    const progressFill = document.querySelector('.progress-fill');
    const loadingText = document.querySelector('.loading-text');

    const loadingPhrases = [
        "Sending data to local Ollama model...",
        "Analyzing text semantics with llama3...",
        "Checking for common scam patterns...",
        "Evaluating compensation and urgency flags...",
        "Structuring final response..."
    ];

    async function startAnalysis(type) {
        let textToAnalyze = "";

        if (type === 'text') {
            textToAnalyze = document.querySelector('.text-input').value.trim();
        } else if (type === 'image') {
            // For this demo, inject a mock fake text from image OCR since llama3 is text-only
            textToAnalyze = "Mock OCR Text: Hiring interns urgently! Limited seats. Earn $5000/month. No experience needed. Pay $50 registration fee to apply. Contact via WhatsApp only.";
            console.log("Image upload detected. Using mock OCR text for Llama3 since it's a text model.");
        }

        // Hide input, show scanning
        inputArea.classList.add('hidden');
        resultsArea.classList.add('hidden');
        scanningState.classList.remove('hidden');

        // Reset progress
        progressFill.style.width = '10%';
        loadingText.textContent = loadingPhrases[0];

        let phraseIndex = 0;

        // Simulate progress bar and text changes while waiting for API
        const interval = setInterval(() => {
            let currentWidth = parseFloat(progressFill.style.width);
            if (currentWidth < 90) {
                progressFill.style.width = `${currentWidth + Math.random() * 5}%`;
            }

            // Change phrase periodically
            if (Math.random() > 0.7 && phraseIndex < loadingPhrases.length - 1) {
                phraseIndex++;
                loadingText.textContent = loadingPhrases[phraseIndex];
            }
        }, 800);

        try {
            const apiResult = await callOllama(textToAnalyze);
            clearInterval(interval);
            progressFill.style.width = '100%';
            loadingText.textContent = "Analysis complete!";

            setTimeout(() => {
                showResults(apiResult);
            }, 500);

        } catch (error) {
            clearInterval(interval);
            scanningState.classList.add('hidden');
            inputArea.classList.remove('hidden');
            alert("Error communicating with local AI model. Please ensure Ollama is running on localhost:11434 with llama3.");
            console.error("Analysis Error:", error);
        }
    }

    async function callOllama(text) {
        const systemPrompt = `You are an expert fraud detection AI. Analyze the given internship poster and determine if it is FAKE or REAL.

Check for these red flags:
- Registration or joining fee required
- Unrealistic stipend or salary
- No official company name or website
- Only WhatsApp or personal contact
- Urgency pressure tactics ("limited seats", "apply now")
- Vague job description
- Too good to be true perks (free iPhone, laptop, etc.)
- Poor grammar or excessive punctuation

Check for these trust signals:
- Official company email domain
- Clear job role and responsibilities
- Realistic stipend amount
- Application deadline mentioned
- Eligibility criteria clearly defined
- Official website or careers page link

Respond ONLY in this exact JSON format:
{
  "verdict": "FAKE" or "REAL",
  "confidence": <number between 0-100>,
  "red_flags": ["flag1", "flag2"],
  "trust_signals": ["signal1", "signal2"],
  "summary": "2-3 sentence explanation"
}`;

        const promptText = `${systemPrompt}\n\nPoster Text:\n${text}`;

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify({
                model: 'llama3',
                prompt: promptText,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error! status: ${response.status}`);
        }

        const data = await response.json();

        // Extract JSON from response string (in case the model wraps it in markdown blocks)
        let jsonStr = data.response;
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        }

        // Additional cleanup: sometimes it might have non-JSON text before or after
        const startIndex = jsonStr.indexOf('{');
        const endIndex = jsonStr.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
            jsonStr = jsonStr.substring(startIndex, endIndex + 1);
        }

        return JSON.parse(jsonStr);
    }

    function showResults(result) {
        scanningState.classList.add('hidden');
        resultsArea.classList.remove('hidden');

        renderResultsDashboard(result);

        // Scroll to results
        resultsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderResultsDashboard(result) {
        const isFake = result.verdict && result.verdict.toUpperCase() === 'FAKE';
        const score = result.confidence || 0;

        const verdictClass = isFake ? 'verdict-fake' : 'verdict-real';
        const verdictText = isFake ? 'LIKELY FAKE' : 'APPEARS LEGIT';
        const iconName = isFake ? 'shield-alert' : 'shield-check';

        let flagsHTML = '';

        if (result.red_flags && Array.isArray(result.red_flags) && result.red_flags.length > 0) {
            result.red_flags.forEach(flag => {
                flagsHTML += `
                    <div class="flag-item negative">
                        <i data-lucide="alert-circle"></i>
                        <div class="flag-content">
                            <h4>Red Flag Detected</h4>
                            <p>${flag}</p>
                        </div>
                    </div>
                `;
            });
        }

        if (result.trust_signals && Array.isArray(result.trust_signals) && result.trust_signals.length > 0) {
            result.trust_signals.forEach(signal => {
                flagsHTML += `
                    <div class="flag-item positive">
                        <i data-lucide="check-circle-2"></i>
                        <div class="flag-content">
                            <h4>Trust Signal</h4>
                            <p>${signal}</p>
                        </div>
                    </div>
                `;
            });
        }

        if (flagsHTML === '') {
            flagsHTML = `
                <div class="flag-item warning">
                    <i data-lucide="info"></i>
                    <div class="flag-content">
                        <h4>Inconclusive</h4>
                        <p>No major red flags or clear trust signals found. Proceed with caution.</p>
                    </div>
                </div>
            `;
        }

        resultsArea.innerHTML = `
            <div class="result-card glass-card">
                <div class="result-header ${verdictClass}">
                    <div class="verdict-box">
                        <div class="verdict-icon">
                            <i data-lucide="${iconName}"></i>
                        </div>
                        <div>
                            <div class="score-label">Final Verdict</div>
                            <div class="verdict-title">${verdictText}</div>
                        </div>
                    </div>
                    <div class="confidence-score">
                        <div class="score-value">${score}%</div>
                        <div class="score-label">Confidence Score</div>
                        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 8px; overflow: hidden;">
                            <div style="width: ${score}%; height: 100%; background: ${isFake ? 'var(--danger)' : 'var(--success)'}; border-radius: 3px; transition: width 1s ease-out;"></div>
                        </div>
                    </div>
                </div>
                
                <p style="margin-bottom: 2rem; font-size: 1.125rem; color: var(--text-main); padding: 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; line-height: 1.6;">
                    <strong>AI Summary:</strong> ${result.summary || 'No summary provided by AI.'}
                </p>

                <h3 style="margin-bottom: 1.5rem; font-size: 1.25rem;">Analysis Breakdown</h3>
                <div class="flags-list">
                    ${flagsHTML}
                </div>
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button class="btn btn-secondary" onclick="location.reload()">Scan Another Poster</button>
                    ${isFake ? '<button class="btn btn-primary">Report Scam Pattern</button>' : ''}
                </div>
            </div>
        `;

        // Re-initialize Lucide icons for the newly injected HTML
        lucide.createIcons();
    }
});
