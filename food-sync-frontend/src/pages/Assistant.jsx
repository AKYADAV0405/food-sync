import { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import "../assets/styles/assistant.css";


const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Simple, self-contained Markdown Renderer component to avoid dependency version conflicts
const MarkdownRenderer = ({ text }) => {
  if (!text) return null;

  const renderInline = (line) => {
    const regex = /\*\*(.*?)\*\*/g;
    const elements = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        elements.push(<span key={key++}>{line.substring(lastIndex, match.index)}</span>);
      }
      elements.push(<strong key={key++}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      elements.push(<span key={key++}>{line.substring(lastIndex)}</span>);
    }

    return elements.length > 0 ? elements : line;
  };

  const lines = text.split("\n");
  const parsedElements = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith("### ")) {
      parsedElements.push(<h3 key={idx}>{renderInline(trimmed.substring(4))}</h3>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      parsedElements.push(<h2 key={idx}>{renderInline(trimmed.substring(3))}</h2>);
      return;
    }
    if (trimmed.startsWith("# ")) {
      parsedElements.push(<h1 key={idx}>{renderInline(trimmed.substring(2))}</h1>);
      return;
    }

    // Unordered lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulMatch) {
      parsedElements.push(
        <li key={idx} style={{ marginLeft: "1.25rem", listStyleType: "disc" }}>
          {renderInline(ulMatch[2])}
        </li>
      );
      return;
    }

    // Ordered lists
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      parsedElements.push(
        <li key={idx} style={{ marginLeft: "1.25rem", listStyleType: "decimal" }}>
          {renderInline(olMatch[2])}
        </li>
      );
      return;
    }

    // Empty lines
    if (trimmed === "") {
      parsedElements.push(<div key={idx} style={{ height: "0.5rem" }} />);
      return;
    }

    // Normal paragraph
    parsedElements.push(<p key={idx}>{renderInline(line)}</p>);
  });

  return <div className="markdown-content">{parsedElements}</div>;
};

// Strips markdown characters before passing text to Speech Synthesis
const stripMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1")     // Italics
    .replace(/###?\s+(.*)/g, "$1")      // Headers
    .replace(/[-*+]\s+/g, "")          // Bullets
    .replace(/\d+\.\s+/g, "")          // Numbers
    .replace(/`([^`]+)`/g, "$1")       // Inline code
    .replace(/👋|🤖|🌶️|⏱️|🥬|🥚|🍽️/g, "") // Emojis
    .trim();
};

// Extracts user speech from voice recognition transcript, removing echo of spoken companion text
const extractUserSpeech = (transcript, spokenText) => {
  if (!spokenText) return transcript;
  const cleanT = transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
  const cleanS = spokenText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
  
  if (!cleanS) return transcript;
  
  const tWords = cleanT.split(" ");
  const sWords = cleanS.split(" ");
  
  let maxMatchLength = 0;
  
  for (let len = 1; len <= tWords.length; len++) {
    const prefix = tWords.slice(0, len).join(" ");
    if (cleanS.includes(prefix)) {
      maxMatchLength = len;
    } else {
      break;
    }
  }
  
  if (maxMatchLength > 0) {
    const userWords = tWords.slice(maxMatchLength);
    return userWords.join(" ");
  }
  
  return transcript;
};

// Scans text responses for nutritional info to dynamically update telemetry cards
const extractNutrition = (text) => {
  if (!text) return null;
  const caloriesMatch = text.match(/calories:\s*([\d\w\s]+)/i) || text.match(/(\d+\s*kcal)/i);
  const proteinMatch = text.match(/protein:\s*([\d\w\s]+)/i) || text.match(/protein\s*([\d]+g)/i);
  const carbsMatch = text.match(/carbs:\s*([\d\w\s]+)/i) || text.match(/carbohydrates:\s*([\d\w\s]+)/i) || text.match(/carbs\s*([\d]+g)/i);
  const fatMatch = text.match(/fat:\s*([\d\w\s]+)/i) || text.match(/fat\s*([\d]+g)/i);

  if (caloriesMatch || proteinMatch || carbsMatch || fatMatch) {
    return {
      calories: caloriesMatch ? caloriesMatch[1].trim() : "N/A",
      protein: proteinMatch ? proteinMatch[1].trim() : "N/A",
      carbs: carbsMatch ? carbsMatch[1].trim() : "N/A",
      fat: fatMatch ? fatMatch[1].trim() : "N/A"
    };
  }
  return null;
};

export default function Assistant() {
  const { getAuthHeaders, currentUser } = useAuth();
  
  // Companion and user profile states
  const [companionName, setCompanionName] = useState("Jarvis");
  const [userName, setUserName] = useState("friend");
  const [hasInitializedMessage, setHasInitializedMessage] = useState(false);

  // Chat History state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Voice mode and speech state
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speechRate, setSpeechRate] = useState(0.95);
  const [consoleLog, setConsoleLog] = useState("SYSTEM: INITIALIZED. STANDING BY.");
  const [nutritionData, setNutritionData] = useState(null);
  const [assistantLang, setAssistantLang] = useState("en-US");

  // Jarvis recipe, voice cockpit and memory states
  const [jarvisRecipe, setJarvisRecipe] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [voiceHistory, setVoiceHistory] = useState([]);
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState("");
  const [isCooked, setIsCooked] = useState(false);
  const [cookLoading, setCookLoading] = useState(false);

  // Vision AI Action states
  const [isScanningCounter, setIsScanningCounter] = useState(false);
  const [isCheckingDoneness, setIsCheckingDoneness] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [donenessResult, setDonenessResult] = useState(null);
  const [safetyAlert, setSafetyAlert] = useState(null);

  // Time context
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [timeOfDayContext, setTimeOfDayContext] = useState({ title: "", description: "" });

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const currentSpeechTextRef = useRef("");
  
  // Keep Refs updated to prevent stale closures inside speech callback loops
  const isVoiceModeRef = useRef(isVoiceMode);
  const isSpeakingRef = useRef(isSpeaking);
  const loadingRef = useRef(loading);
  const transcriptRef = useRef(input);
  const jarvisRecipeRef = useRef(jarvisRecipe);
  const activeStepIndexRef = useRef(activeStepIndex);
  const assistantLangRef = useRef(assistantLang);

  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    transcriptRef.current = input;
  }, [input]);

  useEffect(() => {
    jarvisRecipeRef.current = jarvisRecipe;
  }, [jarvisRecipe]);

  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
  }, [activeStepIndex]);

  useEffect(() => {
    assistantLangRef.current = assistantLang;
  }, [assistantLang]);

  // Load User Profile details for personalized companion name & user name
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${BASE_URL}/profile`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.companion_name) {
            setCompanionName(data.companion_name);
          }
          if (data.name) {
            setUserName(data.name);
          }
          if (data.language) {
            setAssistantLang(data.language);
          }
        }
      } catch (err) {
        console.error("Failed to load profile details", err);
      }
    };
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  // Dynamically initialize greeting once companion name is loaded
  useEffect(() => {
    if (companionName && !hasInitializedMessage) {
      setMessages([
        {
          role: "chef",
          content: `👋 Hey there! I'm your AI kitchen companion, **${companionName}**! I'm your warm, knowledgeable friend hanging out in the kitchen with you. Tell me what's on your mind or what you're craving today, and let's check what we've got in the fridge! 🍳`
        }
      ]);
      setHasInitializedMessage(true);
    }
  }, [companionName, hasInitializedMessage]);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Update Time telemetry
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setCurrentTimeStr(timeStr);

      const hour = now.getHours();
      if (hour >= 5 && hour < 11.5) {
        setTimeOfDayContext({
          title: "Morning Operations",
          description: "Recommending energizing breakfasts to start your day, friend."
        });
      } else if (hour >= 11.5 && hour < 16) {
        setTimeOfDayContext({
          title: "Mid-Day Operations",
          description: "Suggesting balanced lunches for sustained performance."
        });
      } else {
        setTimeOfDayContext({
          title: "Evening Operations",
          description: "Suggesting relaxing dinners to help you recover."
        });
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch speech synthesis voices
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const populateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
      const defaultVoice =
        allVoices.find((v) => v.name.includes("Google US English")) ||
        allVoices.find((v) => v.lang.startsWith("en-US")) ||
        allVoices.find((v) => v.lang.startsWith("en")) ||
        allVoices[0];
      setSelectedVoice(defaultVoice);
    };

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }, []);

  // Voice synthesis speaker
  const speakText = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop current speaking

    const cleanText = stripMarkdown(text);
    currentSpeechTextRef.current = cleanText;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;

    // Dynamically select voice based on current language preference
    const allVoices = window.speechSynthesis.getVoices();
    let matchedVoice = null;
    const currentLang = assistantLangRef.current;
    if (currentLang.startsWith("hi")) {
      matchedVoice = allVoices.find(v => v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi") || v.name.includes("Google हिन्दी"));
    } else {
      matchedVoice = selectedVoice || allVoices.find(v => v.lang.startsWith("en"));
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setConsoleLog(`${companionName.toUpperCase()}: TRANSMITTING AUDIO RESPONSE...`);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      currentSpeechTextRef.current = "";
      setConsoleLog(`${companionName.toUpperCase()}: AUDIO SPEECH COMPLETED.`);
      // Resume listening if voice mode is still enabled
      if (isVoiceModeRef.current) {
        startListening();
      }
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      setIsSpeaking(false);
      currentSpeechTextRef.current = "";
      setConsoleLog("SYSTEM ERROR: SPEECH SYNTHESIS INTERRUPTED.");
      if (isVoiceModeRef.current) {
        startListening();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Walkthrough navigation handlers
  const handleNextStep = () => {
    const currentRecipe = jarvisRecipeRef.current;
    const currentIdx = activeStepIndexRef.current;
    if (!currentRecipe || !currentRecipe.instructions) return;
    
    if (currentIdx < currentRecipe.instructions.length - 1) {
      const nextIdx = currentIdx + 1;
      setActiveStepIndex(nextIdx);
      speakText(`Step ${nextIdx + 1}: ${currentRecipe.instructions[nextIdx]}. Did you do that? Let me know when you're done!`);
      setConsoleLog(`${companionName.toUpperCase()}: READING STEP ${nextIdx + 1}`);
    } else {
      speakText("Awesome, you have completed all steps! Enjoy your meal!");
      setConsoleLog(`${companionName.toUpperCase()}: INSTRUCTIONS COMPLETED.`);
    }
  };

  const handlePrevStep = () => {
    const currentRecipe = jarvisRecipeRef.current;
    const currentIdx = activeStepIndexRef.current;
    if (!currentRecipe || !currentRecipe.instructions) return;

    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setActiveStepIndex(prevIdx);
      speakText(`Step ${prevIdx + 1}: ${currentRecipe.instructions[prevIdx]}. Did you do that? Let me know when you're done!`);
      setConsoleLog(`${companionName.toUpperCase()}: READING STEP ${prevIdx + 1}`);
    } else {
      speakText("This is the first step!");
    }
  };

  const handleRepeatStep = () => {
    const currentRecipe = jarvisRecipeRef.current;
    const currentIdx = activeStepIndexRef.current;
    if (!currentRecipe || !currentRecipe.instructions) return;
    
    speakText(`Repeating step ${currentIdx + 1}: ${currentRecipe.instructions[currentIdx]}. Did you do that? Let me know when you're done!`);
    setConsoleLog(`${companionName.toUpperCase()}: REPEATING STEP ${currentIdx + 1}`);
  };

  const handleSpeakIngredients = () => {
    const currentRecipe = jarvisRecipeRef.current;
    if (!currentRecipe || !currentRecipe.ingredients) return;
    
    const speech = "The ingredients are: " + currentRecipe.ingredients.join(". ");
    speakText(speech);
    setConsoleLog(`${companionName.toUpperCase()}: READING INGREDIENTS LIST.`);
  };

  const handleCookRecipe = async () => {
    const currentRecipe = jarvisRecipeRef.current;
    if (!currentRecipe || cookLoading || isCooked) return;
    setCookLoading(true);
    setConsoleLog(`${companionName.toUpperCase()}: AUTOMATICALLY DEDUCTING INVENTORY & LOGGING MEAL...`);
    try {
      const formattedIngredients = (currentRecipe.ingredients || []).map((ingStr) => {
        const cleanName = ingStr.replace(/^[\d\.\/\s]+(g|kg|ml|l|tbsp|tsp|cup|cups|pieces|piece)?\s+/i, "").split(",")[0].trim();
        return { item: cleanName || ingStr, quantity: 1.0, unit: "pieces" };
      });

      const res = await fetch(`${BASE_URL}/assistant/complete-recipe`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recipe_name: currentRecipe.recipe_name,
          ingredients: formattedIngredients,
          servings: 2.0
        })
      });

      if (!res.ok) throw new Error("Complete recipe failed");
      
      setIsCooked(true);
      speakText(`Awesome! I have automatically deducted the ingredients for ${currentRecipe.recipe_name} from your pantry inventory and logged the meal to your cooking history.`);
      setConsoleLog(`${companionName.toUpperCase()}: PANTRY INVENTORY DEDUCTED & HISTORY LOGGED.`);
    } catch (err) {
      console.error(err);
      setConsoleLog("SYSTEM ERROR: INVENTORY DEDUCTION FAILURE.");
    } finally {
      setCookLoading(false);
    }
  };

  // Add counter scanned missing ingredients to user's Shopping List
  const handleAddMissingToShoppingList = async (ingredientsList) => {
    if (!ingredientsList || ingredientsList.length === 0) return;
    setConsoleLog(`${companionName.toUpperCase()}: ADDING INGREDIENTS TO SHOPPING LIST...`);
    try {
      for (const ing of ingredientsList) {
        await fetch(`${BASE_URL}/shopping-list/add`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            item: ing,
            quantity: 1.0,
            unit: "pieces"
          })
        });
      }
      speakText(`I have added ${ingredientsList.join(", ")} to your Shopping List!`);
      setMessages((prev) => [
        ...prev,
        {
          role: "chef",
          content: `🛒 **Added to Shopping List**:\n${ingredientsList.map((i) => `- ${i}`).join("\n")}`
        }
      ]);
      setConsoleLog(`${companionName.toUpperCase()}: INGREDIENTS ADDED TO SHOPPING LIST.`);
    } catch (err) {
      console.error(err);
      setConsoleLog("SYSTEM ERROR: FAILED TO ADD TO SHOPPING LIST.");
    }
  };

  // Proactive Emergency Safety Broadcast Handler (High-Priority Voice Override)
  const handleSafetyAlert = (alertData) => {
    setSafetyAlert(alertData);
    setConsoleLog(`🚨 EMERGENCY SAFETY ALERT: ${alertData.message}`);

    // HIGH-PRIORITY AUDIO OVERRIDE: Instantly interrupt any ongoing voice synthesis!
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    // Announce high-priority emergency warning out loud
    const warningText = `Attention! Emergency Warning! ${alertData.message}`;
    currentSpeechTextRef.current = warningText;
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(warningText));
    utterance.rate = 1.05;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
  };

  // Vision Action: Scan Counter Ingredients
  const handleScanCounter = async () => {
    if (isScanningCounter) return;
    setIsScanningCounter(true);
    setError("");
    setConsoleLog(`${companionName.toUpperCase()}: SCANNING KITCHEN COUNTER INGREDIENTS...`);
    try {
      const res = await fetch(`${BASE_URL}/assistant/scan-counter`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Scan counter failed");
      const data = await res.json();
      setScanResult(data);

      if (data.ingredients && data.ingredients.length > 0) {
        const speech = `I identified these ingredients on your counter: ${data.ingredients.join(", ")}.`;
        speakText(speech);
        setMessages((prev) => [
          ...prev,
          {
            role: "chef",
            content: `🔍 **Counter Ingredients Identified**:\n${data.ingredients.map((ing) => `- ${ing}`).join("\n")}`
          }
        ]);
        setConsoleLog(`${companionName.toUpperCase()}: IDENTIFIED ${data.ingredients.length} COUNTER INGREDIENTS.`);
      } else {
        const speech = data.error || "I couldn't spot any clear ingredients on your counter right now.";
        speakText(speech);
        setConsoleLog(`${companionName.toUpperCase()}: NO COUNTER INGREDIENTS DETECTED.`);
      }
    } catch (err) {
      console.error("Scan counter error:", err);
      setConsoleLog("SYSTEM ERROR: COUNTER SCAN FAILED.");
      setError("Failed to scan counter ingredients.");
    } finally {
      setIsScanningCounter(false);
    }
  };

  // Vision Action: Check Doneness Status
  const handleCheckDoneness = async () => {
    if (isCheckingDoneness) return;
    setIsCheckingDoneness(true);
    setError("");
    const currentRecipe = jarvisRecipeRef.current;
    const currentStep = currentRecipe?.instructions?.[activeStepIndexRef.current] || "current step";

    setConsoleLog(`${companionName.toUpperCase()}: CHECKING VISUAL DONENESS STATUS...`);
    try {
      const res = await fetch(`${BASE_URL}/assistant/check-doneness`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expected_state: currentStep,
          recipe_title: currentRecipe?.recipe_name,
          step_description: currentStep
        })
      });
      if (!res.ok) throw new Error("Check doneness failed");
      const data = await res.json();
      setDonenessResult(data);

      if (data.advice) {
        speakText(data.advice);
        setMessages((prev) => [
          ...prev,
          {
            role: "chef",
            content: `🍳 **Visual Doneness Check (${data.is_ready ? "✅ Ready!" : "⏳ Needs More Time"})**:\n${data.advice}`
          }
        ]);
        setConsoleLog(`${companionName.toUpperCase()}: DONENESS EVALUATION COMPLETED.`);
      }
    } catch (err) {
      console.error("Check doneness error:", err);
      setConsoleLog("SYSTEM ERROR: DONENESS EVALUATION FAILED.");
      setError("Failed to evaluate visual doneness.");
    } finally {
      setIsCheckingDoneness(false);
    }
  };

  // Kitchen companion separate voice-only request handler
  const handleSendVoiceMessage = async (queryText) => {
    const query = queryText.trim();
    if (!query) return;

    setError("");
    setLoading(true);
    setConsoleLog(`${companionName.toUpperCase()}: INTERPRETING VOICE TELEMETRY...`);
    setLastVoiceTranscript(query);
    setInput("");

    try {
      // Map voice history for API
      const formattedHistory = voiceHistory.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${BASE_URL}/assistant/jarvis`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: query,
          client_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          history: formattedHistory,
          language: assistantLangRef.current,
          active_recipe_title: jarvisRecipeRef.current?.recipe_name || null,
          current_step_number: jarvisRecipeRef.current ? activeStepIndexRef.current + 1 : null,
          current_step_description: jarvisRecipeRef.current?.instructions?.[activeStepIndexRef.current] || null
        })
      });

      if (!response.ok) {
        throw new Error("Jarvis API call failed");
      }

      const data = await response.json();
      
      if (data.is_new_recipe) {
        setJarvisRecipe(data);
        setActiveStepIndex(0);
        setIsCooked(false);
        if (data.nutrition) {
          setNutritionData(data.nutrition);
        }
      }

      // Maintain a brief transient history (max 3 turns / 6 messages)
      setVoiceHistory((prev) => {
        const nextHist = [
          ...prev,
          { role: "user", content: query },
          { role: "assistant", content: data.voice_greeting || data.recipe_name }
        ];
        return nextHist.slice(-6);
      });

      // Log voice interaction to main chat log
      setMessages((prev) => [
        ...prev,
        { role: "user", content: query },
        { role: "chef", content: data.voice_greeting || (data.recipe_name ? `Let's make **${data.recipe_name}**!` : "") }
      ]);

      if (data.voice_greeting) {
        let greeting = data.voice_greeting;
        if (data.is_new_recipe && !greeting.toLowerCase().includes("steps")) {
          greeting += " Shall we go through the steps?";
        }
        speakText(greeting);
      } else if (data.recipe_name) {
        speakText(`I suggest ${data.recipe_name}! I have loaded the step-by-step instructions. Shall we go through the steps?`);
      }

    } catch (err) {
      console.error(err);
      setError(`${companionName} is temporarily unreachable.`);
      setConsoleLog("SYSTEM ERROR: COGNITIVE LINK FAILED.");
      if (isVoiceModeRef.current) {
        startListening();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompanionName = async () => {
    if (!companionName.trim()) return;
    setConsoleLog(`SYSTEM: SAVING COMPANION NAME '${companionName.toUpperCase()}'...`);
    try {
      const resProfile = await fetch(`${BASE_URL}/profile`, {
        headers: getAuthHeaders()
      });
      let currentProfile = {};
      if (resProfile.ok) {
        currentProfile = await resProfile.json();
      }
      
      const saveRes = await fetch(`${BASE_URL}/profile/save`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...currentProfile,
          companion_name: companionName
        })
      });
      
      if (saveRes.ok) {
        setConsoleLog(`SYSTEM: COMPANION NAME SYNCHRONIZED TO '${companionName.toUpperCase()}'.`);
        setMessages((prev) => [
          ...prev,
          {
            role: "chef",
            content: `🤖 System updated! Call me **${companionName}** from now on. What star ingredient are we cooking with today?`
          }
        ]);
      } else {
        throw new Error("Failed to save companion name");
      }
    } catch (err) {
      console.error(err);
      setConsoleLog("SYSTEM ERROR: FAILED TO SAVE COMPANION NAME.");
    }
  };

  const handleSaveLanguage = async (lang) => {
    setAssistantLang(lang);
    setConsoleLog(`SYSTEM: PERSISTING LANGUAGE CHOICE '${lang.toUpperCase()}'...`);
    try {
      const resProfile = await fetch(`${BASE_URL}/profile`, {
        headers: getAuthHeaders()
      });
      let currentProfile = {};
      if (resProfile.ok) {
        currentProfile = await resProfile.json();
      }
      
      const saveRes = await fetch(`${BASE_URL}/profile/save`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...currentProfile,
          language: lang
        })
      });
      
      if (saveRes.ok) {
        setConsoleLog(`SYSTEM: LANGUAGE CHOICE '${lang.toUpperCase()}' PERSISTED.`);
      } else {
        throw new Error("Failed to save language preference");
      }
    } catch (err) {
      console.error(err);
      setConsoleLog("SYSTEM ERROR: FAILED TO PERSIST LANGUAGE CHOICE.");
    }
  };

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setConsoleLog("SYSTEM WARNING: SPEECH RECOGNITION NOT SUPPORTED IN THIS BROWSER.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = assistantLangRef.current;

    recognition.onstart = () => {
      setIsListening(true);
      setConsoleLog(`${companionName.toUpperCase()}: LISTENING ACTIVELY...`);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart recognition if voice mode is active
      if (isVoiceModeRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.error("Restart error", err);
        }
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error", e);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      // Clear previous auto-submit timer
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Gather current transcripts
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();
      if (!activeText) return;

      let processedText = activeText;
      if (isSpeakingRef.current) {
        const userSpeech = extractUserSpeech(activeText, currentSpeechTextRef.current);
        if (userSpeech && userSpeech.trim().length > 1) {
          // Barge-in detected!
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
          currentSpeechTextRef.current = "";
          setConsoleLog(`USER INTERRUPTED: "${userSpeech}"`);
          processedText = userSpeech;
        } else {
          // Just echo, do not update input or set silence timer
          return;
        }
      }

      setInput(processedText);
      setConsoleLog(`USER (detecting): "${processedText}"`);

      // Set silence timer to auto-submit when the user pauses speaking (1.5 seconds)
      silenceTimeoutRef.current = setTimeout(() => {
        const queryText = transcriptRef.current;
        if (queryText && queryText.trim()) {
          // Stop mic recognition to prevent feedback
          recognition.stop();

          // Check for voice commands if Voice Mode is active and Jarvis has a recipe loaded
          if (isVoiceModeRef.current && jarvisRecipeRef.current) {
            const cleanQuery = queryText.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
            
            // Start walkthrough
            if (cleanQuery === "yes" || cleanQuery === "start" || cleanQuery === "sure" || cleanQuery === "lets go" || cleanQuery === "lets start" || cleanQuery === "go ahead") {
              setInput("");
              const currentRecipe = jarvisRecipeRef.current;
              const currentIdx = activeStepIndexRef.current;
              speakText(`Step ${currentIdx + 1}: ${currentRecipe.instructions[currentIdx]}. Did you do that? Let me know when you're done!`);
              setConsoleLog(`${companionName.toUpperCase()}: STARTING WALKTHROUGH - STEP 1`);
              return;
            }
            // Next step (done / i did that)
            if (
              cleanQuery === "done" || 
              cleanQuery === "i did that" || 
              cleanQuery === "i did it" || 
              cleanQuery === "completed" || 
              cleanQuery === "ready" || 
              cleanQuery === "next" || 
              cleanQuery === "next step" || 
              cleanQuery === "go to next step" || 
              cleanQuery === "forward"
            ) {
              setInput("");
              handleNextStep();
              return;
            }
            if (cleanQuery === "back" || cleanQuery === "previous" || cleanQuery === "previous step" || cleanQuery === "go back") {
              setInput("");
              handlePrevStep();
              return;
            }
            if (cleanQuery === "repeat" || cleanQuery === "repeat step" || cleanQuery === "read again" || cleanQuery === "say again" || cleanQuery === "replay") {
              setInput("");
              handleRepeatStep();
              return;
            }
            if (cleanQuery === "ingredients" || cleanQuery === "read ingredients" || cleanQuery === "ingredients list" || cleanQuery === "what are the ingredients") {
              setInput("");
              handleSpeakIngredients();
              return;
            }
            if (cleanQuery === "cook" || cleanQuery === "log cook" || cleanQuery === "i cooked this" || cleanQuery === "log cooking") {
              setInput("");
              handleCookRecipe();
              return;
            }
          }
          
          if (isVoiceModeRef.current) {
            handleSendVoiceMessage(queryText);
          } else {
            handleSendMessage(queryText);
          }
        }
      }, 1500);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Update recognition language dynamically when assistantLang changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = assistantLang;
      if (isListening) {
        recognitionRef.current.stop();
        // Will auto-restart in onend with the new language
      }
    }
  }, [assistantLang]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Recognition already active
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Recognition already inactive
      }
    }
  };

  // Triggered when Voice Mode is toggled
  const toggleVoiceMode = () => {
    const targetState = !isVoiceMode;
    setIsVoiceMode(targetState);

    if (targetState) {
      setConsoleLog("SYSTEM: HANDS-FREE VOICE DECK ACTIVE.");
      startListening();
    } else {
      setConsoleLog("SYSTEM: STANDING BY.");
      stopListening();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  };

  // Send Message backend handler
  const handleSendMessage = async (textToSend) => {
    const query = textToSend.trim();
    if (!query) return;

    // Intercept walkthrough text commands if a recipe is active:
    if (jarvisRecipeRef.current) {
      const cleanQuery = query.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      
      // Start walkthrough
      if (cleanQuery === "yes" || cleanQuery === "start" || cleanQuery === "sure" || cleanQuery === "lets go" || cleanQuery === "lets start" || cleanQuery === "go ahead") {
        setInput("");
        const currentRecipe = jarvisRecipeRef.current;
        const currentIdx = activeStepIndexRef.current;
        
        const userMsg = { role: "user", content: query };
        const systemResponse = {
          role: "chef",
          content: `🍳 **Step ${currentIdx + 1}**: ${currentRecipe.instructions[currentIdx]}\n\nDid you do that? Let me know when you're done!`
        };
        setMessages((prev) => [...prev, userMsg, systemResponse]);
        speakText(`Step ${currentIdx + 1}: ${currentRecipe.instructions[currentIdx]}. Did you do that? Let me know when you're done!`);
        setConsoleLog(`${companionName.toUpperCase()}: STARTING WALKTHROUGH - STEP 1`);
        return;
      }
      
      // Next step (done / i did that)
      if (
        cleanQuery === "done" || 
        cleanQuery === "i did that" || 
        cleanQuery === "i did it" || 
        cleanQuery === "completed" || 
        cleanQuery === "ready" || 
        cleanQuery === "next" || 
        cleanQuery === "next step" || 
        cleanQuery === "go to next step" || 
        cleanQuery === "forward"
      ) {
        setInput("");
        
        const currentRecipe = jarvisRecipeRef.current;
        const currentIdx = activeStepIndexRef.current;
        
        const userMsg = { role: "user", content: query };
        
        if (currentIdx < currentRecipe.instructions.length - 1) {
          const nextIdx = currentIdx + 1;
          setActiveStepIndex(nextIdx);
          
          const systemResponse = {
            role: "chef",
            content: `🍳 **Step ${nextIdx + 1}**: ${currentRecipe.instructions[nextIdx]}\n\nDid you do that? Let me know when you're done!`
          };
          setMessages((prev) => [...prev, userMsg, systemResponse]);
          speakText(`Step ${nextIdx + 1}: ${currentRecipe.instructions[nextIdx]}. Did you do that? Let me know when you're done!`);
          setConsoleLog(`${companionName.toUpperCase()}: READING STEP ${nextIdx + 1}`);
        } else {
          const systemResponse = {
            role: "chef",
            content: `🎉 **Awesome!** You have completed all steps. Enjoy your meal!`
          };
          setMessages((prev) => [...prev, userMsg, systemResponse]);
          speakText("Awesome, you have completed all steps! Enjoy your meal!");
          setConsoleLog(`${companionName.toUpperCase()}: INSTRUCTIONS COMPLETED.`);
        }
        return;
      }
      
      // Previous step
      if (cleanQuery === "back" || cleanQuery === "previous" || cleanQuery === "previous step" || cleanQuery === "go back") {
        setInput("");
        const currentRecipe = jarvisRecipeRef.current;
        const currentIdx = activeStepIndexRef.current;
        
        const userMsg = { role: "user", content: query };
        
        if (currentIdx > 0) {
          const prevIdx = currentIdx - 1;
          setActiveStepIndex(prevIdx);
          
          const systemResponse = {
            role: "chef",
            content: `🍳 **Step ${prevIdx + 1}**: ${currentRecipe.instructions[prevIdx]}\n\nDid you do that? Let me know when you're done!`
          };
          setMessages((prev) => [...prev, userMsg, systemResponse]);
          speakText(`Step ${prevIdx + 1}: ${currentRecipe.instructions[prevIdx]}. Did you do that? Let me know when you're done!`);
          setConsoleLog(`${companionName.toUpperCase()}: READING STEP ${prevIdx + 1}`);
        } else {
          const systemResponse = {
            role: "chef",
            content: `This is the first step!`
          };
          setMessages((prev) => [...prev, userMsg, systemResponse]);
          speakText("This is the first step!");
        }
        return;
      }
      
      // Repeat step
      if (cleanQuery === "repeat" || cleanQuery === "repeat step" || cleanQuery === "read again" || cleanQuery === "say again" || cleanQuery === "replay") {
        setInput("");
        const currentRecipe = jarvisRecipeRef.current;
        const currentIdx = activeStepIndexRef.current;
        
        const userMsg = { role: "user", content: query };
        const systemResponse = {
          role: "chef",
          content: `🍳 **Repeating Step ${currentIdx + 1}**: ${currentRecipe.instructions[currentIdx]}\n\nDid you do that? Let me know when you're done!`
        };
        setMessages((prev) => [...prev, userMsg, systemResponse]);
        speakText(`Repeating step ${currentIdx + 1}: ${currentRecipe.instructions[currentIdx]}. Did you do that? Let me know when you're done!`);
        setConsoleLog(`${companionName.toUpperCase()}: REPEATING STEP ${currentIdx + 1}`);
        return;
      }
    }

    setError("");
    setLoading(true);
    setConsoleLog("SYSTEM: DISPATCHING TELEMETRY COMMAND...");
    
    // Clear display input immediately
    setInput("");

    // Add User message to log
    const userMessage = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Map history for API
      const chatHistory = messages.map((m) => ({
        role: m.role === "chef" ? "assistant" : "user",
        content: m.content
      }));

      const response = await fetch(`${BASE_URL}/assistant/chat`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: query,
          history: chatHistory,
          language: assistantLangRef.current,
          active_recipe_title: jarvisRecipe?.recipe_name || null,
          active_recipe_ingredients: jarvisRecipe?.ingredients || [],
          active_recipe_steps: jarvisRecipe?.instructions || [],
          current_step_number: activeStepIndex + 1,
          current_step_description: jarvisRecipe?.instructions?.[activeStepIndex] || null
        })
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = await response.json();
      const responseText = data.response || data.response_text || data.voice_greeting || "No response received.";
      
      const chefResponse = {
        role: "chef",
        content: responseText
      };

      setMessages((prev) => [...prev, chefResponse]);

      // Scan response for nutritional info
      const extracted = extractNutrition(responseText);
      if (extracted) {
        setNutritionData(extracted);
      }

      // Check if backend returned a new recipe or recipe action
      const recipeData = data.recipe_action || data.recipe || (data.is_new_recipe ? data : null);
      if (recipeData && (recipeData.recipe_name || recipeData.name) && recipeData.instructions && recipeData.instructions.length > 0) {
        const dishName = recipeData.recipe_name || recipeData.name;
        console.log("🍳 UPDATING ACTIVE RECIPE DECK:", dishName);
        
        const formattedRecipe = {
          recipe_name: dishName,
          ingredients: recipeData.ingredients || [],
          instructions: recipeData.instructions || [],
          nutrition: recipeData.nutrition || { calories: recipeData.calories || "350 kcal", protein: "25g", carbs: "15g", fat: "12g" },
          health_benefits: recipeData.health_benefits || `Nutritious and easy to prepare!`,
          voice_greeting: recipeData.voice_greeting || responseText
        };

        setJarvisRecipe(formattedRecipe);
        setActiveStepIndex(0);
        setIsCooked(false);
        setConsoleLog(`JARVIS: ACTIVATED RECIPE DECK -> ${dishName.toUpperCase()}`);

        if (isVoiceModeRef.current && formattedRecipe.instructions.length > 0) {
          speakText(`Let's make ${dishName}! Step 1: ${formattedRecipe.instructions[0]}`);
        } else if (isVoiceModeRef.current) {
          speakText(responseText);
        }
      } else {
        if (isVoiceModeRef.current) {
          speakText(responseText);
        } else {
          setConsoleLog("SYSTEM: COMPLETED INQUIRY.");
        }
      }

    } catch (err) {
      console.error(err);
      setError("Chef is currently unavailable. Please check your connection or try again.");
      setConsoleLog("SYSTEM ERROR: TELEMETRY RETRIEVAL FAILURE.");
      if (isVoiceModeRef.current) {
        startListening();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    // Stop listening during processing if active
    if (isVoiceMode) {
      stopListening();
    }
    if (isVoiceMode) {
      handleSendVoiceMessage(input);
    } else {
      handleSendMessage(input);
    }
  };

  // Quick action chips
  const quickChips = [
    { label: "Spicy & High Protein 🌶️", text: "I want something spicy and high in protein!" },
    { label: "Quick 10-Minute Meals ⏱️", text: "Suggest a quick 10-minute meal I can make." },
    { label: "Use expiring veggies 🥬", text: "What can I cook to use up my expiring vegetables?" },
    { label: "Pantry Staples Only 🥚", text: "Suggest a simple recipe using only basic pantry staples." }
  ];

  // Dynamic voice status state text
  const getVoiceStateLabel = () => {
    if (isSpeaking) return "SPEAKING";
    if (loading) return "PROCESSING";
    if (isListening) return "LISTENING";
    return "IDLE";
  };

  if (!currentUser) {
    return (
      <div className="assistant-page">
        <p style={{ padding: "2rem", textAlign: "center" }}>
          Please log in to chat with the Chef Assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="assistant-page-container">
      {/* 🚨 URGENT SAFETY ALERT BANNER */}
      {safetyAlert && (
        <div className="safety-alert-banner" style={{ gridColumn: "1 / -1" }}>
          <div className="safety-alert-content">
            <span className="safety-alert-icon">🚨</span>
            <div>
              <strong>EMERGENCY SAFETY WARNING ({safetyAlert.hazard_type || "STOVETOP HAZARD"})</strong>
              <p>{safetyAlert.message}</p>
            </div>
          </div>
          <button onClick={() => setSafetyAlert(null)} className="safety-dismiss-btn">
            Dismiss
          </button>
        </div>
      )}

      {/* LEFT COLUMN: Conversational Chat logs */}
      <div className="chat-section">
        {/* Header */}
        <div className="assistant-header">
          <div>
            <h1>🤖 {companionName}</h1>
            <p className="assistant-subtitle">Your warm & friendly AI kitchen companion</p>
          </div>
          <div className="assistant-status">
            <span className="status-dot"></span>
            <span>{companionName} is Online</span>
          </div>
        </div>

        {/* Quick Chips */}
        <div className="chips-container">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className="action-chip"
              onClick={() => handleSendMessage(chip.text)}
              disabled={loading}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat Logs Window */}
        <div className="chat-window">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble-wrapper ${msg.role}`}>
              <div className="chat-bubble">
                <MarkdownRenderer text={msg.content} />
              </div>
            </div>
          ))}

          {/* Loading typing indicator */}
          {loading && (
            <div className="chat-bubble-wrapper chef">
              <div className="chat-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <p className="error-message-alert">{error}</p>}

        {/* Text Input Submit Form */}
        <form className="chat-input-bar" onSubmit={handleFormSubmit}>
          <input
            type="text"
            placeholder={isListening ? "Listening... speak now or type query..." : "Ask the chef what to make..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={loading || !input.trim()}
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Jarvis holographic cockpit controls & metrics */}
      <div className="cockpit-section">
        {/* Voice Frequency visualizer / core clicker */}
        <div className="jarvis-panel jarvis-central">
          <div className="jarvis-stage-heading">
            <span>VOICE COCKPIT DECK</span>
          </div>

          <div
            className={`holo-ring-container ${isListening ? "active" : ""}`}
            onClick={toggleVoiceMode}
            title="Click to toggle Voice Mode"
          >
            <div className="holo-circle"></div>
            <div className="holo-circle-inner"></div>
            <div className="holo-core">
              {isListening ? "🎤" : isSpeaking ? "🔊" : "🎙️"}
            </div>
          </div>

          {/* Holographic Sound Wave bars */}
          <div className={`audio-waves ${isSpeaking ? "speaking" : isListening ? "listening" : ""}`}>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
          </div>

          <div className="cockpit-indicator-badge">
            STATUS: <span className={isListening || isSpeaking ? "status-glow" : ""}>{getVoiceStateLabel()}</span>
          </div>
        </div>

        {/* Time telemetry widget */}
        {jarvisRecipe ? (
          /* Active Recipe Dashboard replacing standard widgets */
          <div className="jarvis-panel jarvis-recipe-deck">
            <div className="jarvis-stage-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span>ACTIVE RECIPE DECK</span>
              <button 
                type="button"
                onClick={() => {
                  setJarvisRecipe(null);
                  setLastVoiceTranscript("");
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                }}
                className="clear-recipe-btn"
                title="Exit Walkthrough"
              >
                ✕
              </button>
            </div>
            
            <h2 className="jarvis-recipe-title">{jarvisRecipe.recipe_name}</h2>

            {jarvisRecipe.health_benefits && (
              <p className="jarvis-recipe-benefits">
                💡 {jarvisRecipe.health_benefits}
              </p>
            )}

            {/* Nutrition Compact Panel */}
            {jarvisRecipe.nutrition && (
              <div className="nutrition-grid-compact">
                <div className="nutrition-card-compact">
                  <div className="val">{jarvisRecipe.nutrition.calories}</div>
                  <div className="lbl">CALORIES</div>
                </div>
                <div className="nutrition-card-compact">
                  <div className="val">{jarvisRecipe.nutrition.protein}</div>
                  <div className="lbl">PROTEIN</div>
                </div>
                <div className="nutrition-card-compact">
                  <div className="val">{jarvisRecipe.nutrition.carbs}</div>
                  <div className="lbl">CARBS</div>
                </div>
                <div className="nutrition-card-compact">
                  <div className="val">{jarvisRecipe.nutrition.fat}</div>
                  <div className="lbl">FAT</div>
                </div>
              </div>
            )}

            <div className="recipe-section-title">INGREDIENTS CHECKLIST</div>
            <ul className="jarvis-ingredients-checklist">
              {jarvisRecipe.ingredients.map((ing, idx) => (
                <li key={idx} className="ingredient-item">
                  <input type="checkbox" id={`ing-${idx}`} />
                  <label htmlFor={`ing-${idx}`}>{ing}</label>
                </li>
              ))}
            </ul>
            <button 
              type="button"
              onClick={handleSpeakIngredients} 
              className="read-ingredients-btn"
            >
              🔊 Read ingredients out loud
            </button>

            <div className="recipe-section-title" style={{ marginTop: "1rem" }}>WALKTHROUGH CONTROLS</div>
            <div className="step-glow-box">
              <div className="step-badge">STEP {activeStepIndex + 1} OF {jarvisRecipe.instructions.length}</div>
              <p className="step-instruction-text">
                {jarvisRecipe.instructions[activeStepIndex]}
              </p>
            </div>

            <div className="step-controls">
              <button 
                type="button"
                onClick={handlePrevStep} 
                disabled={activeStepIndex === 0} 
                className="step-btn"
              >
                ◀ BACK
              </button>
              <button 
                type="button"
                onClick={handleRepeatStep} 
                className="step-btn repeat-btn"
              >
                🔊 REPEAT
              </button>
              <button 
                type="button"
                onClick={handleNextStep} 
                disabled={activeStepIndex === jarvisRecipe.instructions.length - 1}
                className="step-btn next-btn"
              >
                NEXT ▶
              </button>
            </div>

            <button
              type="button"
              onClick={handleCookRecipe}
              disabled={cookLoading || isCooked}
              className={`cook-log-btn ${isCooked ? "cooked" : ""}`}
            >
              {cookLoading ? "LOGGING MEAL..." : isCooked ? "✓ Cooked & Logged to History" : "🍳 Cook & Log Recipe"}
            </button>
          </div>
        ) : (
          /* Standard Telemetry Panels when no recipe is active */
          <>
            {/* Time telemetry widget */}
            <div className="jarvis-panel jarvis-time-alert">
              <div className="jarvis-time-alert-title">{timeOfDayContext.title}</div>
              <p style={{ margin: "2px 0 0 0", color: "#cbd5e1", fontSize: "0.85rem" }}>{timeOfDayContext.description}</p>
              <div style={{ fontSize: "0.75rem", color: "#00f0ff", marginTop: "8px", fontWeight: "600" }}>
                TELEMETRY CLOCK: {currentTimeStr}
              </div>
            </div>

            {/* Nutritonal analysis widget updated from recipe chats */}
            <div className="jarvis-panel">
              <div className="jarvis-stage-heading" style={{ marginBottom: "0.75rem" }}>
                <span>NUTRITIONAL CALCULATIONS</span>
              </div>
              {nutritionData ? (
                <div className="nutrition-grid">
                  <div className="nutrition-card">
                    <div className="nutrition-val">{nutritionData.calories}</div>
                    <div className="nutrition-lbl">CALORIES</div>
                  </div>
                  <div className="nutrition-card">
                    <div className="nutrition-val">{nutritionData.protein}</div>
                    <div className="nutrition-lbl">PROTEIN</div>
                  </div>
                  <div className="nutrition-card">
                    <div className="nutrition-val">{nutritionData.carbs}</div>
                    <div className="nutrition-lbl">CARBS</div>
                  </div>
                  <div className="nutrition-card">
                    <div className="nutrition-val">{nutritionData.fat}</div>
                    <div className="nutrition-lbl">FAT</div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.82rem", fontStyle: "italic", padding: "10px 0" }}>
                  Ready to analyze incoming recipes.
                </div>
              )}
            </div>



            {/* Speech configuration sliders & voice selectors */}
            <div className="jarvis-panel">
              <div className="jarvis-stage-heading" style={{ marginBottom: "0.75rem" }}>
                <span>SPEECH PREFERENCES</span>
              </div>
              <div className="speech-config-group">
                <div className="speech-config-item">
                  <label htmlFor="companion-name-select">COMPANION NAME</label>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px", marginBottom: "8px" }}>
                    <input
                      id="companion-name-select"
                      type="text"
                      value={companionName}
                      onChange={(e) => setCompanionName(e.target.value)}
                      placeholder="Jarvis"
                      style={{
                        flex: 1,
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(0, 240, 255, 0.2)",
                        borderRadius: "8px",
                        color: "#f8fafc",
                        padding: "6px 10px",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveCompanionName}
                      style={{
                        background: "rgba(0, 240, 255, 0.1)",
                        border: "1px solid #00f0ff",
                        borderRadius: "8px",
                        color: "#00f0ff",
                        padding: "6px 12px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "all 0.2s"
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="speech-config-item">
                  <label htmlFor="language-select">INTERACTION LANGUAGE</label>
                  <select
                    id="language-select"
                    value={assistantLang}
                    onChange={(e) => handleSaveLanguage(e.target.value)}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="hi-IN">Hindi (हिन्दी)</option>
                  </select>
                </div>

                <div className="speech-config-item">
                  <label htmlFor="voice-select">SYNTHESIS ENGINE</label>
                  <select
                    id="voice-select"
                    value={selectedVoice ? selectedVoice.name : ""}
                    onChange={(e) => {
                      const found = voices.find((v) => v.name === e.target.value);
                      if (found) setSelectedVoice(found);
                    }}
                  >
                    {voices.length === 0 ? (
                      <option>Local Browser voices loading...</option>
                    ) : (
                      voices.map((v, idx) => (
                        <option key={idx} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="speech-config-item">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                    <label htmlFor="speed-range">SPEAKING RATE</label>
                    <span style={{ color: "#00f0ff" }}>{speechRate}x</span>
                  </div>
                  <input
                    id="speed-range"
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  />
                </div>

                <div className="speech-config-item" style={{ marginTop: "6px", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: "600", textTransform: "uppercase", color: "#94a3b8" }}>
                    Hands-Free Voice Mode
                  </span>
                  <button
                    type="button"
                    className={`voice-mode-toggle-switch-btn ${isVoiceMode ? "switch-active" : ""}`}
                    onClick={toggleVoiceMode}
                  >
                    {isVoiceMode ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Subtitles Overlay Panel */}
        {lastVoiceTranscript && (
          <div className="jarvis-panel jarvis-subtitles-panel">
            <div className="telemetry-log-heading">[{companionName.toUpperCase()} TRANSCRIPT STREAM]</div>
            <div style={{ color: "#cbd5e1", fontSize: "0.8rem", marginBottom: "4px" }}>
              <span style={{ color: "#00f0ff", fontWeight: "bold" }}>USER:</span> "{lastVoiceTranscript}"
            </div>
            {jarvisRecipe && (
              <div style={{ color: "#a0aec0", fontSize: "0.8rem", lineHeight: "1.4" }}>
                <span style={{ color: "#ff007f", fontWeight: "bold" }}>{companionName.toUpperCase()}:</span> "{jarvisRecipe.voice_greeting}"
              </div>
            )}
          </div>
        )}

        {/* Real-time system console logs */}
        <div className="console-telemetry-container">
          <div className="telemetry-log-heading">[SYSTEM TELEMETRY]</div>
          <div className="telemetry-log-body">{consoleLog}</div>
        </div>
      </div>
    </div>
  );
}
