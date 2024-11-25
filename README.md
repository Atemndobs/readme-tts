### **ReadMe - Text to Speech Chrome Extension**

#### **Overview**
ReadMe is a powerful Chrome extension that converts text to speech with advanced audio management capabilities. It offers a seamless experience for users who want to listen to web content, featuring multi-language support, customizable voices, and an intuitive mini-player interface. The extension uses a secure cloud-based API for high-quality speech synthesis while maintaining robust error handling and context management.

---

### **Key Features**

#### **Text-to-Speech Conversion**
- **Smart Text Selection:** Convert selected text from any webpage directly to speech
- **Bulk Text Processing:** Handle large text chunks with automatic splitting and queuing
- **API Integration:** Secure cloud-based API integration with voice.cloud.atemkeng.de
- **Audio Queue Management:** Smart queuing system for handling multiple conversion requests

#### **Voice and Model Customization**
- **Multiple Languages:** Support for English (US/GB), German, French, Spanish, and Italian
- **Voice Selection:** Multiple voice options per language (e.g., Amy, Alan, Ryan, Kathleen for US English)
- **Model Quality:** Low and medium quality options for different bandwidth needs

#### **Advanced Audio Features**
- **Mini Player:** Floating mini-player with progress tracking and controls
- **Progress Tracking:** Visual progress indication for audio playback
- **Queue Management:** Efficient handling of multiple audio requests
- **Text Highlighting:** Synchronized text highlighting during playback

#### **User Interface**
- **Dark Mode:** System-aware dark mode with manual toggle option
- **Floating Window:** Detachable popup window for better usability
- **Settings Persistence:** Saves user preferences across sessions
- **Responsive Design:** Adapts to different window sizes and contexts

#### **Security & Performance**
- **Context Validation:** Continuous monitoring of extension context for security
- **Error Recovery:** Automatic cleanup and recovery from error states
- **Secure Communications:** HTTPS-only API communications
- **Resource Management:** Efficient cleanup of audio resources and UI elements

---

### **Technical Implementation**

#### **Core Components**
- **Content Script (`content.js`):** Handles webpage interaction, text selection, and mini-player
- **Popup Interface (`popup.js`):** Manages user interface and audio conversion workflow
- **Background Service:** Handles API communications and state management
- **Style Management:** Dedicated CSS for extension styling and dark mode

#### **API Integration**
- **Endpoint:** Secure connection to voice.cloud.atemkeng.de
- **Request Structure:**
  ```json
  {
    "model": "selected-model-id",
    "voice": "selected-voice-id",
    "input": "text-to-convert"
  }
  ```

#### **Audio Processing**
- **Chunk Processing:** Automatic text chunking for large content
- **Queue System:** FIFO queue for managing multiple audio requests
- **Progress Tracking:** Real-time progress monitoring and UI updates

---

### **Installation**

1. Download the extension files
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer Mode"
4. Click "Load Unpacked" and select the extension directory

---

### **Usage**

1. **Quick Convert:**
   - Select text on any webpage
   - Right-click and choose "Convert to Speech"
   - Listen through the mini-player

2. **Manual Convert:**
   - Click the extension icon
   - Enter or paste text
   - Select language and voice
   - Click "Convert"

3. **Settings:**
   - Access settings through the gear icon
   - Customize voice, model, and interface preferences
   - Toggle dark mode

---

### **Project Structure**
```
readme-tts/
├── manifest.json     # Extension configuration
├── popup.html       # Main interface
├── popup.js         # Core functionality
├── content.js       # Webpage interaction
├── background.js    # Background services
├── style.css        # Styling
└── icon/           # Extension icons
```

---

### **Future Enhancements**
- Offline processing capability
- Additional language support
- Custom voice training integration
- Browser-native audio download support
- Enhanced accessibility features

---

This extension represents a sophisticated approach to text-to-speech conversion, combining powerful features with a user-friendly interface. It's designed for both casual users and those requiring advanced audio management capabilities.