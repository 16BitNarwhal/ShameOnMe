'use client';

import { useEffect, useRef } from 'react';

const Sound = ({ text }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    const generateSpeech = async () => {
      if (!text) return;

      try {
        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch(error => {
            console.error('Error playing audio:', error);
          });
        }
      } catch (error) {
        console.error('Error generating speech:', error);
      }
    };

    generateSpeech();

    // Cleanup function to revoke the object URL when component unmounts
    return () => {
      if (audioRef.current && audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, [text]);

  return (
    <audio ref={audioRef} className="hidden" />
  );
};

export default Sound;
