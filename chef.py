import cv2
import google.generativeai as genai
import os
import tkinter as tk
from tkinter import scrolledtext
from PIL import Image, ImageTk
import threading
import time

# Configure the Gemini API with your API key
# You need to get an API key from Google AI Studio: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY = "AIzaSyD74CzOVX_y3g7GK5uIJzKlzR_qx0v2WSo"  # Replace with your actual API key
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')

class ObjectDetectionApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Object Detection with Gemini")
        self.root.geometry("800x600")
        
        # Create frames
        self.video_frame = tk.Frame(root, width=640, height=480)
        self.video_frame.pack(side=tk.LEFT, padx=10, pady=10)
        
        self.chat_frame = tk.Frame(root)
        self.chat_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Video canvas
        self.canvas = tk.Canvas(self.video_frame, width=640, height=480)
        self.canvas.pack()
        
        # Chat display
        self.chat_label = tk.Label(self.chat_frame, text="Detected Objects:")
        self.chat_label.pack(anchor=tk.W)
        
        self.chat_box = scrolledtext.ScrolledText(self.chat_frame, width=30, height=20, wrap=tk.WORD)
        self.chat_box.pack(fill=tk.BOTH, expand=True)
        
        # Buttons
        self.button_frame = tk.Frame(self.chat_frame)
        self.button_frame.pack(fill=tk.X, pady=10)
        
        self.scan_button = tk.Button(self.button_frame, text="Scan Objects", command=self.scan_objects)
        self.scan_button.pack(side=tk.LEFT, padx=5)
        
        self.clear_button = tk.Button(self.button_frame, text="Clear Chat", command=self.clear_chat)
        self.clear_button.pack(side=tk.LEFT, padx=5)
        
        # Initialize webcam
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            self.add_message("Error: Could not open webcam")
        
        # Start video stream
        self.is_running = True
        self.update_thread = threading.Thread(target=self.update_video)
        self.update_thread.daemon = True
        self.update_thread.start()
        
        # For storing the current frame
        self.current_frame = None
        
        # Flag to prevent multiple scans at once
        self.is_scanning = False
    
    def update_video(self):
        while self.is_running:
            ret, frame = self.cap.read()
            if ret:
                # Convert colors from BGR to RGB
                self.current_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(self.current_frame)
                img = ImageTk.PhotoImage(image=img)
                
                self.canvas.create_image(0, 0, anchor=tk.NW, image=img)
                self.canvas.image = img  # Keep a reference
            time.sleep(0.03)  # ~30 FPS
    
    def scan_objects(self):
        if self.is_scanning:
            return
        
        if self.current_frame is None:
            self.add_message("Error: No camera feed available")
            return
        
        self.is_scanning = True
        self.scan_button.config(state=tk.DISABLED)
        self.add_message("Scanning objects...")
        
        # Run the API call in a separate thread to avoid freezing the UI
        threading.Thread(target=self.process_image).start()
    
    def process_image(self):
        try:
            # Save the current frame temporarily
            temp_img_path = "temp_scan.jpg"
            cv2.imwrite(temp_img_path, cv2.cvtColor(self.current_frame, cv2.COLOR_RGB2BGR))
            
            # Open and process the image within a context manager
            with Image.open(temp_img_path) as image:
                # Generate content with Gemini
                prompt = "List only the edible items (food and beverages) you can see in this image. Format the response as a bulleted list. If no edible items are visible, respond with 'No edible items detected.'"
                response = model.generate_content([prompt, image])
                
                # Display the response
                self.add_message("\nDetected Edible Items:")
                self.add_message(response.text)
            
            # Clean up after the image is properly closed
            try:
                os.remove(temp_img_path)
            except OSError:
                # If file is still locked, schedule it for deletion on next scan
                pass
            
        except Exception as e:
            self.add_message(f"Error during scanning: {str(e)}")
        
        finally:
            self.is_scanning = False
            self.root.after(0, lambda: self.scan_button.config(state=tk.NORMAL))
    
    def add_message(self, message):
        self.chat_box.configure(state=tk.NORMAL)
        self.chat_box.insert(tk.END, message + "\n")
        self.chat_box.see(tk.END)
        self.chat_box.configure(state=tk.DISABLED)
    
    def clear_chat(self):
        self.chat_box.configure(state=tk.NORMAL)
        self.chat_box.delete(1.0, tk.END)
        self.chat_box.configure(state=tk.DISABLED)
    
    def on_closing(self):
        self.is_running = False
        if self.cap.isOpened():
            self.cap.release()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = ObjectDetectionApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
