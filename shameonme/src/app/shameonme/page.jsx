'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import Anthropic from '@anthropic-ai/sdk';
import Sound from './sound';
const Page = () => {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [descriptions, setDescriptions] = useState([]);
  const [error, setError] = useState(null);
  const [anthropicClient, setAnthropicClient] = useState(null);
  const [keywordFound, setKeywordFound] = useState(false);
  const [testSound, setTestSound] = useState(null);
  const [audio, setAudio] = useState(null);

  // Initialize Anthropic client
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    console.log('API Key available:', !!apiKey);

    if (!apiKey) {
      console.error('Anthropic API key is not set in environment variables');
      setError('API key not configured. Please check your environment variables.');
      return;
    }

    const client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    
    setAnthropicClient(client);
  }, []);

  const playElevenLabsAudio = async () => {
    try {
      console.log('Attempting to play ElevenLabs audio...');
      console.log('API Key available:', !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY);
      
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: "Opening the fridge again you fatty?",
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        throw new Error(`Failed to generate audio: ${response.status} ${errorText}`);
      }
      
      console.log('Audio response received, creating blob...');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Audio URL created:', audioUrl);
      
      const newAudio = new Audio(audioUrl);
      console.log('Audio element created, attempting to play...');
      
      // Add event listeners for debugging
      newAudio.addEventListener('playing', () => console.log('Audio started playing'));
      newAudio.addEventListener('error', (e) => console.error('Audio playback error:', e));
      newAudio.addEventListener('ended', () => console.log('Audio playback ended'));
      
      setAudio(newAudio);
      await newAudio.play();
      console.log('Audio play() called successfully');
    } catch (error) {
      console.error('Error in playElevenLabsAudio:', error);
    }
  };

  const analyzeImage = async (imageData) => {
    if (!imageData || !anthropicClient) {
      console.error('No image data provided or Anthropic client not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const base64Data = imageData.split(',')[1];
      
      console.log('Sending image to Claude for analysis...');
      const response = await anthropicClient.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "I am a witty, slightly sarcastic inner voice observing the user's actions through a camera feed. Using the provided image, describe what I see in a concise, first-person perspective (1-2 sentences). Focus on the key objects or actions in the scene and weave in a cheeky tone that reflects the user's habits."
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        temperature: 0.7,
      });

      if (!response.content || !response.content[0]?.text) {
        throw new Error('Invalid response from Claude API');
      }

      const newDescription = response.content[0].text;
      console.log('Received description from Claude:', newDescription);
      setDescription(newDescription);
      
      // Store in local state
      const timestamp = new Date().toISOString();
      const newDescriptionObj = { timestamp, description: newDescription };
      console.log('Adding new description:', newDescriptionObj);
      setDescriptions(prev => [...prev, newDescriptionObj]);

      // Check for waterbottle keyword
      const hasWaterBottle = newDescription.toLowerCase().includes('waterbottle');
      
      if (hasWaterBottle) {
        setKeywordFound(true);
        await playElevenLabsAudio();
      } else {
        setKeywordFound(false);
      }

    } catch (error) {
      console.error('Error analyzing image:', error);
      setError(error.message || 'Error analyzing image. Please try again.');
      setDescription('Error analyzing image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-capture every 2 seconds
  useEffect(() => {
    if (!anthropicClient) return;
    
    console.log('Starting auto-capture interval...');
    const interval = setInterval(() => {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          setImgSrc(imageSrc);
          analyzeImage(imageSrc);
        }
      }
    }, 2000);

    return () => {
      console.log('Cleaning up auto-capture interval...');
      clearInterval(interval);
    };
  }, [anthropicClient]);

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Real-time Image Analyzer</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {keywordFound && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center text-xl font-bold">
            KEY WORD FOUND: Water Bottle Detected!
          </div>
        )}
        
        {!error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full rounded-lg shadow-lg"
                videoConstraints={{
                  width: 640,
                  height: 480,
                  facingMode: "user"
                }}
              />
              <div className="bg-white p-4 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-2">Current Analysis:</h2>
                {isLoading ? (
                  <p className="text-gray-600">Analyzing image...</p>
                ) : (
                  <>
                    <p className="text-gray-700">{description || 'Waiting for analysis...'}</p>
                    {description && <Sound text={description} />}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-2">Recent Descriptions:</h2>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {descriptions.slice().reverse().map((item, index) => (
                    <div key={index} className="border-b pb-2">
                      <p className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                      <p className="text-gray-700">{item.description}</p>
                      <Sound text={item.description} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;