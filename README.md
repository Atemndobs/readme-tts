### **Text-to-Speech Converter Chrome Extension**

#### **Overview**
The Text-to-Speech Converter is a lightweight and user-friendly Chrome extension that converts written text into high-quality audio. This extension leverages an external API to perform text-to-speech synthesis, supporting multiple languages, voices, and models to cater to diverse user needs. The extension is equipped with features for voice and model selection, dark mode, and customizable playback options, offering a seamless experience for users who want to convert text into speech effortlessly.

---

### **Key Features**

#### **Text-to-Speech Conversion**
- **Input Text:** Users can input any text into the provided text area.
- **API Integration:** The extension sends the text to an external API for conversion into speech.
- **Audio Playback:** Generated audio is played directly within the extension, with controls for playback.

#### **Voice and Model Customization**
- **Voice Selection:** A dropdown menu lets users choose from a variety of voices (e.g., male, female, or neutral tones).
- **Model Selection:** Supports multiple language models, such as English (US, GB), German, Catalan, and more, with tailored voices for each model.

#### **Audio Management**
- **Multiple Outputs:** The extension supports generating and managing multiple audio outputs simultaneously.
- **Delete Option:** Users can remove specific audio files using a delete button.

#### **User Interface**
- **Dark Mode:** Toggle between light and dark themes for comfortable usage in varying lighting conditions.
- **Popup Window:** Includes an option to open the interface in a separate, resizable floating window.
- **Responsive Design:** Works seamlessly within the browser popup.

#### **Error Handling**
- Displays clear error messages if text input is empty or if the API request fails.

---

### **Technical Details**

#### **Manifest Configuration**
- **Permissions:** Requires storage permissions for saving settings and host permissions for API access.
- **Service Worker:** Background service worker (`background.js`) manages API communications.

#### **API Interaction**
- **Endpoint:** Uses the API at `http://45.94.111.107:6080/v1/audio/speech` for speech synthesis.
- **Request Structure:**
  - `model`: Specifies the selected speech model.
  - `input`: Text to be converted.
  - `voice`: Selected voice for the model.

#### **Dynamic Voice Management**
- Dynamically maps available voices to the selected model using a predefined configuration.
- Automatically updates the voice dropdown based on the chosen model.

#### **Dark Mode Implementation**
- **LocalStorage Support:** Remembers user preference for dark mode across sessions.
- **Toggle Button:** Allows users to switch between dark and light themes.

#### **Audio Output**
- **Blob Handling:** Converts the API response into a playable audio file using `URL.createObjectURL`.
- **Delete Functionality:** Provides a delete button for each audio file to manage outputs effectively.

---

### **Getting Started**

#### **Installation**
1. Download the extension files.
2. Open `chrome://extensions` in your Chrome browser.
3. Enable **Developer Mode**.
4. Click on **Load Unpacked** and select the extension folder.

#### **Usage**
1. Click on the extension icon in the Chrome toolbar to open the popup.
2. Enter text in the provided text area.
3. Select a model and voice from the dropdown menus.
4. Click **Convert to Speech** to generate audio.
5. Play, manage, or delete the audio outputs as needed.

---

### **File Structure**
- `manifest.json`: Configuration file for the Chrome extension.
- `popup.html`: User interface for the extension.
- `popup.js`: JavaScript logic for handling user input, API interaction, and UI functionality.
- `style.css`: Styles for the extension's popup.
- `icon/`: Folder containing icons for the extension.

---

### **Future Enhancements**
- Support for offline text-to-speech processing.
- Option to save generated audio files to the local system.
- More comprehensive error messages and diagnostics.
- Integration with additional APIs for expanded voice options.

---

This extension serves as an intuitive tool for converting text to speech, offering versatility in voice and language options, and a clean, modern interface.