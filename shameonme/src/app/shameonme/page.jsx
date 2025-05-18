'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import Anthropic from '@anthropic-ai/sdk';
import { QdrantClient } from '@qdrant/js-client-rest';
import Sound from './sound';

const Page = () => {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [descriptions, setDescriptions] = useState([]);
  const [error, setError] = useState(null);
  const [useQdrant, setUseQdrant] = useState(false);
  const [anthropicClient, setAnthropicClient] = useState(null);
  const [testSound, setTestSound] = useState('');

  // Log descriptions whenever they change
  useEffect(() => {
    console.log('Current descriptions:', descriptions);
  }, [descriptions]);

  // Initialize Anthropic client
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    console.log('API Key available:', !!apiKey); // This will log true/false without exposing the key

    if (!apiKey) {
      console.error('Anthropic API key is not set in environment variables');
      setError('API key not configured. Please check your environment variables.');
      return;
    }

    // Create Anthropic client
    const client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    
    setAnthropicClient(client);
  }, []);

  // Initialize Qdrant client only if needed
  const qdrantClient = useQdrant ? new QdrantClient({ 
    url: process.env.NEXT_PUBLIC_QDRANT_URL || 'http://localhost:6333',
    checkCompatibility: false 
  }) : null;

  // Initialize Qdrant collection only if using Qdrant
  useEffect(() => {
    if (!useQdrant || !qdrantClient) return;

    const initQdrant = async () => {
      try {
        await qdrantClient.createCollection('image_descriptions', {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        });
        console.log('Qdrant collection initialized successfully');
      } catch (error) {
        console.log('Qdrant initialization error:', error);
        setUseQdrant(false);
      }
    };
    initQdrant();
  }, [useQdrant, qdrantClient]);

  const analyzeImage = async (imageData) => {
    if (!imageData || !anthropicClient) {
      console.error('No image data provided or Anthropic client not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Extract base64 data without the data URL prefix
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
                text: "I am a witty, slightly sarcastic inner voice observing the user's actions through a camera feed. Using the provided image, describe what I see in a concise, first-person perspective (1-2 sentences). Focus on the key objects or actions in the scene and weave in a cheeky tone that reflects the user's habits, drawing on context from the MCP memory server (e.g., frequency of similar actions) to make it playful and relevant."
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

      // Try to store in Qdrant if available
      if (useQdrant && qdrantClient) {
        try {
          await qdrantClient.upsert('image_descriptions', {
            points: [
              {
                id: timestamp,
                vector: new Array(1536).fill(0),
                payload: {
                  description: newDescription,
                  timestamp: timestamp,
                  image: imageData
                }
              }
            ]
          });
          console.log('Successfully stored in Qdrant');
        } catch (qdrantError) {
          console.error('Error storing in Qdrant:', qdrantError);
          setUseQdrant(false);
        }
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
    if (!anthropicClient) return; // Don't start auto-capture until Anthropic is initialized
    
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
  }, [anthropicClient]); // Re-run this effect when the Anthropic client changes

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Real-time Image Analyzer</h1>
        
        <div className="mb-8 flex justify-center">
          <button
            onClick={() => setTestSound('hello world')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Test Sound
          </button>
          {testSound && <Sound text={testSound} />}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
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