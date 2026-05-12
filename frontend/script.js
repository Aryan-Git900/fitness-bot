document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const welcomeMessage = document.getElementById('welcome-message');
    const suggestionChips = document.getElementById('suggestion-chips');
    const errorToast = document.getElementById('error-toast');

    // Generate a unique session ID for this conversation
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 11);

    // API URL — auto-detects local (file:// or localhost) vs. deployed
    // Note: when opened as a file:// URL, hostname is '' (empty string)
    const isLocal = ['127.0.0.1', 'localhost', ''].includes(window.location.hostname);
    const API_URL = isLocal
        ? 'http://127.0.0.1:5000/api/chat'
        : '/api/chat'; // On Netlify, use relative path via redirect proxy

    // Configure Marked.js for clean markdown rendering
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false
    });

    let isLoading = false;

    // ── Utility: Scroll to bottom ──────────────────────────────────
    function scrollToBottom() {
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
    }

    // ── Utility: Format timestamp ──────────────────────────────────
    function getTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // ── Show error toast ───────────────────────────────────────────
    function showError(message) {
        errorToast.textContent = message;
        errorToast.classList.add('show');
        setTimeout(() => errorToast.classList.remove('show'), 4000);
    }

    // ── Add a message to the chat ──────────────────────────────────
    function addMessage(content, isUser = false) {
        // Hide welcome message on first message
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        if (isUser) {
            // Sanitize user input to prevent XSS
            contentDiv.textContent = content;
        } else {
            // Render markdown for bot messages
            contentDiv.innerHTML = marked.parse(content);
        }

        const timeDiv = document.createElement('div');
        timeDiv.classList.add('message-time');
        timeDiv.textContent = getTime();

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    // ── Add typing indicator ───────────────────────────────────────
    function addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.classList.add('typing-indicator');
        indicator.id = 'typing-indicator';

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('typing-dot');
            indicator.appendChild(dot);
        }

        chatContainer.appendChild(indicator);
        scrollToBottom();
        return indicator;
    }

    // ── Remove typing indicator ────────────────────────────────────
    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    // ── Set loading state ──────────────────────────────────────────
    function setLoading(loading) {
        isLoading = loading;
        sendBtn.disabled = loading;
        userInput.disabled = loading;
        if (loading) {
            sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        } else {
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }
    }

    // ── Send message to backend ────────────────────────────────────
    async function sendMessage(message) {
        if (!message || isLoading) return;

        addMessage(message, true);
        setLoading(true);
        addTypingIndicator();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, session_id: sessionId }),
            });

            const data = await response.json();
            removeTypingIndicator();

            if (response.ok && data.response) {
                addMessage(data.response, false);
            } else {
                const errMsg = data.error || 'An error occurred. Please try again.';
                addMessage(`⚠️ ${errMsg}`, false);
                showError(errMsg);
            }
        } catch (error) {
            removeTypingIndicator();
            const errMsg = 'Network error. Please check your connection and try again.';
            addMessage(`⚠️ ${errMsg}`, false);
            showError(errMsg);
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }

    // ── Handle form submission ─────────────────────────────────────
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message || isLoading) return;
        userInput.value = '';
        autoResize();
        await sendMessage(message);
    });

    // ── Handle Enter key (Shift+Enter = newline) ───────────────────
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // ── Auto-resize textarea ───────────────────────────────────────
    function autoResize() {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    }

    userInput.addEventListener('input', autoResize);

    // ── Suggestion chips ───────────────────────────────────────────
    if (suggestionChips) {
        suggestionChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (chip) {
                const msg = chip.dataset.msg;
                if (msg) sendMessage(msg);
            }
        });
    }

    // ── Clear chat ─────────────────────────────────────────────────
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            // Remove all messages except the welcome div
            const messages = chatContainer.querySelectorAll('.message, .typing-indicator');
            messages.forEach(m => m.remove());

            // Show welcome message again
            if (welcomeMessage) {
                welcomeMessage.style.display = '';
            }
        });
    }

    // ── Info button ────────────────────────────────────────────────
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            addMessage("I'm **Aura**, your AI Fitness Coach powered by **Google Gemini 2.0 Flash**! I can help you with:\n\n- 🏋️ **Workout Plans** – Tailored to your goals and fitness level\n- 🥗 **Nutrition Advice** – Macros, meal plans, and healthy eating tips\n- 💪 **Muscle Building** – Progressive overload, exercises, and recovery\n- 🏃 **Cardio & Weight Loss** – Effective strategies for burning fat\n- 😴 **Recovery & Sleep** – Rest, stretching, and injury prevention\n\nJust type your question and I'll help you crush your goals! 🚀", false);
        });
    }

    // ── Focus input on load ────────────────────────────────────────
    userInput.focus();
});
