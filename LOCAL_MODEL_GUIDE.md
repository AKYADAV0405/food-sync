# Developer Guide: Running Offline Local Models with Ollama

This guide details the roadmap to transition the "Jarvis Chef Companion" from Google Gemini to a fully local, offline LLaMA model stack running on the client machine using Ollama. This setup requires **zero external API keys** and runs at **zero cost** completely offline.

---

## 1. Install Ollama

Ollama is a lightweight framework that packages and runs large language models locally.

1. **Download Ollama**: Visit [Ollama.com](https://ollama.com) and download the version for your operating system:
   - **Windows**: Install the Windows execution package.
   - **macOS**: Install the macOS App.
   - **Linux**: Run the installation curl script:
     ```bash
     curl -fsSL https://ollama.com/install.sh | sh
     ```
2. **Verify Installation**: Open your command line and run:
   ```bash
   ollama --version
   ```

---

## 2. Pull the LLaMA 3 Model

We recommend LLaMA 3 (8 Billion parameters) for high-quality conversational output on modern local hardware.

Run the following command to download the model weights:
```bash
ollama pull llama3
```
*Note: This requires a download of approximately 4.7 GB. Ensure you have an active network connection and sufficient disk space.*

---

## 3. Ollama API Architecture

Once installed, Ollama runs a local web server running on:
```
http://localhost:11434
```
It exposes an OpenAI-compatible endpoint at:
```
http://localhost:11434/v1
```

---

## 4. Reconfiguring backend `jarvis_engine.py`

To redirect Jarvis queries to the offline local model, we modify [jarvis_engine.py](file:///e:/models/backend/services/jarvis_engine.py) to point to the local HTTP endpoint instead of initializing the Google GenAI client.

### Option A: Using raw `requests` / `httpx` (No extra libraries)

Replace the client call in `jarvis_engine.py` with an HTTP post to the local completions endpoint:

```python
import httpx
import json

def generate_jarvis_response_ollama(query: str, client_time: str, inventory: list, history: list) -> dict:
    # 1. Format pantry inventory and instructions
    inventory_str = ... # same inventory list formatting
    system_instruction = ... # same Tony Jarvis persona instruction

    # 2. Build history payload
    messages = [{"role": "system", "content": system_instruction}]
    for msg in history:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})
    
    messages.append({"role": "user", "content": query})

    # 3. Post to Ollama local server
    # We request JSON format output to ensure it matches our Pydantic schema structure
    try:
        response = httpx.post(
            "http://localhost:11434/v1/chat/completions",
            json={
                "model": "llama3",
                "messages": messages,
                "response_format": { "type": "json_object" } # Instruct LLaMA to yield JSON
            },
            timeout=60.0
        )
        result = response.json()
        content_text = result["choices"][0]["message"]["content"]
        return json.loads(content_text)
    except Exception as e:
        print(f"Local Ollama connection failed: {e}")
        # Return fallback simulation
        return { ... }
```

### Option B: Using OpenAI Client Library

If you prefer using a structured SDK, install the `openai` python library:
```bash
pip install openai
```
Then rewrite client configuration to connect locally:
```python
from openai import OpenAI

# Connect to local Ollama server
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama" # placeholder, key is not checked locally
)

response = client.chat.completions.create(
    model="llama3",
    messages=[
        {"role": "system", "content": system_instruction},
        *history_messages,
        {"role": "user", "content": query}
    ],
    response_format={ "type": "json_object" }
)
```

---

## 5. Running and Validating

1. Launch Ollama in the background (or run `ollama serve`).
2. Restart the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8001
   ```
3. Check the Jarvis cockpit page `/jarvis-chef`. All suggestions and guided steps will now generate in real time on your CPU/GPU, complete with voice control and speech feedback.
