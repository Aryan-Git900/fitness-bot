import os
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables (works locally with .env, uses system env on Render)
load_dotenv()

# ── Gemini Configuration ──────────────────────────────────────────
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is missing. Please set it in .env or your hosting environment.")

client = genai.Client(api_key=API_KEY)
MODEL_ID = "models/gemini-2.5-flash"

# ── Flask App Setup ───────────────────────────────────────────────
app = Flask(__name__)

CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"]
)

# ── System Prompt ─────────────────────────────────────────────────
SYSTEM_PROMPT = """You are Aura, a knowledgeable, friendly, and motivational AI Fitness Coach.
Your mission is to help users achieve their fitness goals by providing:
- Personalized workout plans and exercise guidance
- Nutrition advice, macro targets, and meal planning
- Motivation, accountability, and mindset coaching
- Recovery strategies, sleep tips, and injury prevention
- General health and wellness guidance

Response Guidelines:
- Keep responses clear, structured, and easy to read
- Use markdown formatting: **bold** for key points, bullet lists for steps/plans
- Be warm, encouraging, and empathetic — celebrate wins big and small
- Tailor advice to the user's stated goals and fitness level
- If asked about non-fitness topics, politely redirect back to health and fitness
- Never provide medical diagnoses or replace professional medical advice"""

# ── In-memory chat sessions ───────────────────────────────────────
# Each session stores a list of Content objects
chat_histories = {}

# ── Routes ────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "name": "Aura Fitness Bot API",
        "status": "running",
        "version": "2.0.0",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat [POST]"
        }
    })

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "message": "Aura Fitness Bot Backend is running",
        "model": MODEL_ID
    })

@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({"error": "No JSON data received. Send a JSON body with 'message'."}), 400

        user_message = data.get("message", "").strip()
        session_id = data.get("session_id", "default")

        if not user_message:
            return jsonify({"error": "Message is required and cannot be empty."}), 400

        # Build conversation history for this session
        history = chat_histories.get(session_id, [])

        # Add user message to history
        history.append(types.Content(
            role="user",
            parts=[types.Part(text=user_message)]
        ))

        # Call Gemini API with full history and system instruction
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.8,
                max_output_tokens=1024,
            )
        )

        assistant_text = response.text

        # Add assistant response to history
        history.append(types.Content(
            role="model",
            parts=[types.Part(text=assistant_text)]
        ))

        # Save updated history (limit to last 20 turns to avoid memory bloat)
        chat_histories[session_id] = history[-40:]

        return jsonify({
            "response": assistant_text,
            "session_id": session_id
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "error": f"An error occurred: {str(e)}"
        }), 500


# ── Entry Point ───────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"
    app.run(debug=debug, host="0.0.0.0", port=port)
